// ── POST /api/coach ────────────────────────────────────────────────
// Streaming AI coach backed by DeepSeek (OpenAI-compatible chat API).
// Returns plain UTF-8 text chunks so the client can render tokens as they
// arrive without an SSE parser.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CoachProblem {
  leetcodeId?: number;
  title?: string;
  titleCn?: string | null;
  topic?: string | null;
  difficulty?: string | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_MESSAGES = 20;
const MAX_CHARS = 4000;
const PROMPT_VERSION = 'coach-v1.2';

type CoachMode = 'chat' | 'hint1' | 'hint2' | 'hint3' | 'review';

/** Hint ladder: each level reveals more, but never a submit-ready solution. */
const MODE_INSTRUCTIONS: Record<CoachMode, string> = {
  chat: '按学生的问题回答，保持苏格拉底式。',
  hint1:
    '只给「方向」：点出考点和第一步该想什么，不给数据结构名称以外的解法，不超过 80 字。结尾用一个问题把思考交还给学生。',
  hint2:
    '给「思路」：说出合适的数据结构和关键步骤，但不写代码、不给完整算法。不超过 150 字。',
  hint3:
    '给「边界与复杂度」：列出容易漏的边界条件、时间/空间复杂度，可给伪代码骨架，但不给可提交的完整代码。',
  review:
    '带学生复盘：先让他用自己的话讲思路，再指出漏洞和面试表达可以改进的地方。不要直接重写答案。',
};

function buildSystemPrompt(problem: CoachProblem, mode: CoachMode): string {
  const name = problem.titleCn || problem.title || '未知题目';
  return [
    '你是「AI LeetCode 私教」的教练，正在辅导一位准备技术面试的学生。',
    `当前题目：#${problem.leetcodeId ?? '?'} ${name}（${problem.title ?? ''}）`,
    `专题：${problem.topic ?? '未知'}｜难度：${problem.difficulty ?? '未知'}`,
    `本轮任务模式：${mode}。${MODE_INSTRUCTIONS[mode]}`,
    '教学原则：',
    '- 苏格拉底式：先给方向或反问，不要一上来贴完整答案或完整代码。',
    '- 每次回答控制在 150 字内，最多给一个可执行的下一步。',
    '- 学生明确说「给答案 / 直接说解法」时，才给完整思路；代码只在被要求时给。',
    '- 用中文，句子短，面向面试表达。',
    '- 不编造题目中不存在的条件；不确定时说明假设。',
    '- 如果学生贴了代码或思路，先指出第一个错误或缺口，再给修正方向。',
  ].join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI 教练未配置：缺少 DEEPSEEK_API_KEY' },
        { status: 503 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      problem?: CoachProblem;
      messages?: ChatMessage[];
      mode?: CoachMode;
    };

    const problem = body.problem;
    const messages = body.messages;
    const mode: CoachMode =
      body.mode && body.mode in MODE_INSTRUCTIONS ? body.mode : 'chat';

    if (!problem?.title && !problem?.titleCn) {
      return NextResponse.json({ error: 'problem is required' }, { status: 400 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages is required' }, { status: 400 });
    }

    const trimmed = messages
      .filter(
        (m) =>
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string' &&
          m.content.trim().length > 0,
      )
      .slice(-MAX_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

    if (trimmed.length === 0 || trimmed[trimmed.length - 1]?.role !== 'user') {
      return NextResponse.json({ error: 'last message must be from user' }, { status: 400 });
    }

    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        stream: true,
        temperature: 0.7,
        max_tokens: 700,
        messages: [
          { role: 'system', content: buildSystemPrompt(problem, mode) },
          ...trimmed,
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      console.error('DeepSeek error:', upstream.status, detail.slice(0, 500));
      return NextResponse.json(
        { error: `AI 服务暂时不可用 (${upstream.status})` },
        { status: 502 },
      );
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine.startsWith('data:')) continue;
              const payload = trimmedLine.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const json = JSON.parse(payload) as {
                  choices?: { delta?: { content?: string } }[];
                };
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) controller.enqueue(encoder.encode(delta));
              } catch {
                // Skip malformed keep-alive frames.
              }
            }
          }
        } catch (error) {
          console.error('Coach stream error:', error);
        } finally {
          controller.close();
          reader.releaseLock();
        }
      },
      cancel() {
        void reader.cancel();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'X-Coach-Prompt-Version': PROMPT_VERSION,
        'X-Coach-Mode': mode,
      },
    });
  } catch (error) {
    console.error('POST /api/coach error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
