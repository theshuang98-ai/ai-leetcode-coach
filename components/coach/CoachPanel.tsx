'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Loader2,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyProblem } from '@/components/daily/ProblemCard';

type CoachMode = 'chat' | 'hint1' | 'hint2' | 'hint3' | 'review';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  mode?: CoachMode;
}

interface CoachPanelProps {
  problem: DailyProblem | null;
  onClose: () => void;
}

const QUICK_PROMPTS: { label: string; prompt: string; mode: CoachMode }[] = [
  { label: '提示 L1 · 方向', prompt: '给我 L1 提示：只点方向，不要展开', mode: 'hint1' },
  { label: '提示 L2 · 思路', prompt: '给我 L2 提示：讲思路和数据结构，不要代码', mode: 'hint2' },
  { label: '提示 L3 · 边界', prompt: '给我 L3 提示：边界条件和复杂度', mode: 'hint3' },
  { label: '复盘我的思路', prompt: '帮我复盘：我先讲思路，你指出漏洞', mode: 'review' },
];

const DIFFICULTY_LABELS: Record<string, string> = {
  Easy: '简单',
  Medium: '中等',
  Hard: '困难',
};

/** Minimal renderer: keeps paragraphs, renders ``` code fences as blocks. */
function MessageContent({ content }: { content: string }) {
  const parts = content.split('```');
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <pre
            key={index}
            className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100"
          >
            <code>{part.replace(/^[a-zA-Z0-9+#-]*\n/, '')}</code>
          </pre>
        ) : (
          <p key={index} className="whitespace-pre-wrap">
            {part}
          </p>
        ),
      )}
    </div>
  );
}

