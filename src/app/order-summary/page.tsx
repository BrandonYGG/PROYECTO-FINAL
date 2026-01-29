'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, FileDown, Home, MapPin, PackageCheck, Truck, CircleHelp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { DeliveryMap } from '@/components/maps/delivery-map';
import { Badge } from '@/components/ui/badge';
import { materialsList } from '@/lib/materials';


// Aumenta jsPDF con el método autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const statusConfig = {
    'Pendiente': { title: '¡Pedido Recibido!', description: 'Hemos recibido tu pedido y lo estamos procesando.', icon: <CircleHelp className="h-12 w-12 text-gray-500" />, color: 'text-gray-500' },
    'En proceso': { title: '¡Pedido en Proceso!', description: 'Estamos preparando tus materiales para el envío.', icon: <PackageCheck className="h-12 w-12 text-blue-500" />, color: 'text-blue-500' },
    'Enviado': { title: '¡Tu Pedido va en Camino!', description: 'Tus materiales han sido enviados y llegarán pronto.', icon: <Truck className="h-12 w-12 text-purple-500" />, color: 'text-purple-500' },
    'Entregado': { title: '¡Pedido Entregado!', description: 'Tus materiales han sido entregados con éxito. ¡Gracias por tu compra!', icon: <CheckCircle className="h-12 w-12 text-green-500" />, color: 'text-green-500' },
    'Cancelado': { title: 'Pedido Cancelado', description: 'Este pedido ha sido cancelado.', icon: <AlertTriangle className="h-12 w-12 text-red-500" />, color: 'text-red-500' },
};


function OrderSummaryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();

  const userId = searchParams.get('userId');
  const orderId = searchParams.get('orderId');

  const orderDocRef = useMemoFirebase(() => {
    // El administrador puede pasar cualquier userId, el usuario normal solo puede usar el suyo
    const effectiveUserId = user?.uid === userId || user?.providerData.some(p => p.providerId === 'admin') ? userId : user?.uid;
    return (effectiveUserId && orderId) ? doc(firestore, 'users', effectiveUserId, 'orders', orderId) : null;
  }, [firestore, orderId, userId, user]);
  
  const { data: orderData, isLoading: isOrderLoading, error } = useDoc(orderDocRef);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";


  useEffect(() => {
    if (error) {
        console.error("Error al cargar el pedido:", error);
        router.push('/profile');
    }
  }, [error, router]);

  const generatePdf = async () => {
    if (!orderData || !summaryRef.current) return;
    setIsGeneratingPdf(true);
  
    try {
      const doc = new jsPDF();
      let lastY = 20; // Initial Y position
  
      // --- Encabezado ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Tlapaleria los Pinos', 105, lastY, { align: 'center' });
      lastY += 10;
  
      // --- Información del Pedido ---
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const details = [
        { title: 'Solicitante:', content: orderData.requesterName },
        { title: 'Obra:', content: orderData.projectName },
        { title: 'Dirección:', content: `${orderData.street} ${orderData.number}, ${orderData.colony}, ${orderData.municipality}, ${orderData.state}, C.P. ${orderData.postalCode}` },
        { title: 'Teléfono:', content: orderData.phone },
      ];
      doc.autoTable({
        startY: lastY,
        body: details,
        theme: 'plain',
        styles: { cellPadding: { top: 1, right: 2, bottom: 1, left: 0 }, fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 1: { cellWidth: 'auto' } },
      });
      lastY = (doc as any).lastAutoTable.finalY + 10;
  
      // --- Mapa de Ubicación ---
      if (orderData.location) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Ubicación de Entrega', 14, lastY);
        lastY += 5;
        const { lat, lng } = orderData.location;
        const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=600x300&maptype=roadmap&markers=color:red%7C${lat},${lng}&key=${mapsApiKey}`;
        try {
          const response = await fetch(mapUrl);
          const imageBlob = await response.blob();
          const reader = new FileReader();
          reader.readAsDataURL(imageBlob);
          await new Promise<void>(resolve => {
            reader.onloadend = () => {
              doc.addImage(reader.result as string, 'PNG', 14, lastY, 180, 70);
              lastY += 75;
              resolve();
            };
          });
        } catch (mapError) {
          console.error("Error fetching static map:", mapError);
          lastY += 5; // Add some space even if map fails
        }
      }
  
      // --- Detalles del Pedido (Tabla) ---
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Detalles del Pedido', 14, lastY);
      lastY += 5;
      const tableColumn = ["Descripción", "Cantidad", "P. Unitario", "Importe"];
      const tableRows = orderData.materials.map((material: any) => {
        const materialInfo = materialsList.find(m => m.name === material.name);
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
  
      // --- Total del Pedido ---
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Total del Pedido:', 140, lastY, { align: 'right' });
      doc.text(`$${orderData.total.toFixed(2)} MXN`, 200, lastY, { align: 'right' });
      lastY += 15;
  
      // --- Calendario de Entrega ---
      if (calendarRef.current) {
        // Check if there is enough space, otherwise add a new page
        if (lastY > 220) { // 220 is a heuristic value, adjust if needed
          doc.addPage();
          lastY = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Periodo de Entrega Programado', 14, lastY);
        lastY += 10;
  
        const canvas = await html2canvas(calendarRef.current, {
          scale: 2, // Increase scale for better resolution
          backgroundColor: null, // Use transparent background
        });
        const imgData = canvas.toDataURL('image/png');
        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = doc.internal.pageSize.getWidth() - 28; // with margins
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        doc.addImage(imgData, 'PNG', 14, lastY, pdfWidth, pdfHeight);
        lastY += pdfHeight + 10;
      }
  
      doc.save(`pedido-${orderData.projectName.replace(/\s/g, '_') || 'resumen'}.pdf`);
  
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };


  if (isOrderLoading || !orderData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-14rem)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  const {
    requesterName,
    projectName,
    phone,
    street,
    number,
    colony,
    postalCode,
    state,
    municipality,
    materials,
    deliveryDates,
    total,
    location,
    status
  } = orderData;
  
  const deliveryStart = new Date(deliveryDates.from.seconds * 1000);
  const deliveryEnd = new Date(deliveryDates.to.seconds * 1000);
  const fullAddress = `${street} ${number}, ${colony}, ${municipality}, ${state}, C.P. ${postalCode}`;

  const currentStatusConfig = statusConfig[status as keyof typeof statusConfig] || statusConfig['Pendiente'];


  return (
    <div className="container mx-auto py-12 px-4 animate-fade-in">
      <Card ref={summaryRef} className="max-w-4xl mx-auto shadow-lg">
          <CardHeader>
              <div className="flex flex-col items-center text-center">
                  <div className={`mb-4 ${currentStatusConfig.color}`}>{currentStatusConfig.icon}</div>
                  <CardTitle className="text-3xl font-bold font-headline">{currentStatusConfig.title}</CardTitle>
                  <CardDescription className="mt-2">{currentStatusConfig.description}</CardDescription>
              </div>
          </CardHeader>

          {/* Este contenido es solo para mostrar, el PDF se genera programáticamente */}
          <div className="p-6 sm:p-8 bg-white text-black rounded-lg">
              <div className="flex justify-center items-center mb-4">
                  <Logo />
              </div>
              <Separator className="my-4 bg-gray-300" />
              
              <div className="text-sm space-y-4">
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <h3 className="font-bold uppercase text-muted-foreground">Solicitante:</h3>
                            <p>{requesterName}</p>
                        </div>
                        <div>
                            <h3 className="font-bold uppercase text-muted-foreground">Obra:</h3>
                            <p>{projectName}</p>
                        </div>
                         <div>
                            <h3 className="font-bold uppercase text-muted-foreground">Estado del Pedido:</h3>
                             <Badge variant={status === 'Entregado' ? 'default' : 'secondary'} className={`${currentStatusConfig.color} border-current`}>
                                {status}
                            </Badge>
                        </div>
                    </div>
                  <div>
                      <h3 className="font-bold uppercase text-muted-foreground">Teléfono:</h3>
                      <p>{phone}</p>
                  </div>
                  <div className="space-y-2">
                      <h3 className="font-bold uppercase text-muted-foreground flex items-center gap-2"><MapPin className="h-4 w-4"/>Ubicación de Entrega:</h3>
                      <p>{fullAddress}</p>
                       <div className="h-[250px] w-full rounded-lg overflow-hidden border">
                          <DeliveryMap apiKey={mapsApiKey} address={fullAddress} initialCoordinates={location} />
                       </div>
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
                  {materials.map((material: any, index: number) => {
                    const materialInfo = materialsList.find(m => m.name === material.name);
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
                    <TableCell className="text-right font-bold text-lg">${total.toFixed(2)} MXN</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
              
              <Separator className="my-4 bg-gray-300" />
              
              <div ref={calendarRef} className="flex flex-col items-center bg-white">
                  <h3 className="font-bold uppercase mb-2">Periodo de Entrega Programado</h3>
                   <Calendar
                      mode="range"
                      selected={{ from: deliveryStart, to: deliveryEnd }}
                      defaultMonth={deliveryStart}
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

          <CardFooter className="flex flex-col sm:flex-row justify-center gap-4 pt-6 bg-slate-50 rounded-b-lg border-t">
              <Button onClick={generatePdf} disabled={isGeneratingPdf}>
                  {isGeneratingPdf ? (
                      <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generando PDF...
                      </>
                  ) : (
                      <>
                          <FileDown className="mr-2 h-4 w-4" />
                          Descargar Ticket (PDF)
                      </>
                  )}
              </Button>
               <Button variant="outline" onClick={() => router.push('/')}>
                  <Home className="mr-2 h-4 w-4" />
                  Volver al Inicio
              </Button>
          </CardFooter>
      </Card>
    </div>
  );
}

export default function OrderSummaryPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>}>
            <OrderSummaryContent />
        </Suspense>
    )
}
