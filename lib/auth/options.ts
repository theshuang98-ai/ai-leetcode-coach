import type { NextAuthOptions, Profile } from 'next-auth';
import WeChatProvider from './wechat-provider';
import { prisma } from '@/lib/prisma';

/**
 * NextAuth v4 configuration for AI LeetCode Coach.
 *
 * Strategy:
 * - JWT (not database sessions) — 7-day expiry
 * - WeChat OAuth via QR code scanning (PC login)
 * - User created in DB on first sign-in (via signIn event)
 * - No PrismaAdapter — we handle user creation ourselves
 */
export const authOptions: NextAuthOptions = {
  providers: [
    WeChatProvider({
      clientId: process.env.WECHAT_APP_ID ?? '',
      clientSecret: process.env.WECHAT_APP_SECRET ?? '',
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // First-time sign-in: attach user data to token
      if (user) {
        token.id = user.id;
        token.openid = account?.providerAccountId ?? user.id;
      }
      // Always fetch planId from DB — plan selection must reflect immediately
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
            select: { planId: true },
          });
          token.planId = dbUser?.planId ?? null;
        } catch {
          // DB failure — keep existing planId, don't clear it
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Attach token data to session for server-side access
      if (session.user) {
        session.user.id = token.id;
        session.user.planId = token.planId ?? null;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      // Create user in DB if first-time login
      if (account?.provider === 'wechat' && profile) {
        const openId =
          (profile as Record<string, unknown>)?.openid ??
          (profile as Record<string, unknown>)?.sub;
        const nickname =
          (profile as Record<string, unknown>)?.nickname ??
          (profile as Record<string, unknown>)?.name;

        if (openId && typeof openId === 'string') {
          const existing = await prisma.user.findUnique({
            where: { wechatOpenId: openId },
            select: { id: true },
          });

          if (!existing) {
            await prisma.user.create({
              data: {
                wechatOpenId: openId,
                wechatNickname:
                  nickname && typeof nickname === 'string'
                    ? nickname
                    : 'WeChat User',
              },
            });
          }
        }
      }
    },
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
};
