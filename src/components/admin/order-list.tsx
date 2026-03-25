'use client';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, doc, updateDoc, deleteDoc, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, AlertTriangle, ShoppingCart, MoreHorizontal, Truck, Package, XCircle, Trash2, Eye, FileDown, MapPin, Edit, DownloadCloud } from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Separator } from '../ui/separator';
import { useState, useEffect, useRef } from 'react';
import SignaturePad from './signature-pad';
import { Calendar } from '../ui/calendar';
import { getMaterials, type Material } from '@/lib/materials';

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
  const calendarRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const fetchAllOrders = async () => {
      setIsLoading(true);
      setError(null);
      if (!firestore) {
        setIsLoading(false);
        return;
      }
      try {
        const [usersSnapshot, materialsData] = await Promise.all([
          getDocs(collection(firestore, 'users')),
          getMaterials()
        ]);
        setMaterialsCatalog(materialsData);

        const allOrders: any[] = [];
        
        for (const userDoc of usersSnapshot.docs) {
          const ordersCollectionRef = collection(firestore, 'users', userDoc.id, 'orders');
          const ordersSnapshot = await getDocs(ordersCollectionRef);
          ordersSnapshot.forEach(orderDoc => {
            allOrders.push({ id: orderDoc.id, ...orderDoc.data() });
          });
        }
        
        allOrders.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());
        setOrders(allOrders);

      } catch (e: any) {
        console.error("Error fetching all orders:", e);
        setError(e);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: '/users/{userId}/orders',
            operation: 'list',
        }));
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
        if (deliveryData) {
            updateData.deliveryConfirmation = deliveryData;
        }

        await updateDoc(orderDocRef, updateData)
        .catch(error => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: orderDocRef.path,
                operation: 'update',
                requestResourceData: updateData
            }));
            throw error;
        });

        const notificationRef = collection(firestore, 'users', order.userId, 'notifications');
        const notificationMessage = `El estado de tu pedido para la obra "${order.projectName}" ha cambiado a: ${newStatus}.`;
        
        addDoc(notificationRef, {
          userId: order.userId,
          orderId: order.id,
          message: notificationMessage,
          read: false,
          createdAt: serverTimestamp(),
        }).catch(error => {
            console.error("Failed to create notification:", error);
        });

        setOrders(prevOrders => prevOrders.map(o => o.id === order.id ? {...o, status: newStatus, deliveryConfirmation: deliveryData || o.deliveryConfirmation } : o));

        toast({
            title: "Estado del Pedido Actualizado",
            description: `El pedido ahora está "${newStatus}".`,
        });
    } catch (e) {
        console.error("Error al actualizar estado: ", e);
        toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo actualizar el estado del pedido.",
        });
    }
  }

  const handleDeleteOrder = async (order: any) => {
    setIsDeleting(true);
    const orderDocRef = doc(firestore, 'users', order.userId, 'orders', order.id);
    try {
        await deleteDoc(orderDocRef)
        .catch(error => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: orderDocRef.path,
                operation: 'delete',
            }));
            throw error;
        });

        const notificationRef = collection(firestore, 'users', order.userId, 'notifications');
        const notificationMessage = `Tu pedido para la obra "${order.projectName}" ha sido cancelado y eliminado por un administrador.`;
        
        addDoc(notificationRef, {
          userId: order.userId,
          orderId: order.id,
          message: notificationMessage,
          read: false,
          createdAt: serverTimestamp(),
        }).catch(error => {
            console.error("Failed to create delete notification:", error);
        });
        
        setOrders(prevOrders => prevOrders.filter(o => o.id !== order.id));

        toast({
            title: "Pedido Eliminado",
            description: "El pedido ha sido borrado permanentemente y se ha notificado al usuario.",
        });
    } catch(e) {
        console.error("Error al eliminar pedido:", e);
        toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo eliminar el pedido.",
        });
    } finally {
      setIsDeleting(false);
    }
  }

  const handleViewDetails = (order: any) => {
    setSelectedOrder(order);
  };

  const generateConfirmationPdf = (order: any, signatureDataUrl: string, confirmedAt: Date) => {
    const docPdf = new jsPDF();
    const pageWidth = docPdf.internal.pageSize.getWidth();
    
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(20);
    docPdf.text('Confirmación de Entrega de Material', pageWidth / 2, 20, { align: 'center' });

    docPdf.setFontSize(11);
    docPdf.setFont('helvetica', 'normal');
    const deliveryDate = format(confirmedAt, "dd 'de' MMMM 'de' yyyy 'a las' HH:mm 'hrs.'", { locale: es });
    
    const bodyText = `Por medio del presente documento, yo, ${order.requesterName}, en mi calidad de receptor, hago constar que he recibido a mi entera y total satisfacción el conjunto de materiales especificados en el pedido con folio ${order.id}, el cual está destinado para la obra denominada "${order.projectName}".\n\nLa entrega fue efectuada en la fecha y hora: ${deliveryDate}.\n\nLa firma que se estampa a continuación funge como prueba irrefutable de la recepción de los bienes y de la conformidad con la calidad y cantidad de los mismos, no reservándome acción o derecho alguno que ejercitar en contra de Tlapaleria los Pinos por este concepto.`;
    
    const splitText = docPdf.splitTextToSize(bodyText, 180);
    docPdf.text(splitText, 14, 40);
    
    docPdf.setFont('helvetica', 'bold');
    docPdf.text('Firma de Recepción:', pageWidth / 2, 115, { align: 'center' });
    docPdf.addImage(signatureDataUrl, 'PNG', (pageWidth / 2) - 50, 120, 100, 40);
    docPdf.line( (pageWidth / 2) - 50, 165, (pageWidth / 2) + 50, 165);
    docPdf.setFont('helvetica', 'normal');
    docPdf.text(order.requesterName, pageWidth / 2, 170, { align: 'center' });
    docPdf.setFontSize(10);
    docPdf.text("Nombre y Firma de Quien Recibe", pageWidth / 2, 175, { align: 'center' });

    return docPdf;
};


  const handleSaveSignature = async (signatureDataUrl: string) => {
    if (!selectedOrder) return;
    
    const confirmedAt = new Date();
    const deliveryData = {
        signatureDataUrl,
        confirmedAt: confirmedAt.toISOString(),
    };

    const docPdf = generateConfirmationPdf(selectedOrder, signatureDataUrl, confirmedAt);
    docPdf.save(`confirmacion-entrega-${selectedOrder.id}.pdf`);
    
    await handleStatusChange(selectedOrder, 'Entregado', deliveryData);
    
    setIsSignatureModalOpen(false);
    toast({
        title: "Entrega Confirmada",
        description: "Se ha generado el PDF de confirmación y el pedido se marcó como 'Entregado'."
    });
  }

  const downloadConfirmationPdf = (order: any) => {
    if (!order.deliveryConfirmation?.signatureDataUrl) return;
    const confirmedAt = new Date(order.deliveryConfirmation.confirmedAt);
    const docPdf = generateConfirmationPdf(order, order.deliveryConfirmation.signatureDataUrl, confirmedAt);
    docPdf.save(`confirmacion-entrega-${order.id}.pdf`);
  };

  const generateOrderPdf = async () => {
    if (!selectedOrder || materialsCatalog.length === 0) return;
    setIsGeneratingPdf(true);
  
    try {
        const doc = new jsPDF();
        let lastY = 20;
  
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('Tlapaleria los Pinos', 105, lastY, { align: 'center' });
        lastY += 10;
  
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const details = [
            { title: 'Folio:', content: selectedOrder.id },
            { title: 'Solicitante:', content: selectedOrder.requesterName },
            { title: 'Obra:', content: selectedOrder.projectName },
            { title: 'Dirección:', content: `${selectedOrder.street} ${selectedOrder.number}, ${selectedOrder.colony}, ${selectedOrder.municipality}, ${selectedOrder.state}, C.P. ${selectedOrder.postalCode}` },
            { title: 'Teléfono:', content: selectedOrder.phone },
        ];
        doc.autoTable({
            startY: lastY,
            body: details,
            theme: 'plain',
            styles: { cellPadding: { top: 1, right: 2, bottom: 1, left: 0 }, fontSize: 10 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 1: { cellWidth: 'auto' } },
        });
        lastY = (doc as any).lastAutoTable.finalY + 10;
  
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Detalles del Pedido', 14, lastY);
        lastY += 5;
  
        const tableColumn = ["Descripción", "Cantidad", "P. Unitario", "Importe"];
        const tableRows = selectedOrder.materials.map((material: any) => {
            const materialInfo = materialsCatalog.find(m => m.name === material.name);
            const unitPrice = materialInfo?.price || 0;
            const subtotal = material.quantity * unitPrice;
            return [material.name, `${material.quantity} ${materialInfo?.unit}(s)`, `$${unitPrice.toFixed(2)}`, `$${subtotal.toFixed(2)}`];
        });
        doc.autoTable({
            startY: lastY,
            head: [tableColumn],
            body: tableRows,
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            styles: { fontSize: 10 },
        });
        lastY = (doc as any).lastAutoTable.finalY + 10;
  
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Total del Pedido:', 140, lastY, { align: 'right' });
        doc.text(`$${selectedOrder.total.toFixed(2)} MXN`, 200, lastY, { align: 'right' });
        lastY += 15;

        if (calendarRef.current) {
            if (lastY > 220) {
              doc.addPage();
              lastY = 20;
            }
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Periodo de Entrega Programado', 14, lastY);
            lastY += 10;
            const canvas = await html2canvas(calendarRef.current, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = doc.internal.pageSize.getWidth() - 28;
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            doc.addImage(imgData, 'PNG', 14, lastY, pdfWidth, pdfHeight);
        }
  
        doc.save(`pedido-${selectedOrder.projectName.replace(/\s/g, '_') || 'resumen'}.pdf`);
  
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <ShoppingCart className="h-5 w-5" />
          <span>Pedidos de Clientes</span>
        </CardTitle>
        <CardDescription>Lista de todos los pedidos realizados en la plataforma.</CardDescription>
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
                <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                </TableRow>
                )}
                {error && (
                <TableRow>
                    <TableCell colSpan={7} className="text-center h-24 text-destructive">
                    <div className="flex items-center justify-center gap-2">
                        <AlertTriangle className="h-5 w-5"/>
                        <span>Error al cargar pedidos: Permisos insuficientes.</span>
                    </div>
                    </TableCell>
                </TableRow>
                )}
                {!isLoading && !error && orders?.map((order) => {
                  const isFinalState = order.status === 'Entregado' || order.status === 'Cancelado';
                  return (
                    <TableRow key={order.id}>
                        <TableCell>
                        {order.createdAt ? format(order.createdAt.toDate(), 'dd/MM/yyyy', { locale: es }) : 'N/A'}
                        </TableCell>
                        <TableCell>{order.requesterName}</TableCell>
                        <TableCell>{order.projectName}</TableCell>
                        <TableCell>${order.total.toFixed(2)}</TableCell>
                        <TableCell>
                            <Badge className={priorityStyles[order.priority] || 'bg-gray-400'}>
                                {order.priority}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className={statusStyles[order.status as OrderStatus] || ''}>
                                {order.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menú</span>
                                <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <DialogTrigger asChild>
                                <DropdownMenuItem onSelect={() => handleViewDetails(order)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Ver Detalles del Pedido
                                </DropdownMenuItem>
                                </DialogTrigger>

                                <DropdownMenuItem 
                                  onSelect={() => {
                                      handleViewDetails(order);
                                      setIsSignatureModalOpen(true);
                                  }}
                                  disabled={order.status === 'Cancelado' || order.status === 'Pendiente' || order.status === 'En proceso' || !!order.deliveryConfirmation}
                                >
                                      <Edit className="mr-2 h-4 w-4" />
                                      Confirmar Entrega
                                </DropdownMenuItem>

                                {order.status === 'Entregado' && order.deliveryConfirmation && (
                                  <DropdownMenuItem onSelect={() => downloadConfirmationPdf(order)}>
                                      <DownloadCloud className="mr-2 h-4 w-4" />
                                      Descargar Confirmación
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleStatusChange(order, 'En proceso')} 
                                  disabled={isFinalState || order.status === 'En proceso' || order.status === 'Enviado'}
                                >
                                    <Package className="mr-2 h-4 w-4" />
                                    Marcar como "En proceso"
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleStatusChange(order, 'Enviado')}
                                  disabled={isFinalState || order.status === 'Enviado'}
                                >
                                    <Truck className="mr-2 h-4 w-4" />
                                    Marcar como "Enviado"
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-amber-600 focus:text-amber-700 focus:bg-amber-50" 
                                  onClick={() => handleStatusChange(order, 'Cancelado')}
                                  disabled={isFinalState}
                                >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancelar Pedido
                                </DropdownMenuItem>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Borrar Pedido
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta acción no se puede deshacer. Esto eliminará permanentemente el pedido de la base de datos.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteOrder(order)} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Sí, borrar pedido'}
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>

                            </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                  );
                })}
                {!isLoading && !error && orders?.length === 0 && (
                <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No se encontraron pedidos.
                    </TableCell>
                </TableRow>
                )}
            </TableBody>
            </Table>

            <DialogContent className="max-w-3xl">
                {selectedOrder && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Resumen del Pedido: {selectedOrder.projectName}</DialogTitle>
                            <DialogDescription>
                                Realizado por {selectedOrder.requesterName} el {format(selectedOrder.createdAt.toDate(), 'dd/MM/yyyy', { locale: es })}.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="max-h-[60vh] overflow-y-auto p-4">
                            <div className="text-sm space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <h3 className="font-bold uppercase text-muted-foreground">Solicitante:</h3>
                                        <p>{selectedOrder.requesterName}</p>
                                    </div>
                                    <div>
                                        <h3 className="font-bold uppercase text-muted-foreground">Obra:</h3>
                                        <p>{selectedOrder.projectName}</p>
                                    </div>
                                </div>
                                 <div>
                                    <h3 className="font-bold uppercase text-muted-foreground">Teléfono:</h3>
                                    <p>{selectedOrder.phone}</p>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-bold uppercase text-muted-foreground flex items-center gap-2"><MapPin className="h-4 w-4"/>Dirección de Entrega:</h3>
                                    <p className="text-lg">{selectedOrder.street} {selectedOrder.number}, {selectedOrder.colony}, {selectedOrder.municipality}, {selectedOrder.state}, C.P. {selectedOrder.postalCode}</p>
                                </div>
                            </div>

                            <Separator className="my-4 bg-gray-300" />
                            
                            <h3 className="font-bold uppercase text-center mb-2">Detalles del Pedido</h3>
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="text-center">Cantidad</TableHead>
                                    <TableHead className="text-right">P. Unitario</TableHead>
                                    <TableHead className="text-right">Importe</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {selectedOrder.materials.map((material: any, index: number) => {
                                    const materialInfo = materialsCatalog.find(m => m.name === material.name);
                                    const unitPrice = materialInfo?.price || 0;
                                    const subtotal = material.quantity * unitPrice;
                                    return (
                                    <TableRow key={index}>
                                        <TableCell className="capitalize">{material.name}</TableCell>
                                        <TableCell className="text-center">{material.quantity} {materialInfo?.unit}(s)</TableCell>
                                        <TableCell className="text-right">${unitPrice.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">${subtotal.toFixed(2)}</TableCell>
                                    </TableRow>
                                    )
                                })}
                                </TableBody>
                                <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={3} className="text-right font-bold text-lg">Total del Pedido:</TableCell>
                                    <TableCell className="text-right font-bold text-lg">${selectedOrder.total.toFixed(2)} MXN</TableCell>
                                </TableRow>
                                </TableFooter>
                            </Table>
                            
                            <Separator className="my-4 bg-gray-300" />
                            
                            <div ref={calendarRef} className="flex flex-col items-center bg-white">
                                <h3 className="font-bold uppercase mb-2">Periodo de Entrega Programado</h3>
                                <Calendar
                                    mode="range"
                                    selected={{ from: selectedOrder.deliveryDates.from.toDate(), to: selectedOrder.deliveryDates.to.toDate() }}
                                    defaultMonth={selectedOrder.deliveryDates.from.toDate()}
                                    locale={es}
                                    numberOfMonths={2}
                                    className="p-0"
                                    classNames={{
                                      head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
                                      cell: "h-8 w-8 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                                      day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
                                      day_selected: "bg-primary/20 text-primary-foreground",
                                      day_today: "bg-primary/90 text-primary-foreground rounded-md",
                                      day_range_start: "day-range-start !bg-red-500 !text-white rounded-md",
                                      day_range_end: "day-range-end !bg-green-500 !text-white rounded-md",
                                      day_range_middle: "aria-selected:bg-primary/20 aria-selected:text-primary-foreground"
                                    }}
                                    disabled
                                 />
                            </div>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button onClick={generateOrderPdf} disabled={isGeneratingPdf}>
                                {isGeneratingPdf ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Generando...
                                    </>
                                ) : (
                                    <>
                                        <FileDown className="mr-2 h-4 w-4" />
                                        Descargar PDF
                                    </>
                                )}
                            </Button>
                            <DialogClose asChild>
                                <Button variant="outline">Cerrar</Button>
                            </DialogClose>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
        
        <Dialog open={isSignatureModalOpen} onOpenChange={setIsSignatureModalOpen}>
            <DialogContent className="max-w-xl">
                {selectedOrder && (
                    <>
                    <DialogHeader>
                        <DialogTitle>Confirmación de Entrega</DialogTitle>
                        <DialogDescription>
                            El cliente debe firmar para confirmar la recepción de los materiales del pedido para la obra "{selectedOrder.projectName}".
                        </DialogDescription>
                    </DialogHeader>
                    <div className='py-4'>
                        <p className='text-sm text-muted-foreground mb-4'>
                            Yo, <span className='font-bold'>{selectedOrder.requesterName}</span>, confirmo haber recibido a mi entera satisfacción los materiales correspondientes a este pedido.
                        </p>
                        <SignaturePad onSave={handleSaveSignature} />
                    </div>
                    </>
                )}
            </DialogContent>
        </Dialog>

      </CardContent>
    </Card>
  );
}