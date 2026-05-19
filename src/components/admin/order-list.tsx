'use client';
import { useFirestore } from '@/firebase';
import { collectionGroup, collection, query, doc, updateDoc, deleteDoc, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
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
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const fetchAllOrders = async () => {
    if (!firestore) return;
    setIsLoading(true);
    setError(null);
    try {
      const materialsData = await getMaterials();
      setMaterialsCatalog(materialsData);

      const ordersQuery = query(collectionGroup(firestore, 'orders'));
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
          ...doc.data(),
          path: doc.ref.path
      }));
      
      setOrders(allOrders);
    } catch (e: any) {
      console.error("Error fetching all orders:", e);
      setError(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllOrders();
  }, [firestore]);

  const handleStatusChange = async (order: any, newStatus: OrderStatus, deliveryData?: any) => {
    if (!firestore) return;
    
    if (!order.userId) {
        toast({ variant: "destructive", title: "Error", description: "ID de usuario no encontrado en el pedido." });
        return;
    }

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
                } else {
                    console.warn(`No se pudo encontrar el material "${item.name}" para devolver el stock.`);
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

        // ✅ CORREGIDO: collection ahora está importado correctamente
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
        console.error("Error updating status:", e);
        toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el estado del pedido." });
    }
  }

  const handleDeleteOrder = async (order: any) => {
    if (!firestore || !order.userId) return;
    if (!confirm("¿Estás seguro de que deseas eliminar este registro permanentemente?")) return;

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
        
        docPdf.setFontSize(10);
        docPdf.text(`Fecha: ${selectedOrder.createdAt ? format(selectedOrder.createdAt.toDate(), 'PPP', { locale: es }) : 'N/A'}`, 14, 30);
        
        docPdf.autoTable({
            startY: 40,
            body: [
                ['Folio:', selectedOrder.id],
                ['Obra:', selectedOrder.projectName],
                ['Cliente:', selectedOrder.requesterName],
                ['Dirección:', `${selectedOrder.street} ${selectedOrder.number}, ${selectedOrder.colony}`],
                ['Total:', `$${selectedOrder.total.toFixed(2)} MXN`]
            ],
            theme: 'plain'
        });

        const tableColumn = ["Material", "Cantidad", "Unitario", "Subtotal"];
        const tableRows = selectedOrder.materials.map((m: any) => {
            const price = materialsCatalog.find(cat => cat.name === m.name)?.price || 0;
            return [m.name, m.quantity, `$${price.toFixed(2)}`, `$${(m.quantity * price).toFixed(2)}` ];
        });

        docPdf.autoTable({
            startY: (docPdf as any).lastAutoTable.finalY + 10,
            head: [tableColumn],
            body: tableRows,
        });

        docPdf.save(`ticket-pedido-${selectedOrder.projectName.replace(/\s+/g, '-')}.pdf`);
    } catch (error) {
      console.error("Error PDF:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
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
                    <TableRow><TableCell colSpan={7} className="text-center h-24 text-destructive"><div className="flex items-center justify-center gap-2"><AlertTriangle className="h-5 w-5"/><span>Error al cargar pedidos. Reintenta.</span></div></TableCell></TableRow>
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
                                <DropdownMenuItem onSelect={() => { setSelectedOrder(order); setIsDetailsModalOpen(true); }}><Eye className="mr-2 h-4 w-4" />Ver Resumen</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => { setSelectedOrder(order); setIsSignatureModalOpen(true); }} disabled={isFinalState || !!order.deliveryConfirmation}><Edit className="mr-2 h-4 w-4" />Confirmar Entrega</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleStatusChange(order, 'En proceso')} disabled={isFinalState || order.status === 'En proceso'}><Package className="mr-2 h-4 w-4" />Procesar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(order, 'Enviado')} disabled={isFinalState || order.status === 'Enviado'}><Truck className="mr-2 h-4 w-4" />Enviar</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-amber-600" onClick={() => handleStatusChange(order, 'Cancelado')} disabled={isFinalState}><XCircle className="mr-2 h-4 w-4" />Cancelar (Reestablecer Stock)</DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteOrder(order)} disabled={isDeleting}><Trash2 className="mr-2 h-4 w-4" />Eliminar Registro</DropdownMenuItem>
                            </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                  );
                })}
                {!isLoading && !error && orders?.length === 0 && (
                     <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No se encontraron pedidos registrados.</TableCell></TableRow>
                )}
            </TableBody>
            </Table>

            {/* Modal de Detalles */}
            <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
                <DialogContent className="max-w-3xl">
                    {selectedOrder && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Detalles del Pedido: {selectedOrder.projectName}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><p className="font-bold text-muted-foreground uppercase text-xs">Solicitante</p><p>{selectedOrder.requesterName}</p></div>
                                    <div><p className="font-bold text-muted-foreground uppercase text-xs">Teléfono</p><p>{selectedOrder.phone}</p></div>
                                    <div className="col-span-2"><p className="font-bold text-muted-foreground uppercase text-xs">Dirección</p><p>{selectedOrder.street} {selectedOrder.number}, {selectedOrder.colony}, {selectedOrder.municipality}</p></div>
                                </div>
                                <Separator />
                                <Table>
                                    <TableHeader><TableRow><TableHead>Material</TableHead><TableHead className="text-center">Cant.</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {selectedOrder.materials.map((m: any, i: number) => {
                                            const unitPrice = materialsCatalog.find(cat => cat.name === m.name)?.price || 0;
                                            return (
                                                <TableRow key={i}>
                                                    <TableCell>{m.name}</TableCell>
                                                    <TableCell className="text-center">{m.quantity}</TableCell>
                                                    <TableCell className="text-right">${(m.quantity * unitPrice).toFixed(2)}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                                <div className="text-right font-bold text-lg">Total: ${selectedOrder.total.toFixed(2)} MXN</div>
                            </div>
                            <DialogFooter>
                                <Button onClick={generateOrderPdf} disabled={isGeneratingPdf}>{isGeneratingPdf ? <Loader2 className="animate-spin h-4 w-4" /> : <FileDown className="mr-2 h-4 w-4" />} Descargar Ticket</Button>
                                <Button variant="outline" onClick={() => setIsDetailsModalOpen(false)}>Cerrar</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
            
            {/* Modal de Firma */}
            <Dialog open={isSignatureModalOpen} onOpenChange={setIsSignatureModalOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader><DialogTitle>Confirmación de Entrega - Firma del Cliente</DialogTitle></DialogHeader>
                    <div className='py-4'><SignaturePad onSave={handleSaveSignature} /></div>
                </DialogContent>
            </Dialog>
      </CardContent>
    </Card>
  );
}