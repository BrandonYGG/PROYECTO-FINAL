'use client';

import { useUser } from '@/firebase';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Logo() {
  const { user } = useUser();
  const pathname = usePathname();
  
  // Prevent re-rendering the profile page if already there
  const href = user && pathname === '/profile' ? '#' : (user ? '/profile' : '/');

  return (
    <Link href={href} className="flex items-center gap-2" aria-label="Ir a la página de inicio">
      <Image 
        src="/logotlapaLosPinos.png" 
        alt="Logo de Tlapaleria los Pinos" 
        width={32} 
        height={32} 
        className="h-8 w-8"
      />
      <span className="text-xl font-bold font-headline tracking-tighter">
        Tlapaleria los Pinos
      </span>
    </Link>
  );
}
