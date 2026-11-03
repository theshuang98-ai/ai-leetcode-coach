// Payment API routes — T8 will implement
// POST /api/payment/checkout — Stripe checkout session
// POST /api/payment/webhook — Stripe webhook handler
export async function GET() {
  return Response.json({ message: 'Payment API — not yet implemented' }, { status: 501 });
}
