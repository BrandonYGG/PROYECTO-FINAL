/**
 * @fileOverview Flujo y herramienta de IA para la geocodificación de direcciones utilizando la API de Google Maps.
 * 
 * Se ha añadido una lógica de fallback para evitar que la aplicación se bloquee si la API de Google Maps
 * no está configurada o tiene restricciones de facturación (Modo Desarrollo).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const GeocodeAddressInputSchema = z.object({
  address: z.string().describe('La dirección de calle a geocodificar.'),
});
export type GeocodeAddressInput = z.infer<typeof GeocodeAddressInputSchema>;

export const GeocodeAddressOutputSchema = z.object({
  lat: z.number().describe('La latitud de la dirección.'),
  lng: z.number().describe('La longitud de la dirección.'),
});
export type GeocodeAddressOutput = z.infer<typeof GeocodeAddressOutputSchema>;

// Coordenadas de fallback (Centro de CDMX) para evitar bloqueos en desarrollo
const FALLBACK_LOCATION = { lat: 19.4326, lng: -99.1332 };

// Define la herramienta de Genkit para la geocodificación
export const geocodeAddressTool = ai.defineTool(
  {
    name: 'geocodeAddress',
    description: 'Obtiene las coordenadas de latitud y longitud para una dirección de calle dada.',
    inputSchema: GeocodeAddressInputSchema,
    outputSchema: GeocodeAddressOutputSchema,
  },
  async (input) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    // Si no hay API Key configurada correctamente, usamos fallback silencioso
    if (!apiKey || apiKey.length < 10) {
      console.warn('Geocoding: No hay API Key válida. Usando ubicación de fallback para desarrollo.');
      return FALLBACK_LOCATION;
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        input.address
      )}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        // Si la API niega el acceso por facturación o límites, devolvemos el fallback en lugar de lanzar error
        if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
          console.warn(`Geocoding API ${data.status}: Usando fallback por restricciones de cuenta de Google.`);
          return FALLBACK_LOCATION;
        }
        throw new Error(`La geocodificación falló con el estado: ${data.status}. ${data.error_message || ''}`);
      }

      return data.results[0].geometry.location;
    } catch (error) {
      console.error('Error en geocodeAddressTool:', error);
      return FALLBACK_LOCATION;
    }
  }
);


// Define el flujo de Genkit que utiliza la herramienta de geocodificación.
export const geocodeAddressFlow = ai.defineFlow(
  {
    name: 'geocodeAddressFlow',
    inputSchema: GeocodeAddressInputSchema,
    outputSchema: GeocodeAddressOutputSchema,
  },
  async (input) => {
    return geocodeAddressTool(input);
  }
);
