'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const errorMessages: Record<string, string> = {
  Configuration: '服务配置错误，请联系管理员。',
  AccessDenied: '访问被拒绝，你没有权限执行此操作。',
  Verification: '验证链接已过期或无效，请重新登录。',
  Default: '认证过程中发生错误，请重试。',
  OAuthSignin: '微信登录失败，请重试。',
  OAuthCallback: '微信登录回调处理失败，请重试。',
  OAuthCreateAccount: '无法创建用户账户，请重试。',
  EmailCreateAccount: '无法创建用户账户，请重试。',
  Callback: '回调处理失败，请重试。',
  OAuthAccountNotLinked:
    '此微信账号已关联到其他账户，请使用原方式登录。',
  EmailSignin: '验证邮件发送失败，请重试。',
  CredentialsSignin: '登录失败，请检查 API Key 是否正确。',
  SessionRequired: '请先登录后再访问此页面。',
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('error') ?? 'Default';
  const errorMessage = errorMessages[errorCode] ?? errorMessages.Default;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 text-6xl">⚠️</div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          认证失败
        </h1>
        <p className="mb-8 text-gray-600">{errorMessage}</p>
        <div className="space-y-3">
          <Link
            href="/login"
            className="inline-block w-full rounded-lg bg-[#07C160] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#06AD56]"
          >
            返回登录
          </Link>
          <Link
            href="/"
            className="inline-block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50">加载中...</div>}>
      <AuthErrorContent />
    </Suspense>
  );
}
