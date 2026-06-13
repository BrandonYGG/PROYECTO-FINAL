'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const orderId = searchParams.get('orderId');
  const userId = searchParams.get('userId');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!orderId || !userId || !sessionId) return;

    const confirmPayment = async () => {
      try {
        const res = await fetch('/api/confirm-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, orderId, userId }),
        });
        if (!res.ok) throw new Error('Error del servidor');
        setStatus('success');
      } catch (e) {
        console.error('Error confirmando pago:', e);
        setStatus('error');
      }
    };

    confirmPayment();
  }, [orderId, userId, sessionId]);

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

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[calc(100vh-14rem)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}