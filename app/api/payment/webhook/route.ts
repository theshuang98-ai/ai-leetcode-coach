import { NextResponse } from 'next/server';
import { stripe } from '@/lib/payment/stripe';
import { prisma } from '@/lib/prisma';
import {
  activateSubscription,
  cancelSubscription,
  syncSubscriptionStatus,
  markPastDue,
} from '@/lib/payment/subscription-manager';

/**
 * POST /api/payment/webhook
 *
 * Stripe webhook handler. Receives events and syncs subscription state to the database.
 *
 * Events handled:
 *   - checkout.session.completed → activate subscription for first-time customers
 *   - customer.subscription.updated → sync subscription status changes
 *   - customer.subscription.deleted → mark subscription as canceled
 *   - invoice.payment_failed → mark subscription as past_due (stub)
 *
 * IMPORTANT:
 *   - Uses req.text() (NOT req.json()) for Stripe signature verification
 *   - No authentication middleware (Stripe sends directly)
 *   - Must be dynamic (uses headers())
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    // Read raw body for Stripe signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 },
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 },
      );
    }

    // Verify webhook signature
    let event: ReturnType<typeof stripe.webhooks.constructEvent>;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 },
      );
    }

    // Handle event by type
    switch (event.type) {
      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as StripeCheckoutSession;
        // Only handle subscription mode
        if (checkoutSession.mode !== 'subscription') {
          break;
        }

        const userId = checkoutSession.metadata?.userId;
        if (!userId) {
          console.warn(
            'checkout.session.completed: missing userId in metadata',
          );
          break;
        }

        const stripeCustomerId = checkoutSession.customer as string;
        const stripeSubscriptionId = checkoutSession.subscription as string;

        if (!stripeCustomerId || !stripeSubscriptionId) {
          console.warn(
            'checkout.session.completed: missing customer or subscription',
          );
          break;
        }

        // Trial ends 7 days from now (matches subscription_data.trial_period_days: 7)
        const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await activateSubscription(
          userId,
          stripeCustomerId,
          stripeSubscriptionId,
          trialEndsAt,
        );

        console.log(
          `Subscription activated for user ${userId}: ${stripeSubscriptionId}`,
        );
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as StripeSubscription;
        const subId = subscription.id;
        const stripeStatus = subscription.status;
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null;
        const cancelAtPeriodEnd = subscription.cancel_at_period_end;

        await syncSubscriptionStatus(
          subId,
          stripeStatus,
          periodEnd,
          cancelAtPeriodEnd,
        );

        console.log(
          `Subscription ${subId} synced: status=${stripeStatus}, cancelAtPeriodEnd=${cancelAtPeriodEnd}`,
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const deletedSubscription = event.data.object as StripeSubscription;
        const deletedSubId = deletedSubscription.id;

        // Look up local subscription to get userId
        const localSub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: deletedSubId },
          select: { userId: true },
        });

        if (localSub) {
          await cancelSubscription(localSub.userId);
          console.log(
            `Subscription ${deletedSubId} canceled for user ${localSub.userId}`,
          );
        } else {
          console.warn(
            `customer.subscription.deleted: no local record for ${deletedSubId}`,
          );
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as StripeInvoice;
        const invoiceSubId = invoice.subscription as string;

        if (invoiceSubId) {
          const localSub = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: invoiceSubId },
            select: { userId: true },
          });

          if (localSub) {
            await markPastDue(localSub.userId);
            console.log(
              `Payment failed for subscription ${invoiceSubId}, marked past_due for user ${localSub.userId}`,
            );
          }
        }

        // Stub: send notification to user about failed payment
        console.warn(
          `invoice.payment_failed: subscription=${invoiceSubId}, attempt_count=${invoice.attempt_count}`,
        );
        break;
      }

      default:
        // Unhandled event type — acknowledge receipt
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('POST /api/payment/webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ── Stripe event object type helpers ─────────────────────────

interface StripeCheckoutSession {
  id: string;
  mode: string;
  customer: string | StripeCustomer;
  subscription: string | StripeSubscription;
  metadata: Record<string, string> | null;
}

interface StripeCustomer {
  id: string;
}

interface StripeSubscription {
  id: string;
  status: string;
  current_period_end: number;
  current_period_start: number;
  cancel_at_period_end: boolean;
  trial_end?: number;
  metadata: Record<string, string> | null;
}

interface StripeInvoice {
  id: string;
  subscription: string | StripeSubscription | null;
  attempt_count: number;
  status: string;
}
