import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { stripe } from '@/lib/payment/stripe';

/**
 * POST /api/payment/create-checkout
 *
 * Creates a Stripe Checkout Session for ¥99/month subscription with 7-day free trial.
 *
 * Request body (optional):
 *   { successUrl?: string, cancelUrl?: string }
 *
 * Response:
 *   { url: string } — Stripe Checkout Session URL
 */
export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse optional custom URLs
    let successUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/subscribe/success`;
    let cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/subscribe`;

    try {
      const body = await req.json();
      if (body.successUrl && typeof body.successUrl === 'string') {
        successUrl = body.successUrl;
      }
      if (body.cancelUrl && typeof body.cancelUrl === 'string') {
        cancelUrl = body.cancelUrl;
      }
    } catch {
      // No JSON body or parse error — use defaults
    }

    // Resolve price ID from env
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return NextResponse.json(
        { error: 'Stripe price ID not configured' },
        { status: 500 },
      );
    }

    // Create Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
      },
      metadata: {
        userId,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('POST /api/payment/create-checkout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
