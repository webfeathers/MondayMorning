import { NextRequest, NextResponse } from 'next/server';
// TODO: Implement @wf/billing package in Phase 4
// import { handleStripeWebhook } from '@wf/billing';
import { db } from '@wf/db';

/**
 * Stripe webhook endpoint
 * Handles subscription and invoice events from Stripe
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw body (needed for signature verification)
    const rawBody = await request.text();

    // Get the Stripe signature from headers
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Get the webhook secret from environment
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    // Stub implementation for Phase 6 - will be replaced in Phase 4
    const result = {
      eventId: 'evt_stub_' + Date.now(),
      eventType: 'customer.subscription.updated',
      handled: true,
    };

    return NextResponse.json({
      received: true,
      eventId: result.eventId,
      eventType: result.eventType,
      handled: result.handled,
    });
  } catch (error) {
    console.error('Webhook error:', error);

    // Return 400 for signature errors (don't retry)
    if (error instanceof Error && error.message.includes('Invalid signature')) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Return 500 for other errors (Stripe will retry)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
