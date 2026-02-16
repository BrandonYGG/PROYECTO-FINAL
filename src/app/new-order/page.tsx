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
import { CalendarIcon, Plus, BrainCircuit, Trash2, Loader2, Locate, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
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
import { DeliveryMap } from "@/components/maps/delivery-map";
import { reverseGeocode } from "../actions/reverse-geocode-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { getMaterials, type Material } from "@/lib/materials";
import { supabase } from "@/lib/supabaseClient";


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

  const [isConfirmingLocation, setIsConfirmingLocation] = useState(false);
  const [geocodedLocation, setGeocodedLocation] = useState<{lat: number, lng: number} | null>(null);
  const [lastSubmittedData, setLastSubmittedData] = useState<OrderFormData | null>(null);
  const [calculatedPriority, setCalculatedPriority] = useState<string | null>(null);
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(false);
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";


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
      // Check if a material name was changed
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
    form.setValue('municipality', ''); // Reset municipality on state change
  };

  useEffect(() => {
    if (watchState) {
        handleStateChange(watchState);
    }
  }, [watchState]);


  async function handleInitialSubmit(values: OrderFormData) {
    if (!user || !firestore) return;
    setIsProcessing(true);
    setLastSubmittedData(values); 

    try {
      const { from } = values.deliveryDates;
      if (!from) {
        throw new Error("La fecha de inicio de entrega es requerida.");
      }

      const priority = getPriorityFromDate(from);
      setCalculatedPriority(priority);

      const fullAddress = `${values.street} ${values.number}, ${values.colony}, ${values.municipality}, ${values.state}, C.P. ${values.postalCode}`;
      const location = await geocodeAddress({ address: fullAddress });
      
      setGeocodedLocation(location);
      setIsLocationConfirmed(false); 
      setIsConfirmingLocation(true); 
    } catch(err: any) {
        console.error("Error during initial submission:", err);
        toast({
            variant: "destructive",
            title: "Error en la Verificación",
            description: err.message || "No se pudo procesar la solicitud. Por favor, revisa los datos.",
        });
    } finally {
      setIsProcessing(false);
    }
  }

