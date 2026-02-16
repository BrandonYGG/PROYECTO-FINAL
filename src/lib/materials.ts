import { supabase } from './supabaseClient';

export interface Material {
  id: number;
  name: string; // Mapeado desde 'nombre' en Supabase
  price: number; // Mapeado desde 'precio' en Supabase
  stock: number;
  unit: string; // Mapeado desde 'categoria' en Supabase
  description: string; // Mapeado desde 'descripcion' en Supabase
  created_at: string;
}

export interface ProductCatalogItem {
    productName: string;
    variants: Material[];
}

/**
 * Obtiene la lista completa de materiales desde Supabase.
 * Consulta la tabla con nombres de columna en español y los mapea
 * a la interfaz en inglés que espera la aplicación.
 * @returns Una promesa que se resuelve con un arreglo de materiales.
 */
export async function getMaterials(): Promise<Material[]> {
  // La consulta a Supabase usa los nombres de columna en español.
  const { data, error } = await supabase
    .from('materiales')
    .select('id, nombre, precio, stock, categoria, descripcion, created_at')
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error fetching materials:', JSON.stringify(error, null, 2));
    return [];
  }
  
  if (!data) {
    return [];
  }

  // Mapea los datos de Supabase (español) a la interfaz Material (inglés) que usa la app.
  const materials: Material[] = data.map(item => ({
    id: item.id,
    name: item.nombre,
    price: item.precio,
    stock: item.stock,
    // NOTA: Se asume que 'categoria' puede funcionar como 'unit' (unidad) para la UI.
    unit: item.categoria || '', 
    description: item.descripcion || '',
    created_at: item.created_at,
  }));

  return materials;
}

/**
 * Obtiene el catálogo de productos agrupado por nombre base.
 * @returns Una promesa que se resuelve con un arreglo de productos para el catálogo.
 */
export async function getProductCatalog(): Promise<ProductCatalogItem[]> {
    const materials = await getMaterials();
    
    const catalog = materials.reduce((acc, material) => {
        // Extrae el nombre base del material, ej: "Piedra" de "Piedra (Tonelada)"
        // Esta lógica asume que los nombres de los materiales siguen un patrón de agrupación.
        const productName = material.name.split(' (')[0];
        const existing = acc.find(p => p.productName === productName);
        
        if (existing) {
            existing.variants.push(material);
        } else {
            acc.push({
                productName: productName,
                variants: [material]
            });
        }
        return acc;
    }, [] as ProductCatalogItem[]);

    // Ordenar variantes dentro de cada producto si es necesario
    catalog.forEach(p => {
        p.variants.sort((a, b) => a.name.localeCompare(b.name));
    });

    return catalog;
}
