import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/Providers';
import './globals.css';

const siteName = 'AI LeetCode 私教';
const siteDescription = '智能刷题教练 — 个性化 LeetCode 学习路径、间隔重复、进度追踪。在 LeetCode 做题时自动跟踪、打分、推送复习提醒。';
const siteUrl = 'https://aitoearn.com';

/** OG image as a self-contained SVG data URI — avoids @vercel/og Windows path bug */
function ogImageSvgDataUri(): string {
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(99,102,241,0.08)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <circle cx="1000" cy="150" r="250" fill="rgba(99,102,241,0.15)"/>
  <rect x="0" y="626" width="1200" height="4" fill="url(#accent)"/>
  <g transform="translate(600,315)">
    <rect x="-360" y="-100" width="720" height="200" rx="0"/>
    <text x="0" y="-20" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="48" font-weight="700" fill="#f1f5f9">AI LeetCode 私教</text>
    <text x="0" y="40" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="24" fill="#94a3b8">智能刷题教练 · 个性化学习路径 · 间隔重复 · 进度追踪</text>
  </g>
</svg>`)
  );
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName,
    title: siteName,
    description: siteDescription,
    url: siteUrl,
    locale: 'zh_CN',
    images: [{ url: ogImageSvgDataUri(), width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteName,
    description: siteDescription,
    images: [{ url: ogImageSvgDataUri(), width: 1200, height: 630 }],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
