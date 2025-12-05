'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { businessSignupSchema } from '@/lib/auth-validation';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TermsContent } from '@/components/legal/terms-content';
import { PrivacyContent } from '@/components/legal/privacy-content';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Eye, EyeOff } from 'lucide-react';

export function BusinessSignupForm() {
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof businessSignupSchema>>({
    resolver: zodResolver(businessSignupSchema),
    defaultValues: {
      companyName: '',
      legalRepName: '',
      email: '',
      rfc: '',
      phone: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  async function onSubmit(values: z.infer<typeof businessSignupSchema>) {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: values.companyName,
      });

      const userDocRef = doc(firestore, "users", user.uid);
      const businessDocRef = doc(firestore, "businesses", user.uid);

      const userData = {
        id: user.uid,
        email: values.email,
        userType: 'business',
      };

      const businessData = {
        id: user.uid,
        companyName: values.companyName,
        legalRepresentativeName: values.legalRepName,
        email: values.email,
        rfc: values.rfc,
        phoneNumber: values.phone,
      };

      await setDoc(userDocRef, userData)
        .catch(error => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'create',
                requestResourceData: userData
            }));
            throw error;
        });

      await setDoc(businessDocRef, businessData)
        .catch(error => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: businessDocRef.path,
                operation: 'create',
                requestResourceData: businessData
            }));
            throw error;
        });

      toast({
        title: '¡Cuenta de Empresa Creada!',
        description: 'Tu cuenta ha sido creada exitosamente. Redirigiendo...',
      });
      
      router.push('/profile');

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al crear la cuenta',
        description: error.message || 'Ocurrió un error inesperado.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de la Empresa</FormLabel>
              <FormControl>
                <Input placeholder="Constructora S.A. de C.V." {...field} disabled={isLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="legalRepName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Representante Legal</FormLabel>
              <FormControl>
                <Input placeholder="Jane Doe" {...field} disabled={isLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="rfc"
          render={({ field }) => (
            <FormItem>
              <FormLabel>RFC</FormLabel>
              <FormControl>
                <Input placeholder="XAXX010101000" {...field} disabled={isLoading} />
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
              <FormLabel>Número Telefónico</FormLabel>
              <FormControl>
                <Input 
                  placeholder="55 1234 5678" 
                  {...field} 
                  disabled={isLoading}
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
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correo Electrónico</FormLabel>
              <FormControl>
                <Input placeholder="contact@constructora.com" {...field} disabled={isLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contraseña</FormLabel>
              <div className="relative">
                <FormControl>
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    {...field} 
                    disabled={isLoading}
                    className="pr-10"
                  />
                </FormControl>
                 <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar Contraseña</FormLabel>
               <div className="relative">
                <FormControl>
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    {...field} 
                    disabled={isLoading}
                    className="pr-10"
                  />
                </FormControl>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="acceptTerms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isLoading}
                />
              </FormControl>
               <div className="space-y-1 leading-none">
                <FormLabel>
                  He leído y acepto los Términos y Condiciones del Servicio
                </FormLabel>
                <FormDescription>
                  Al registrarte, aceptas nuestros{' '}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="link" className="p-0 h-auto text-sm">Términos de Servicio</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Términos y Condiciones</DialogTitle>
                        <DialogDescription>
                           Por favor, lee nuestros términos de servicio antes de continuar.
                        </DialogDescription>
                      </DialogHeader>
                       <ScrollArea className="h-96 pr-6">
                         <TermsContent />
                       </ScrollArea>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button>Cerrar</Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  {' '}y{' '}
                   <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="link" className="p-0 h-auto text-sm">Política de Privacidad</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Política de Privacidad</DialogTitle>
                        <DialogDescription>
                           Por favor, lee nuestra política de privacidad antes de continuar.
                        </DialogDescription>
                      </DialogHeader>
                       <ScrollArea className="h-96 pr-6">
                          <PrivacyContent />
                       </ScrollArea>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button>Cerrar</Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  .
                </FormDescription>
                 <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full font-bold" disabled={isLoading}>
          {isLoading ? 'Creando cuenta...' : 'Crear Cuenta de Empresa'}
        </Button>
      </form>
    </Form>
  );
}
