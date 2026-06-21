'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { User, Mail, Phone, LogOut, PackagePlus, Shield, Briefcase, Database, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useUser, useFirestore } from "@/firebase";
import { signOut } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import UserList from "@/components/admin/user-list";
import BusinessList from "@/components/admin/business-list";
import OrderList from "@/components/admin/order-list";
import UserOrderList from "@/components/profile/user-order-list";
import SuperintendentManager from "@/components/business/superintendent-manager";
import SuperintendentOrderPanel from '@/components/superintendent/superintendent-order-panel';
import BusinessOrderPanel from '@/components/business/business-order-panel';

export default function ProfilePage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [userData, setUserData] = useState<any>(null);
  const [businessData, setBusinessData] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBusiness, setIsBusiness] = useState(false);
  const [isSuperintendent, setIsSuperintendent] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    const checkUser = async () => {
      setIsLoadingProfile(true);
      try {
        await user.reload();
        const userDocRef = doc(firestore, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const fetchedUserData = userDocSnap.data();
          setUserData(fetchedUserData);
          if (fetchedUserData.userType === 'admin') {
            setIsAdmin(true);
          } else if (fetchedUserData.userType === 'business') {
            setIsBusiness(true);
            const businessDocRef = doc(firestore, "businesses", user.uid);
            const businessDocSnap = await getDoc(businessDocRef);
            if (businessDocSnap.exists()) {
              setBusinessData(businessDocSnap.data());
            }
          } else if (fetchedUserData.userType === 'superintendent') {
            setIsSuperintendent(true);
          }
        } else {
          signOut(auth).finally(() => router.push('/login'));
        }
      } catch (error) {
        console.error("Error:", error);
        signOut(auth).finally(() => router.push('/login'));
      } finally {
        setIsLoadingProfile(false);
      }
    };

    checkUser();
  }, [user, isUserLoading, router, auth, firestore]);

  const handleLogout = () => {
    signOut(auth).finally(() => router.push('/'));
  };

  if (isLoadingProfile || isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-14rem)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const nameFallback = (user.displayName || user.email || 'U').charAt(0).toUpperCase();

  // --- VISTA ADMIN ---
  if (isAdmin) {
    return (
      <div className="container mx-auto py-12 px-4 animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <Card className="w-full shadow-lg">
              <CardHeader className="items-center text-center">
                <Avatar className="h-24 w-24 mb-2">
                  <AvatarImage src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTwjUDzWTN_cm49cji7n30AHDElHnzxOKWMOA&s" alt="Admin" />
                  <AvatarFallback>{nameFallback}</AvatarFallback>
                </Avatar>
                <CardTitle className="text-xl font-bold font-headline">{user.displayName || 'Administrador'}</CardTitle>
                <CardDescription>Panel de Administrador</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-xs text-muted-foreground">
                  {user.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground truncate">{user.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 p-1.5 bg-primary/10 rounded-md">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-bold text-primary">Rol de Administrador</span>
                  </div>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`} target="_blank" rel="noopener noreferrer">
                    <Database className="mr-2 h-4 w-4" />
                    Consola de Firebase
                  </Link>
                </Button>
                <Button onClick={handleLogout} variant="outline" className="w-full">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesión
                </Button>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-3 space-y-8">
            <OrderList />
            <UserList />
            <BusinessList />
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA EMPRESA ---
  if (isBusiness) {
    return (
      <div className="container mx-auto py-12 px-4 animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <Card className="w-full shadow-lg">
              <CardHeader className="items-center text-center">
                <Avatar className="h-24 w-24 mb-2">
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {nameFallback}
                  </AvatarFallback>
                </Avatar>
                <CardTitle className="text-xl font-bold font-headline">
                  {businessData?.companyName || user.displayName || 'Empresa'}
                </CardTitle>
                <CardDescription>Panel de Empresa</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-xs text-muted-foreground">
                  {user.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground truncate">{user.email}</span>
                    </div>
                  )}
                  {businessData?.phoneNumber && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">{businessData.phoneNumber}</span>
                    </div>
                  )}
                  {businessData?.rfc && (
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">RFC: {businessData.rfc}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 p-1.5 bg-primary/10 rounded-md">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-bold text-primary">Cuenta Empresarial</span>
                  </div>
                </div>
                <Button asChild className="w-full">
                  <Link href="/new-order">
                    <PackagePlus className="mr-2 h-4 w-4" />
                    Nuevo Pedido
                  </Link>
                </Button>
                <Button onClick={handleLogout} variant="outline" className="w-full">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesión
                </Button>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-3 space-y-8">
            <SuperintendentManager businessData={businessData} />
            <BusinessOrderPanel />
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA SUPERINTENDENTE ---
  if (isSuperintendent) {
    return (
      <div className="container mx-auto py-12 px-4 animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <Card className="w-full shadow-lg">
              <CardHeader className="items-center text-center">
                <Avatar className="h-24 w-24 mb-2">
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {nameFallback}
                  </AvatarFallback>
                </Avatar>
                <CardTitle className="text-xl font-bold font-headline">
                  {userData?.firstName} {userData?.lastName}
                </CardTitle>
                <CardDescription>Panel de Superintendente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-xs text-muted-foreground">
                  {user.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground truncate">{user.email}</span>
                    </div>
                  )}
                  {userData?.businessName && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">{userData.businessName}</span>
                    </div>
                  )}
                </div>
                <Button asChild className="w-full">
                  <Link href="/new-order">
                    <PackagePlus className="mr-2 h-4 w-4" />
                    Nuevo Pedido
                  </Link>
                </Button>
                <Button onClick={handleLogout} variant="outline" className="w-full">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesión
                </Button>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-3 space-y-8">
            <SuperintendentOrderPanel />
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA USUARIO NORMAL ---
  return (
    <div className="container mx-auto py-12 px-4 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <Card className="w-full shadow-lg">
            <CardHeader className="items-center text-center">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} />
                <AvatarFallback>{nameFallback}</AvatarFallback>
              </Avatar>
              <CardTitle className="text-3xl font-bold font-headline">{user.displayName || 'Usuario'}</CardTitle>
              <CardDescription>Panel de Perfil</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 text-sm text-muted-foreground">
                {user.displayName && (
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">{user.displayName}</span>
                  </div>
                )}
                {user.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">{user.email}</span>
                  </div>
                )}
                {user.phoneNumber && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">{user.phoneNumber}</span>
                  </div>
                )}
              </div>
              <Button onClick={handleLogout} variant="outline" className="w-full">
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
              </Button>
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-2 space-y-8">
          <div className="grid grid-cols-1 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Nuevo Pedido</CardTitle>
                <PackagePlus className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full mt-4">
                  <Link href="/new-order">Crear un nuevo pedido</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3 text-sm sm:text-base animate-pulse-subtle">
            <Phone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-muted-foreground">
              <span className="font-bold text-foreground">¿Necesitas ayuda?</span> Para cancelar un pedido comunícate a este número:
              <a href="tel:+5215581536176" className="ml-1 font-bold text-primary hover:underline inline-flex items-center gap-1">
                +52 1 55 8153 6176
              </a>
            </p>
          </div>
          <UserOrderList />
        </div>
      </div>
    </div>
  );
}