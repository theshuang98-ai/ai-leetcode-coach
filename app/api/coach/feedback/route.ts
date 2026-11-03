// ── POST /api/coach/feedback ───────────────────────────────────────
// Captures thumbs-up/down on coach answers. This is the Bad Case loop:
// every low-rated answer is logged with its mode, prompt version, latency
// and the answer text so it can be reviewed and turned into a prompt fix
// or an eval case.

import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

export const runtime = 'nodejs';

const LOG_DIR = join(process.cwd(), 'data');
const LOG_FILE = join(LOG_DIR, 'coach-feedback.jsonl');

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      problemId?: number;
      problemTitle?: string;
      mode?: string;
      promptVersion?: string;
      rating?: 'up' | 'down';
      question?: string;
      answer?: string;
      latencyMs?: number;
    };

    if (body.rating !== 'up' && body.rating !== 'down') {
      return NextResponse.json({ error: 'rating must be up or down' }, { status: 400 });
    }

    const entry = {
      at: new Date().toISOString(),
      userId: session.user.id,
      problemId: body.problemId ?? null,
      problemTitle: (body.problemTitle ?? '').slice(0, 120),
      mode: (body.mode ?? 'chat').slice(0, 20),
      promptVersion: (body.promptVersion ?? 'coach-v1.2').slice(0, 20),
      rating: body.rating,
      question: (body.question ?? '').slice(0, 500),
      answer: (body.answer ?? '').slice(0, 2000),
      latencyMs: typeof body.latencyMs === 'number' ? body.latencyMs : null,
    };

    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf8');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/coach/feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
