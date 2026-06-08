'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building2, Store, Loader2, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PaymentMethodModalProps {
  open: boolean;
  order: { id: string; projectName: string; total: number; requesterName: string } | null;
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
  const [selected, setSelected] = useState<'transferencia' | 'oxxo' | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast({ title: 'Copiado al portapapeles' });
  };

  const handleConfirm = async () => {
    if (!selected) return;
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
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelected('transferencia')}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                selected === 'transferencia'
                  ? 'border-primary bg-primary/10'
                  : 'border-muted hover:border-primary/50'
              }`}
            >
              <Building2 className={`h-8 w-8 ${selected === 'transferencia' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-sm font-semibold">Transferencia</span>
              <span className="text-xs text-muted-foreground text-center">Depósito bancario o SPEI</span>
            </button>

            <button
              onClick={() => setSelected('oxxo')}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                selected === 'oxxo'
                  ? 'border-primary bg-primary/10'
                  : 'border-muted hover:border-primary/50'
              }`}
            >
              <Store className={`h-8 w-8 ${selected === 'oxxo' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-sm font-semibold">Depósito OXXO</span>
              <span className="text-xs text-muted-foreground text-center">Pago en efectivo</span>
            </button>
          </div>

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
            {isConfirming ? 'Confirmando...' : 'Confirmar método de pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}