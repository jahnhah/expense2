import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Transaction {
  id: string;
  title: string;
  amount: number;
  payer_id: string;
  category_id: string | null;
  date: string;
  notes: string;
}

interface Settlement {
  id: string;
  from_member_id: string;
  to_member_id: string;
  amount: number;
  date: string;
  note: string;
}

interface Member {
  id: string;
  name: string;
  color: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Participant {
  transaction_id: string;
  member_id: string;
  computed_share: number;
  is_paid: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { question, household_id, groq_api_key } = await req.json();

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Fetch household data
    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    };

    // Fetch all relevant data in parallel
    const [membersRes, transactionsRes, settlementsRes, categoriesRes, participantsRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/members?household_id=eq.${household_id}&select=id,name,color`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/transactions?household_id=eq.${household_id}&select=id,title,amount,payer_id,category_id,date,notes&order=date.desc&limit=100`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/settlements?household_id=eq.${household_id}&select=id,from_member_id,to_member_id,amount,date,note&order=date.desc&limit=100`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/categories?household_id=eq.${household_id}&select=id,name,color`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/transaction_participants?select=transaction_id,member_id,computed_share,is_paid`, { headers }),
    ]);

    const members: Member[] = membersRes.ok ? await membersRes.json() : [];
    const transactions: Transaction[] = transactionsRes.ok ? await transactionsRes.json() : [];
    const settlements: Settlement[] = settlementsRes.ok ? await settlementsRes.json() : [];
    const categories: Category[] = categoriesRes.ok ? await categoriesRes.json() : [];
    const participants: Participant[] = participantsRes.ok ? await participantsRes.json() : [];

    // Build member map for lookups
    const memberMap = new Map(members.map((m) => [m.id, m]));
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    // Compute member balances
    const balances = new Map<string, { paid: number; owed: number; reimbursed: number; received: number }>();
    members.forEach((m) => balances.set(m.id, { paid: 0, owed: 0, reimbursed: 0, received: 0 }));

    transactions.forEach((tx) => {
      if (tx.payer_id && balances.has(tx.payer_id)) {
        balances.get(tx.payer_id)!.paid += tx.amount;
      }
    });

    participants.forEach((p) => {
      if (balances.has(p.member_id)) {
        balances.get(p.member_id)!.owed += p.computed_share ?? 0;
      }
    });

    settlements.forEach((s) => {
      if (balances.has(s.from_member_id)) {
        balances.get(s.from_member_id)!.reimbursed += s.amount;
      }
      if (balances.has(s.to_member_id)) {
        balances.get(s.to_member_id)!.received += s.amount;
      }
    });

    // Build context
    const today = new Date().toISOString().split('T')[0];
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const context = {
      household: {
        id: household_id,
        current_date: today,
        date_one_week_ago: oneWeekAgo,
        date_one_month_ago: oneMonthAgo,
      },
      members: members.map((m) => {
        const b = balances.get(m.id)!;
        const net = b.paid - b.owed + b.received - b.received;
        return {
          name: m.name,
          total_paid: Math.round(b.paid * 100) / 100,
          total_owed: Math.round(b.owed * 100) / 100,
          total_reimbursed: Math.round(b.reimbursed * 100) / 100,
          net_balance: Math.round(net * 100) / 100,
        };
      }),
      transactions: transactions.slice(0, 50).map((tx) => ({
        title: tx.title,
        amount: tx.amount,
        payer: memberMap.get(tx.payer_id)?.name ?? 'Unknown',
        category: tx.category_id ? categoryMap.get(tx.category_id)?.name ?? 'Uncategorized' : 'Uncategorized',
        date: tx.date,
        notes: tx.notes || null,
        participants: participants
          .filter((p) => p.transaction_id === tx.id)
          .map((p) => ({
            member: memberMap.get(p.member_id)?.name ?? 'Unknown',
            share: Math.round((p.computed_share ?? 0) * 100) / 100,
            is_paid: p.is_paid,
          })),
      })),
      settlements: settlements.slice(0, 50).map((s) => ({
        from: memberMap.get(s.from_member_id)?.name ?? 'Unknown',
        to: memberMap.get(s.to_member_id)?.name ?? 'Unknown',
        amount: s.amount,
        date: s.date,
        note: s.note || null,
      })),
      categories: categories.map((c) => ({
        name: c.name,
        total: Math.round(
          transactions
            .filter((tx) => tx.category_id === c.id)
            .reduce((sum, tx) => sum + tx.amount, 0) * 100
        ) / 100,
        count: transactions.filter((tx) => tx.category_id === c.id).length,
      })),
      stats: {
        total_transactions: transactions.length,
        total_settlements: settlements.length,
        total_expenses: Math.round(transactions.reduce((sum, tx) => sum + tx.amount, 0) * 100) / 100,
        total_settled: Math.round(settlements.reduce((sum, s) => sum + s.amount, 0) * 100) / 100,
        transactions_this_week: transactions.filter((tx) => tx.date >= oneWeekAgo).length,
        transactions_this_month: transactions.filter((tx) => tx.date >= oneMonthAgo).length,
        settlements_this_week: settlements.filter((s) => s.date >= oneWeekAgo).length,
        settlements_this_month: settlements.filter((s) => s.date >= oneMonthAgo).length,
        expenses_this_week: Math.round(
          transactions
            .filter((tx) => tx.date >= oneWeekAgo)
            .reduce((sum, tx) => sum + tx.amount, 0) * 100
        ) / 100,
        expenses_this_month: Math.round(
          transactions
            .filter((tx) => tx.date >= oneMonthAgo)
            .reduce((sum, tx) => sum + tx.amount, 0) * 100
        ) / 100,
      },
    };

    // Generate answer using Groq LLM
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
            content: `You are a helpful assistant that answers questions about a shared living expense management system. You have access to real-time data about transactions, settlements, members, and balances.

Answer questions concisely and accurately based on the provided data. Use specific numbers when available. If you need to show calculations, do so clearly.

The data includes:
- Members with their payment/expense balances
- Recent transactions with amounts, payers, categories, and participants
- Settlements between members
- Category breakdowns
- Statistics for different time periods

Today's date is ${today}. One week ago is ${oneWeekAgo}. One month ago is ${oneMonthAgo}.`,
          },
          {
            role: "user",
            content: `Based on the following household expense data, answer the question.

## Data:
${JSON.stringify(context, null, 2)}

## Question:
${question}`,
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
      JSON.stringify({
        answer,
        stats: context.stats,
        data_available: {
          members: members.length,
          transactions: transactions.length,
          settlements: settlements.length,
          categories: categories.length,
        },
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
