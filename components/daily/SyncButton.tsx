'use client';

import { useState, useCallback } from 'react';
import { Cloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * SyncButton — Shows instructions for syncing LeetCode CN data via the extension popup.
 *
 * This button is a web-only UI component. The actual sync is triggered from
 * the Chrome extension popup when the user is on leetcode.cn.
 */
export function SyncButton() {
  const [showModal, setShowModal] = useState(false);

  const handleOpen = useCallback(() => {
    setShowModal(true);
  }, []);

  const handleClose = useCallback(() => {
    setShowModal(false);
  }, []);

  return (
    <>
      {/* Sync trigger button */}
      <button
        onClick={handleOpen}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border border-border',
          'bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground',
          'transition-all hover:border-primary/30 hover:text-foreground hover:shadow-sm',
          'active:scale-95',
        )}
        title="同步 LeetCode CN 数据"
      >
        <Cloud className="h-4 w-4" />
        <span>同步 LeetCode 数据</span>
      </button>

      {/* Modal overlay */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            className={cn(
              'mx-4 w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl',
              'animate-in fade-in zoom-in-95',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Cloud className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">同步 LeetCode 数据</h3>
                  <p className="text-xs text-muted-foreground">
                    从 LeetCode CN 导入你的刷题记录
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Instructions */}
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-4">
                <h4 className="mb-2 text-sm font-medium">操作步骤</h4>
                <ol className="ml-4 list-decimal space-y-2 text-sm text-muted-foreground">
                  <li>
                    打开{' '}
                    <a
                      href="https://leetcode.cn"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                    >
                      leetcode.cn
                    </a>{' '}
                    并确保已登录
                  </li>
                  <li>点击浏览器右上角的 AI LeetCode 私教 扩展图标</li>
                  <li>在扩展弹窗中点击「同步 LeetCode CN 数据」按钮</li>
                  <li>等待同步完成提示</li>
                </ol>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <strong>提示：</strong>只需要同步一次即可导入所有通过的解题记录。
                后续在 LeetCode CN 上做题时，系统会自动跟踪你的提交。
              </div>

              <button
                onClick={handleClose}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
