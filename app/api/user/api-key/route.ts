import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { validateApiKey, generateApiKey, listUserApiKeys } from '@/lib/auth/api-key';

/**
 * GET /api/user/api-key
 *
 * Lists all API keys for the authenticated user.
 * Returns keyPrefix only (never the raw key).
 *
 * Supports two authentication methods:
 *   1. JWT session cookie (web)
 *   2. Bearer token (Chrome extension)
 */
export async function GET(req: NextRequest) {
  try {
    // Method 1: JWT session (web browser)
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const keys = await listUserApiKeys(session.user.id);
      return NextResponse.json({ keys });
    }

    // Method 2: Bearer token (Chrome extension)
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.slice(7);
      const userId = await validateApiKey(apiKey);
      if (userId) {
        const keys = await listUserApiKeys(userId);
        return NextResponse.json({ keys });
      }
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch (error) {
    console.error('GET /api/user/api-key error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/user/api-key
 *
 * Generates a new API key for the authenticated user.
 * Returns the raw key once (won't be shown again).
 *
 * Body: { name?: string }
 * Response: { apiKey: string, keyPrefix: string }
 */
export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null;

    // Method 1: JWT session (web browser)
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      userId = session.user.id;
    }

    // Method 2: Bearer token (Chrome extension)
    if (!userId) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const apiKey = authHeader.slice(7);
        userId = await validateApiKey(apiKey);
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() || undefined : undefined;

    const rawKey = await generateApiKey(userId, name);
    const keyPrefix = rawKey.slice(0, 8);

    return NextResponse.json({ apiKey: rawKey, keyPrefix }, { status: 201 });
  } catch (error) {
    console.error('POST /api/user/api-key error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
