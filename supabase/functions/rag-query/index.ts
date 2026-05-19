import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { question, household_id, groq_api_key, match_count = 5, match_threshold = 0.3 } = await req.json();

    if (!question || !household_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: question, household_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!groq_api_key) {
      return new Response(
        JSON.stringify({ error: "Groq API key is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Embed the question
    const embedRes = await fetch("https://api.groq.com/openai/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groq_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: [question],
      }),
    });

    if (!embedRes.ok) {
      const err = await embedRes.text();
      return new Response(
        JSON.stringify({ error: `Groq embedding error: ${err}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const embedData = await embedRes.json();
    const queryEmbedding = embedData.data[0].embedding as number[];

    // 2. Search for similar documents using the match function
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/match_rag_documents`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query_embedding: queryEmbedding,
        match_household_id: household_id,
        match_count,
        match_threshold,
      }),
    });

    if (!rpcRes.ok) {
      const err = await rpcRes.text();
      return new Response(
        JSON.stringify({ error: `Vector search error: ${err}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const matches = await rpcRes.json();

    if (!matches || matches.length === 0) {
      return new Response(
        JSON.stringify({
          answer: "I couldn't find any relevant documents to answer your question. Try uploading some documents first.",
          sources: [],
          matches: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Build context from matches
    const context = matches
      .map((m: { title: string; chunk_text: string; similarity: number; source: string }, i: number) =>
        `[Document ${i + 1}: "${m.title}" (similarity: ${m.similarity.toFixed(3)})]\n${m.chunk_text}`
      )
      .join("\n\n---\n\n");

    const sources = matches.map((m: { title: string; source: string; similarity: number }) => ({
      title: m.title,
      source: m.source,
      similarity: m.similarity,
    }));

    // 4. Generate answer using Groq LLM
    const chatRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groq_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that answers questions based on the provided document context. Always cite which document(s) your answer comes from. If the context doesn't contain enough information to answer the question, say so clearly. Be concise and accurate.`,
          },
          {
            role: "user",
            content: `Based on the following documents, answer the question.\n\n## Context:\n${context}\n\n## Question:\n${question}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!chatRes.ok) {
      const err = await chatRes.text();
      return new Response(
        JSON.stringify({ error: `Groq chat error: ${err}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chatData = await chatRes.json();
    const answer = chatData.choices[0].message.content;

    return new Response(
      JSON.stringify({ answer, sources, matches }),
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
