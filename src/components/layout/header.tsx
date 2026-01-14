'use client';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ThemeToggle } from '../theme-toggle';
import { User, LogOut, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { NotificationBell } from './notification-bell';

export function Header() {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    signOut(auth);
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-4">
            <Button variant="ghost" asChild>
                <Link href="/products">Productos</Link>
            </Button>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <NotificationBell />
              <Button variant="ghost" asChild>
                <Link href="/profile" className='flex items-center gap-2'>
                  <User />
                  <span className="hidden sm:inline">Perfil</span>
                </Link>
              </Button>
              <Button onClick={handleLogout} size="sm">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
                </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">
                  <span className="hidden sm:inline">Iniciar Sesión</span>
                   <User className="sm:hidden" />
                </Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Regístrate</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
