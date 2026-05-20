import { NextRequest, NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
    }

    // 1. Borrar de Firebase Auth
    await admin.auth().deleteUser(userId);

    // 2. Borrar subcolecciones primero (orders y notifications)
    const ordersSnap = await admin.firestore().collection(`users/${userId}/orders`).get();
    const notifSnap = await admin.firestore().collection(`users/${userId}/notifications`).get();

    const batch = admin.firestore().batch();
    ordersSnap.docs.forEach(doc => batch.delete(doc.ref));
    notifSnap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // 3. Borrar documento principal del usuario
    await admin.firestore().doc(`users/${userId}`).delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error eliminando usuario:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}