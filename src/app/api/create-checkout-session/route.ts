import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
apiVersion: '2026-05-27.dahlia',
});

export async function POST(req: NextRequest) {
  try {
    const { orderId, userId, total, projectName, requesterName } = await req.json();

    if (!orderId || !userId || !total) {
      return NextResponse.json({ error: 'Faltan datos del pedido' }, { status: 400 });
    }

    // Convertir total a centavos (Stripe usa centavos)
    const amountInCents = Math.round(total * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: `Pedido: ${projectName}`,
              description: `Solicitante: ${requesterName} | ID: ${orderId}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // ✅ Redirige de vuelta a la app después del pago
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment-success?orderId=${orderId}&userId=${userId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile`,
      metadata: {
        orderId,
        userId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creando sesión de Stripe:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}