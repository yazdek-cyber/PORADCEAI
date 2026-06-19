-- Zapni pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Workspace (organizace) — příprava na multi-tenant. Zatím existuje jen výchozí.
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nazev TEXT NOT NULL,
  vytvoreno_kdy TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO workspaces (id, nazev)
VALUES ('00000000-0000-0000-0000-000000000001', 'Výchozí workspace')
ON CONFLICT (id) DO NOTHING;

-- Tabulka dokumentů
CREATE TABLE IF NOT EXISTS dokumenty (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nazev TEXT NOT NULL,
  pojistovna TEXT,
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

-- Funkce pro vyhledávání podobných chunků; volitelné filtry na pojišťovnu a workspace.
CREATE OR REPLACE FUNCTION hledej_chunky(
  dotaz_embedding VECTOR(768),
  pocet INTEGER DEFAULT 8,
  filtr_pojistovna TEXT DEFAULT NULL,
  filtr_workspace UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  obsah TEXT,
  pojistovna TEXT,
  nazev_dokumentu TEXT,
  strana INTEGER,
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
    1 - (chunky.embedding <=> dotaz_embedding) AS podobnost
  FROM chunky
  WHERE (filtr_pojistovna IS NULL OR chunky.pojistovna = filtr_pojistovna)
    AND (filtr_workspace IS NULL OR chunky.workspace_id = filtr_workspace)
  ORDER BY chunky.embedding <=> dotaz_embedding
  LIMIT pocet;
$$;
