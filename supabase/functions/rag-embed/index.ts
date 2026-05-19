import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 200;

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  if (!text || text.trim().length === 0) return [];

  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunk = words.slice(start, end).join(" ");
    chunks.push(chunk);
    start += chunkSize - overlap;
    if (start >= words.length) break;
  }

  return chunks;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { title, content, household_id, source, groq_api_key } = await req.json();

    if (!title || !content || !household_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: title, content, household_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!groq_api_key) {
      return new Response(
        JSON.stringify({ error: "Groq API key is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Chunk the document
    const chunks = chunkText(content, CHUNK_SIZE, CHUNK_OVERLAP);

    if (chunks.length === 0) {
      return new Response(
        JSON.stringify({ error: "Document content is empty after processing" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get embeddings from Groq for all chunks
    const embeddingResponse = await fetch(
      "https://api.groq.com/openai/v1/embeddings",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groq_api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-ada-002",
          input: chunks,
        }),
      }
    );

    if (!embeddingResponse.ok) {
      const err = await embeddingResponse.text();
      return new Response(
        JSON.stringify({ error: `Groq embedding API error: ${err}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const embeddingData = await embeddingResponse.json();
    const embeddings = embeddingData.data as { embedding: number[] }[];

    // Insert chunks with embeddings into Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const records = chunks.map((chunkText, i) => ({
      household_id,
      title,
      content,
      chunk_index: i,
      chunk_text: chunkText,
      embedding: embeddings[i]?.embedding ?? null,
      source: source || "",
    }));

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/rag_documents`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(records),
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      return new Response(
        JSON.stringify({ error: `Database insert error: ${err}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        chunks_created: chunks.length,
        title,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
