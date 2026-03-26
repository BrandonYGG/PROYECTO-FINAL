'use client';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ThemeToggle } from '../theme-toggle';
import { User, LogOut, Loader2, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { NotificationBell } from './notification-bell';

export function Header() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    signOut(auth).then(() => {
      router.push('/');
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto flex h-24 items-center justify-between px-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-4">
            <Button variant="ghost" asChild>
                <Link href="/#featured-materials">Productos</Link>
            </Button>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isUserLoading ? (
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : user ? (
            <>
              {/* Botones para Escritorio */}
              <div className="hidden sm:flex items-center gap-2">
                <NotificationBell />
                <Button variant="ghost" asChild>
                  <Link href="/profile" className='flex items-center gap-2'>
                    <User />
                    <span>Perfil</span>
                  </Link>
                </Button>
                <Button onClick={handleLogout} size="sm">
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Cerrar Sesión</span>
                  </Button>
              </div>

              {/* Botones para Móvil */}
              <div className="sm:hidden flex items-center gap-1">
                <NotificationBell />
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/profile"><User className="h-5 w-5" /></Link>
                </Button>
                <Button variant="outline" size="icon" onClick={handleLogout}>
                    <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Botones para Escritorio */}
              <div className="hidden sm:flex items-center gap-2">
                <Button variant="ghost" asChild>
                    <Link href="/login">Iniciar Sesión</Link>
                </Button>
                <Button asChild>
                    <Link href="/signup">Regístrate</Link>
                </Button>
              </div>

              {/* Botones para Móvil */}
              <div className="sm:hidden flex items-center gap-1">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/login"><User className="h-5 w-5" /></Link>
                </Button>
                <Button size="icon" asChild>
                    <Link href="/signup"><UserPlus className="h-5 w-5" /></Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
