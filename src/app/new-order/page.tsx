'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { mexicoStates, State } from '@/lib/mexico-states';
import { useState, useEffect } from "react";
import { CalendarIcon, Plus, BrainCircuit, Trash2, Loader2, Locate, MapPin, ExternalLink, Search, Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useFirestore, useUser } from "@/firebase";
import { addDoc, collection, serverTimestamp, query, where, getDocs, writeBatch, doc } from "firebase/firestore";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress } from "@/app/actions/geocode-actions";
import { reverseGeocode } from "../actions/reverse-geocode-actions";
import { getMaterials, type Material } from "@/lib/materials";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";


const materialOrderSchema = z.object({
  name: z.string().min(1, { message: "Debes seleccionar un material." }),
  quantity: z.coerce.number().min(1, { message: "La cantidad debe ser mayor a 0." }),
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

    if (diffDays <= 3) {
        return 'Urgente';
    } else if (diffDays <= 7) {
        return 'Pronto';
    } else {
        return 'Normal';
    }
}


export default function NewOrderPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

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
      materials: [{ name: '', quantity: 0 }],
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
    setIsMounted(true);
    const fetchMaterials = async () => {
        setIsMaterialsLoading(true);
        const materials = await getMaterials();
        setMaterialsList(materials);
        setIsMaterialsLoading(false);
    }
    fetchMaterials();
  }, []);
  
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (type === 'change' && name && name.startsWith('materials') && name.endsWith('.name')) {
        const index = parseInt(name.split('.')[1], 10);
        const materialItem = value.materials?.[index];
        
        if (materialItem) {
          const selectedMaterial = materialsList.find(m => m.name === materialItem.name);
          const currentQuantity = materialItem.quantity;

          if (selectedMaterial && currentQuantity > selectedMaterial.stock) {
            form.setValue(`materials.${index}.quantity`, selectedMaterial.stock);
            toast({
              variant: 'default',
              title: 'Cantidad Ajustada',
              description: `Se ajustó la cantidad de "${selectedMaterial.name}" al stock disponible de ${selectedMaterial.stock} unidades.`,
            });
          }
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, materialsList, toast]);


  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const watchMaterials = form.watch('materials');
  const watchState = form.watch('state');

  const total = watchMaterials.reduce((acc, current) => {
    const materialInfo = materialsList.find(m => m.name === current.name);
    const price = materialInfo?.price || 0;
    const quantity = Number(current.quantity) || 0;
    return acc + (price * quantity);
  }, 0);


  const handleStateChange = (stateName: string) => {
    const stateData = mexicoStates.find(s => s.nombre === stateName) || null;
    setSelectedState(stateData);
    form.setValue('municipality', '');
  };

  useEffect(() => {
    if (watchState) {
        handleStateChange(watchState);
    }
  }, [watchState]);


  async function handleInitialSubmit(values: OrderFormData) {
    if (!user || !firestore) return;
    setIsProcessing(true);

    try {
      const { from } = values.deliveryDates;
      if (!from) {
        throw new Error("La fecha de inicio de entrega es requerida.");
      }

      const priority = getPriorityFromDate(from);
      
      let location = { lat: 19.4326, lng: -99.1332 }; 
      try {
        const fullAddress = `${values.street} ${values.number}, ${values.colony}, ${values.municipality}, ${values.state}, C.P. ${values.postalCode}`;
        const geocoded = await geocodeAddress({ address: fullAddress });
        if (geocoded) location = geocoded;
      } catch (e) {
        console.warn("Geocodificación fallida, usando ubicación por defecto para continuar sin errores de API.");
      }

      await finalizeOrder(values, priority, location);
    } catch(err: any) {
        console.error("Error during submission:", err);
        toast({
            variant: "destructive",
            title: "Error al Procesar",
            description: err.message || "No se pudo procesar la solicitud.",
        });
    } finally {
      setIsProcessing(false);
    }
  }