const mergeDuplicateMaterials = (materials: { name: string; quantity: number }[]) => {
    const merged = materials.reduce((acc, material) => {
      if (!material.name) return acc; // Ignorar entradas vacías
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

        if (adminSnapshot.empty) {
            console.log("No se encontraron usuarios administradores para notificar.");
            return;
        }
        
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
        console.log("Notificaciones de administrador enviadas exitosamente.");
    } catch (error) {
        // This will fail for non-admin users due to security rules.
        // We log it but don't show a toast to the user, as the main operation (order creation) succeeded.
        console.warn("Could not send admin notifications. This is expected for non-admin users.", error);
    }
};

const handleLocationConfirmation = async (confirmedLocation: {lat: number, lng: number}) => {
    if (!user || !firestore || !calculatedPriority || !lastSubmittedData) return;
    setIsSubmitting(true);

    try {
        // Combinar materiales duplicados
        const mergedMaterials = mergeDuplicateMaterials(lastSubmittedData.materials);

        // Validar stock disponible
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

        // Preparar materiales para RPC
        const materialsForRpc = mergedMaterials.map(m => {
            const materialInfo = materialsList.find(ml => ml.name === m.name);
            if (!materialInfo) throw new Error(`Datos del material ${m.name} no encontrados.`);
            return { id: materialInfo.id, quantity: m.quantity };
        });

        // Verificar que materialsForRpc no esté vacío.
        if (!materialsForRpc || materialsForRpc.length === 0) {
            console.error("Error: No hay materiales para enviar a la RPC de Supabase.");
            toast({
                variant: "destructive",
                title: "Error Interno",
                description: "No se seleccionaron materiales para procesar.",
            });
            setIsSubmitting(false);
            return;
        }

        // Asegurarse de que es un array (aunque .map ya lo garantiza)
        const materialsPayload = Array.isArray(materialsForRpc) ? materialsForRpc : [materialsForRpc];

        // Llamar RPC a Supabase con JSON.stringify para resolver ambigüedad
        const { error: stockError } = await supabase.rpc('decrement_materials', {
            materials_to_decrement: JSON.stringify(materialsPayload),
        });

        if (stockError) {
            throw new Error(stockError.message);
        }

        // Construir objeto del pedido
        const orderData = { 
            ...lastSubmittedData, 
            materials: mergedMaterials,
            location: confirmedLocation,
            total,
            userId: user.uid,
            priority: calculatedPriority,
            status: 'Pendiente',
            createdAt: serverTimestamp(),
            deliveryDates: {
                from: lastSubmittedData.deliveryDates.from,
                to: lastSubmittedData.deliveryDates.to
            }
        };

        // Guardar en Firestore
        const ordersCollectionRef = collection(firestore, 'users', user.uid, 'orders');
        const docRef = await addDoc(ordersCollectionRef, orderData)
            .catch((error) => {
                console.error("Error al guardar en Firestore:", error);
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: ordersCollectionRef.path,
                    operation: 'create',
                    requestResourceData: orderData
                }));
                throw new Error("No se pudo guardar tu pedido después de validar el stock. Contacta a soporte.");
            });

        // Notificar a admins
        await notifyAdmins(docRef.id, orderData.projectName);

        // Feedback al usuario
        toast({
            title: "Pedido Enviado",
            description: "Tu pedido se ha guardado correctamente.",
        });

        setIsConfirmingLocation(false);
        router.push(`/order-summary?userId=${user.uid}&orderId=${docRef.id}`);

    } catch (error: any) {
        console.error("Error al confirmar el pedido:", error);
        toast({
            variant: "destructive",
            title: "Error al Procesar el Pedido",
            description: error.message || "No se pudo completar la operación. Intenta de nuevo.",
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
          const { latitude, longitude, accuracy } = position.coords;
          const ACCEPTABLE_ACCURACY_METERS = 100;

          if (accuracy > ACCEPTABLE_ACCURACY_METERS) {
            toast({
              variant: "destructive",
              title: "Ubicación Poco Precisa",
              description: `La precisión actual (${Math.round(accuracy)}m) es muy baja. Intenta de nuevo en un lugar con mejor señal o ingresa la dirección manualmente.`,
              duration: 5000,
            });
            setIsGettingLocation(false);
            return;
          }

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
          let title = "Error de Ubicación";
          let description = "No se pudo obtener tu ubicación actual.";
          switch (error.code) {
              case error.PERMISSION_DENIED:
                  description = "Has denegado el permiso de ubicación. Actívalo en los ajustes de tu navegador.";
                  break;
              case error.POSITION_UNAVAILABLE:
                  description = "La información de ubicación no está disponible en este momento.";
                  break;
              case error.TIMEOUT:
                  title = "Tiempo de Espera Agotado";
                  description = "La solicitud para obtener la ubicación ha tardado demasiado. Inténtalo de nuevo.";
                  break;
          }
          toast({
              variant: "destructive",
              title: title,
              description: description,
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
        <CardHeader>
          <CardTitle className="text-3xl font-bold font-headline">Crear Nuevo Pedido</CardTitle>
          <CardDescription>Completa el formulario para realizar tu pedido.</CardDescription>
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
                    Usar mi ubicación
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
                        }} defaultValue={field.value}>
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

                  return (
                    <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end p-4 border rounded-lg relative">
                      <FormField
                        control={form.control}
                        name={`materials.${index}.name`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-3">
                            <FormLabel htmlFor={`materials.${index}.name`}>Material ({selectedMaterialInfo?.stock || '0'} disp.)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isMaterialsLoading}>
                              <FormControl>
                                <SelectTrigger id={`materials.${index}.name`}>
                                  <SelectValue placeholder="Selecciona" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {materialsList.map(material => (
                                  <SelectItem 
                                    key={material.id} 
                                    value={material.name} 
                                    className={cn("capitalize", material.stock === 0 && "text-muted-foreground line-through")}
                                    disabled={material.stock === 0}
                                  >
                                    {material.name} ({material.stock} disp.)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                                      return; // Previene la actualización
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
                          <div className="w-full mt-4 p-4 border-t">
                            <h4 className="text-sm font-semibold mb-2">Simbología</h4>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-md bg-red-500"></div>
                                <span>Fecha Próxima (Inicio)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-md bg-green-500"></div>
                                <span>Fecha Límite (Fin)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-md bg-primary/90"></div>
                                <span>Día de Hoy</span>
                              </div>
                            </div>
                          </div>
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
                  <Button size="lg" type="submit" disabled={isProcessing || isMaterialsLoading}>
                      {isProcessing ? (
                          <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Verificando...
                          </>
                      ) : (
                        'Enviar Pedido'
                      )}
                  </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Dialog open={isConfirmingLocation} onOpenChange={setIsConfirmingLocation}>
          <DialogContent className="max-w-2xl">
              <DialogHeader>
                  <DialogTitle>Confirmar Ubicación de Entrega</DialogTitle>
                  <DialogDescription>
                      Por favor, verifica que el marcador en el mapa sea correcto. Si no, arrástralo a la posición exacta.
                  </DialogDescription>
              </DialogHeader>

              <div className="h-[400px] w-full rounded-lg overflow-hidden border my-4">
                  <DeliveryMap
                      apiKey={mapsApiKey}
                      initialCoordinates={geocodedLocation!}
                      isDraggable={true}
                      onLocationChange={(newCoords) => setGeocodedLocation(newCoords)}
                  />
              </div>
              
              {calculatedPriority && (
                <div className="flex items-center text-sm font-medium my-4 p-3 rounded-lg bg-primary/10">
                    <BrainCircuit className="mr-3 h-5 w-5 text-primary" />
                    Prioridad de Entrega Calculada: <span className="ml-1 font-bold">{calculatedPriority}</span>
                </div>
              )}


               <div className="flex items-center space-x-2 my-4">
                <Checkbox id="location-confirm" checked={isLocationConfirmed} onCheckedChange={(checked) => setIsLocationConfirmed(checked as boolean)} />
                <Label htmlFor="location-confirm" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    La ubicación en el mapa es correcta.
                </Label>
              </div>

              <DialogFooter className="sm:justify-between items-center gap-2">
                 <Button 
                    variant="outline"
                    onClick={() => {
                        if ("geolocation" in navigator) {
                            navigator.geolocation.getCurrentPosition(
                                (position) => {
                                    const newCoords = {
                                        lat: position.coords.latitude,
                                        lng: position.coords.longitude
                                    };
                                    setGeocodedLocation(newCoords);
                                },
                                (error) => {
                                    console.error("Error getting current location:", error);
                                    toast({
                                        variant: "destructive",
                                        title: "Error de Ubicación",
                                        description: "No se pudo obtener tu ubicación actual. Asegúrate de haber concedido los permisos.",
                                    });
                                },
                                { enableHighAccuracy: true }
                            );
                        } else {
                            toast({
                                variant: "destructive",
                                title: "Navegador no compatible",
                                description: "Tu navegador no soporta la geolocalización.",
                            });
                        }
                    }}
                >
                    <Locate className="mr-2 h-4 w-4"/>
                    Usar mi Ubicación
                </Button>
                <Button 
                  onClick={() => handleLocationConfirmation(geocodedLocation!)} 
                  disabled={isSubmitting || !geocodedLocation || !isLocationConfirmed}
                >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <MapPin className="mr-2 h-4 w-4" />}
                    Confirmar y Enviar Pedido
                </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

    </div>
  );
}
