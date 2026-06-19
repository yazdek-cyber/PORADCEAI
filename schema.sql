-- Zapni pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabulka dokumentů
CREATE TABLE IF NOT EXISTS dokumenty (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nazev TEXT NOT NULL,
  pojistovna TEXT,
  nahrano_kdy TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pocet_chunku INTEGER DEFAULT 0
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
  nazev_dokumentu TEXT
);

-- Vyhledávání používá přesné (exact) KNN — pro malý/střední objem dat je to rychlé
-- a spolehlivé. HNSW index zde záměrně NENÍ (po hromadných UPDATech vracel pro
-- některé dotazy 0 řádků). Pro velký objem dat zvážit:
--   CREATE INDEX chunky_embedding_idx ON chunky USING hnsw (embedding vector_cosine_ops);
--   a po větších změnách REINDEX.

-- Funkce pro vyhledávání podobných chunků; volitelný filtr na konkrétní pojišťovnu.
CREATE OR REPLACE FUNCTION hledej_chunky(
  dotaz_embedding VECTOR(768),
  pocet INTEGER DEFAULT 8,
  filtr_pojistovna TEXT DEFAULT NULL
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
  WHERE filtr_pojistovna IS NULL OR chunky.pojistovna = filtr_pojistovna
  ORDER BY chunky.embedding <=> dotaz_embedding
  LIMIT pocet;
$$;
