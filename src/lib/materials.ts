import { supabase } from './supabaseClient';

export interface Material {
  id: number;
  name: string;
  price: number;
  stock: number;
  unit: string;
  created_at: string;
}

export interface ProductCatalogItem {
    productName: string;
    variants: Material[];
}

/**
 * Obtiene la lista completa de materiales desde Supabase.
 * @returns Una promesa que se resuelve con un arreglo de materiales.
 */
export async function getMaterials(): Promise<Material[]> {
  const { data, error } = await supabase
    .from('materiales')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching materials:', JSON.stringify(error, null, 2));
    return [];
  }

  return data;
}

/**
 * Obtiene el catálogo de productos agrupado por nombre base.
 * @returns Una promesa que se resuelve con un arreglo de productos para el catálogo.
 */
export async function getProductCatalog(): Promise<ProductCatalogItem[]> {
    const materials = await getMaterials();
    
    const catalog = materials.reduce((acc, material) => {
        // Extrae el nombre base del material, ej: "Piedra" de "Piedra (Tonelada)"
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
