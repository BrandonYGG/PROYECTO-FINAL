'use client';

import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { RefreshCw, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

interface SignaturePadProps {
  onSave: (signature: string) => void;
}

export default function SignaturePad({ onSave }: SignaturePadProps) {
  const sigPadRef = useRef<SignatureCanvas>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const clear = () => {
    sigPadRef.current?.clear();
  };

  const handleSave = () => {
    if (sigPadRef.current?.isEmpty()) {
      toast({
        variant: 'destructive',
        title: 'Firma requerida',
        description: 'Por favor, proporciona una firma antes de guardar.',
      });
      return;
    }
    setIsSaving(true);
    const signatureDataUrl = sigPadRef.current?.getTrimmedCanvas().toDataURL('image/png') || '';
    onSave(signatureDataUrl);
    // El estado de guardado será gestionado por el componente padre.
  };

  return (
    <div className="flex flex-col gap-4">
      <Label htmlFor="signature-canvas">Área de Firma</Label>
      <div className="rounded-lg border bg-background relative w-full h-48">
        <SignatureCanvas
          ref={sigPadRef}
          penColor="black"
          canvasProps={{
            id: 'signature-canvas',
            className: 'w-full h-full rounded-lg',
          }}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={clear} disabled={isSaving}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Limpiar
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Guardando...' : 'Guardar Firma y Generar PDF'}
        </Button>
      </div>
    </div>
  );
}
