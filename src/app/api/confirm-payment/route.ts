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
  const { sessionId, orderId, userId } = await req.json();

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Pago no confirmado' }, { status: 400 });
    }

    const db = getFirestore();
    const orderRef = db.doc(`users/${userId}/orders/${orderId}`);
    const orderSnap = await orderRef.get();

    await orderRef.update({
      status: 'Pendiente',
      paymentMethod: 'tarjeta',
      paymentConfirmed: true,
      stripeSessionId: sessionId,
    });

    if (orderSnap.exists) {
      const orderData = orderSnap.data()!;
      const materials = await getMaterials();
      for (const item of orderData.materials) {
        const materialInfo = materials.find((m: any) => m.name === item.name);
        if (materialInfo) {
          await updateMaterialStock(materialInfo.id, item.quantity, 'subtract');
        }
      }

      await db.collection(`users/${userId}/notifications`).add({
        userId,
        orderId,
        message: `¡Tu pago para el pedido "${orderData.projectName}" fue confirmado!`,
        read: false,
        createdAt: new Date(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Error confirmando pago:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}