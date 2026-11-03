import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/plans
 *
 * Returns all available learning plans.
 * MVP: single Hot 100 plan.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const plans = await prisma.plan.findMany({
      include: {
        planProblems: {
          include: {
            problem: { select: { topic: true } },
          },
        },
      },
    });

    const result = plans.map((plan) => {
      const topics = [...new Set(plan.planProblems.map((pp) => pp.problem.topic))];
      return {
        id: plan.id,
        name: plan.name,
        totalProblems: plan.totalProblems,
        description: plan.description,
        topics,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/plans error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/plans
 *
 * Select a plan for the current user.
 * MVP: only preset plans (planId-based) — custom plan removed.
 * Creates UserProblem records from PlanProblem links, sets user.planId.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { planId } = body as { planId?: number };

    if (!planId || typeof planId !== 'number') {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 });
    }

    // Verify the plan exists
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Get problem IDs from PlanProblem links (sorted by order)
    const planProblems = await prisma.planProblem.findMany({
      where: { planId },
      orderBy: { order: 'asc' },
      select: { problemId: true },
    });
    const problemIds = planProblems.map((pp) => pp.problemId);

    if (problemIds.length === 0) {
      return NextResponse.json(
        { error: 'Plan has no problems assigned' },
        { status: 500 },
      );
    }

    // Transaction: delete old UserProblems + create new ones + update planId
    const userId = session.user.id;

    await prisma.$transaction(async (tx) => {
      await tx.userProblem.deleteMany({ where: { userId } });

      await tx.userProblem.createMany({
        data: problemIds.map((problemId) => ({
          userId,
          problemId,
          status: 'unsolved',
          mastery: 0,
          reviewCount: 0,
        })),
      });

      await tx.user.update({
        where: { id: userId },
        data: { planId },
      });
    });

    return NextResponse.json({
      success: true,
      userProblemCount: problemIds.length,
    });
  } catch (error) {
    console.error('POST /api/plans error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
