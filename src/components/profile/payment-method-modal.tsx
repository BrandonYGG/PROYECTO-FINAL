'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building2, Store, CreditCard, Loader2, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PaymentMethodModalProps {
  open: boolean;
  order: { id: string; projectName: string; total: number; requesterName: string; userId?: string } | null;
  onConfirm: (method: 'transferencia' | 'oxxo') => Promise<void>;
  onClose: () => void;
}

const BANK_INFO = {
  banco: 'BBVA',
  titular: 'Tlapaleria los Pinos S.A. de C.V.',
  clabe: '012180015548562197',
  cuenta: '0155 4856 2197',
};

export default function PaymentMethodModal({ open, order, onConfirm, onClose }: PaymentMethodModalProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<'transferencia' | 'oxxo' | 'tarjeta' | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast({ title: 'Copiado al portapapeles' });
  };

  const handleConfirm = async () => {
    if (!selected || !order) return;

    // ✅ Si eligió tarjeta, redirigir a Stripe Checkout
    if (selected === 'tarjeta') {
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
        // Redirigir a Stripe
        window.location.href = data.url;
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
        setIsConfirming(false);
      }
      return;
    }

    // Transferencia u OXXO
    setIsConfirming(true);
    await onConfirm(selected);
    setIsConfirming(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">¿Cómo vas a pagar?</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <p className="text-sm text-muted-foreground">
            Elige tu método de pago. Tu pedido quedará reservado mientras verificamos tu pago (48-72 hrs).
          </p>

          {/* Opciones de pago */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setSelected('transferencia')}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                selected === 'transferencia'
                  ? 'border-primary bg-primary/10'
                  : 'border-muted hover:border-primary/50'
              }`}
            >
              <Building2 className={`h-7 w-7 ${selected === 'transferencia' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-xs font-semibold">Transferencia</span>
              <span className="text-[10px] text-muted-foreground text-center">SPEI / Depósito</span>
            </button>

            <button
              onClick={() => setSelected('oxxo')}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                selected === 'oxxo'
                  ? 'border-primary bg-primary/10'
                  : 'border-muted hover:border-primary/50'
              }`}
            >
              <Store className={`h-7 w-7 ${selected === 'oxxo' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-xs font-semibold">OXXO</span>
              <span className="text-[10px] text-muted-foreground text-center">Pago en efectivo</span>
            </button>

            {/* ✅ Nueva opción: Tarjeta */}
            <button
              onClick={() => setSelected('tarjeta')}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                selected === 'tarjeta'
                  ? 'border-primary bg-primary/10'
                  : 'border-muted hover:border-primary/50'
              }`}
            >
              <CreditCard className={`h-7 w-7 ${selected === 'tarjeta' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-xs font-semibold">Tarjeta</span>
              <span className="text-[10px] text-muted-foreground text-center">Pago en línea</span>
            </button>
          </div>

          {/* Info de tarjeta */}
          {selected === 'tarjeta' && (
            <div className="rounded-lg border p-4 bg-primary/5 border-primary/20 space-y-2">
              <p className="text-xs font-bold text-primary uppercase">Pago seguro con Stripe</p>
              <p className="text-xs text-muted-foreground">
                Serás redirigido a la página de pago de Stripe. Tu información bancaria es procesada de forma segura.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs bg-muted px-2 py-1 rounded font-mono">Visa</span>
                <span className="text-xs bg-muted px-2 py-1 rounded font-mono">Mastercard</span>
                <span className="text-xs bg-muted px-2 py-1 rounded font-mono">Amex</span>
              </div>
            </div>
          )}

          {/* Datos bancarios */}
          {selected === 'transferencia' && (
            <div className="rounded-lg border p-4 bg-muted/50 space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase">Datos para transferencia</p>
              {[
                { label: 'Banco', value: BANK_INFO.banco },
                { label: 'Titular', value: BANK_INFO.titular },
                { label: 'CLABE', value: BANK_INFO.clabe },
                { label: 'Cuenta', value: BANK_INFO.cuenta },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-semibold">{value}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleCopy(value, label)} className="h-8 w-8">
                    {copiedField === label ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              ))}
              <p className="text-xs text-amber-600 font-medium">
                Concepto: {order?.requesterName} - {order?.projectName}
              </p>
            </div>
          )}

          {selected === 'oxxo' && (
            <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase">Datos para depósito OXXO</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Número de cuenta</p>
                  <p className="text-sm font-semibold">{BANK_INFO.cuenta}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleCopy(BANK_INFO.cuenta, 'Número de cuenta')} className="h-8 w-8">
                  {copiedField === 'Número de cuenta' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Banco: <span className="font-semibold">{BANK_INFO.banco}</span>
              </p>
              <p className="text-xs text-amber-600 font-medium">
                Indica en el depósito: {order?.requesterName} - {order?.projectName}
              </p>
            </div>
          )}

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
          <Button onClick={handleConfirm} disabled={!selected || isConfirming}>
            {isConfirming ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
            {isConfirming
              ? 'Procesando...'
              : selected === 'tarjeta'
              ? 'Pagar con tarjeta →'
              : 'Confirmar método de pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}