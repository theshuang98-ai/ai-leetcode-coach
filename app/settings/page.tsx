'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

interface ApiKeyEntry {
  id: string;
  keyPrefix: string;
  name: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate new key flow
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Auth guard (skip in dev mode)
  useEffect(() => {
    if (status === 'authenticated') return;
    if (status === 'loading') return;
    // In production, redirect unauthenticated users
    // In dev, allow access for testing
  }, [status, router]);

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/user/api-key', { credentials: 'include' });

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      if (!res.ok) {
        throw new Error(`请求失败 (${res.status})`);
      }

      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取 API Key 失败');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchKeys();
    }
  }, [status, fetchKeys]);

  const handleGenerate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        setGenerating(true);
        setError(null);

        const res = await fetch('/api/user/api-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: keyName || undefined }),
        });

        if (res.status === 401) {
          router.push('/login');
          return;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || '生成失败');
        }

        const data = await res.json();
        setNewlyGeneratedKey(data.apiKey);
        setKeyName('');
        setShowGenerateForm(false);
        setCopied(false);
        // Refresh the key list
        fetchKeys();
      } catch (e) {
        setError(e instanceof Error ? e.message : '生成 API Key 失败');
      } finally {
        setGenerating(false);
      }
    },
    [keyName, router, fetchKeys],
  );

  const handleCopy = useCallback(async () => {
    if (!newlyGeneratedKey) return;
    try {
      await navigator.clipboard.writeText(newlyGeneratedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback: select text manually
      setCopied(true);
    }
  }, [newlyGeneratedKey]);

  const handleDismissNewKey = useCallback(() => {
    setNewlyGeneratedKey(null);
    setCopied(false);
  }, []);

  // ── Loading state (auth check) ───────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  // ── Loading state (data fetch) ───────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">加载设置...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              设置
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              管理你的 API Key
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Error banner */}
        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Newly generated key banner */}
        {newlyGeneratedKey && (
          <div className="mb-6 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50">
            <div className="border-b border-emerald-200 bg-emerald-100 px-4 py-2">
              <p className="text-sm font-semibold text-emerald-800">
                新的 API Key 已生成
              </p>
            </div>
            <div className="space-y-3 p-4">
              <div className="rounded-lg bg-white p-3 font-mono text-sm break-all select-all">
                {newlyGeneratedKey}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  {copied ? (
                    <>
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      已复制
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      复制
                    </>
                  )}
                </button>
                <button
                  onClick={handleDismissNewKey}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  关闭
                </button>
              </div>
              <p className="text-xs font-medium text-amber-600">
                ⚠ 请立即保存此 Key。关闭后不再显示。
              </p>
            </div>
          </div>
        )}

        {/* Generate new key section */}
        <div className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
          {!showGenerateForm ? (
            <button
              onClick={() => setShowGenerateForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:scale-105 active:scale-95"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              生成新 API Key
            </button>
          ) : (
            <form onSubmit={handleGenerate} className="space-y-3">
              <div>
                <label htmlFor="keyName" className="mb-1 block text-sm font-medium text-foreground">
                  名称（可选）
                </label>
                <input
                  id="keyName"
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="例如：Chrome 插件"
                  className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={generating}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      生成中...
                    </>
                  ) : (
                    '生成'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGenerateForm(false)}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  取消
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Existing keys list */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              已有 API Key
              {keys.length > 0 && (
                <span className="ml-1.5 text-muted-foreground">({keys.length})</span>
              )}
            </h2>
          </div>

          {keys.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                暂无 API Key，点击上方按钮生成
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {keys.map((key) => (
                <li
                  key={key.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-foreground">
                        {key.keyPrefix}...
                      </span>
                      {key.name && (
                        <span className="truncate text-xs text-muted-foreground">
                          {key.name}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      创建于 {formatDate(key.createdAt)}
                      {key.lastUsedAt && (
                        <> · 上次使用 {formatDate(key.lastUsedAt)}</>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          API Key 用于 Chrome 插件身份验证。生成后请妥善保存。
        </p>
      </main>
    </div>
  );
}
