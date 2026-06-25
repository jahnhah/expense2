'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useHousehold } from '@/lib/household-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Brain, Send, Loader as Loader2, Key, MessageSquare, TrendingUp, Receipt, Users, Scale, CircleHelp as HelpCircle, Lightbulb, TriangleAlert as AlertTriangle, Sparkles } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  stats?: {
    total_transactions: number;
    total_settlements: number;
    total_expenses: number;
    total_settled: number;
    transactions_this_week: number;
    settlements_this_week: number;
    expenses_this_week: number;
    expenses_this_month: number;
  };
}

const SUGGESTED_QUESTIONS = [
  'How many settlements were done this week?',
  'How much did we spend this month?',
  'Who has the highest balance?',
  'What are our top expense categories?',
  'How many transactions do we have?',
  'What is the total amount settled?',
  'Who paid the most?',
  'What did we spend on Food category?',
];

export default function RAGPage() {
  const params = useParams();
  const householdId = params.id as string;
  const household = useHousehold();

  const [groqKey, setGroqKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load Groq key from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('groq_api_key');
    if (stored) {
      setGroqKey(stored);
      setShowKeyInput(false);
    }
  }, []);

  function saveGroqKey(key: string) {
    setGroqKey(key);
    localStorage.setItem('groq_api_key', key);
    setShowKeyInput(false);
  }

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Ask question
  async function askQuestion(q?: string) {
    const query = q || question.trim();
    if (!query || !groqKey) return;

    if (!q) setQuestion('');
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setAsking(true);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const res = await fetch(`${supabaseUrl}/functions/v1/rag-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          question: query,
          household_id: householdId,
          groq_api_key: groqKey,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Error: ${result.error || 'Unknown error'}`,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: result.answer,
            stats: result.stats,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Failed: ${err instanceof Error ? err.message : 'Network error'}`,
        },
      ]);
    }

    setAsking(false);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            Expense Assistant
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ask questions about your household expenses, settlements, and balances
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowKeyInput(true)}
          className="gap-2"
        >
          <Key className="w-3.5 h-3.5" />
          {groqKey ? 'API Key Set' : 'Set API Key'}
        </Button>
      </div>

      {/* API Key Banner */}
      {!groqKey && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Groq API Key Required</p>
            <p className="text-xs text-muted-foreground mt-1">
              You need a Groq API key to use the assistant. Get one free at{' '}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                console.groq.com
              </a>
              . Your key is stored locally in your browser.
            </p>
            <Button
              size="sm"
              className="mt-2 gap-2"
              onClick={() => setShowKeyInput(true)}
            >
              <Key className="w-3.5 h-3.5" />
              Enter API Key
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="bg-muted/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Transactions</p>
            </div>
            <p className="text-xl font-bold text-foreground mt-1">
              --
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Settlements</p>
            </div>
            <p className="text-xl font-bold text-foreground mt-1">
              --
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Members</p>
            </div>
            <p className="text-xl font-bold text-foreground mt-1">
              --
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">This Week</p>
            </div>
            <p className="text-xl font-bold text-foreground mt-1">
              --
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chat */}
      <Card className="flex flex-col h-[500px]">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Ask a Question
          </CardTitle>
        </CardHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <Sparkles className="w-10 h-10 text-primary/30 mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                Ask about your expenses
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                I can answer questions about transactions, settlements, balances, and more
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {SUGGESTED_QUESTIONS.slice(0, 4).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => askQuestion(q)}
                    disabled={!groqKey}
                    className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'flex gap-3',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Brain className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[85%] rounded-xl px-4 py-3 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-foreground'
                )}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-muted-foreground">U</span>
                </div>
              )}
            </div>
          ))}

          {asking && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Brain className="w-3.5 h-3.5 text-primary animate-pulse" />
              </div>
              <div className="bg-muted/50 rounded-xl px-4 py-3 text-sm text-muted-foreground">
                Analyzing your data and generating answer...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              askQuestion();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={
                groqKey
                  ? 'Ask about your expenses...'
                  : 'Set API key first...'
              }
              disabled={asking || !groqKey}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={asking || !question.trim() || !groqKey}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </Card>

      {/* Suggested questions */}
      {messages.length > 0 && messages.length < 3 && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Lightbulb className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">Try asking:</span>
          {SUGGESTED_QUESTIONS.slice(0, 4).map((q, i) => (
            <button
              key={i}
              onClick={() => askQuestion(q)}
              disabled={!groqKey || asking}
              className="px-2 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* API Key Modal */}
      {showKeyInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowKeyInput(false)} />
          <Card className="relative z-10 w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Key className="w-5 h-5 text-primary" />
                Groq API Key
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Your key is stored only in your browser&apos;s localStorage and sent directly to Groq&apos;s API.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="password"
                placeholder="gsk_..."
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveGroqKey(groqKey)}
              />
              <p className="text-xs text-muted-foreground">
                Get a free key at{' '}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  console.groq.com
                </a>
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowKeyInput(false)}>
                  Cancel
                </Button>
                <Button onClick={() => saveGroqKey(groqKey)} disabled={!groqKey.trim()}>
                  Save Key
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
