import { prisma } from '@/lib/prisma';
import type { SubscriptionStatus, SubscriptionPlanStatus } from '@prisma/client';

/**
 * Subscription state machine.
 *
 * User-facing states (SubscriptionStatus enum on User model):
 *   free → trial → active → canceled
 *
 * Stripe-facing states (SubscriptionPlanStatus on Subscription model):
 *   active → canceled | past_due
 *
 * Transitions:
 *   free   → trial  : on first checkout.session.completed (7-day trial)
 *   trial  → active : after trial ends (Stripe handles auto-conversion)
 *   active → canceled: user cancels via Customer Portal
 *   active → past_due: payment fails
 *   canceled → active: user restores within 30 days
 *   canceled → free  : after 30 days without restore
 */

/**
 * Activate a subscription after successful checkout.
 * Creates/updates both the User record and Subscription record.
 */
export async function activateSubscription(
  userId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  trialEndsAt: Date | null,
  currentPeriodEnd?: Date | null,
) {
  const now = new Date();
  const isTrial = trialEndsAt !== null && trialEndsAt > now;
  const userStatus: SubscriptionStatus = isTrial ? 'trial' : 'active';

  // Upsert subscription record
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId,
      stripeSubscriptionId,
      status: 'active',
      trialEndsAt,
      currentPeriodEnd: currentPeriodEnd ?? null,
      currentPeriodStart: now,
    },
    update: {
      stripeCustomerId,
      stripeSubscriptionId,
      status: 'active',
      trialEndsAt,
      currentPeriodEnd: currentPeriodEnd ?? null,
      currentPeriodStart: now,
    },
  });

  // Update user-facing status
  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionStatus: userStatus },
  });
}

/**
 * Cancel a subscription.
 * Sets both User and Subscription status to 'canceled'.
 */
export async function cancelSubscription(userId: string) {
  await prisma.subscription.updateMany({
    where: { userId },
    data: { status: 'canceled' },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionStatus: 'canceled' },
  });
}

/**
 * Restore a previously canceled subscription (within 30-day grace period).
 * Sets status back to active on both models.
 */
export async function restoreSubscription(userId: string) {
  await prisma.subscription.updateMany({
    where: { userId },
    data: { status: 'active' },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionStatus: 'active' },
  });
}

/**
 * Mark a subscription as past_due after payment failure.
 * Updates Subscription.status to past_due; User.subscriptionStatus stays as-is
 * (SubscriptionStatus enum has no 'past_due' value).
 */
export async function markPastDue(userId: string) {
  await prisma.subscription.updateMany({
    where: { userId },
    data: { status: 'past_due' },
  });
}

/**
 * Sync subscription status from Stripe event data.
 * Maps Stripe subscription status to our local enums.
 */
export async function syncSubscriptionStatus(
  stripeSubscriptionId: string,
  stripeStatus: string,
  currentPeriodEnd?: Date | null,
  cancelAtPeriodEnd?: boolean,
) {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    select: { userId: true, trialEndsAt: true },
  });

  if (!subscription) {
    console.warn(
      `syncSubscriptionStatus: no local subscription record for ${stripeSubscriptionId}`,
    );
    return;
  }

  const { userId, trialEndsAt } = subscription;

  // Map Stripe status to our SubscriptionPlanStatus
  let planStatus: SubscriptionPlanStatus;
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      planStatus = 'active';
      break;
    case 'past_due':
      planStatus = 'past_due';
      break;
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      planStatus = 'canceled';
      break;
    default:
      planStatus = 'active';
  }

  // Update subscription record
  await prisma.subscription.update({
    where: { stripeSubscriptionId },
    data: {
      status: planStatus,
      currentPeriodEnd: currentPeriodEnd ?? undefined,
    },
  });

  // Sync user-facing status if needed
  const now = new Date();
  let userStatus: SubscriptionStatus;

  if (planStatus === 'canceled') {
    userStatus = 'canceled';
  } else if (
    planStatus === 'active' &&
    trialEndsAt !== null &&
    trialEndsAt > now
  ) {
    userStatus = 'trial';
  } else if (planStatus === 'past_due') {
    // User stays at current status; past_due not in SubscriptionStatus enum
    return;
  } else {
    userStatus = 'active';
  }

  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionStatus: userStatus },
  });
}
