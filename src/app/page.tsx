
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { ShieldCheck, Users, Truck, Gem, Zap, Shield, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getProductCatalog, ProductCatalogItem } from '@/lib/materials';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

const heroImage = PlaceHolderImages.find((img) => img.id === 'hero');

const whyChooseUs = [
  {
    icon: <ShieldCheck className="h-10 w-10 text-primary" />,
    title: 'Calidad Insuperable',
    description: 'Materiales que cumplen los más altos estándares para garantizar la durabilidad y seguridad de tu proyecto.',
  },
  {
    icon: <Users className="h-10 w-10 text-primary" />,
    title: 'Asesoramiento Experto',
    description: 'Nuestro equipo está siempre disponible para guiarte en la selección de los mejores materiales para tus necesidades.',
  },
  {
    icon: <Truck className="h-10 w-10 text-primary" />,
    title: 'Logística Eficiente',
    description: 'Entregamos tus materiales a tiempo y en perfectas condiciones, directamente en tu obra, para que no te preocupes.',
  }
];

const featuredQualities = [
    {
      name: 'Calidad Garantizada',
      description: 'Seleccionamos solo los mejores materiales del mercado para asegurar que tu proyecto tenga una base sólida y confiable.',
      icon: <Gem className="h-8 w-8 text-primary" />,
    },
    {
      name: 'Durabilidad y Resistencia',
      description: 'Nuestros productos están diseñados para resistir el paso del tiempo y las condiciones más exigentes.',
      icon: <Shield className="h-8 w-8 text-primary" />,
    },
    {
      name: 'Innovación en Materiales',
      description: 'Estamos a la vanguardia, ofreciendo las soluciones más modernas y eficientes para todo tipo de construcción.',
      icon: <Zap className="h-8 w-8 text-primary" />,
    },
    {
      name: 'Acabados Perfectos',
      description: 'Logra resultados profesionales con nuestros materiales de primera, que garantizan un acabado impecable.',
      icon: <Star className="h-8 w-8 text-primary" />,
    },
];

const galleryImages = [
  {
    src: '/images/varilla-4.jpeg',
    alt: 'Estructura de varillas en construcción',
    title: 'Varilla',
    description: 'Armado de columnas y trabes con varilla de alta resistencia.',
  },
  {
    src: '/images/Block-5.jpeg',
    alt: 'Albañil colocando blocks de concreto',
    title: 'Block',
    description: 'Construcción de muros con block de concreto para una cimentación sólida.',
  },
  {
    src: '/images/malla-electrosoldada-3.jpeg',
    alt: 'Aplicación de malla electrosoldada en piso',
    title: 'Malla Electrosoldada',
    description: 'Malla electrosoldada para garantizar la durabilidad de superficies.',
  },
  {
    src: '/images/piedras-7.jpeg',
    alt: 'Muro de piedra decorativo',
    title: 'Acabados con Identidad',
    description: 'Muros de piedra natural que añaden un toque rústico y elegante.',
  },
  {
    src: '/images/PVC-3.jpeg',
    alt: 'Instalación de tubería de PVC',
    title: 'Instalaciones Hidráulicas',
    description: 'Tubería de PVC para sistemas de agua potable y drenaje eficientes.',
  },
  {
    src: '/images/mortero-azul-2.jpeg',
    alt: 'Acabado de mortero azul en alberca',
    title: 'Mortero Cruz Azul',
    description: 'Mortero especializado para acabados impermeables y estéticos en albercas.',
  },
];


