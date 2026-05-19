'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useHousehold } from '@/lib/household-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Brain, Upload, Send, FileText, Trash2, Loader as Loader2, Key, MessageSquare, BookOpen, TriangleAlert as AlertTriangle, X } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; source: string; similarity: number }[];
}

interface DocRecord {
  id: string;
  title: string;
  chunk_index: number;
  chunk_text: string;
  source: string;
  created_at: string;
}

export default function RAGPage() {
  const params = useParams();
  const householdId = params.id as string;
  const household = useHousehold();

  const [groqKey, setGroqKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(true);
  const [documents, setDocuments] = useState<DocRecord[]>([]);
  const [docTitles, setDocTitles] = useState<{ title: string; chunks: number; source: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadSource, setUploadSource] = useState('');
  const [uploading, setUploading] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Delete state
  const [deleteTitle, setDeleteTitle] = useState<string | null>(null);

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

  // Load documents
  const loadDocs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('rag_documents')
      .select('id, title, chunk_index, chunk_text, source, created_at')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });
    setDocuments(data ?? []);

    // Group by title
    const titleMap = new Map<string, { chunks: number; source: string }>();
    (data ?? []).forEach((d) => {
      if (!titleMap.has(d.title)) {
        titleMap.set(d.title, { chunks: 0, source: d.source });
      }
      titleMap.get(d.title)!.chunks++;
    });
    setDocTitles(
      Array.from(titleMap.entries()).map(([title, info]) => ({
        title,
        chunks: info.chunks,
        source: info.source,
      }))
    );
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Upload document
  async function uploadDocument() {
    if (!uploadTitle.trim() || !uploadContent.trim() || !groqKey) return;
    setUploading(true);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const res = await fetch(`${supabaseUrl}/functions/v1/rag-embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          title: uploadTitle.trim(),
          content: uploadContent.trim(),
          household_id: householdId,
          source: uploadSource.trim() || 'manual',
          groq_api_key: groqKey,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Upload error: ${result.error || 'Unknown error'}`,
          },
        ]);
      } else {
        setUploadTitle('');
        setUploadContent('');
        setUploadSource('');
        setShowUpload(false);
        loadDocs();
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Upload failed: ${err instanceof Error ? err.message : 'Network error'}`,
        },
      ]);
    }

    setUploading(false);
  }

  // Ask question
  async function askQuestion() {
    if (!question.trim() || !groqKey) return;

    const q = question.trim();
    setQuestion('');
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
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
          question: q,
          household_id: householdId,
          groq_api_key: groqKey,
          match_count: 5,
          match_threshold: 0.3,
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
            sources: result.sources,
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

  // Delete document (all chunks with same title)
  async function deleteDocument() {
    if (!deleteTitle) return;
    await supabase
      .from('rag_documents')
      .delete()
      .eq('household_id', householdId)
      .eq('title', deleteTitle);
    setDeleteTitle(null);
    loadDocs();
  }

  // Handle file upload
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
    setUploadSource(file.name);
    setUploadContent(text);
    setShowUpload(true);
    e.target.value = '';
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            RAG Assistant
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload documents and ask questions — powered by Groq + pgvector
          </p>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* API Key Banner */}
      {!groqKey && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Groq API Key Required</p>
            <p className="text-xs text-muted-foreground mt-1">
              You need a Groq API key to use embeddings and chat. Get one free at{' '}
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Documents */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Documents
                </CardTitle>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".txt,.md,.csv,.json"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button variant="outline" size="sm" className="gap-2" asChild>
                      <span>
                        <Upload className="w-3.5 h-3.5" />
                        Upload
                      </span>
                    </Button>
                  </label>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setUploadTitle('');
                      setUploadContent('');
                      setUploadSource('');
                      setShowUpload(true);
                    }}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Paste
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : docTitles.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No documents yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload text files or paste content to get started
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {docTitles.map((doc) => (
                    <div
                      key={doc.title}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                    >
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {doc.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {doc.chunks} chunk{doc.chunks !== 1 ? 's' : ''} · {doc.source}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive transition-opacity"
                        onClick={() => setDeleteTitle(doc.title)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Chat */}
        <div className="lg:col-span-3">
          <Card className="flex flex-col h-[600px]">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Ask Questions
              </CardTitle>
            </CardHeader>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Brain className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Ask a question about your uploaded documents
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Answers are generated using RAG with Groq LLM
                  </p>
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
                      'max-w-[80%] rounded-xl px-4 py-3 text-sm',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-foreground'
                    )}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-border/50">
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                          Sources:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((s, si) => (
                            <span
                              key={si}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                            >
                              <FileText className="w-2.5 h-2.5" />
                              {s.title}
                              <span className="opacity-60">
                                ({(s.similarity * 100).toFixed(0)}%)
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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
                    Searching documents and generating answer...
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
                      ? 'Ask about your documents...'
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
        </div>
      </div>

      {/* Upload Modal */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Add Document
            </DialogTitle>
            <DialogDescription>
              Paste or type document content. It will be chunked and embedded for semantic search.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="e.g. Lease Agreement"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Source (optional)</Label>
              <Input
                placeholder="e.g. lease.pdf, https://..."
                value={uploadSource}
                onChange={(e) => setUploadSource(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                placeholder="Paste your document text here..."
                value={uploadContent}
                onChange={(e) => setUploadContent(e.target.value)}
                className="min-h-[200px] resize-y font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {uploadContent.length > 0 && (
                  <>{uploadContent.split(/\s+/).length} words · will be split into ~{Math.ceil(uploadContent.split(/\s+/).length / 800)} chunks</>
                )}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>
              Cancel
            </Button>
            <Button
              onClick={uploadDocument}
              disabled={uploading || !uploadTitle.trim() || !uploadContent.trim()}
              className="gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Embedding...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload & Embed
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Key Modal */}
      <Dialog open={showKeyInput} onOpenChange={setShowKeyInput}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Groq API Key
            </DialogTitle>
            <DialogDescription>
              Your key is stored only in your browser&apos;s localStorage and sent directly to Groq&apos;s API. It is never stored on our servers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>API Key</Label>
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKeyInput(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveGroqKey(groqKey)} disabled={!groqKey.trim()}>
              Save Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTitle} onOpenChange={(o) => !o && setDeleteTitle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Delete all chunks of &ldquo;{deleteTitle}&rdquo;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteDocument}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
