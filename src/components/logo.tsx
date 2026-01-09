'use client';

import { useUser } from '@/firebase';
import { HardHat } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Logo() {
  const { user } = useUser();
  const pathname = usePathname();
  
  // Prevent re-rendering the profile page if already there
  const href = user && pathname === '/profile' ? '#' : (user ? '/profile' : '/');

  return (
    <Link href={href} className="flex items-center gap-2" aria-label="Ir a la página de inicio">
      <HardHat className="h-7 w-7 text-primary" />
      <span className="text-xl font-bold font-headline tracking-tighter">
        Tlapaleria los Pinos
      </span>
    </Link>
  );
}
