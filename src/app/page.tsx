
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { ShieldCheck, Users, Truck, BrainCircuit, Gem, Zap, Shield, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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

export default function Home() {
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

      <section id="why-us" className="py-20 md:py-28 bg-background">
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
    </div>
  );
}
