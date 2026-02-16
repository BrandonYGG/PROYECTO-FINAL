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
    console.error('Error fetching materials:', error);
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

    return catalog;
}
