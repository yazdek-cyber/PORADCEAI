-- Zapni pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Workspace (organizace) — příprava na multi-tenant. Zatím existuje jen výchozí.
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nazev TEXT NOT NULL,
  vytvoreno_kdy TIMESTAMPTZ DEFAULT NOW()
);

-- Výchozí workspace = první tenant (firma). Multitenant: každá firma má vlastní postupy,
-- produkty, klienty a plány přes workspace_id. eDO je první tenant, ne natvrdo v kódu.
INSERT INTO workspaces (id, nazev)
VALUES ('00000000-0000-0000-0000-000000000001', 'eDO')
ON CONFLICT (id) DO NOTHING;

-- Tabulka dokumentů. Tři nezávislé osy:
--   domena    = pilíř: pojisteni | uvery | investice | penze
--   pojistovna= POSKYTOVATEL (pojišťovna/banka/investiční či penzijní společnost/fond)
--   kategorie = ROLE v RAG: postup_firmy | metodika | produktove_podminky
CREATE TABLE IF NOT EXISTS dokumenty (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nazev TEXT NOT NULL,
  pojistovna TEXT,                       -- poskytovatel (pojišťovna/banka/správce/fond)
  domena TEXT NOT NULL DEFAULT 'pojisteni',
  kategorie TEXT NOT NULL DEFAULT 'produktove_podminky',
  nahrano_kdy TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pocet_chunku INTEGER DEFAULT 0,
  workspace_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Tabulka chunků s embeddingy
CREATE TABLE IF NOT EXISTS chunky (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dokument_id UUID REFERENCES dokumenty(id) ON DELETE CASCADE,
  obsah TEXT NOT NULL,
  embedding VECTOR(768),  -- gemini-embedding-001 s outputDimensionality=768
  strana INTEGER,
  poradi INTEGER,
  pojistovna TEXT,
  nazev_dokumentu TEXT,
  domena TEXT NOT NULL DEFAULT 'pojisteni',
  kategorie TEXT NOT NULL DEFAULT 'produktove_podminky',
  workspace_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS dokumenty_workspace_idx ON dokumenty (workspace_id);
CREATE INDEX IF NOT EXISTS chunky_workspace_idx ON chunky (workspace_id);

-- RLS zapnuté + zatím PERMISIVNÍ politika. Service_role klíč (server) ji obchází.
-- Připraveno na Supabase Auth: později se permisivní politiky nahradí dle workspace_id uživatele.
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE dokumenty ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunky ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permisivni_vse ON workspaces;
CREATE POLICY permisivni_vse ON workspaces FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS permisivni_vse ON dokumenty;
CREATE POLICY permisivni_vse ON dokumenty FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS permisivni_vse ON chunky;
CREATE POLICY permisivni_vse ON chunky FOR ALL USING (true) WITH CHECK (true);

-- Vyhledávání používá přesné (exact) KNN — pro malý/střední objem dat je to rychlé
-- a spolehlivé. HNSW index zde záměrně NENÍ (po hromadných UPDATech vracel pro
-- některé dotazy 0 řádků). Pro velký objem dat zvážit:
--   CREATE INDEX chunky_embedding_idx ON chunky USING hnsw (embedding vector_cosine_ops);
--   a po větších změnách REINDEX.

-- Funkce pro vyhledávání podobných chunků; volitelné filtry na pojišťovnu, workspace, doménu a kategorii.
-- POZOR: signatura (počet/typy parametrů) i RETURNS TABLE se v historii měnily. CREATE OR REPLACE
-- nedokáže změnit návratový typ ani nahradit funkci s jiným počtem parametrů (vytvořil by přetížení),
-- proto staré signatury napřed zahodíme — migrace je tak idempotentní a re-run na starší DB nespadne.
DROP FUNCTION IF EXISTS hledej_chunky(VECTOR(768), INTEGER, TEXT);
DROP FUNCTION IF EXISTS hledej_chunky(VECTOR(768), INTEGER, TEXT, UUID);
DROP FUNCTION IF EXISTS hledej_chunky(VECTOR(768), INTEGER, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS hledej_chunky(VECTOR(768), INTEGER, TEXT, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION hledej_chunky(
  dotaz_embedding VECTOR(768),
  pocet INTEGER DEFAULT 8,
  filtr_pojistovna TEXT DEFAULT NULL,
  filtr_workspace UUID DEFAULT NULL,
  filtr_domena TEXT DEFAULT NULL,
  filtr_kategorie TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  obsah TEXT,
  pojistovna TEXT,
  nazev_dokumentu TEXT,
  strana INTEGER,
  domena TEXT,
  kategorie TEXT,
  podobnost FLOAT
)
LANGUAGE sql
AS $$
  SELECT
    chunky.id,
    chunky.obsah,
    chunky.pojistovna,
    chunky.nazev_dokumentu,
    chunky.strana,
    chunky.domena,
    chunky.kategorie,
    1 - (chunky.embedding <=> dotaz_embedding) AS podobnost
  FROM chunky
  WHERE (filtr_pojistovna IS NULL OR chunky.pojistovna = filtr_pojistovna)
    AND (filtr_workspace IS NULL OR chunky.workspace_id = filtr_workspace)
    AND (filtr_domena IS NULL OR chunky.domena = filtr_domena)
    AND (filtr_kategorie IS NULL OR chunky.kategorie = filtr_kategorie)
  ORDER BY chunky.embedding <=> dotaz_embedding
  LIMIT pocet;
$$;

-- ============================================================================
-- 4 PILÍŘE: strukturované produkty + klienti + finanční plány
-- ============================================================================

-- Strukturované parametry produktů (čisté vstupy pro kalkulačky napříč doménami).
-- parametry JSONB drží doménově specifická čísla (sazba, TER, limity, výluky…).
CREATE TABLE IF NOT EXISTS produkty (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES workspaces(id),
  domena TEXT NOT NULL CHECK (domena IN ('pojisteni','uvery','investice','penze')),
  poskytovatel TEXT,
  nazev TEXT NOT NULL,
  typ TEXT,
  parametry JSONB NOT NULL DEFAULT '{}'::jsonb,
  zdroj TEXT NOT NULL DEFAULT 'rucni' CHECK (zdroj IN ('rucni','scraping','api')),
  zdroj_dokument_id UUID REFERENCES dokumenty(id) ON DELETE SET NULL,
  aktualizovano_kdy TIMESTAMPTZ DEFAULT NOW(),
  vytvoreno_kdy TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS produkty_domena_idx ON produkty (domena);

-- Klienti (profil pro finanční plán) — profil jako JSONB kvůli pružnosti.
-- VLASTNICTVÍ per poradce: poradce_id = auth.users; default auth.uid() (insert přes session client).
CREATE TABLE IF NOT EXISTS klienti (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES workspaces(id),
  poradce_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  jmeno TEXT,
  profil JSONB NOT NULL DEFAULT '{}'::jsonb,
  vytvoreno_kdy TIMESTAMPTZ DEFAULT NOW(),
  aktualizovano_kdy TIMESTAMPTZ DEFAULT NOW()
);
-- Migrace existující DB (CREATE TABLE IF NOT EXISTS nové sloupce nepřidá):
ALTER TABLE klienti ADD COLUMN IF NOT EXISTS poradce_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE klienti ADD COLUMN IF NOT EXISTS aktualizovano_kdy TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS klienti_poradce_idx ON klienti (poradce_id);

-- Vygenerované finanční plány (výstup orchestrace) + uložené výpočty pro dohledatelnost.
CREATE TABLE IF NOT EXISTS financni_plany (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES workspaces(id),
  poradce_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  klient_id UUID REFERENCES klienti(id) ON DELETE SET NULL,
  profil JSONB NOT NULL DEFAULT '{}'::jsonb,
  plan_md TEXT,
  vypocty JSONB DEFAULT '{}'::jsonb,
  vytvoreno_kdy TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE financni_plany ADD COLUMN IF NOT EXISTS poradce_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS financni_plany_poradce_idx ON financni_plany (poradce_id);

ALTER TABLE produkty       ENABLE ROW LEVEL SECURITY;
ALTER TABLE klienti        ENABLE ROW LEVEL SECURITY;
ALTER TABLE financni_plany ENABLE ROW LEVEL SECURITY;

-- produkty: sdílená konfigurace (zatím permisivní; přístup jen přes server service-role).
DROP POLICY IF EXISTS permisivni_vse ON produkty;
CREATE POLICY permisivni_vse ON produkty FOR ALL USING (true) WITH CHECK (true);

-- klienti + financni_plany: REÁLNÁ izolace per poradce (poradce_id = auth.uid()).
-- POZOR: nikdy zde neobnovovat permisivni_vse (USING true) — permisivní politiky se kombinují přes OR
-- a jediná USING(true) by anulovala izolaci. Proto ji explicitně dropujeme a NEvytváříme.
DROP POLICY IF EXISTS permisivni_vse ON klienti;
DROP POLICY IF EXISTS klienti_select ON klienti;
DROP POLICY IF EXISTS klienti_insert ON klienti;
DROP POLICY IF EXISTS klienti_update ON klienti;
DROP POLICY IF EXISTS klienti_delete ON klienti;
CREATE POLICY klienti_select ON klienti FOR SELECT USING (poradce_id = auth.uid());
CREATE POLICY klienti_insert ON klienti FOR INSERT WITH CHECK (poradce_id = auth.uid());
CREATE POLICY klienti_update ON klienti FOR UPDATE USING (poradce_id = auth.uid()) WITH CHECK (poradce_id = auth.uid());
CREATE POLICY klienti_delete ON klienti FOR DELETE USING (poradce_id = auth.uid());

DROP POLICY IF EXISTS permisivni_vse ON financni_plany;
DROP POLICY IF EXISTS fp_select ON financni_plany;
DROP POLICY IF EXISTS fp_insert ON financni_plany;
DROP POLICY IF EXISTS fp_update ON financni_plany;
DROP POLICY IF EXISTS fp_delete ON financni_plany;
CREATE POLICY fp_select ON financni_plany FOR SELECT USING (poradce_id = auth.uid());
CREATE POLICY fp_insert ON financni_plany FOR INSERT WITH CHECK (poradce_id = auth.uid());
CREATE POLICY fp_update ON financni_plany FOR UPDATE USING (poradce_id = auth.uid()) WITH CHECK (poradce_id = auth.uid());
CREATE POLICY fp_delete ON financni_plany FOR DELETE USING (poradce_id = auth.uid());
