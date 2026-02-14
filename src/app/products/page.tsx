
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { productCatalog } from '@/lib/materials';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

export default function ProductsPage() {
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
          const productImages = PlaceHolderImages.filter(img => img.id === product.productName.toLowerCase().replace(/ /g, '-'));
          const description = productImages[0]?.description || `Material de construcción: ${product.productName}`;

          return (
            <Card 
              key={product.productName} 
              className="overflow-hidden flex flex-col transform hover:scale-105 transition-transform duration-300 shadow-xl bg-card animate-fade-in"
              style={{ animationDelay: `${100 * (index + 1)}ms` }}
            >
              {productImages.length > 0 && (
                <CardHeader className="p-0 relative">
                  <Carousel className="w-full">
                    <CarouselContent>
                      {productImages.map((image, i) => (
                        <CarouselItem key={i}>
                          <Image
                            src={image.imageUrl}
                            alt={product.productName}
                            width={400}
                            height={300}
                            className="object-cover w-full h-48 bg-muted"
                            data-ai-hint={image.imageHint}
                          />
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
                </CardHeader>
              )}
              <CardContent className="p-6 flex flex-col flex-grow">
                <CardTitle className="text-2xl font-bold capitalize font-headline">{product.productName}</CardTitle>
                <CardDescription className="mt-2 flex-grow">{description}</CardDescription>
                
                <div className='mt-4 flex-grow space-y-2'>
                  <p className='text-sm font-semibold text-muted-foreground'>Presentaciones:</p>
                  {product.variants.map(variant => (
                    <div key={variant.name} className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-muted/50">
                      <span className='capitalize font-medium'>{variant.unit}</span>
                      <Badge variant={variant.deliverable ? "secondary" : "outline"}>
                        ${variant.price.toFixed(2)}
                      </Badge>
                    </div>
                  ))}
                  {product.variants.some(v => v.notes) && (
                    <p className="text-xs text-amber-600 mt-2 p-1 bg-amber-50 rounded-md border border-amber-200">{product.variants.find(v => v.notes)?.notes}</p>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                 <Button asChild className="w-full">
                    <Link href="/new-order">Hacer Pedido de Entrega</Link>
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  );
}
