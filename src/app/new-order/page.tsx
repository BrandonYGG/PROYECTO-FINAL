'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { mexicoStates, State } from '@/lib/mexico-states';
import { useState, useEffect, useMemo } from "react";
import { CalendarIcon, Plus, Trash2, Loader2, Search, ImageIcon, FolderTree } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useFirestore, useUser } from "@/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress } from "@/app/actions/geocode-actions";
import { getMaterials, type Material } from "@/lib/materials";
import Image from "next/image";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const materialOrderSchema = z.object({
  name: z.string().min(1, { message: "Debes seleccionar un material." }),
  quantity: z.coerce.number().min(0.01, { message: "La cantidad debe ser mayor a 0." }),
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
  }),
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

export default function NewOrderPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [materialsList, setMaterialsList] = useState<Material[]>([]);
  const [isMaterialsLoading, setIsMaterialsLoading] = useState(true);
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
      deliveryDates: {
        from: undefined,
        to: undefined
      },
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "materials"
  });

  useEffect(() => {
    const fetchMaterials = async () => {
        setIsMaterialsLoading(true);
        try {
            const materials = await getMaterials();
            setMaterialsList(materials);
        } catch (error) {
            console.error("Failed to fetch materials", error);
        } finally {
            setIsMaterialsLoading(false);
        }
    }
    fetchMaterials();
  }, []);

  const hierarchicalMaterials = useMemo(() => {
    const hierarchy: Record<string, Record<string, Material[]>> = {};
    materialsList.forEach(m => {
        const f = m.family || 'General';
        const sf = m.subfamily || 'Varios';
        if (!hierarchy[f]) hierarchy[f] = {};
        if (!hierarchy[f][sf]) hierarchy[f][sf] = [];
        hierarchy[f][sf].push(m);
    });
    return hierarchy;
  }, [materialsList]);

  const watchMaterials = form.watch('materials');
  const watchState = form.watch('state');

  const total = useMemo(() => {
    return watchMaterials.reduce((acc, current) => {
      const materialInfo = materialsList.find(m => m.name === current.name);
      const price = materialInfo?.price || 0;
      const quantity = Number(current.quantity) || 0;
      return acc + (price * quantity);
    }, 0);
  }, [watchMaterials, materialsList]);

  useEffect(() => {
    if (watchState) {
        const stateData = mexicoStates.find(s => s.nombre === watchState) || null;
        setSelectedState(stateData);
    }
  }, [watchState]);

  async function handleInitialSubmit(values: OrderFormData) {
    if (!user || !firestore) return;

    let hasStockError = false;
    values.materials.forEach((item, index) => {
      const materialInfo = materialsList.find(m => m.name === item.name);
      if (materialInfo) {
        if (item.quantity > materialInfo.stock) {
          form.setError(`materials.${index}.quantity`, {
            type: "manual",
            message: `Stock insuficiente. Disponible: ${materialInfo.stock}`
          });
          hasStockError = true;
        }
      }
    });

    if (hasStockError) {
      toast({
        variant: "destructive",
        title: "Error de Inventario",
        description: "Uno o más productos superan el stock disponible."
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { from } = values.deliveryDates;
      const priority = getPriorityFromDate(from);
      
      let location = { lat: 19.4326, lng: -99.1332 }; 
      try {
        const fullAddress = `${values.street} ${values.number}, ${values.colony}, ${values.municipality}, ${values.state}, C.P. ${values.postalCode}`;
        const geocoded = await geocodeAddress({ address: fullAddress });
        if (geocoded) location = geocoded;
      } catch (e) { console.warn("Geo fallback used"); }

      await finalizeOrder(values, priority, location);
    } catch(err: any) {
        toast({ variant: "destructive", title: "Error", description: err.message });
        setIsProcessing(false);
    }
  }

  const finalizeOrder = async (formData: OrderFormData, priority: string, location: {lat: number, lng: number}) => {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    try {
        const orderData = { 
            ...formData, 
            location,
            total,
            userId: user.uid,
            priority,
            status: 'Pendiente',
            createdAt: serverTimestamp(),
        };

        const ordersRef = collection(firestore, 'users', user.uid, 'orders');
        await addDoc(ordersRef, orderData);

        toast({ title: "Pedido Enviado", description: "Tu pedido se ha guardado correctamente." });
        router.push('/profile');
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message });
        setIsSubmitting(false);
        setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4 animate-fade-in">
      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold font-headline">Crear Nuevo Pedido</CardTitle>
          <CardDescription>Selecciona tus materiales y verifica la disponibilidad en tiempo real.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleInitialSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b pb-6">
                <FormField control={form.control} name="requesterName" render={({ field }) => (
                  <FormItem><FormLabel>Solicitante</FormLabel><FormControl><Input placeholder="Nombre completo" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="projectName" render={({ field }) => (
                  <FormItem><FormLabel>Obra</FormLabel><FormControl><Input placeholder="Nombre del proyecto" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input 
                        type="tel" 
                        placeholder="Solo números" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b pb-6">
                <FormField control={form.control} name="street" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>Calle</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="number" render={({ field }) => (
                  <FormItem>
                    <FormLabel>N°</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Números" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="colony" render={({ field }) => (
                  <FormItem><FormLabel>Colonia</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem><FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger></FormControl>
                      <SelectContent>{mexicoStates.map(s => <SelectItem key={s.nombre} value={s.nombre}>{s.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="municipality" render={({ field }) => (
                  <FormItem><FormLabel>Municipio</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedState}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Municipio" /></SelectTrigger></FormControl>
                      <SelectContent>{selectedState?.municipios.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="postalCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>C.P.</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="5 dígitos" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2"><FolderTree className="h-5 w-5" /> Selección de Materiales</h3>
                {fields.map((field, index) => {
                   const selectedMaterial = materialsList.find(m => m.name === watchMaterials[index]?.name);
                   const searchTerm = searchTerms[index] || "";
                   const isSearching = searchTerm.length > 0;
                   
                   const filteredMaterials = materialsList.filter(m => 
                     m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                     (m.family && m.family.toLowerCase().includes(searchTerm.toLowerCase()))
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
                                    <div className="flex items-center gap-2 truncate">
                                        {selectedMaterial?.imageUrl && (
                                            <div className="relative w-8 h-8 rounded overflow-hidden shrink-0 border">
                                                <Image src={selectedMaterial.imageUrl} alt={selectedMaterial.name} fill className="object-cover" />
                                            </div>
                                        )}
                                        <span className="truncate">{field.value || "Selecciona material..."}</span>
                                    </div>
                                    <Search className="ml-2 h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0" align="start">
                                <div className="p-2 border-b">
                                  <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      placeholder="Buscar por nombre o familia..."
                                      className="pl-8"
                                      value={searchTerm}
                                      onChange={(e) => setSearchTerms(prev => ({ ...prev, [index]: e.target.value }))}
                                    />
                                  </div>
                                </div>
                                <ScrollArea className="h-[400px]">
                                  {isSearching ? (
                                    <div className="p-2 space-y-1">
                                      {filteredMaterials.map(m => (
                                        <Button key={m.id} variant="ghost" className="w-full justify-start text-xs h-auto py-2" onClick={() => field.onChange(m.name)}>
                                          <div className="flex items-center gap-3 w-full">
                                            <div className="relative w-12 h-12 rounded border overflow-hidden shrink-0 bg-muted flex items-center justify-center">
                                                {m.imageUrl ? (
                                                    <Image src={m.imageUrl} alt={m.name} fill className="object-cover" />
                                                ) : (
                                                    <ImageIcon className="h-6 w-6 opacity-20" />
                                                )}
                                            </div>
                                            <div className="flex flex-col items-start truncate flex-1">
                                              <span className="font-bold truncate w-full text-left">{m.name}</span>
                                              <span className="text-[10px] opacity-70 truncate">{m.family} > {m.subfamily}</span>
                                              <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">${m.price}/{m.unit}</Badge>
                                                <span className={cn("text-[9px] font-medium", m.stock > 0 ? "text-green-600" : "text-red-600")}>
                                                  Stock: {m.stock}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </Button>
                                      ))}
                                      {filteredMaterials.length === 0 && <p className="text-center p-4 text-muted-foreground">Sin resultados</p>}
                                    </div>
                                  ) : (
                                    <Accordion type="single" collapsible className="w-full">
                                      {Object.entries(hierarchicalMaterials).map(([family, subfamilies]) => (
                                        <AccordionItem value={family} key={family} className="border-none">
                                          <AccordionTrigger className="px-4 py-2 hover:no-underline hover:bg-muted/50 text-sm font-bold">
                                            {family}
                                          </AccordionTrigger>
                                          <AccordionContent className="pb-0">
                                            <Accordion type="single" collapsible className="w-full pl-4 border-l ml-4">
                                              {Object.entries(subfamilies).map(([subfamily, items]) => (
                                                <AccordionItem value={subfamily} key={subfamily} className="border-none">
                                                  <AccordionTrigger className="py-2 hover:no-underline text-xs text-muted-foreground italic">
                                                    {subfamily} ({items.length})
                                                  </AccordionTrigger>
                                                  <AccordionContent className="pb-2">
                                                    <div className="flex flex-col gap-1 pr-2">
                                                      {items.map(m => (
                                                        <Button key={m.id} variant="ghost" className="justify-start h-auto py-2 text-xs font-normal" onClick={() => field.onChange(m.name)}>
                                                          <div className="flex items-center gap-2 w-full">
                                                            <div className="relative w-10 h-10 rounded border overflow-hidden shrink-0 bg-muted flex items-center justify-center">
                                                                {m.imageUrl ? (
                                                                    <Image src={m.imageUrl} alt={m.name} fill className="object-cover" />
                                                                ) : (
                                                                    <ImageIcon className="h-5 w-5 opacity-20" />
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col items-start truncate flex-1">
                                                              <span className="truncate text-left font-medium">{m.name}</span>
                                                              <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="opacity-70 text-[10px]">${m.price}/{m.unit}</span>
                                                                <span className={cn("text-[10px]", m.stock > 0 ? "text-green-600" : "text-red-600")}>
                                                                  Stock: {m.stock}
                                                                </span>
                                                              </div>
                                                            </div>
                                                          </div>
                                                        </Button>
                                                      ))}
                                                    </div>
                                                  </AccordionContent>
                                                </AccordionItem>
                                              ))}
                                            </Accordion>
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
                          <Label className="text-xs">Precio Unitario</Label>
                          <Input readOnly value={selectedMaterial ? `$${selectedMaterial.price}/${selectedMaterial.unit}`: '-'} className="bg-muted text-xs h-10" />
                      </div>

                      <FormField control={form.control} name={`materials.${index}.quantity`} render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel className="text-xs">Cantidad</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  {...field} 
                                  className={cn(
                                    "h-10 pr-10",
                                    selectedMaterial && field.value > selectedMaterial.stock && "border-destructive focus-visible:ring-destructive"
                                  )} 
                                />
                                {selectedMaterial && (
                                  <span className={cn(
                                    "absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold",
                                    field.value > selectedMaterial.stock ? "text-destructive animate-pulse" : "text-muted-foreground"
                                  )}>
                                    / {selectedMaterial.stock}
                                  </span>
                                )}
                              </div>
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
                  )
                })}

                <Button type="button" variant="outline" onClick={() => append({ name: '', quantity: 1 })} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Añadir otro material
                </Button>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-end gap-6 pt-6 border-t">
                <FormField control={form.control} name="deliveryDates" render={({ field }) => (
                  <FormItem className="w-full max-w-sm">
                    <FormLabel>Cronograma de Entrega</FormLabel>
                    <Dialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" type="button" className="w-full h-12 justify-start text-left font-normal bg-card">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value?.from ? (field.value.to ? `${format(field.value.from, "PP", { locale: es })} - ${format(field.value.to, "PP", { locale: es })}` : format(field.value.from, "PP", { locale: es })) : <span>Selecciona período de entrega</span>}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Seleccionar Período de Entrega</DialogTitle>
                          <DialogDescription>
                            Elige el rango de fechas programado para recibir tus materiales en la obra.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="p-4 flex justify-center">
                          <Calendar
                            mode="range"
                            selected={{ from: field.value?.from, to: field.value?.to }}
                            onSelect={(range) => {
                                field.onChange(range);
                            }}
                            numberOfMonths={2}
                            locale={es}
                            className="rounded-md border shadow"
                            disabled={{ before: new Date() }}
                          />
                        </div>
                        <DialogFooter>
                          <Button type="button" onClick={() => setIsCalendarOpen(false)}>Confirmar Selección</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="text-right">
                  <p className="text-sm text-muted-foreground uppercase font-bold">Total Estimado</p>
                  <p className="text-4xl font-extrabold text-primary">${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  <Button size="lg" type="submit" className="mt-4 px-12" disabled={isProcessing || isSubmitting || total === 0}>
                    {isProcessing || isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Confirmar Pedido'}
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
