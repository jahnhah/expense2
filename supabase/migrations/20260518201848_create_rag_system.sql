/*
  # RAG System - Documents and Embeddings

  ## Overview
  Sets up pgvector extension and tables for storing documents with vector embeddings
  for Retrieval-Augmented Generation.

  ## New Extensions
  - `vector` (v0.8.0) - Enables vector data type and similarity search (ivfflat/hnsw indexes)

  ## New Tables

  ### rag_documents
  - `id` (uuid, primary key)
  - `household_id` (uuid, FK -> households) - Scope documents to a household
  - `title` (text) - Document title/filename
  - `content` (text) - Full document text content
  - `chunk_index` (integer) - Index of this chunk within the original document
  - `chunk_text` (text) - The specific text chunk used for embedding
  - `embedding` (vector(1536)) - 1536-dim embedding vector (OpenAI/Groq compatible)
  - `source` (text) - Source metadata (url, filename, etc.)
  - `created_at` (timestamp)

  ## Security
  - RLS enabled on rag_documents
  - Anon access for MVP (no auth)
  - HNSW index for fast cosine similarity search
*/

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Documents table with embeddings
CREATE TABLE IF NOT EXISTS rag_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  chunk_index integer NOT NULL DEFAULT 0,
  chunk_text text NOT NULL,
  embedding extensions.vector(1536),
  source text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon users can read rag_documents"
  ON rag_documents FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert rag_documents"
  ON rag_documents FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update rag_documents"
  ON rag_documents FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can delete rag_documents"
  ON rag_documents FOR DELETE
  TO anon
  USING (true);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_rag_documents_embedding
  ON rag_documents
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index for household filtering
CREATE INDEX IF NOT EXISTS idx_rag_documents_household
  ON rag_documents(household_id);

-- Helper function for similarity search
CREATE OR REPLACE FUNCTION match_rag_documents(
  query_embedding extensions.vector(1536),
  match_household_id uuid,
  match_count int DEFAULT 5,
  match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  household_id uuid,
  title text,
  chunk_text text,
  source text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rd.id,
    rd.household_id,
    rd.title,
    rd.chunk_text,
    rd.source,
    1 - (rd.embedding <=> query_embedding) AS similarity
  FROM rag_documents rd
  WHERE rd.household_id = match_household_id
    AND rd.embedding IS NOT NULL
    AND 1 - (rd.embedding <=> query_embedding) > match_threshold
  ORDER BY rd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
