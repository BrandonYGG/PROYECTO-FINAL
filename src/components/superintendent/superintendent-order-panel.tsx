'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase';
import { collection, getDocs, query, where, doc, addDoc, serverTimestamp, onSnapshot, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ShoppingCart, MessageCircle, Send, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

const statusIcons: { [key: string]: any } = {
  'Pendiente de aprobación': Clock,
  'Aprobado': CheckCircle,
  'Rechazado': XCircle,
  'Corrección requerida': AlertCircle,
};

export default function SuperintendentOrderPanel() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!user || !firestore) return;
    setIsLoading(true);

    const ordersRef = collection(firestore, 'users', user.uid, 'orders');
    const unsubscribe = onSnapshot(ordersRef, (snap) => {
      const allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(allOrders.sort((a: any, b: any) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, firestore]);

  const openMessages = (order: any) => {
    setSelectedOrder(order);
    setIsMessagesOpen(true);

    const messagesRef = collection(firestore, 'users', user!.uid, 'orders', order.id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedOrder || !user) return;
    setIsSending(true);
    try {
      const messagesRef = collection(firestore, 'users', user.uid, 'orders', selectedOrder.id, 'messages');
      await addDoc(messagesRef, {
        text: newMessage.trim(),
        senderId: user.uid,
        senderType: 'superintendent',
        createdAt: serverTimestamp(),
      });
      setNewMessage('');
    } catch (e) {
      console.error('Error enviando mensaje:', e);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Mis Pedidos
          </CardTitle>
          <CardDescription>Pedidos enviados a tu empresa para aprobación.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No tienes pedidos aún. Crea uno nuevo.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Mensajes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map(order => {
                  const StatusIcon = statusIcons[order.status];
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="text-sm">
                        {order.createdAt ? format(order.createdAt.toDate(), 'dd/MM/yy', { locale: es }) : 'N/A'}
                      </TableCell>
                      <TableCell className="font-medium">{order.projectName}</TableCell>
                      <TableCell>${order.total?.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusStyles[order.status] || ''}>
                          {StatusIcon && <StatusIcon className="h-3 w-3 mr-1 inline" />}
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openMessages(order)}>
                          <MessageCircle className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                        {order.status === 'Corrección requerida' && (
                          <Button variant="ghost" size="sm" onClick={() => router.push(`/edit-order/${order.id}`)}>
                            Editar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isMessagesOpen} onOpenChange={setIsMessagesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              {selectedOrder?.projectName} — Mensajes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedOrder && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">Estado:</span>
                <Badge variant="outline" className={statusStyles[selectedOrder.status] || ''}>
                  {selectedOrder.status}
                </Badge>
              </div>
            )}
            <div className="space-y-2 max-h-[300px] overflow-y-auto p-2">
              {messages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">Sin mensajes aún.</p>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.senderType === 'superintendent' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.senderType === 'superintendent'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}>
                      <p className="text-xs font-semibold mb-1 opacity-70">
                        {msg.senderType === 'superintendent' ? 'Tú' : 'Empresa'}
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