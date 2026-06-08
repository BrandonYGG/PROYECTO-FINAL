'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { personalSignupSchema } from '@/lib/auth-validation';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TermsContent } from '@/components/legal/terms-content';
import { PrivacyContent } from '@/components/legal/privacy-content';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Eye, EyeOff, Building2, CheckCircle } from 'lucide-react';
import { Label } from '../ui/label';
import { cn } from '@/lib/utils';

export function PersonalSignupForm() {
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [isCheckingInvitation, setIsCheckingInvitation] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 1) {
      setHasScrolledToBottom(true);
    }
  };

  const form = useForm<z.infer<typeof personalSignupSchema>>({
    resolver: zodResolver(personalSignupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const watchedEmail = form.watch('email');

  // Detectar invitación cuando el usuario escribe su email
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setInvitation(null);

    if (!watchedEmail || !watchedEmail.includes('@')) return;

    debounceRef.current = setTimeout(async () => {
      setIsCheckingInvitation(true);
      try {
        const invitationsSnap = await getDocs(
          query(
            collection(firestore, 'invitations'),
            where('email', '==', watchedEmail.toLowerCase().trim()),
            where('status', '==', 'pending')
          )
        );
        if (!invitationsSnap.empty) {
          const inv = { id: invitationsSnap.docs[0].id, ...invitationsSnap.docs[0].data() };
          setInvitation(inv);
        }
      } catch (e) {
        console.error('Error verificando invitación:', e);
      } finally {
        setIsCheckingInvitation(false);
      }
    }, 800);
  }, [watchedEmail, firestore]);

  async function onSubmit(values: z.infer<typeof personalSignupSchema>) {
    setIsLoading(true);
    let firebaseUser: any = null;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      firebaseUser = userCredential.user;

      const displayName = `${values.firstName} ${values.lastName}`;
      await updateProfile(firebaseUser, { displayName });

      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      const userData: any = {
        id: firebaseUser.uid,
        firstName: values.firstName,
        lastName: values.lastName,
        phoneNumber: values.phone,
        email: values.email,
        userType: invitation ? 'superintendent' : 'normal',
      };

      // Si tiene invitación, vincular a la empresa
      if (invitation) {
        userData.businessId = invitation.businessId;
        userData.businessName = invitation.businessName;
      }

      await setDoc(userDocRef, userData)
        .catch(error => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'create',
            requestResourceData: userData
          }));
          throw error;
        });

      // Marcar invitación como aceptada
      if (invitation) {
        await updateDoc(doc(firestore, 'invitations', invitation.id), {
          status: 'accepted',
        });
      }

      toast({
        title: invitation ? '¡Cuenta creada y vinculada!' : '¡Cuenta Creada!',
        description: invitation
          ? `Tu cuenta ha sido vinculada a ${invitation.businessName}.`
          : 'Tu cuenta personal ha sido creada exitosamente.',
      });

      router.push('/profile');

    } catch (error: any) {
      // Si algo falló después de crear el usuario en Auth, borrarlo
      if (firebaseUser) {
        try {
          await firebaseUser.delete();
        } catch (deleteError) {
          console.warn('No se pudo limpiar el usuario de Auth:', deleteError);
        }
      }
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Juan" {...field} disabled={isLoading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellido</FormLabel>
                <FormControl>
                  <Input placeholder="Pérez" {...field} disabled={isLoading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Número de Teléfono</FormLabel>
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
                <Input placeholder="nombre@ejemplo.com" {...field} disabled={isLoading} />
              </FormControl>
              <FormMessage />
              {/* Banner de invitación */}
              {isCheckingInvitation && (
                <p className="text-xs text-muted-foreground animate-pulse">Verificando invitaciones...</p>
              )}
              {invitation && !isCheckingInvitation && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30 mt-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                      ¡Tienes una invitación!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Este correo ha sido invitado por <span className="font-bold">{invitation.businessName}</span>. Al registrarte quedarás vinculado como superintendente.
                    </p>
                  </div>
                  <Building2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                </div>
              )}
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

        <div className="space-y-2">
          <Label>Términos, Condiciones y Política de Privacidad</Label>
          <ScrollArea className="h-48 w-full rounded-md border p-4" onScroll={handleScroll}>
            <TermsContent />
            <div className="my-8 border-t pt-8">
              <PrivacyContent />
            </div>
          </ScrollArea>
          {!hasScrolledToBottom && (
            <p className="text-xs text-amber-600">
              Por favor, lee y desliza hasta el final para aceptar los términos y condiciones del servicio.
            </p>
          )}
        </div>

        <FormField
          control={form.control}
          name="acceptTerms"
          render={({ field }) => (
            <FormItem className={cn(
              "flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow transition-opacity",
              !hasScrolledToBottom && "cursor-not-allowed opacity-60"
            )}>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!hasScrolledToBottom || isLoading}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className={cn(
                  "transition-colors",
                  !hasScrolledToBottom && "text-muted-foreground"
                )}>
                  He leído y acepto los Términos del Servicio y la Política de Privacidad.
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full font-bold" disabled={isLoading}>
          {isLoading ? 'Creando cuenta...' : invitation ? 'Crear Cuenta y Unirme a la Empresa' : 'Crear Cuenta'}
        </Button>
      </form>
    </Form>
  );
}