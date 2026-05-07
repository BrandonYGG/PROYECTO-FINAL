'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ArrowLeft, Package, Boxes, ShoppingCart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { type Material } from '@/lib/materials';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';

interface HierarchicalMaterialsViewerProps {
  materials: Material[];
  onActiveChange?: (isActive: boolean) => void;
}

type ViewState = 'families' | 'subfamilies' | 'materials';

export function HierarchicalMaterialsViewer({ materials, onActiveChange }: HierarchicalMaterialsViewerProps) {
  const { user } = useUser();
  const [view, setView] = useState<ViewState>('families');
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [selectedSubfamily, setSelectedSubfamily] = useState<string | null>(null);

  // Link dinámico basado en la autenticación
  const orderLink = user ? '/new-order' : '/login';

  // Notificar al padre si estamos en modo "exploración activa"
  useEffect(() => {
    if (onActiveChange) {
      onActiveChange(view !== 'families');
    }
  }, [view, onActiveChange]);

  // Agrupamiento de datos
  const hierarchy = useMemo(() => {
    const data: Record<string, Record<string, Material[]>> = {};
    materials.forEach((m) => {
      const f = m.family || 'General';
      const sf = m.subfamily || 'Varios';
      if (!data[f]) data[f] = {};
      if (!data[f][sf]) data[f][sf] = [];
      data[f][sf].push(m);
    });
    return data;
  }, [materials]);

  const families = Object.keys(hierarchy).sort();
  const subfamilies = selectedFamily ? Object.keys(hierarchy[selectedFamily]).sort() : [];
  const currentMaterials = (selectedFamily && selectedSubfamily) ? hierarchy[selectedFamily][selectedSubfamily] : [];

  const handleFamilyClick = (family: string) => {
    setSelectedFamily(family);
    setView('subfamilies');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubfamilyClick = (subfamily: string) => {
    setSelectedSubfamily(subfamily);
    setView('materials');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    if (view === 'materials') {
      setView('subfamilies');
      setSelectedSubfamily(null);
    } else if (view === 'subfamilies') {
      setView('families');
      setSelectedFamily(null);
    }
  };

  return (
    <div className="space-y-8 min-h-[60vh]">
      {/* Breadcrumbs / Navigation Control */}
      <div className="flex items-center gap-4 mb-6">
        {view !== 'families' && (
          <Button variant="outline" size="sm" onClick={goBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        )}
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground overflow-x-auto pb-2 sm:pb-0">
          <span 
            className={cn(view === 'families' ? "text-primary font-bold" : "cursor-pointer hover:underline whitespace-nowrap")} 
            onClick={() => { setView('families'); setSelectedFamily(null); setSelectedSubfamily(null); }}
          >
            Todas las Familias
          </span>
          {selectedFamily && (
            <>
              <ChevronRight className="h-4 w-4 shrink-0" />
              <span 
                className={cn(view === 'subfamilies' ? "text-primary font-bold" : "cursor-pointer hover:underline whitespace-nowrap")} 
                onClick={() => { setView('subfamilies'); setSelectedSubfamily(null); }}
              >
                {selectedFamily}
              </span>
            </>
          )}
          {selectedSubfamily && (
            <>
              <ChevronRight className="h-4 w-4 shrink-0" />
              <span className="text-primary font-bold whitespace-nowrap">{selectedSubfamily}</span>
            </>
          )}
        </div>
      </div>

      {/* Grid Display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
        {view === 'families' && families.map((family) => (
          <Card 
            key={family} 
            className="cursor-pointer hover:border-primary hover:shadow-xl transition-all group overflow-hidden"
            onClick={() => handleFamilyClick(family)}
          >
            <div className="h-32 bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Package className="h-12 w-12 text-primary/40 group-hover:scale-110 transition-transform" />
            </div>
            <CardHeader className="p-4">
              <CardTitle className="text-lg text-center font-headline capitalize">{family}</CardTitle>
              <CardDescription className="text-center">{Object.keys(hierarchy[family]).length} Categorías</CardDescription>
            </CardHeader>
          </Card>
        ))}

        {view === 'subfamilies' && subfamilies.map((subfamily) => (
          <Card 
            key={subfamily} 
            className="cursor-pointer hover:border-primary hover:shadow-xl transition-all group overflow-hidden"
            onClick={() => handleSubfamilyClick(subfamily)}
          >
            <div className="h-32 bg-secondary/5 flex items-center justify-center group-hover:bg-secondary/10 transition-colors">
              <Boxes className="h-12 w-12 text-secondary/40 group-hover:scale-110 transition-transform" />
            </div>
            <CardHeader className="p-4">
              <CardTitle className="text-lg text-center font-headline capitalize">{subfamily}</CardTitle>
              <CardDescription className="text-center">{hierarchy[selectedFamily!][subfamily].length} Productos</CardDescription>
            </CardHeader>
          </Card>
        ))}

        {view === 'materials' && currentMaterials.map((material) => (
          <Card key={material.id} className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow">
            <div className="relative h-48 w-full bg-muted">
              {material.imageUrl ? (
                <Image 
                  src={material.imageUrl} 
                  alt={material.name} 
                  fill 
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Package className="h-12 w-12 opacity-20" />
                </div>
              )}
            </div>
            <CardHeader className="p-4 flex-grow">
              <div className="flex justify-between items-start gap-2 mb-2">
                <Badge variant="secondary" className="text-[10px]">{material.unit}</Badge>
                <Badge variant="outline" className={cn("text-[10px]", material.stock > 0 ? "text-green-600 border-green-200" : "text-red-600 border-red-200")}>
                  Stock: {material.stock}
                </Badge>
              </div>
              <CardTitle className="text-sm font-bold line-clamp-2 min-h-[2.5rem]">{material.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
               <div className="flex items-center justify-between mt-2">
                  <span className="text-lg font-bold text-primary">${material.price.toFixed(2)}</span>
                  <Button asChild size="sm" className="gap-2">
                    <Link href={orderLink}>
                      <ShoppingCart className="h-4 w-4" />
                      Pedir
                    </Link>
                  </Button>
               </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {view === 'materials' && currentMaterials.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No hay materiales en esta categoría.</p>
        </div>
      )}
    </div>
  );
}
