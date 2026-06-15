'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PaymentMethodModalProps {
  open: boolean;
  order: { id: string; projectName: string; total: number; requesterName: string; userId?: string } | null;
  onConfirm: (method: 'transferencia' | 'oxxo') => Promise<void>;
  onClose: () => void;
}

export default function PaymentMethodModal({ open, order, onClose }: PaymentMethodModalProps) {
  const { toast } = useToast();
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!order) return;
    setIsConfirming(true);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          userId: order.userId,
          total: order.total,
          projectName: order.projectName,
          requesterName: order.requesterName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear sesión de pago');
      window.location.href = data.url;
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
      setIsConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Pago con tarjeta</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* Info tarjeta */}
          <div className="rounded-lg border p-4 bg-primary/5 border-primary/20 space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <p className="text-xs font-bold text-primary uppercase">Pago seguro con Stripe</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Serás redirigido a la página de pago de Stripe. Tu información bancaria es procesada de forma segura.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-muted px-2 py-1 rounded font-mono">Visa</span>
              <span className="text-xs bg-muted px-2 py-1 rounded font-mono">Mastercard</span>
              <span className="text-xs bg-muted px-2 py-1 rounded font-mono">Amex</span>
            </div>
          </div>

          {/* Total */}
          {order && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <span className="text-sm font-medium">Total a pagar</span>
              <span className="text-lg font-extrabold text-primary">
                ${order.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isConfirming}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={isConfirming}>
            {isConfirming ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
            {isConfirming ? 'Procesando...' : 'Pagar con tarjeta →'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}