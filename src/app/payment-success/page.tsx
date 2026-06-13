'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getMaterials, updateMaterialStock } from '@/lib/materials';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firestore = useFirestore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const orderId = searchParams.get('orderId');
  const userId = searchParams.get('userId');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!orderId || !userId || !sessionId || !firestore) return;

    const confirmPayment = async () => {
      try {
        // 1. Actualizar estado del pedido
        const orderRef = doc(firestore, 'users', userId, 'orders', orderId);
        await updateDoc(orderRef, {
          status: 'Pendiente',
          paymentMethod: 'tarjeta',
          paymentConfirmed: true,
          stripeSessionId: sessionId,
        });

        // 2. Descontar stock
        const { data: orderSnap } = await import('firebase/firestore').then(async ({ getDoc }) => {
          return { data: await getDoc(orderRef) };
        });

        if (orderSnap.exists()) {
          const orderData = orderSnap.data();
          const materials = await getMaterials();
          for (const item of orderData.materials) {
            const materialInfo = materials.find((m: any) => m.name === item.name);
            if (materialInfo) {
              await updateMaterialStock(materialInfo.id, item.quantity, 'subtract');
            }
          }

          // 3. Notificar al usuario
          const notificationRef = collection(firestore, 'users', userId, 'notifications');
          await addDoc(notificationRef, {
            userId,
            orderId,
            message: `¡Tu pago para el pedido "${orderData.projectName}" fue confirmado! Tu pedido está siendo procesado.`,
            read: false,
            createdAt: serverTimestamp(),
          });
        }

        setStatus('success');
      } catch (e) {
        console.error('Error confirmando pago:', e);
        setStatus('error');
      }
    };

    confirmPayment();
  }, [orderId, userId, sessionId, firestore]);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-14rem)] px-4">
      <Card className="max-w-md w-full text-center shadow-lg">
        <CardHeader className="items-center">
          {status === 'loading' && <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />}
          {status === 'success' && <CheckCircle className="h-16 w-16 text-green-500 mb-4" />}
          {status === 'error' && <XCircle className="h-16 w-16 text-destructive mb-4" />}
          <CardTitle className="text-2xl font-bold">
            {status === 'loading' && 'Confirmando pago...'}
            {status === 'success' && '¡Pago exitoso!'}
            {status === 'error' && 'Error al confirmar'}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Espera un momento mientras procesamos tu pago.'}
            {status === 'success' && 'Tu pedido ha sido confirmado y está siendo procesado.'}
            {status === 'error' && 'Hubo un problema al confirmar tu pago. Contáctanos.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status !== 'loading' && (
            <Button className="w-full" onClick={() => router.push('/profile')}>
              Ir a mis pedidos
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}