'use client';
import { useFirestore } from '@/firebase';
import { collectionGroup, query, doc, updateDoc, deleteDoc, getDocs, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, ShoppingCart, MoreHorizontal, Truck, Package, XCircle, Trash2, Eye, FileDown, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Separator } from '../ui/separator';
import { useState, useEffect } from 'react';
import SignaturePad from './signature-pad';
import { getMaterials, updateMaterialStock, type Material } from '@/lib/materials';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

type OrderStatus = 'Pendiente' | 'En proceso' | 'Enviado' | 'Entregado' | 'Cancelado';

const priorityStyles: {[key: string]: string} = {
    'Urgente': 'bg-red-500 hover:bg-red-500/80',
    'Pronto': 'bg-yellow-500 hover:bg-yellow-500/80',
    'Normal': 'bg-blue-500 hover:bg-blue-500/80',
}

const statusStyles: {[key in OrderStatus]: string} = {
    'Pendiente': 'border-gray-500/50 text-gray-500',
    'En proceso': 'border-blue-500/50 text-blue-500',
    'Enviado': 'border-purple-500/50 text-purple-500',
    'Entregado': 'border-green-500/50 text-green-500',
    'Cancelado': 'border-red-500/50 text-red-500 line-through',
}

export default function OrderList() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [materialsCatalog, setMaterialsCatalog] = useState<Material[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  useEffect(() => {
    const fetchAllOrders = async () => {
      if (!firestore) return;
      setIsLoading(true);
      setError(null);
      try {
        const materialsData = await getMaterials();
        setMaterialsCatalog(materialsData);

        const ordersQuery = query(collectionGroup(firestore, 'orders'), orderBy('createdAt', 'desc'));
        const ordersSnapshot = await getDocs(ordersQuery).catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: '*/orders/*',
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });

        const allOrders = ordersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        setOrders(allOrders);
      } catch (e: any) {
        console.error("Error fetching all orders:", e);
        setError(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllOrders();
  }, [firestore]);

  const handleStatusChange = async (order: any, newStatus: OrderStatus, deliveryData?: any) => {
    const orderDocRef = doc(firestore, 'users', order.userId, 'orders', order.id);
    try {
        const updateData: any = { status: newStatus };
        if (deliveryData) updateData.deliveryConfirmation = deliveryData;

        // RESTAURAR STOCK SI SE CANCELA
        if (newStatus === 'Cancelado' && order.status !== 'Cancelado') {
            for (const item of order.materials) {
                const materialInfo = materialsCatalog.find(m => m.name === item.name);
                if (materialInfo) {
                    await updateMaterialStock(materialInfo.id, item.quantity, 'add');
                }
            }
        }

        await updateDoc(orderDocRef, updateData).catch(error => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: orderDocRef.path,
                operation: 'update',
                requestResourceData: updateData
            }));
            throw error;
        });

        const notificationRef = collection(firestore, 'users', order.userId, 'notifications');
        addDoc(notificationRef, {
          userId: order.userId,
          orderId: order.id,
          message: `El estado de tu pedido "${order.projectName}" ha cambiado a: ${newStatus}.`,
          read: false,
          createdAt: serverTimestamp(),
        });

        setOrders(prev => prev.map(o => o.id === order.id ? {...o, status: newStatus, deliveryConfirmation: deliveryData || o.deliveryConfirmation } : o));
        toast({ title: "Estado Actualizado", description: `Pedido marcado como ${newStatus}.` });
    } catch (e) {
        toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el estado del pedido." });
    }
  }

  const handleDeleteOrder = async (order: any) => {
    setIsDeleting(true);
    const orderDocRef = doc(firestore, 'users', order.userId, 'orders', order.id);
    try {
        await deleteDoc(orderDocRef).catch(error => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: orderDocRef.path, operation: 'delete' }));
            throw error;
        });
        setOrders(prev => prev.filter(o => o.id !== order.id));
        toast({ title: "Pedido Eliminado", description: "El registro ha sido borrado del sistema." });
    } catch(e) {
        toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el registro." });
    } finally {
      setIsDeleting(false);
    }
  }

  const handleSaveSignature = async (signatureDataUrl: string) => {
    if (!selectedOrder) return;
    const confirmedAt = new Date();
    const deliveryData = { signatureDataUrl, confirmedAt: confirmedAt.toISOString() };
    await handleStatusChange(selectedOrder, 'Entregado', deliveryData);
    setIsSignatureModalOpen(false);
  }

  const generateOrderPdf = async () => {
    if (!selectedOrder || materialsCatalog.length === 0) return;
    setIsGeneratingPdf(true);
    try {
        const docPdf = new jsPDF();
        docPdf.setFontSize(18);
        docPdf.text('Tlapaleria los Pinos - Ticket de Pedido', 105, 20, { align: 'center' });
        docPdf.autoTable({
            startY: 30,
            body: [
                ['Folio:', selectedOrder.id],
                ['Obra:', selectedOrder.projectName],
                ['Cliente:', selectedOrder.requesterName],
                ['Total:', `$${selectedOrder.total.toFixed(2)} MXN`]
            ],
            theme: 'plain'
        });
        docPdf.save(`pedido-${selectedOrder.id}.pdf`);
    } catch (error) {
      console.error("Error PDF:", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'><ShoppingCart className="h-5 w-5" /><span>Gestión Global de Pedidos</span></CardTitle>
        <CardDescription>Visualiza y gestiona todos los pedidos de la plataforma.</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog>
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className='text-right'>Acciones</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading && (
                    <TableRow><TableCell colSpan={7} className="text-center h-24"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
                )}
                {error && (
                    <TableRow><TableCell colSpan={7} className="text-center h-24 text-destructive"><div className="flex items-center justify-center gap-2"><AlertTriangle className="h-5 w-5"/><span>Error al cargar pedidos.</span></div></TableCell></TableRow>
                )}
                {!isLoading && !error && orders?.map((order) => {
                  const isFinalState = order.status === 'Entregado' || order.status === 'Cancelado';
                  return (
                    <TableRow key={order.id}>
                        <TableCell>{order.createdAt ? format(order.createdAt.toDate(), 'dd/MM/yy', { locale: es }) : 'N/A'}</TableCell>
                        <TableCell className="font-medium">{order.requesterName}</TableCell>
                        <TableCell>{order.projectName}</TableCell>
                        <TableCell>${order.total.toFixed(2)}</TableCell>
                        <TableCell><Badge className={priorityStyles[order.priority]}>{order.priority}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={statusStyles[order.status as OrderStatus]}>{order.status}</Badge></TableCell>
                        <TableCell className="text-right">
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <DialogTrigger asChild><DropdownMenuItem onSelect={() => setSelectedOrder(order)}><Eye className="mr-2 h-4 w-4" />Ver Resumen</DropdownMenuItem></DialogTrigger>
                                <DropdownMenuItem onSelect={() => { setSelectedOrder(order); setIsSignatureModalOpen(true); }} disabled={isFinalState || !!order.deliveryConfirmation}><Edit className="mr-2 h-4 w-4" />Confirmar Entrega</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleStatusChange(order, 'En proceso')} disabled={isFinalState || order.status === 'En proceso'}><Package className="mr-2 h-4 w-4" />Procesar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(order, 'Enviado')} disabled={isFinalState || order.status === 'Enviado'}><Truck className="mr-2 h-4 w-4" />Enviar</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-amber-600" onClick={() => handleStatusChange(order, 'Cancelado')} disabled={isFinalState}><XCircle className="mr-2 h-4 w-4" />Cancelar (Devolver Stock)</DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteOrder(order)} disabled={isDeleting}><Trash2 className="mr-2 h-4 w-4" />Eliminar Registro</DropdownMenuItem>
                            </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
            </Table>

            <DialogContent className="max-w-3xl">
                {selectedOrder && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Pedido: {selectedOrder.projectName}</DialogTitle>
                            <DialogDescription>Detalles de materiales y entrega.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><p className="font-bold text-muted-foreground">CLIENTE</p><p>{selectedOrder.requesterName}</p></div>
                                <div><p className="font-bold text-muted-foreground">OBRA</p><p>{selectedOrder.projectName}</p></div>
                            </div>
                            <Separator />
                            <Table>
                                <TableHeader><TableRow><TableHead>Material</TableHead><TableHead className="text-center">Cant.</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {selectedOrder.materials.map((m: any, i: number) => (
                                        <TableRow key={i}><TableCell>{m.name}</TableCell><TableCell className="text-center">{m.quantity}</TableCell><TableCell className="text-right">${(m.quantity * (materialsCatalog.find(cat => cat.name === m.name)?.price || 0)).toFixed(2)}</TableCell></TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <DialogFooter>
                            <Button onClick={generateOrderPdf} disabled={isGeneratingPdf}>{isGeneratingPdf ? <Loader2 className="animate-spin h-4 w-4" /> : <FileDown className="mr-2 h-4 w-4" />} Descargar Ticket</Button>
                            <DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
        
        <Dialog open={isSignatureModalOpen} onOpenChange={setIsSignatureModalOpen}>
            <DialogContent className="max-w-xl">
                <DialogHeader><DialogTitle>Confirmación de Entrega</DialogTitle></DialogHeader>
                <div className='py-4'><SignaturePad onSave={handleSaveSignature} /></div>
            </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}