const mergeDuplicateMaterials = (materials: { name: string; quantity: number }[]) => {
    const merged = materials.reduce((acc, material) => {
      if (!material.name) return acc;
      const key = material.name;
      if (acc[key]) {
        acc[key].quantity += Number(material.quantity) || 0;
      } else {
        acc[key] = { ...material, quantity: Number(material.quantity) || 0 };
      }
      return acc;
    }, {} as Record<string, { name: string; quantity: number }>);
    
    return Object.values(merged);
};

const validateStock = (orderedMaterials: { name: string; quantity: number }[], availableMaterials: Material[]) => {
    const errors: string[] = [];
    for (const orderedMaterial of orderedMaterials) {
        const materialInfo = availableMaterials.find(m => m.name === orderedMaterial.name);

        if (!materialInfo) {
            errors.push(`El material "${orderedMaterial.name}" no se encontró en el catálogo.`);
            continue;
        }

        if (materialInfo.stock < orderedMaterial.quantity) {
            errors.push(`Stock insuficiente para ${orderedMaterial.name}. Pedido: ${orderedMaterial.quantity}, Disponible: ${materialInfo.stock}`);
        }
    }
    return errors;
};

const notifyAdmins = async (orderId: string, projectName: string) => {
    if (!firestore) return;
    try {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('userType', '==', 'admin'));
        const adminSnapshot = await getDocs(q);

        if (adminSnapshot.empty) return;
        
        const batch = writeBatch(firestore);
        const notificationMessage = `Nuevo pedido para la obra "${projectName}" con ID: ${orderId}`;
        
        adminSnapshot.forEach(adminDoc => {
            const notificationRef = doc(collection(firestore, 'users', adminDoc.id, 'notifications'));
            batch.set(notificationRef, {
                userId: adminDoc.id,
                orderId: orderId,
                message: notificationMessage,
                read: false,
                createdAt: serverTimestamp(),
            });
        });

        await batch.commit();
    } catch (error) {
        console.warn("Could not send admin notifications.", error);
    }
};

