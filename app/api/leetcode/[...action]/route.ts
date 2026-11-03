/**
 * LeetCode API route — problem lookup and sync.
 *
 * GET /api/leetcode/{slug}         → Lookup problem by LeetCode slug
 * GET /api/leetcode/{action}/...   → 501 (not yet implemented)
 *
 * Pattern follows ``app/api/health/route.ts`` (Next.js App Router).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
//  Route:  GET /api/leetcode/[...action]
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: { action: string[] } },
) {
  // Single slug → problem lookup (used by extension worker to resolve slug → ID)
  if (params.action.length === 1) {
    const slug = params.action[0] as string;

    try {
      const problem = await prisma.problem.findUnique({
        where: { slug },
        select: {
          id: true,
          leetcodeId: true,
          title: true,
          slug: true,
          difficulty: true,
          topic: true,
        },
      });

      if (!problem) {
        return NextResponse.json(
          { error: `Problem not found: ${slug}` },
          { status: 404 },
        );
      }

      return NextResponse.json(problem);
    } catch (error) {
      console.error(`GET /api/leetcode/${slug} error:`, error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  }

  // Multi-segment paths not yet implemented
  return NextResponse.json(
    { error: 'Not implemented', status: 501, path: _request.nextUrl.pathname },
    { status: 501 },
  );
}

// ---------------------------------------------------------------------------
//  Route:  POST /api/leetcode/[...action]
// ---------------------------------------------------------------------------

export async function POST(
  _request: NextRequest,
  { params }: { params: { action: string[] } },
) {
  void params;
  return NextResponse.json(
    { error: 'Not implemented', status: 501, path: _request.nextUrl.pathname },
    { status: 501 },
  );
}

// ---------------------------------------------------------------------------
//  Route:  PUT /api/leetcode/[...action]
// ---------------------------------------------------------------------------

export async function PUT(
  _request: NextRequest,
  { params }: { params: { action: string[] } },
) {
  void params;
  return NextResponse.json(
    { error: 'Not implemented', status: 501, path: _request.nextUrl.pathname },
    { status: 501 },
  );
}

// ---------------------------------------------------------------------------
//  Route:  DELETE /api/leetcode/[...action]
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { action: string[] } },
) {
  void params;
  return NextResponse.json(
    { error: 'Not implemented', status: 501, path: _request.nextUrl.pathname },
    { status: 501 },
  );
}