export default async function Home() {
  const productCatalog = await getProductCatalog();
  const featuredProducts = productCatalog; // Mostrar todos los productos disponibles

  return (
    <div className="flex flex-col animate-fade-in">
      <section className="relative h-[70vh] md:h-[80vh] w-full flex items-center justify-center text-center text-white overflow-hidden">
        {heroImage && (
          <Image
            src={heroImage.imageUrl}
            alt={heroImage.description}
            fill
            className="object-cover scale-105"
            priority
            data-ai-hint={heroImage.imageHint}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/40 to-transparent" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 animate-slide-in-up animation-delay-300">
          <h1 className="text-5xl md:text-7xl font-headline font-extrabold tracking-tight text-shadow-lg">
            Construye Sólido, Construye con Nosotros
          </h1>
          <p className="mt-6 text-lg md:text-xl max-w-3xl mx-auto text-primary-foreground/90">
            Tu aliado en materiales de construcción de alta calidad. Desde los cimientos hasta los acabados, tenemos todo para tu proyecto.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
            <Button asChild size="lg" className="font-bold text-lg px-10 py-6">
              <Link href="/signup">Empezar a Construir</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="font-bold text-lg bg-black/20 border-white/50 backdrop-blur-sm hover:bg-white/10">
              <Link href="/login">Iniciar Sesión</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="materials-video" className="py-20 md:py-28 bg-background">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-headline font-bold">
            Nuestros Materiales en Acción
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
            Dale un vistazo a la calidad y versatilidad de los materiales que ofrecemos. La base perfecta para construir tus proyectos más ambiciosos.
          </p>
          <div className="mt-12 max-w-sm mx-auto shadow-2xl rounded-lg overflow-hidden border-4 border-card bg-muted">
            <video
              src="/materials-showcase.mp4"
              width="1920"
              height="1080"
              controls
              playsInline
              className="w-full h-auto"
            >
              Tu navegador no soporta el tag de video.
            </video>
          </div>
        </div>
      </section>

      <section id="why-us" className="py-20 md:py-28 bg-secondary/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-headline font-bold">
              ¿Por Qué Elegirnos?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              No solo vendemos materiales, construimos relaciones de confianza.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {whyChooseUs.map((reason, index) => (
              <Card
                key={reason.title}
                className="text-center p-6 flex flex-col items-center border-2 border-transparent hover:border-primary hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 animate-fade-in"
                style={{ animationDelay: `${200 * (index + 2)}ms` }}
              >
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  {reason.icon}
                </div>
                <CardHeader className="p-0">
                  <CardTitle className="text-2xl font-bold font-headline">{reason.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-0 mt-2 flex-grow">
                  <p className="text-muted-foreground">
                    {reason.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="gallery" className="py-20 md:py-28 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-headline font-bold">
              Nuestros Materiales en la Obra
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Calidad que se ve y se siente. Un vistazo a cómo nuestros productos transforman proyectos en realidades duraderas.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {galleryImages.map((image, index) => (
              <Card 
                key={index} 
                className="overflow-hidden group transform hover:-translate-y-2 transition-transform duration-300 shadow-xl bg-card animate-fade-in"
                style={{ animationDelay: `${150 * (index + 1)}ms` }}
              >
                <CardHeader className="p-0">
                   <div className="overflow-hidden">
                    <Image
                      src={image.src}
                      alt={image.alt}
                      width={400}
                      height={300}
                      className="object-cover w-full h-56 transition-transform duration-500 ease-in-out group-hover:scale-110"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <CardTitle className="text-xl font-headline">{image.title}</CardTitle>
                  <CardDescription className="mt-2 text-sm">{image.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="featured-materials" className="py-20 md:py-28 bg-secondary/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-headline font-bold">
              Nuestros Materiales Populares
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              La base de todo gran proyecto. Descubre nuestra selección de materiales de primera calidad.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredProducts.map((product, index) => {
              const productImages = PlaceHolderImages.filter(img => img.id === product.productName.toLowerCase().replace(/ /g, '-'));
              
              return (
                <Card 
                  key={product.productName} 
                  className="overflow-hidden flex flex-col transform hover:scale-105 transition-transform duration-300 shadow-xl bg-card animate-fade-in"
                  style={{ animationDelay: `${100 * (index + 1)}ms` }}
                >
                  {productImages.length > 0 ? (
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
                  ) : (
                    <div className="w-full h-48 bg-muted flex items-center justify-center">
                       <Image
                          src={'/images/placeholder.png'}
                          alt={product.productName}
                          width={400}
                          height={300}
                          className="object-cover w-full h-48 bg-muted"
                        />
                    </div>
                  )}
                  <CardContent className="p-6 flex-grow">
                    <CardTitle className="text-xl capitalize font-headline">{product.productName}</CardTitle>
                    <CardDescription className="mt-2 text-sm">{productImages[0]?.description || `Material de construcción: ${product.productName}`}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="mt-16 text-center">
            <Button asChild size="lg" className="font-bold">
              <Link href="/products">Ver Catálogo Completo</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="featured-qualities" className="py-20 md:py-28 bg-secondary/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-headline font-bold">
              Calidad que Construye Confianza
            </h2>
             <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Nuestros productos están diseñados para resistir el paso del tiempo.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredQualities.map((quality, index) => (
              <Card 
                key={quality.name}
                className="overflow-hidden flex flex-col transform hover:scale-105 transition-transform duration-300 shadow-xl bg-card animate-fade-in"
                style={{ animationDelay: `${200 * (index + 2)}ms` }}
              >
                <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                  {quality.icon}
                  <CardTitle className="text-lg">{quality.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow pt-2">
                  <CardDescription>{quality.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="block-video" className="py-20 md:py-28 bg-background">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-headline font-bold">
            Así Nace la Calidad: La Fabricación de Nuestros Blocks
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
            Un vistazo exclusivo a nuestro proceso de fabricación, donde la resistencia y la precisión se unen para crear la base de tu proyecto.
          </p>
          <div className="mt-12 max-w-md mx-auto shadow-2xl rounded-lg overflow-hidden border-4 border-card bg-muted">
            <video
              src="/block-manufacturing.mp4"
              width="1920"
              height="1080"
              controls
              playsInline
              className="w-full h-auto"
            >
              Tu navegador no soporta el tag de video.
            </video>
          </div>
        </div>
      </section>
    </div>
  );
}
