import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const materialsList = [
    { name: "cemento", price: 250, unit: "bulto" },
    { name: "mortero", price: 220, unit: "bulto" },
    { name: "cal", price: 80, unit: "bulto" },
    { name: "alambre", price: 15, unit: "kg" },
    { name: "ladrillo", price: 5, unit: "pieza" },
    { name: "varilla", price: 150, unit: "pieza" },
    { name: "arena", price: 800, unit: "m³" },
    { name: "grava", price: 900, unit: "m³" },
  ];

export default function ProductsPage() {

  const productImages = PlaceHolderImages.filter(img => img.id !== 'hero');

  return (
    <div className="container mx-auto py-12 px-4 animate-fade-in">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-headline font-bold">Nuestro Catálogo de Productos</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Explora nuestra selección de materiales de construcción de alta calidad, listos para tu próximo gran proyecto.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {productImages.map((product, index) => {
          const materialInfo = materialsList.find(m => product.id.includes(m.name));
          return (
            <Card 
              key={product.id} 
              className="overflow-hidden flex flex-col transform hover:scale-105 transition-transform duration-300 shadow-xl bg-card animate-fade-in"
              style={{ animationDelay: `${100 * (index + 1)}ms` }}
            >
              <CardHeader className="p-0 relative">
                <Image
                  src={product.imageUrl}
                  alt={product.description}
                  width={400}
                  height={300}
                  className="object-cover w-full h-48"
                  data-ai-hint={product.imageHint}
                />
                 {materialInfo && (
                    <Badge className="absolute top-2 right-2 text-lg font-bold" variant="destructive">
                      ${materialInfo.price} <span className='text-sm font-normal ml-1'>/{materialInfo.unit}</span>
                    </Badge>
                  )}
              </CardHeader>
              <CardContent className="p-6 flex flex-col flex-grow">
                <CardTitle className="text-2xl font-bold capitalize font-headline">{product.id.replace('-', ' ')}</CardTitle>
                <CardDescription className="mt-2 flex-grow">{product.description}</CardDescription>
                <Button asChild className="mt-4 w-full">
                    <Link href="/new-order">Hacer Pedido</Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  );
}
