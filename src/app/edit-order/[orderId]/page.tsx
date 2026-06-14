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
import { useRouter, useParams } from "next/navigation";
import { useFirestore, useUser } from "@/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { getMaterials, type Material } from "@/lib/materials";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const materialOrderSchema = z.object({
  name: z.string().min(1, { message: "Debes seleccionar un material." }),
  quantity: z.coerce.number().int().min(1, { message: "La cantidad debe ser al menos 1." }),
});

const orderSchema = z.object({
  requesterName: z.string().min(1, { message: "El nombre es requerido." }),
  projectName: z.string().min(1, { message: "El nombre de la obra es requerido." }),
  phone: z.string().min(10, { message: "El teléfono debe tener al menos 10 dígitos." }).regex(/^\d+$/),
  street: z.string().min(1, { message: "La calle es requerida." }),
  number: z.string().min(1).regex(/^\d+$/),
  colony: z.string().min(1, { message: "La colonia es requerida." }),
  postalCode: z.string().min(5).regex(/^\d+$/),
  state: z.string().min(1),
  municipality: z.string().min(1),
  materials: z.array(materialOrderSchema).min(1),
  deliveryDates: z.object({
    from: z.date({ required_error: "La fecha de inicio es requerida." }),
    to: z.date({ required_error: "La fecha de fin es requerida." }),
  }),
});

type OrderFormData = z.infer<typeof orderSchema>;

function MaterialImage({ src, alt, className }: { src: string | null | undefined, alt: string, className?: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className={cn("bg-muted flex items-center justify-center text-muted-foreground text-xs rounded", className)}>
        📦
      </div>
    );
  }
  return <img src={src} alt={alt} className={cn("object-cover rounded", className)} onError={() => setError(true)} />;
}

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [materialsList, setMaterialsList] = useState<Material[]>([]);
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});

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
  const watchState = form.watch('state');

  useEffect(() => {
    if (watchState) {
      setSelectedState(mexicoStates.find(s => s.nombre === watchState) || null);
    }
  }, [watchState]);

  useEffect(() => {
    getMaterials().then(m => setMaterialsList(m));
  }, []);

  useEffect(() => {
    if (!user || !firestore || !orderId) return;
    const fetchOrder = async () => {
      setIsLoading(true);
      try {
        const orderRef = doc(firestore, 'users', user.uid, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);
        if (orderSnap.exists()) {
          const data = orderSnap.data();
          form.reset({
            requesterName: data.requesterName || '',
            projectName: data.projectName || '',
            phone: data.phone || '',
            street: data.street || '',
            number: data.number || '',
            colony: data.colony || '',
            postalCode: data.postalCode || '',
            state: data.state || '',
            municipality: data.municipality || '',
            materials: data.materials || [{ name: '', quantity: 1 }],
            deliveryDates: {
              from: data.deliveryDates?.from?.toDate() || undefined,
              to: data.deliveryDates?.to?.toDate() || undefined,
            },
          });
        }
      } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el pedido.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrder();
  }, [user, firestore, orderId]);

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

  const total = useMemo(() => {
    return (watchedMaterials || []).reduce((acc, current) => {
      const materialInfo = materialsList.find(m => m.name === current.name);
      return acc + ((materialInfo?.price || 0) * (Number(current.quantity) || 0));
    }, 0);
  }, [watchedMaterials, materialsList]);

  async function handleSubmit(values: OrderFormData) {
    if (!user || !firestore) return;
    setIsProcessing(true);
    try {
      const orderRef = doc(firestore, 'users', user.uid, 'orders', orderId);
      await updateDoc(orderRef, {
        ...values,
        total,
        status: 'Pendiente de aprobación',
      });
      toast({ title: '¡Pedido actualizado!', description: 'Tu pedido fue reenviado para aprobación.' });
      router.push('/profile');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 animate-fade-in">
      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold font-headline">Editar Pedido</CardTitle>
          <CardDescription>Corrige los datos de tu pedido y reenvíalo para aprobación.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b pb-6">
                <FormField control={form.control} name="requesterName" render={({ field }) => (<FormItem><FormLabel>Solicitante</FormLabel><FormControl><Input placeholder="Nombre completo" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="projectName" render={({ field }) => (<FormItem><FormLabel>Nombre de la Obra</FormLabel><FormControl><Input placeholder="Ej. Casa Bosque" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
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
                                    {selectedMaterial && <MaterialImage src={selectedMaterial.imageUrl} alt={selectedMaterial.name} className="w-7 h-7 flex-shrink-0" />}
                                    <span className="truncate">{field.value || "Selecciona material..."}</span>
                                  </span>
                                  <Search className="ml-2 h-4 w-4 opacity-50 flex-shrink-0" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <div className="p-2 border-b"><Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerms(prev => ({ ...prev, [index]: e.target.value }))} /></div>
                              <ScrollArea className="h-[300px]">
                                {searchTerm ? (
                                  <div className="p-2 space-y-1">
                                    {filteredMaterials.map(m => (
                                      <Button key={m.id} variant="ghost" className="w-full justify-start text-xs h-auto py-2" onClick={() => field.onChange(m.name)}>
                                        <div className="flex items-center gap-3 w-full text-left">
                                          <MaterialImage src={m.imageUrl} alt={m.name} className="w-10 h-10 flex-shrink-0" />
                                          <div className="flex flex-col truncate flex-1">
                                            <span className="font-bold truncate">{m.name}</span>
                                            <span className="text-[10px] opacity-70">{String(m.family)} &gt; {String(m.subfamily)}</span>
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
                          {selectedMaterial && <MaterialImage src={selectedMaterial.imageUrl} alt={selectedMaterial.name} className="w-9 h-9 flex-shrink-0 border rounded" />}
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
                            field.value.to ? `${format(field.value.from, "PP", { locale: es })} - ${format(field.value.to, "PP", { locale: es })}` : `${format(field.value.from, "PP", { locale: es })} (Selecciona fin...)`
                          ) : "Seleccionar periodo de entrega"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-4 space-y-4">
                          <Calendar mode="range" selected={{ from: field.value?.from, to: field.value?.to }} onSelect={(range) => field.onChange(range)} disabled={{ before: new Date() }} locale={es} initialFocus />
                          <Button className="w-full" onClick={() => setIsCalendarOpen(false)} disabled={!field.value?.from || !field.value?.to}>
                            <Check className="mr-2 h-4 w-4" /> Confirmar Periodo
                          </Button>
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
                    {isProcessing ? <><Loader2 className="animate-spin h-5 w-5 mr-2" />Guardando...</> : 'Guardar y Reenviar'}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}