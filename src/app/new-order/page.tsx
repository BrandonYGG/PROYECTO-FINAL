'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { mexicoStates, State } from '@/lib/mexico-states';
import { useState, useEffect, useMemo } from "react";
import { CalendarIcon, Plus, Trash2, Loader2, Search, FolderTree, Check, Phone } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useFirestore, useUser } from "@/firebase";
import { addDoc, collection, serverTimestamp, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress } from "@/app/actions/geocode-actions";
import { getMaterials, type Material } from "@/lib/materials";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import PaymentMethodModal from "@/components/profile/payment-method-modal";

const materialOrderSchema = z.object({
  name: z.string().min(1, { message: "Debes seleccionar un material." }),
  quantity: z.coerce.number().int({ message: "La cantidad debe ser un número entero." }).min(1, { message: "La cantidad debe ser al menos 1." }),
});

const orderSchema = z.object({
  requesterName: z.string().min(1, { message: "El nombre es requerido." }),
  projectName: z.string().min(1, { message: "El nombre de la obra es requerido." }),
  phone: z.string().min(10, { message: "El teléfono debe tener al menos 10 dígitos." }).regex(/^\d+$/, { message: "Solo se permiten números." }),
  street: z.string().min(1, { message: "La calle es requerida." }),
  number: z.string().min(1, {message: 'El número exterior es requerido.'}).regex(/^\d+$/, { message: "Solo se permiten números." }),
  colony: z.string().min(1, { message: "La colonia es requerida." }),
  postalCode: z.string().min(5, { message: "El código postal debe tener 5 dígitos." }).regex(/^\d+$/, { message: "Solo se permiten números." }),
  state: z.string().min(1, { message: "Debes seleccionar un estado." }),
  municipality: z.string().min(1, { message: "Debes seleccionar un municipio/delegación." }),
  materials: z.array(materialOrderSchema).min(1, { message: "Debes añadir al menos un material." }),
  deliveryDates: z.object({
    from: z.date({ required_error: "La fecha de inicio es requerida."}),
    to: z.date({ required_error: "La fecha de fin es requerida."}),
  }, { required_error: "Debes seleccionar un rango de fechas completo." }),
});

type OrderFormData = z.infer<typeof orderSchema>;

function getPriorityFromDate(startDate: Date): 'Urgente' | 'Pronto' | 'Normal' {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const diffTime = start.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 3) return 'Urgente';
    if (diffDays <= 7) return 'Pronto';
    return 'Normal';
}

function MaterialImage({ src, alt, className }: { src: string | null | undefined, alt: string, className?: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className={cn("bg-muted flex items-center justify-center text-muted-foreground text-xs rounded", className)}>
        📦
      </div>
    );
  }
  return (
    <img src={src} alt={alt} className={cn("object-cover rounded", className)} onError={() => setError(true)} />
  );
}

