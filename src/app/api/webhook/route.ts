import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMaterials, updateMaterialStock } from '@/lib/materials';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body, sig, process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (e: any) {
    console.error('Firma inválida:', e.message);
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { orderId, userId } = session.metadata!;

    try {
      const db = getFirestore();
      const orderRef = db.doc(`users/${userId}/orders/${orderId}`);
      const orderSnap = await orderRef.get();

      await orderRef.update({
        status: 'Pendiente',
        paymentMethod: 'tarjeta',
        paymentConfirmed: true,
        stripeSessionId: session.id,
      });

      // Descontar stock
      if (orderSnap.exists) {
        const orderData = orderSnap.data()!;
        const materials = await getMaterials();
        for (const item of orderData.materials) {
          const materialInfo = materials.find((m: any) => m.name === item.name);
          if (materialInfo) {
            await updateMaterialStock(materialInfo.id, item.quantity, 'subtract');
          }
        }

        // Notificación al usuario
        await db.collection(`users/${userId}/notifications`).add({
          userId,
          orderId,
          message: `¡Tu pago para el pedido "${orderData.projectName}" fue confirmado!`,
          read: false,
          createdAt: new Date(),
        });
      }
    } catch (e) {
      console.error('Error actualizando Firestore:', e);
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}