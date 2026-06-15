'use client';
import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, getDocs, query, where, addDoc, serverTimestamp, onSnapshot, orderBy, doc, updateDoc, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ShoppingCart, MessageCircle, Send, CheckCircle, XCircle, AlertCircle, CreditCard, Users, Search } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const statusStyles: { [key: string]: string } = {
  'Pendiente de aprobación': 'border-yellow-500/50 text-yellow-500',
  'Aprobado': 'border-green-500/50 text-green-500',
  'Rechazado': 'border-red-500/50 text-red-500',
  'Corrección requerida': 'border-orange-500/50 text-orange-500',
  'Pendiente': 'border-gray-500/50 text-gray-500',
  'En proceso': 'border-blue-500/50 text-blue-500',
  'Enviado': 'border-purple-500/50 text-purple-500',
  'Entregado': 'border-green-500/50 text-green-500',
  'Cancelado': 'border-red-500/50 text-red-500',
};

export default function BusinessOrderPanel() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [correctionMessage, setCorrectionMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user || !firestore) return;
    setIsLoading(true);

    const ordersQuery = query(
      collectionGroup(firestore, 'orders'),
      where('businessId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(ordersQuery, (snap) => {
      const allOrders = snap.docs.map(d => ({ id: d.id, ...d.data(), path: d.ref.path }));
      setOrders(allOrders.sort((a: any, b: any) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, firestore]);

  const groupedOrders = useMemo(() => {
    const filtered = orders.filter(order =>
      searchTerm === '' ||
      order.superintendentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.projectName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.reduce((groups: Record<string, any>, order) => {
      const key = order.superintendentId || 'Sin asignar';
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
      return groups;
    }, {});
  }, [orders, searchTerm]);

  const openMessages = (order: any) => {
    setSelectedOrder(order);
    setIsMessagesOpen(true);

    const messagesRef = collection(firestore, 'users', order.superintendentId, 'orders', order.id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  };

  const openAction = (order: any) => {
    setSelectedOrder(order);
    setIsActionOpen(true);
    setCorrectionMessage('');
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedOrder || !user) return;
    setIsSending(true);
    try {
      const messagesRef = collection(firestore, 'users', selectedOrder.superintendentId, 'orders', selectedOrder.id, 'messages');
      await addDoc(messagesRef, {
        text: newMessage.trim(),
        senderId: user.uid,
        senderType: 'business',
        createdAt: serverTimestamp(),
      });
      setNewMessage('');
    } catch (e) {
      console.error('Error enviando mensaje:', e);
    } finally {
      setIsSending(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedOrder || !user) return;
    setIsProcessing(true);
    try {
      const orderRef = doc(firestore, 'users', selectedOrder.superintendentId, 'orders', selectedOrder.id);
      await updateDoc(orderRef, { status: 'Aprobado' });

      const notificationRef = collection(firestore, 'users', selectedOrder.superintendentId, 'notifications');
      await addDoc(notificationRef, {
        userId: selectedOrder.superintendentId,
        orderId: selectedOrder.id,
        message: `Tu pedido "${selectedOrder.projectName}" fue aprobado. El dueño procederá con el pago.`,
        read: false,
        createdAt: serverTimestamp(),
      });

      setIsActionOpen(false);
      toast({ title: '✅ Pedido aprobado', description: 'Ahora puedes proceder con el pago.' });

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          userId: selectedOrder.superintendentId,
          total: selectedOrder.total,
          projectName: selectedOrder.projectName,
          requesterName: selectedOrder.superintendentName,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedOrder || !user) return;
    setIsProcessing(true);
    try {
      const orderRef = doc(firestore, 'users', selectedOrder.superintendentId, 'orders', selectedOrder.id);
      await updateDoc(orderRef, { status: 'Rechazado' });

      const notificationRef = collection(firestore, 'users', selectedOrder.superintendentId, 'notifications');
      await addDoc(notificationRef, {
        userId: selectedOrder.superintendentId,
        orderId: selectedOrder.id,
        message: `Tu pedido "${selectedOrder.projectName}" fue rechazado.`,
        read: false,
        createdAt: serverTimestamp(),
      });

      setIsActionOpen(false);
      toast({ title: 'Pedido rechazado.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCorrection = async () => {
    if (!selectedOrder || !user || !correctionMessage.trim()) return;
    setIsProcessing(true);
    try {
      const orderRef = doc(firestore, 'users', selectedOrder.superintendentId, 'orders', selectedOrder.id);
      await updateDoc(orderRef, { status: 'Corrección requerida' });

      const messagesRef = collection(firestore, 'users', selectedOrder.superintendentId, 'orders', selectedOrder.id, 'messages');
      await addDoc(messagesRef, {
        text: correctionMessage.trim(),
        senderId: user.uid,
        senderType: 'business',
        createdAt: serverTimestamp(),
      });

      const notificationRef = collection(firestore, 'users', selectedOrder.superintendentId, 'notifications');
      await addDoc(notificationRef, {
        userId: selectedOrder.superintendentId,
        orderId: selectedOrder.id,
        message: `Tu pedido "${selectedOrder.projectName}" requiere correcciones. Revisa los mensajes.`,
        read: false,
        createdAt: serverTimestamp(),
      });

      setIsActionOpen(false);
      toast({ title: 'Corrección solicitada', description: 'El superintendente fue notificado.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Pedidos de Superintendentes
          </CardTitle>
          <CardDescription>Revisa y aprueba los pedidos de tu equipo.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Buscador */}
          <div className="mb-4 relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por superintendente u obra..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
          ) : Object.keys(groupedOrders).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {searchTerm ? 'No hay resultados para tu búsqueda.' : 'No hay pedidos de tus superintendentes aún.'}
            </div>
          ) : (
            Object.entries(groupedOrders).map(([superintendentId, superintendentOrders]) => {
              const firstOrder = superintendentOrders[0];
              return (
                <div key={superintendentId} className="mb-6">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-semibold">
                      {firstOrder.superintendentName || 'Sin nombre'}
                    </span>
                    <Badge variant="secondary">
                      {superintendentOrders.length} pedido{superintendentOrders.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Obra</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {superintendentOrders.map((order: any) => (
                        <TableRow key={order.id}>
                          <TableCell className="text-sm">
                            {order.createdAt ? format(order.createdAt.toDate(), 'dd/MM/yy', { locale: es }) : 'N/A'}
                          </TableCell>
                          <TableCell>{order.projectName}</TableCell>
                          <TableCell>${order.total?.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusStyles[order.status] || ''}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => openMessages(order)}>
                              <MessageCircle className="h-4 w-4 mr-1" />
                              Chat
                            </Button>
                            {order.status === 'Pendiente de aprobación' && (
                              <Button size="sm" onClick={() => openAction(order)}>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Revisar
                              </Button>
                            )}
                            {order.status === 'Aprobado' && (
                              <Button size="sm" onClick={() => openAction(order)}>
                                <CreditCard className="h-4 w-4 mr-1" />
                                Pagar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Modal de acciones — ✅ con scroll */}
      <Dialog open={isActionOpen} onOpenChange={setIsActionOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisar Pedido — {selectedOrder?.projectName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border p-3 bg-muted/50 space-y-1 text-sm">
              <p className="font-semibold text-xs text-muted-foreground mb-2">Información General</p>
              <p><span className="font-semibold">Superintendente:</span> {selectedOrder?.superintendentName}</p>
              <p><span className="font-semibold">Obra:</span> {selectedOrder?.projectName}</p>
              <p><span className="font-semibold">Solicitante:</span> {selectedOrder?.requesterName}</p>
              <p><span className="font-semibold">Teléfono:</span> {selectedOrder?.phone}</p>
              <p><span className="font-semibold">Total:</span> ${selectedOrder?.total?.toFixed(2)} MXN</p>
            </div>

            <div className="rounded-lg border p-3 bg-muted/50 space-y-1 text-sm">
              <p className="font-semibold text-xs text-muted-foreground mb-2">Dirección de entrega</p>
              <p>{selectedOrder?.street} {selectedOrder?.number}, {selectedOrder?.colony}</p>
              <p>{selectedOrder?.municipality}, {selectedOrder?.state}, CP {selectedOrder?.postalCode}</p>
            </div>

            <div className="rounded-lg border p-3 bg-muted/50 space-y-1 text-sm">
              <p className="font-semibold text-xs text-muted-foreground mb-2">Materiales</p>
              {selectedOrder?.materials?.map((m: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span>{m.name}</span>
                  <span className="text-muted-foreground">x{m.quantity}</span>
                </div>
              ))}
            </div>

            <div className="rounded-lg border p-3 bg-muted/50 space-y-1 text-sm">
              <p className="font-semibold text-xs text-muted-foreground mb-2">Periodo de entrega</p>
              <p>
                {selectedOrder?.deliveryDates?.from?.toDate?.()
                  ? `${new Date(selectedOrder.deliveryDates.from.toDate()).toLocaleDateString('es-MX')} — ${new Date(selectedOrder.deliveryDates.to.toDate()).toLocaleDateString('es-MX')}`
                  : 'No especificado'}
              </p>
            </div>

            {selectedOrder?.status === 'Pendiente de aprobación' && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium">¿Requiere corrección?</p>
                  <Input
                    placeholder="Describe qué debe corregir el superintendente..."
                    value={correctionMessage}
                    onChange={e => setCorrectionMessage(e.target.value)}
                  />
                  <Button variant="outline" className="w-full text-orange-500 border-orange-500/50" onClick={handleCorrection} disabled={isProcessing || !correctionMessage.trim()}>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Solicitar Corrección
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="destructive" className="flex-1" onClick={handleReject} disabled={isProcessing}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Rechazar
                  </Button>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    Aprobar y Pagar
                  </Button>
                </div>
              </>
            )}

            {selectedOrder?.status === 'Aprobado' && (
              <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
                Proceder al Pago
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de mensajes */}
      <Dialog open={isMessagesOpen} onOpenChange={setIsMessagesOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              {selectedOrder?.projectName} — Chat
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 max-h-[300px] overflow-y-auto p-2">
              {messages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">Sin mensajes aún.</p>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.senderType === 'business' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.senderType === 'business'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}>
                      <p className="text-xs font-semibold mb-1 opacity-70">
                        {msg.senderType === 'business' ? 'Tú (Empresa)' : selectedOrder?.superintendentName}
                      </p>
                      <p>{msg.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Escribe un mensaje..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                disabled={isSending}
              />
              <Button onClick={sendMessage} disabled={isSending || !newMessage.trim()}>
                {isSending ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
