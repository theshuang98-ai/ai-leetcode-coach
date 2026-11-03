'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function LoginPage() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const handleWeChatLogin = () => {
    signIn('wechat', { callbackUrl: '/home' });
  };

  const handleApiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Store API key in localStorage for Chrome extension usage
    localStorage.setItem('api_key', apiKey);
    // Redirect to onboarding (the route validates the key)
    window.location.href = '/home';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            AI LeetCode 私教
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            扫码登录，开始你的科学刷题之旅
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          {/* WeChat QR Code Section */}
          <div className="mb-6">
            {/* QR Code Placeholder */}
            <div className="mx-auto mb-4 flex h-48 w-48 items-center justify-center rounded-lg bg-gray-100">
              <div className="text-center">
                <div className="mb-2 text-6xl">💬</div>
                <p className="text-sm text-gray-500">微信扫码登录</p>
              </div>
            </div>

            {/* Login Button */}
            <button
              onClick={handleWeChatLogin}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#07C160] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#06AD56] focus:outline-none focus:ring-2 focus:ring-[#07C160] focus:ring-offset-2"
            >
              {/* WeChat SVG icon */}
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045.247.247 0 00.242-.245c0-.06-.024-.12-.04-.177l-.325-1.233a.492.492 0 01.178-.553C23.028 18.333 24 16.592 24 14.628c0-3.299-3.063-5.77-7.062-5.77zm-2.18 2.31c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982zm4.36 0c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982z" />
              </svg>
              微信扫码登录
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">或</span>
            </div>
          </div>

          {/* API Key Section */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {showApiKey ? '收起' : '使用 API Key 登录（Chrome 插件）'}
            </button>

            {showApiKey && (
              <form onSubmit={handleApiKeySubmit} className="mt-4">
                <label htmlFor="apiKey" className="sr-only">
                  API Key
                </label>
                <input
                  id="apiKey"
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="输入你的 API Key"
                  className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm placeholder-gray-400 focus:border-[#07C160] focus:outline-none focus:ring-1 focus:ring-[#07C160]"
                  required
                />
                <button
                  type="submit"
                  className="mt-3 w-full rounded-lg bg-gray-800 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:ring-offset-2"
                >
                  登录
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400">
          登录即表示你同意我们的服务条款和隐私政策
        </p>
      </div>
    </div>
  );
}
