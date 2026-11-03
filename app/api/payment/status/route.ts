import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/payment/status
 *
 * Returns the current authenticated user's subscription status.
 *
 * Response:
 * {
 *   status: "free" | "trial" | "active" | "canceled" | "past_due",
 *   trialEndsAt: string | null,
 *   currentPeriodEnd: string | null,
 *   cancelAtPeriodEnd: boolean,
 *   stripeCustomerId: string | null
 * }
 */
export async function GET() {
  try {
    // Require authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch user with subscription details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        subscriptions: {
          select: {
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            status: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the most recent subscription (should be one-to-one, but Subscription.userId is unique)
    const subscription = user.subscriptions[0] ?? null;

    // Determine effective status
    let status: string;
    if (!subscription) {
      status = 'free';
    } else if (subscription.status === 'past_due') {
      status = 'past_due';
    } else {
      status = user.subscriptionStatus;
    }

    return NextResponse.json({
      status,
      trialEndsAt: subscription?.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: false, // Stripe doesn't expose this via webhook easily; default to false
      stripeCustomerId: subscription?.stripeCustomerId ?? null,
    });
  } catch (error) {
    console.error('GET /api/payment/status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
