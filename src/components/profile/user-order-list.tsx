'use client';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, ShoppingCart, Eye, MessageCircle, Copy, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const WHATSAPP_NUMBER = '5215581536176';

type OrderStatus = 'Pendiente de pago' | 'Pendiente' | 'En proceso' | 'Enviado' | 'Entregado' | 'Cancelado';

const statusStyles: {[key: string]: string} = {
    'Pendiente de pago': 'border-orange-500/50 text-orange-500',
    'Pendiente': 'border-gray-500/50 text-gray-500',
    'En proceso': 'border-blue-500/50 text-blue-500',
    'Enviado': 'border-purple-500/50 text-purple-500',
    'Entregado': 'border-green-500/50 text-green-500',
    'Cancelado': 'border-red-500/50 text-red-500 line-through',
};

const paymentMethodLabel: {[key: string]: string} = {
  'transferencia': 'Transferencia',
  'oxxo': 'Depósito OXXO',
};

export default function UserOrderList() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const userOrdersQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'orders'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user]);

  const { data: orders, isLoading, error } = useCollection(userOrdersQuery, {
    disabled: !user,
  });

  const getWhatsAppMessage = (order: any) => {
    return `Hola, quiero enviar mi comprobante de pago.\n\n*Nombre:* ${order.requesterName}\n*ID de Obra:* ${order.id}\n*Nombre de Obra:* ${order.projectName}\n*Método de pago:* ${paymentMethodLabel[order.paymentMethod] || order.paymentMethod}\n*Total:* $${order.total?.toFixed(2)} MXN`;
  };

  const handleOpenWhatsApp = (order: any) => {
    setSelectedOrder(order);
    setIsWhatsAppModalOpen(true);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = (order: any) => {
    const message = encodeURIComponent(getWhatsAppMessage(order));
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
  };

  if (isUserLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <ShoppingCart className="h-5 w-5" />
            <span>Mis Pedidos</span>
          </CardTitle>
          <CardDescription>Consulta el historial de tus pedidos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <ShoppingCart className="h-5 w-5" />
            <span>Mis Pedidos</span>
          </CardTitle>
          <CardDescription>Consulta el historial de tus pedidos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className='text-right'>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              )}
              {error && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-destructive">
                    <div className="flex items-center justify-center gap-2">
                      <AlertTriangle className="h-5 w-5"/>
                      <span>Error al cargar tus pedidos.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && orders?.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    {order.createdAt ? format(order.createdAt.toDate(), 'dd/MM/yyyy', { locale: es }) : 'N/A'}
                  </TableCell>
                  <TableCell>{order.projectName}</TableCell>
                  <TableCell>${order.total.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusStyles[order.status] || ''}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* ✅ Botón elegir método de pago - cuando no tiene paymentMethod */}
                      {order.status === 'Pendiente de pago' && !order.paymentMethod && (
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                          onClick={() => router.push('/new-order')}
                        >
                          Elegir método de pago
                        </Button>
                      )}
                      {/* ✅ Botón WhatsApp solo para pedidos pendientes de pago con método de pago */}
                      {order.status === 'Pendiente de pago' && order.paymentMethod && (
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-green-500 hover:bg-green-600 text-white"
                          onClick={() => handleOpenWhatsApp(order)}
                        >
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Enviar comprobante
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/order-summary?userId=${user?.uid}&orderId=${order.id}`)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Ver
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && !error && orders?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Aún no has realizado ningún pedido.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de WhatsApp */}
      <Dialog open={isWhatsAppModalOpen} onOpenChange={setIsWhatsAppModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-500" />
              Enviar comprobante por WhatsApp
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Copia el mensaje y pégalo en WhatsApp junto con la foto de tu comprobante.
              </p>
              <div className="rounded-lg border p-4 bg-muted/50 space-y-2 text-sm font-mono whitespace-pre-wrap">
                {getWhatsAppMessage(selectedOrder)}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleCopy(getWhatsAppMessage(selectedOrder))}
              >
                {copied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? 'Copiado' : 'Copiar mensaje'}
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWhatsAppModalOpen(false)}>
              Cerrar
            </Button>
            <Button
              className="bg-green-500 hover:bg-green-600 text-white"
              onClick={() => {
                handleSendWhatsApp(selectedOrder);
                setIsWhatsAppModalOpen(false);
              }}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Abrir WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}