export function CoachPanel({ problem, onClose }: CoachPanelProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<{ first: number; total: number } | null>(null);
  const [promptVersion, setPromptVersion] = useState('coach-v1.2');
  const [feedbackState, setFeedbackState] = useState<
    Record<number, 'up' | 'down' | 'sending'>
  >({});

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset conversation whenever a different problem is opened.
  useEffect(() => {
    if (!problem) return;
    setMessages([
      {
        role: 'assistant',
        content: `这是 #${problem.leetcodeId}「${problem.titleCn || problem.title}」，${
          problem.topic ?? '算法'
        } · ${DIFFICULTY_LABELS[problem.difficulty] ?? problem.difficulty}。\n\n先不要看题解：你的第一反应是什么？卡在哪一步？`,
      },
    ]);
    setInput('');
    setError(null);
    setLatency(null);
    setFeedbackState({});
    setLoading(false);
    abortRef.current?.abort();
    abortRef.current = null;
  }, [problem]);

  // Escape to close.
  useEffect(() => {
    if (!problem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [problem, onClose]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const send = useCallback(
    async (text: string, mode: CoachMode = 'chat') => {
      if (!problem || loading || !text.trim()) return;

      const history = [...messages, { role: 'user' as const, content: text.trim() }];
      setMessages([...history, { role: 'assistant', content: '', mode }]);
      setInput('');
      setError(null);
      setLatency(null);
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const startedAt = performance.now();
      let firstTokenAt = 0;

      try {
        const res = await fetch('/api/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            problem: {
              leetcodeId: problem.leetcodeId,
              title: problem.title,
              titleCn: problem.titleCn,
              topic: problem.topic,
              difficulty: problem.difficulty,
            },
            messages: history,
            mode,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `请求失败 (${res.status})`);
        }

        const version = res.headers.get('X-Coach-Prompt-Version');
        if (version) setPromptVersion(version);

        const reader = res.body?.getReader();
        if (!reader) throw new Error('当前浏览器不支持流式响应');

        const decoder = new TextDecoder();
        let acc = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          if (!firstTokenAt && acc.length > 0) firstTokenAt = performance.now();
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: acc, mode };
            return next;
          });
        }

        const finishedAt = performance.now();
        setLatency({
          first: Math.round((firstTokenAt || finishedAt) - startedAt),
          total: Math.round(finishedAt - startedAt),
        });

        if (!acc.trim()) {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: 'assistant',
              content: '没有收到回复，请再试一次。',
              mode,
            };
            return next;
          });
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : '请求失败，请重试');
        // Drop the empty assistant placeholder.
        setMessages((prev) =>
          prev.length > 0 && prev[prev.length - 1]?.content === ''
            ? prev.slice(0, -1)
            : prev,
        );
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [problem, loading, messages],
  );

  const rate = useCallback(
    async (index: number, rating: 'up' | 'down') => {
      if (!problem) return;
      const msg = messages[index];
      if (!msg) return;

      setFeedbackState((prev) => ({ ...prev, [index]: 'sending' }));

      const question =
        [...messages.slice(0, index)].reverse().find((m) => m.role === 'user')
          ?.content ?? '';

      try {
        await fetch('/api/coach/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            problemId: problem.leetcodeId,
            problemTitle: problem.titleCn || problem.title,
            mode: msg.mode ?? 'chat',
            promptVersion,
            rating,
            question,
            answer: msg.content,
            latencyMs: latency?.total,
          }),
        });
        setFeedbackState((prev) => ({ ...prev, [index]: rating }));
      } catch {
        setFeedbackState((prev) => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
      }
    },
    [problem, messages, promptVersion, latency],
  );

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    onClose();
  }, [onClose]);

  if (!problem) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
        onClick={handleClose}
        aria-hidden
      />
      <aside className="animate-in slide-in-from-right fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-card shadow-2xl duration-300">
        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium text-violet-600">
              <Sparkles className="h-3.5 w-3.5" />
              AI 教练
              <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-normal text-violet-500">
                {promptVersion}
              </span>
            </div>
            <h2 className="mt-0.5 truncate text-sm font-semibold tracking-tight">
              #{problem.leetcodeId} {problem.titleCn || problem.title}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {problem.topic} · {DIFFICULTY_LABELS[problem.difficulty] ?? problem.difficulty}
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label="关闭 AI 教练"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.map((msg, index) => {
            const isStreaming =
              loading && index === messages.length - 1 && msg.role === 'assistant';
            const feedback = feedbackState[index];

            return (
              <div
                key={index}
                className={cn('flex gap-2', msg.role === 'user' && 'justify-end')}
              >
                {msg.role === 'assistant' && (
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100">
                    <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[85%]',
                    msg.role === 'user' && 'flex flex-col items-end',
                  )}
                >
                  <div
                    className={cn(
                      'rounded-2xl px-3.5 py-2.5',
                      msg.role === 'assistant'
                        ? 'bg-secondary text-secondary-foreground'
                        : 'bg-primary text-primary-foreground',
                    )}
                  >
                    {msg.content ? (
                      <MessageContent content={msg.content} />
                    ) : (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        思考中…
                      </div>
                    )}
                  </div>

                  {/* Bad-case loop: rate every coach answer. */}
                  {msg.role === 'assistant' && msg.mode && msg.content && !isStreaming && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      {feedback === 'sending' ? (
                        <span>记录中…</span>
                      ) : feedback === 'up' || feedback === 'down' ? (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <Check className="h-3 w-3" />
                          已记录，用于改进
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => void rate(index, 'up')}
                            aria-label="这条回答有帮助"
                            className="rounded p-0.5 hover:bg-emerald-50 hover:text-emerald-600"
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => void rate(index, 'down')}
                            aria-label="这条回答没帮助"
                            className="rounded p-0.5 hover:bg-red-50 hover:text-red-600"
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </button>
                          <span className="ml-0.5">有用吗？</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <div className="border-t px-3 py-3">
          {error && (
            <p className="mb-2 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-600">
              {error}
            </p>
          )}

          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((item) => (
              <button
                key={item.mode}
                onClick={() => void send(item.prompt, item.mode)}
                disabled={loading}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-violet-300 hover:text-violet-700 disabled:opacity-50"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={2}
              placeholder="说说你的思路，或问一个具体问题…"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/30"
            />
            <button
              onClick={() => void send(input)}
              disabled={loading || !input.trim()}
              aria-label="发送"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white transition-colors hover:bg-violet-700 disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>只给提示，不直接给答案。AI 可能出错，请自行验证。</span>
            {latency && (
              <span className="tabular-nums">
                首字 {(latency.first / 1000).toFixed(1)}s · 完成{' '}
                {(latency.total / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
