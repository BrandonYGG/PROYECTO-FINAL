'use server';
/**
 * @fileOverview Flujo de IA para geocodificación inversa, convirtiendo coordenadas en una dirección.
 * 
 * Se ha añadido lógica de fallback para evitar bloqueos por falta de configuración de API o restricciones de facturación.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ReverseGeocodeInputSchema = z.object({
  lat: z.number().describe('La latitud.'),
  lng: z.number().describe('La longitud.'),
});
export type ReverseGeocodeInput = z.infer<typeof ReverseGeocodeInputSchema>;

const ReverseGeocodeOutputSchema = z.object({
  street: z.string().describe('El nombre de la calle.'),
  number: z.string().describe('El número de la calle.'),
  colony: z.string().describe('La colonia o barrio.'),
  municipality: z.string().describe('El municipio o delegación.'),
  state: z.string().describe('El estado.'),
  postalCode: z.string().describe('El código postal.'),
});
export type ReverseGeocodeOutput = z.infer<typeof ReverseGeocodeOutputSchema>;

// Dirección genérica para evitar que el formulario se quede vacío si falla la API
const FALLBACK_ADDRESS: ReverseGeocodeOutput = {
  street: 'Ubicación detectada',
  number: 'S/N',
  colony: 'Verificar dirección',
  municipality: 'CDMX',
  state: 'Ciudad de México',
  postalCode: '06000',
};

// Define la herramienta de Genkit para geocodificación inversa
const reverseGeocodeTool = ai.defineTool(
  {
    name: 'reverseGeocodeCoordinates',
    description: 'Obtiene una dirección estructurada a partir de coordenadas de latitud y longitud.',
    inputSchema: ReverseGeocodeInputSchema,
    outputSchema: ReverseGeocodeOutputSchema,
  },
  async ({ lat, lng }) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey || apiKey.length < 10) {
      return FALLBACK_ADDRESS;
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        // En caso de denegación, devolvemos datos genéricos para no romper la experiencia de usuario
        if (data.status === 'REQUEST_DENIED') {
          console.warn("Reverse Geocoding: Acceso denegado por Google. Usando datos genéricos.");
          return FALLBACK_ADDRESS;
        }
        throw new Error(`La geocodificación inversa falló con el estado: ${data.status}.`);
      }

      const result = data.results[0];
      const addressComponents = result.address_components;

      const getAddressComponent = (...types: string[]) => {
          const component = addressComponents.find((c: any) => types.some(t => c.types.includes(t)));
          return component?.long_name || '';
      }

      return {
          street: getAddressComponent('route'),
          number: getAddressComponent('street_number'),
          colony: getAddressComponent('neighborhood', 'sublocality'),
          municipality: getAddressComponent('locality', 'administrative_area_level_2'),
          state: getAddressComponent('administrative_area_level_1'),
          postalCode: getAddressComponent('postal_code'),
      };
    } catch (error) {
      console.error("Error en reverseGeocodeTool:", error);
      return FALLBACK_ADDRESS;
    }
  }
);


export async function reverseGeocodeCoordinates(input: ReverseGeocodeInput): Promise<ReverseGeocodeOutput> {
    return reverseGeocodeFlow(input);
}


// Define el flujo de Genkit que utiliza la herramienta de geocodificación inversa.
const reverseGeocodeFlow = ai.defineFlow(
  {
    name: 'reverseGeocodeFlow',
    inputSchema: ReverseGeocodeInputSchema,
    outputSchema: ReverseGeocodeOutputSchema,
  },
  async (input) => {
    return reverseGeocodeTool(input);
  }
);