export default function NewOrderPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [materialsList, setMaterialsList] = useState<Material[]>([]);
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(true);
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [pendingOrderData, setPendingOrderData] = useState<any>(null);

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      requesterName: '',
      projectName: '',
      phone: '',
      street: '',
      number: '',
      colony: '',
      postalCode: '',
      state: '',
      municipality: '',
      materials: [{ name: '', quantity: 1 }],
      deliveryDates: { from: undefined as any, to: undefined as any },
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "materials" });
  const watchedMaterials = useWatch({ control: form.control, name: "materials" });

  useEffect(() => {
    setMounted(true);
    getMaterials().then(m => {
      setMaterialsList(m);
      setIsMaterialsLoading(false);
    });
  }, []);

  const hierarchicalMaterials = useMemo(() => {
    const hierarchy: Record<string, Record<string, Material[]>> = {};
    materialsList.forEach(m => {
      const f = String(m.family || 'General');
      const sf = String(m.subfamily || 'Varios');
      if (!hierarchy[f]) hierarchy[f] = {};
      if (!hierarchy[f][sf]) hierarchy[f][sf] = [];
      hierarchy[f][sf].push(m);
    });
    return hierarchy;
  }, [materialsList]);

  const watchState = form.watch('state');

  const total = useMemo(() => {
    return (watchedMaterials || []).reduce((acc, current) => {
      const materialInfo = materialsList.find(m => m.name === current.name);
      return acc + ((materialInfo?.price || 0) * (Number(current.quantity) || 0));
    }, 0);
  }, [watchedMaterials, materialsList]);

  useEffect(() => {
    if (watchState) {
      setSelectedState(mexicoStates.find(s => s.nombre === watchState) || null);
    }
  }, [watchState]);

  async function handleInitialSubmit(values: OrderFormData) {
    if (!user || !firestore) return;
    if (total <= 0) {
      toast({ variant: "destructive", title: "Error en el pedido", description: "Debes seleccionar al menos un material con cantidad válida." });
      return;
    }

    setIsProcessing(true);
    try {
      const priority = getPriorityFromDate(values.deliveryDates.from);
      let location = { lat: 19.4326, lng: -99.1332 };
      try {
        const fullAddress = `${values.street} ${values.number}, ${values.colony}, ${values.municipality}, ${values.state}`;
        const geocoded = await geocodeAddress({ address: fullAddress });
        if (geocoded) location = geocoded;
      } catch (e) { console.warn("Geo fallback"); }

      // Obtener tipo de usuario
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const userType = userDocSnap.exists() ? userDocSnap.data().userType : 'normal';
      const isSuperintendent = userType === 'superintendent';

      const orderData = {
        ...values,
        location,
        total,
        userId: user.uid,
        priority,
        status: isSuperintendent ? 'Pendiente de aprobación' : 'Pendiente de pago',
        paymentMethod: null,
        createdAt: serverTimestamp(),
        // Si es superintendente, guardar referencia a su empresa
        ...(isSuperintendent && userDocSnap.exists() && {
          businessId: userDocSnap.data().businessId,
          superintendentId: user.uid,
          superintendentName: `${userDocSnap.data().firstName} ${userDocSnap.data().lastName}`,
        }),
      };

      const ordersRef = collection(firestore, 'users', user.uid, 'orders');
      const docRef = await addDoc(ordersRef, orderData).catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: ordersRef.path,
          operation: 'create',
          requestResourceData: orderData
        }));
        throw error;
      });

      if (isSuperintendent) {
        toast({
          title: "¡Pedido enviado!",
          description: "Tu pedido fue enviado a tu empresa para aprobación.",
        });
        router.push('/profile');
      } else {
        setCreatedOrderId(docRef.id);
        setPendingOrderData({ id: docRef.id, projectName: values.projectName, total, requesterName: values.requesterName, userId: user.uid });
        setIsPaymentModalOpen(true);
      }

    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Ocurrió un error al procesar el pedido." });
    } finally {
      setIsProcessing(false);
    }
  }

  const handlePaymentConfirm = async (method: 'transferencia' | 'oxxo') => {
    if (!createdOrderId || !user) return;
    try {
      const orderRef = doc(firestore, 'users', user.uid, 'orders', createdOrderId);
      await updateDoc(orderRef, { paymentMethod: method });

      setIsPaymentModalOpen(false);
      toast({
        title: "¡Pedido registrado!",
        description: `Tu pedido está reservado. Envía tu comprobante de ${method === 'transferencia' ? 'transferencia' : 'depósito OXXO'} por WhatsApp.`,
      });
      router.push('/profile');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el método de pago." });
    }
  };

  // ✅ Bug #2 fix: si cierra el modal sin confirmar, borrar el pedido huérfano
  const handlePaymentModalClose = async () => {
    if (createdOrderId && user) {
      try {
        await deleteDoc(doc(firestore, 'users', user.uid, 'orders', createdOrderId));
      } catch (e) {
        console.warn('No se pudo borrar el pedido huérfano:', e);
      }
    }
    setIsPaymentModalOpen(false);
    setCreatedOrderId(null);
    setPendingOrderData(null);
  };

  const onInvalid = (errors: any) => {
    const errorFields = Object.keys(errors).map(key => {
      if (key === 'deliveryDates') return 'Periodo de Entrega (necesitas inicio y fin)';
      if (key === 'materials') return 'Materiales';
      if (key === 'phone') return 'Teléfono (10 dígitos)';
      if (key === 'colony') return 'Colonia';
      return key;
    }).join(", ");
    toast({
      variant: "destructive",
      title: "Formulario Incompleto",
      description: `Por favor revisa los campos: ${errorFields}. Asegúrate de que el total sea mayor a 0.`,
    });
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto py-12 px-4 animate-fade-in">
        <Card className="max-w-4xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold font-headline">Crear Nuevo Pedido</CardTitle>
            <CardDescription>Selecciona tus materiales y verifica disponibilidad.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleInitialSubmit, onInvalid)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b pb-6">
                  <FormField control={form.control} name="requesterName" render={({ field }) => (<FormItem className="md:col-span-1"><FormLabel>Solicitante</FormLabel><FormControl><Input placeholder="Nombre completo" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="projectName" render={({ field }) => (<FormItem className="md:col-span-1"><FormLabel>Nombre de la Obra</FormLabel><FormControl><Input placeholder="Ej. Casa Bosque" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Teléfono de Contacto</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="10 dígitos" className="pl-10" {...field} maxLength={10} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 border-b pb-6">
                  <FormField control={form.control} name="street" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Calle</FormLabel><FormControl><Input placeholder="Av. Principal" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="number" render={({ field }) => (<FormItem><FormLabel>N° Exterior</FormLabel><FormControl><Input placeholder="Solo números" {...field} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="colony" render={({ field }) => (<FormItem><FormLabel>Colonia</FormLabel><FormControl><Input placeholder="Ej. Juárez" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem><FormLabel>Estado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger></FormControl>
                        <SelectContent>{mexicoStates.map(s => <SelectItem key={s.nombre} value={s.nombre}>{s.nombre}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="municipality" render={({ field }) => (
                    <FormItem><FormLabel>Municipio / Delegación</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!selectedState}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger></FormControl>
                        <SelectContent>{selectedState?.municipios.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="postalCode" render={({ field }) => (<FormItem><FormLabel>Código Postal</FormLabel><FormControl><Input placeholder="5 dígitos" {...field} maxLength={5} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))} /></FormControl><FormMessage /></FormItem>)} />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2"><FolderTree className="h-5 w-5" /> Selección de Materiales</h3>
                  {fields.map((field, index) => {
                    const currentFieldValue = watchedMaterials?.[index];
                    const selectedMaterial = materialsList.find(m => m.name === currentFieldValue?.name);
                    const searchTerm = searchTerms[index] || "";
                    const filteredMaterials = materialsList.filter(m =>
                      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      String(m.family).toLowerCase().includes(searchTerm.toLowerCase())
                    );

                    return (
                      <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end p-4 border rounded-lg bg-card/50">
                        <FormField control={form.control} name={`materials.${index}.name`} render={({ field }) => (
                          <FormItem className="md:col-span-6">
                            <FormLabel>Material</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" className={cn("w-full h-12 justify-between font-normal bg-card", !field.value && "text-muted-foreground")}>
                                    <span className="flex items-center gap-2 truncate">
                                      {selectedMaterial && (
                                        <MaterialImage src={selectedMaterial.imageUrl} alt={selectedMaterial.name} className="w-7 h-7 flex-shrink-0" />
                                      )}
                                      <span className="truncate">{field.value || "Selecciona material..."}</span>
                                    </span>
                                    <Search className="ml-2 h-4 w-4 opacity-50 flex-shrink-0" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0" align="start">
                                <div className="p-2 border-b"><Input placeholder="Buscar por nombre..." value={searchTerm} onChange={(e) => setSearchTerms(prev => ({ ...prev, [index]: e.target.value }))} /></div>
                                <ScrollArea className="h-[300px]">
                                  {searchTerm ? (
                                    <div className="p-2 space-y-1">
                                      {filteredMaterials.map(m => (
                                        <Button key={m.id} variant="ghost" className="w-full justify-start text-xs h-auto py-2" onClick={() => field.onChange(m.name)}>
                                          <div className="flex items-center gap-3 w-full text-left">
                                            <MaterialImage src={m.imageUrl} alt={m.name} className="w-10 h-10 flex-shrink-0" />
                                            <div className="flex flex-col truncate flex-1">
                                              <span className="font-bold truncate">{m.name}</span>
                                              <span className="text-[10px] opacity-70 truncate">{String(m.family)} &gt; {String(m.subfamily)}</span>
                                            </div>
                                            <Badge variant="secondary" className="text-[9px]">${m.price}/{m.unit}</Badge>
                                          </div>
                                        </Button>
                                      ))}
                                    </div>
                                  ) : (
                                    <Accordion type="single" collapsible className="w-full">
                                      {Object.entries(hierarchicalMaterials).map(([family, subfamilies]) => (
                                        <AccordionItem value={family} key={family} className="border-none">
                                          <AccordionTrigger className="px-4 py-2 hover:no-underline text-sm font-bold">{family}</AccordionTrigger>
                                          <AccordionContent className="pb-0 pl-4 border-l ml-4">
                                            {Object.entries(subfamilies).map(([subfamily, items]) => (
                                              <div key={subfamily} className="py-2">
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">{subfamily}</p>
                                                {items.map(m => (
                                                  <Button key={m.id} variant="ghost" className="w-full justify-start text-xs py-1 h-auto" onClick={() => field.onChange(m.name)}>
                                                    <div className="flex items-center gap-2 w-full text-left">
                                                      <MaterialImage src={m.imageUrl} alt={m.name} className="w-8 h-8 flex-shrink-0" />
                                                      <span className="truncate">{m.name}</span>
                                                    </div>
                                                  </Button>
                                                ))}
                                              </div>
                                            ))}
                                          </AccordionContent>
                                        </AccordionItem>
                                      ))}
                                    </Accordion>
                                  )}
                                </ScrollArea>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <div className="md:col-span-2">
                          <Label className="text-xs">Precio Unit.</Label>
                          <div className="flex items-center gap-2 mt-1">
                            {selectedMaterial && (
                              <MaterialImage src={selectedMaterial.imageUrl} alt={selectedMaterial.name} className="w-9 h-9 flex-shrink-0 border rounded" />
                            )}
                            <Input readOnly value={selectedMaterial ? `$${selectedMaterial.price}/${selectedMaterial.unit}` : '-'} className="bg-muted text-xs h-9" />
                          </div>
                        </div>

                        <FormField control={form.control} name={`materials.${index}.quantity`} render={({ field }) => (
                          <FormItem className="md:col-span-3">
                            <FormLabel className="text-xs">Cantidad (Disponible: {selectedMaterial?.stock || 0})</FormLabel>
                            <FormControl>
                              <Input type="number" step="1" placeholder="0" {...field} className="h-10"
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  field.onChange(val === '' ? '' : parseInt(val, 10));
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        <div className="md:col-span-1 flex justify-center pb-0.5">
                          <Button variant="ghost" size="icon" type="button" onClick={() => remove(index)} className="text-destructive" disabled={fields.length === 1}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <Button type="button" variant="outline" onClick={() => append({ name: '', quantity: 1 })} className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Añadir otro material
                  </Button>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-end gap-6 pt-6 border-t">
                  <FormField control={form.control} name="deliveryDates" render={({ field }) => (
                    <FormItem className="w-full max-w-sm">
                      <FormLabel>Periodo de Entrega</FormLabel>
                      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full h-12 justify-start text-left font-normal", !field.value?.from && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value?.from ? (
                              field.value.to ? (
                                `${format(field.value.from, "PP", { locale: es })} - ${format(field.value.to, "PP", { locale: es })}`
                              ) : (
                                `${format(field.value.from, "PP", { locale: es })} (Selecciona fin...)`
                              )
                            ) : "Seleccionar periodo de entrega"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="p-4 space-y-4">
                            <Calendar
                              mode="range"
                              selected={{ from: field.value?.from, to: field.value?.to }}
                              onSelect={(range) => field.onChange(range)}
                              disabled={{ before: new Date() }}
                              locale={es}
                              initialFocus
                            />
                            <Button className="w-full" onClick={() => setIsCalendarOpen(false)} disabled={!field.value?.from || !field.value?.to}>
                              <Check className="mr-2 h-4 w-4" />
                              Confirmar Periodo
                            </Button>
                            {!field.value?.to && field.value?.from && (
                              <p className="text-[10px] text-center text-amber-600 animate-pulse">Selecciona la fecha de finalización.</p>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="text-right">
                    <p className="text-sm text-muted-foreground uppercase font-bold">Total Estimado</p>
                    <p className="text-4xl font-extrabold text-primary">${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    <Button size="lg" type="submit" className="mt-4 px-12" disabled={isProcessing}>
                      {isProcessing ? (
                        <><Loader2 className="animate-spin h-5 w-5 mr-2" />Procesando...</>
                      ) : (
                        'Confirmar Pedido'
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <PaymentMethodModal
        open={isPaymentModalOpen}
        order={pendingOrderData}
        onConfirm={handlePaymentConfirm}
        onClose={handlePaymentModalClose}
      />
    </>
  );
}