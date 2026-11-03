'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

const navLinks = [
  { href: '/home', label: '首页' },
  { href: '/daily', label: '每日推送' },
  { href: '/plans', label: '我的计划' },
  { href: '/dashboard', label: '数据' },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/home"
          className="flex items-center gap-2 font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500/20 to-violet-500/20">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm">AI LeetCode 私教</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== '/home' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