const finalizeOrder = async (formData: OrderFormData, priority: string, location: {lat: number, lng: number}) => {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    try {
        const mergedMaterials = mergeDuplicateMaterials(formData.materials);
        const stockErrors = validateStock(mergedMaterials, materialsList);
        
        if (stockErrors.length > 0) {
            toast({
                variant: "destructive",
                title: "Error de Stock",
                description: (
                    <div className="flex flex-col gap-1">
                        {stockErrors.map((error, i) => <p key={i}>- {error}</p>)}
                    </div>
                ),
                duration: 7000,
            });
            setIsSubmitting(false);
            return;
        }

        const materialsForRpc = mergedMaterials.map(m => {
            const materialInfo = materialsList.find(ml => ml.name === m.name);
            if (!materialInfo) throw new Error(`Datos del material ${m.name} no encontrados.`);
            return { id: materialInfo.id, quantity: m.quantity };
        });

        const { error: stockError } = await supabase.rpc('decrement_materials', {
            materials_to_decrement: materialsForRpc,
        });

        if (stockError) throw new Error(stockError.message);

        const orderData = { 
            ...formData, 
            materials: mergedMaterials,
            location: location,
            total,
            userId: user.uid,
            priority: priority,
            status: 'Pendiente',
            createdAt: serverTimestamp(),
        };

        const ordersCollectionRef = collection(firestore, 'users', user.uid, 'orders');
        const docRef = await addDoc(ordersCollectionRef, orderData)
            .catch((error) => {
                console.error("Error al guardar en Firestore:", error);
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: ordersCollectionRef.path,
                    operation: 'create',
                    requestResourceData: orderData
                }));
                throw new Error("No se pudo guardar tu pedido. Contacta a soporte.");
            });

        await notifyAdmins(docRef.id, orderData.projectName);

        toast({
            title: "Pedido Enviado",
            description: "Tu pedido se ha guardado correctamente.",
        });

        router.push(`/order-summary?userId=${user.uid}&orderId=${docRef.id}`);

    } catch (error: any) {
        console.error("Error al finalizar el pedido:", error);
        toast({
            variant: "destructive",
            title: "Error al Procesar el Pedido",
            description: error.message || "No se pudo completar la operación.",
        });
    } finally {
        setIsSubmitting(false);
    }
};

  const handleUseCurrentLocation = () => {
    if ("geolocation" in navigator) {
      setIsGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const coords = { lat: latitude, lng: longitude };
          try {
            const address = await reverseGeocode(coords);
            form.setValue('street', `${address.street}`);
            form.setValue('number', `${address.number}`);
            form.setValue('colony', address.colony);
            form.setValue('postalCode', address.postalCode);
            form.setValue('state', address.state);
            form.setValue('municipality', address.municipality);

            form.trigger(['street', 'number', 'colony', 'postalCode', 'state', 'municipality']);

            toast({
              title: "Ubicación Obtenida",
              description: "Los campos de dirección han sido actualizados.",
            });
          } catch (error) {
            console.error("Error reverse geocoding:", error);
            toast({
              variant: "destructive",
              title: "Error de Dirección",
              description: "No se pudo obtener la dirección desde tu ubicación.",
            });
          } finally {
            setIsGettingLocation(false);
          }
        },
        (error) => {
          console.error("Error getting current location:", error);
          toast({
              variant: "destructive",
              title: "Error de Ubicación",
              description: "No se pudo obtener tu ubicación actual. Asegúrate de permitir los permisos.",
          });
          setIsGettingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      toast({
        variant: "destructive",
        title: "Navegador no compatible",
        description: "Tu navegador no soporta la geolocalización.",
      });
    }
  };


  const isCdmx = selectedState?.nombre === 'Ciudad de México';

  return (
    <div className="container mx-auto py-12 px-4 animate-fade-in">
      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-3xl font-bold font-headline">Crear Nuevo Pedido</CardTitle>
            <CardDescription>Completa el formulario para realizar tu pedido.</CardDescription>
          </div>
          <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary/10 font-bold">
            <a href="https://tlapaia.netlify.app/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5" />
              Asistente de Cotización IA
              <ExternalLink className="h-4 w-4 opacity-70" />
            </a>
          </Button>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleInitialSubmit)} className="space-y-6">
              <h3 className="text-lg font-semibold border-b pb-2">Información de Contacto</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="requesterName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Solicitante</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan Pérez" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="projectName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Obra</FormLabel>
                      <FormControl>
                        <Input placeholder="Torre Reforma" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Teléfono</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          inputMode="numeric" 
                          placeholder="55 1234 5678" 
                          {...field}
                          onChange={(e) => {
                            const numericValue = e.target.value.replace(/\D/g, '');
                            field.onChange(numericValue);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-between items-center border-b pb-2 pt-4">
                <h3 className="text-lg font-semibold">Dirección de Entrega</h3>
                 <Button type="button" variant="outline" size="sm" onClick={handleUseCurrentLocation} disabled={isGettingLocation}>
                    {isGettingLocation ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                    ) : (
                        <Locate className="mr-2 h-4 w-4"/>
                    )}
                    Autocompletar con mi ubicación
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                  control={form.control}
                  name="street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Calle</FormLabel>
                      <FormControl>
                        <Input placeholder="Av. Siempre Viva" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          inputMode="numeric" 
                          placeholder="742" 
                          {...field}
                          onChange={(e) => {
                            const numericValue = e.target.value.replace(/\D/g, '');
                            field.onChange(numericValue);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="colony"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Colonia</FormLabel>
                        <FormControl>
                          <Input placeholder="Centro" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código Postal</FormLabel>
                        <FormControl>
                          <Input 
                            type="text" 
                            inputMode="numeric" 
                            placeholder="12345" 
                            {...field} 
                            onChange={(e) => {
                              const numericValue = e.target.value.replace(/\D/g, '');
                              field.onChange(numericValue);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Controller
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select onValueChange={(value) => {
                          field.onChange(value);
                          handleStateChange(value);
                        }} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {mexicoStates.map(state => (
                            <SelectItem key={state.nombre} value={state.nombre}>{state.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Controller
                  control={form.control}
                  name="municipality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isCdmx ? 'Delegación' : 'Municipio'}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!selectedState}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={!selectedState ? 'Elige un estado primero' : `Selecciona un ${isCdmx ? 'delegación' : 'municipio'}`} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {selectedState?.municipios.map(municipio => (
                            <SelectItem key={municipio} value={municipio}>{municipio}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <h3 className="text-lg font-semibold border-b pb-2 pt-4">Pedido de Material</h3>

              <div className="space-y-4">
                {isMaterialsLoading && <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>}

                {fields.map((field, index) => {
                   const selectedMaterialInfo = materialsList.find(m => m.name === watchMaterials[index]?.name);
                   const subtotal = (Number(watchMaterials[index]?.quantity) || 0) * (selectedMaterialInfo?.price || 0);
                   const searchTerm = searchTerms[index] || "";
                   const filteredMaterials = materialsList.filter(m => 
                     m.name.toLowerCase().includes(searchTerm.toLowerCase())
                   );

                  return (
                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end p-4 border rounded-lg relative">
                      <FormField
                        control={form.control}
                        name={`materials.${index}.name`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-3">
                            <FormLabel>Material ({selectedMaterialInfo?.stock || '0'} disp.)</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                      "w-full justify-between font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                    disabled={isMaterialsLoading}
                                  >
                                    <span className="truncate">
                                      {field.value
                                        ? materialsList.find((m) => m.name === field.value)?.name
                                        : "Selecciona material..."}
                                    </span>
                                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[300px] p-0" align="start">
                                <div className="flex items-center border-b px-3">
                                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                  <Input
                                    placeholder="Escribe para buscar..."
                                    className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none border-none focus-visible:ring-0"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerms(prev => ({ ...prev, [index]: e.target.value }))}
                                  />
                                </div>
                                <ScrollArea className="h-72">
                                  <div className="p-1">
                                    {filteredMaterials.length === 0 && (
                                      <div className="py-6 text-center text-sm text-muted-foreground">
                                        No se encontraron materiales.
                                      </div>
                                    )}
                                    {filteredMaterials.map((material) => (
                                      <Button
                                        key={material.id}
                                        variant="ghost"
                                        className={cn(
                                          "w-full justify-start font-normal capitalize py-3 h-auto mb-1",
                                          field.value === material.name && "bg-accent"
                                        )}
                                        onClick={() => {
                                          field.onChange(material.name);
                                          // Se mantiene el Popover abierto por si quiere cambiar, 
                                          // o se puede cerrar automáticamente si fuera un Dialog.
                                        }}
                                        disabled={material.stock === 0}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4 shrink-0",
                                            field.value === material.name ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex items-center gap-3 overflow-hidden">
                                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                                            <Image
                                              src={material.imageUrl || '/images/placeholder.png'}
                                              alt={material.name}
                                              fill
                                              className="object-cover"
                                              unoptimized={!!material.imageUrl}
                                            />
                                          </div>
                                          <div className="flex flex-col text-left overflow-hidden">
                                            <span className={cn("font-medium truncate", material.stock === 0 && "text-muted-foreground line-through")}>
                                              {material.name}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                              {material.stock} disp. - ${material.price.toFixed(2)} / {material.unit}
                                            </span>
                                          </div>
                                        </div>
                                      </Button>
                                    ))}
                                  </div>
                                </ScrollArea>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-2 md:col-span-2">
                          <Label htmlFor={`unit-price-${index}`}>P. Unitario</Label>
                          <Input
                            id={`unit-price-${index}`}
                            readOnly 
                            value={selectedMaterialInfo ? `$${selectedMaterialInfo.price.toFixed(2)} / ${selectedMaterialInfo.unit}`: '$0.00'} 
                            className="bg-muted"
                          />
                      </div>

                      <FormField
                        control={form.control}
                        name={`materials.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Cantidad</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                inputMode="numeric"
                                placeholder="0"
                                {...field}
                                value={field.value as number}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const newQuantity = value === '' ? '' : Number(value);
                                
                                  if (newQuantity === '') {
                                    field.onChange('');
                                    return;
                                  }
                                
                                  const selectedMaterialName = form.getValues(`materials.${index}.name`);
                                  if (selectedMaterialName) {
                                    const materialInfo = materialsList.find(m => m.name === selectedMaterialName);
                                    if (materialInfo && newQuantity > materialInfo.stock) {
                                      toast({
                                        variant: "destructive",
                                        title: "Stock insuficiente",
                                        description: `Solo quedan ${materialInfo.stock} unidades de este material.`,
                                      });
                                      return;
                                    }
                                  }
                                  
                                  field.onChange(newQuantity);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="space-y-2 md:col-span-2">
                          <Label htmlFor={`subtotal-${index}`}>Subtotal</Label>
                          <Input
                            id={`subtotal-${index}`}
                            readOnly 
                            value={`$${subtotal.toFixed(2)}`} 
                            className="bg-muted font-bold"
                          />
                      </div>

                      {fields.length > 1 && (
                         <div className="md:col-span-1">
                          <Button variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-5 w-5" />
                            <span className="sr-only">Eliminar material</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}

                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => append({ name: '', quantity: 0 })}
                  className="w-full md:w-auto"
                  disabled={isMaterialsLoading}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Añadir otro material
                </Button>

                {watchMaterials.length > 0 && total > 0 && (
                   <div className="flex justify-end pt-4">
                      <div className="w-full md:w-1/3">
                          <Label className="text-lg font-semibold" htmlFor="total-order">Total del Pedido</Label>
                          <Input
                            id="total-order"
                            readOnly 
                            value={`$${total.toFixed(2)}`} 
                            className="bg-muted font-bold text-2xl h-12 mt-2"
                          />
                      </div>
                  </div>
                )}
              </div>

              <h3 className="text-lg font-semibold border-b pb-2 pt-4">Cronograma de Entrega</h3>
              <FormField
                control={form.control}
                name="deliveryDates"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fechas de Entrega</FormLabel>
                    <Dialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <DialogTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full max-w-sm justify-start text-left font-normal",
                              !field.value.from && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value.from ? (
                              field.value.to ? (
                                <>
                                  {format(field.value.from, "PPP", { locale: es })} -{" "}
                                  {format(field.value.to, "PPP", { locale: es })}
                                </>
                              ) : (
                                format(field.value.from, "PPP", { locale: es })
                              )
                            ) : (
                              <span>Elige un rango de fechas</span>
                            )}
                          </Button>
                        </FormControl>
                      </DialogTrigger>
                      <DialogContent className="w-auto sm:max-w-4xl flex justify-center">
                        <div className="flex flex-col items-center">
                          <DialogHeader>
                            <DialogTitle>Selecciona las Fechas</DialogTitle>
                            <DialogDescription>
                              Selecciona una fecha de inicio y una fecha final para la entrega.
                            </DialogDescription>
                          </DialogHeader>
                          <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={field.value.from}
                            selected={{from: field.value.from!, to: field.value.to}}
                            onSelect={(dateRange) => {
                              field.onChange(dateRange)
                            }}
                            numberOfMonths={2}
                            locale={es}
                            className="p-4"
                            disabled={isMounted ? { before: new Date() } : { before: new Date('1970-01-01')}}
                          />
                          <DialogFooter className="pt-4">
                            <DialogClose asChild>
                              <Button onClick={() => setIsCalendarOpen(false)}>Confirmar</Button>
                            </DialogClose>
                          </DialogFooter>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <FormDescription>
                        Define el periodo en el que puedes recibir el material.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-4">
                  <Button size="lg" type="submit" disabled={isProcessing || isSubmitting || isMaterialsLoading}>
                      {isProcessing || isSubmitting ? (
                          <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Procesando Pedido...
                          </>
                      ) : (
                        'Confirmar y Enviar Pedido'
                      )}
                  </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
