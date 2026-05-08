'use client';

import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getProductCatalog, type ProductCatalogItem, type Material } from '@/lib/materials';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useUser } from '@/firebase';
import { useState, useEffect } from 'react';
import { Loader2, ShoppingCart } from 'lucide-react';

export default function ProductsPage() {
  const { user, isUserLoading } = useUser();
  const [productCatalog, setProductCatalog] = useState<ProductCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const data = await getProductCatalog();
        setProductCatalog(data);
      } catch (error) {
        console.error("Error al cargar el catálogo:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  // Determinar el destino del botón según si el usuario inició sesión o no
  const orderLink = user ? '/new-order' : '/login';

  if (isLoading || isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-14rem)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 animate-fade-in">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-headline font-bold">Nuestro Catálogo de Productos</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Explora nuestra selección de materiales de construcción de alta calidad, listos para tu próximo gran proyecto.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {productCatalog.map((product, index) => {
          const dbImageUrl = product.variants.find(v => v.imageUrl)?.imageUrl;
          const productImages = PlaceHolderImages.filter(img => img.id === product.productName.toLowerCase().replace(/ /g, '-'));
          const description = product.variants[0]?.description || productImages[0]?.description || `Material de construcción: ${product.productName}`;

          return (
            <Card 
              key={product.productName} 
              className="overflow-hidden flex flex-col transform hover:scale-105 transition-transform duration-300 shadow-xl bg-card animate-fade-in"
              style={{ animationDelay: `${100 * (index + 1)}ms` }}
            >
              <CardHeader className="p-0 relative">
                {dbImageUrl ? (
                  <div className="relative w-full h-48">
                    <Image
                      src={dbImageUrl}
                      alt={product.productName}
                      fill
                      className="object-cover bg-muted"
                      unoptimized
                    />
                  </div>
                ) : productImages.length > 0 ? (
                  <Carousel className="w-full">
                    <CarouselContent>
                      {productImages.map((image, i) => (
                        <CarouselItem key={i}>
                          <div className="relative w-full h-48">
                            <Image
                              src={image.imageUrl}
                              alt={product.productName}
                              fill
                              className="object-cover bg-muted"
                              data-ai-hint={image.imageHint}
                            />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {productImages.length > 1 && (
                      <>
                        <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/30 text-white border-none hover:bg-black/50" />
                        <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/30 text-white border-none hover:bg-black/50" />
                      </>
                    )}
                  </Carousel>
                ) : (
                  <div className="relative w-full h-48 bg-muted flex items-center justify-center">
                    <Image
                      src={'/images/placeholder.png'}
                      alt={product.productName}
                      width={400}
                      height={300}
                      className="object-cover w-full h-48"
                    />
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-6 flex flex-col flex-grow">
                <CardTitle className="text-2xl font-bold capitalize font-headline">{product.productName}</CardTitle>
                <CardDescription className="mt-2 flex-grow">{description}</CardDescription>
                
                <div className='mt-4 flex-grow space-y-2'>
                  <p className='text-sm font-semibold text-muted-foreground'>Presentaciones:</p>
                  {product.variants.map((variant: Material) => (
                    <div key={variant.id} className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-muted/50">
                      <span className='capitalize font-medium'>{variant.unit} ({variant.stock} disponibles)</span>
                      <Badge variant={"secondary"}>
                        ${variant.price.toFixed(2)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                 <Button asChild className="w-full gap-2">
                    <Link href={orderLink}>
                        <ShoppingCart className="h-4 w-4" />
                        Pedir
                    </Link>
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  );
}
