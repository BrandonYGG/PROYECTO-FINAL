import { supabase } from './supabaseClient';

export interface PublicMaterial {
  id: string;
  name: string;
  price: number;
  stock: number;
  unit: string;
  description: string;
  imageUrl: string | null;
  family: string;
  subfamily: string;
  familyImageUrl?: string | null;
}

export interface AdminMaterial extends PublicMaterial {
  cost: number;
  createdAt: string;
}

export interface ProductCatalogItem {
  productName: string;
  variants: PublicMaterial[];
}

export type Material = PublicMaterial;

/**
 * Obtiene los materiales con limpieza de datos para evitar errores de renderizado.
 */
export async function getPublicMaterials(): Promise<PublicMaterial[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("Faltan credenciales de Supabase.");
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('materiales')
      .select(`
        id, 
        nombre, 
        precio, 
        stock, 
        descripcion, 
        image_url, 
        unit,
        subfamilias (
          nombre,
          familias (
            nombre,
            image_url
          )
        )
      `)
      .order('nombre', { ascending: true });

    if (error) throw error;
    
    return (data || []).map(item => {
      const subfam: any = Array.isArray(item.subfamilias) ? item.subfamilias[0] : item.subfamilias;
      const fam: any = subfam?.familias ? (Array.isArray(subfam.familias) ? subfam.familias[0] : subfam.familias) : null;

      return {
        id: item.id.toString(),
        name: item.nombre || 'Material sin nombre',
        price: Number(item.precio) || 0,
        stock: Number(item.stock) || 0,
        unit: item.unit || 'Pza',
        description: item.descripcion || '',
        imageUrl: item.image_url || null,
        family: (typeof fam?.nombre === 'string' ? fam.nombre : 'General'),
        subfamily: (typeof subfam?.nombre === 'string' ? subfam.nombre : 'Varios'),
        familyImageUrl: fam?.image_url || null,
      };
    });
  } catch (error: any) {
    console.error("Error en getPublicMaterials:", error);
    return [];
  }
}

/**
 * Actualiza el stock de un material (restando o sumando).
 */
export async function updateMaterialStock(materialId: string | number, quantityChange: number, operation: 'subtract' | 'add' = 'subtract') {
  try {
    const { data: material, error: fetchError } = await supabase
      .from('materiales')
      .select('stock')
      .eq('id', materialId)
      .single();

    if (fetchError || !material) throw new Error(`Material ID ${materialId} no encontrado`);

    const currentStock = Number(material.stock) || 0;
    const newStock = operation === 'subtract' 
      ? currentStock - Number(quantityChange)
      : currentStock + Number(quantityChange);
    
    const { error: updateError } = await supabase
      .from('materiales')
      .update({ stock: newStock })
      .eq('id', materialId);

    if (updateError) throw updateError;
    return true;
  } catch (error) {
    console.error("Error al actualizar stock:", error);
    throw error;
  }
}

export async function getMaterials(): Promise<PublicMaterial[]> {
  return getPublicMaterials();
}

export async function getProductCatalog(): Promise<ProductCatalogItem[]> {
  const materials = await getPublicMaterials();
  const catalog = materials.reduce((acc, material) => {
    const productName = material.name.split(' (')[0].split('  ')[0].trim();
    const existing = acc.find(p => p.productName === productName);
    if (existing) {
      existing.variants.push(material);
    } else {
      acc.push({ productName, variants: [material] });
    }
    return acc;
  }, [] as ProductCatalogItem[]);
  return catalog;
}
