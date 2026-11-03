'use client';

import { SessionProvider, useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';

/**
 * Dev mode auto-login: calls /api/auth/test-bypass to set a next-auth
 * session cookie, so pages don't require WeChat OAuth for local development.
 *
 * Only activates when NODE_ENV !== 'production' and session is unauthenticated.
 */
function DevAutoLogin({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (
      process.env.NODE_ENV === 'production' ||
      status !== 'unauthenticated' ||
      attemptedRef.current
    ) {
      return;
    }

    attemptedRef.current = true;

    fetch('/api/auth/test-bypass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'test-user-001', createIfMissing: true }),
      credentials: 'include',
    })
      .then((res) => {
        if (res.ok) {
          // Cookie is now set — reload so useSession() picks it up
          window.location.reload();
        } else {
          console.warn('[DevAutoLogin] test-bypass failed:', res.status);
          attemptedRef.current = false; // allow retry
        }
      })
      .catch((err) => {
        console.warn('[DevAutoLogin] test-bypass error:', err);
        attemptedRef.current = false;
      });
  }, [status]);

  // Show children immediately while auto-login is in progress.
  // After reload, the session cookie will be present and status=syncing
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DevAutoLogin>{children}</DevAutoLogin>
    </SessionProvider>
  );
}
