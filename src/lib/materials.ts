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
 * Obtiene los materiales usando las relaciones reales con las tablas familias y subfamilias.
 * Se asume una estructura: materiales -> subfamilias -> familias
 */
export async function getPublicMaterials(): Promise<PublicMaterial[]> {
  try {
    // Intentamos la consulta con la relación configurada en la DB
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
            nombre
          )
        )
      `)
      .order('nombre', { ascending: true });

    if (error) {
      console.warn("Error con relaciones anidadas, intentando fallback a columnas planas:", error.message);
      
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('materiales')
        .select('id, nombre, precio, stock, descripcion, image_url, unit, categoria')
        .order('nombre', { ascending: true });
      
      if (fallbackError) throw fallbackError;
      
      return (fallbackData || []).map(item => ({
        id: item.id.toString(),
        name: item.nombre,
        price: item.precio || 0,
        stock: item.stock || 0,
        unit: item.unit || 'Pza',
        description: item.descripcion || '',
        imageUrl: item.image_url || null,
        family: 'General',
        subfamily: item.categoria || 'Varios',
      }));
    }
    
    return (data || []).map(item => {
      // Manejo de la data anidada de Supabase considerando que pueden venir como objetos o arrays
      const subfam: any = Array.isArray(item.subfamilias) ? item.subfamilias[0] : item.subfamilias;
      const fam: any = subfam?.familias ? (Array.isArray(subfam.familias) ? subfam.familias[0] : subfam.familias) : null;

      return {
        id: item.id.toString(),
        name: item.nombre,
        price: item.precio || 0,
        stock: item.stock || 0,
        unit: item.unit || 'Pza',
        description: item.descripcion || '',
        imageUrl: item.image_url || null,
        family: fam?.nombre || 'General',
        subfamily: subfam?.nombre || 'Varios',
      };
    });
  } catch (error: any) {
    console.error("Error crítico en getPublicMaterials:", error?.message || "Error desconocido");
    return [];
  }
}

/**
 * Obtiene los materiales para la vista de administrador incluyendo costos.
 */
export async function getAdminMaterials(): Promise<AdminMaterial[]> {
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
        cost, 
        created_at,
        subfamilias (
          nombre,
          familias (
            nombre
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(item => {
      const subfam: any = Array.isArray(item.subfamilias) ? item.subfamilias[0] : item.subfamilias;
      const fam: any = subfam?.familias ? (Array.isArray(subfam.familias) ? subfam.familias[0] : subfam.familias) : null;

      return {
        id: item.id.toString(),
        name: item.nombre,
        price: item.precio || 0,
        stock: item.stock || 0,
        unit: item.unit || 'Pza',
        description: item.descripcion || '',
        imageUrl: item.image_url || null,
        family: fam?.nombre || 'General',
        subfamily: subfam?.nombre || 'Varios',
        cost: item.cost || 0,
        createdAt: item.created_at,
      };
    });
  } catch (error: any) {
    console.error("Error crítico en getAdminMaterials:", error?.message || "Error desconocido");
    return [];
  }
}

/**
 * Actualiza el stock de un material restando la cantidad.
 */
export async function updateMaterialStock(materialId: string | number, quantityToSubtract: number) {
  try {
    const { data: material, error: fetchError } = await supabase
      .from('materiales')
      .select('stock')
      .eq('id', materialId)
      .single();

    if (fetchError || !material) throw new Error(`Material ID ${materialId} no encontrado`);

    const newStock = (material.stock || 0) - quantityToSubtract;
    
    const { error: updateError } = await supabase
      .from('materiales')
      .update({ stock: newStock })
      .eq('id', materialId);

    if (updateError) throw updateError;
    
    return true;
  } catch (error) {
    console.error("Error al actualizar stock en Supabase:", error);
    throw error;
  }
}

export async function getMaterials(): Promise<PublicMaterial[]> {
  return getPublicMaterials();
}

/**
 * Agrupa los materiales por su nombre base para el catálogo.
 */
export async function getProductCatalog(): Promise<ProductCatalogItem[]> {
  const materials = await getPublicMaterials();

  const catalog = materials.reduce((acc, material) => {
    const productName = material.name.split(' (')[0].split('  ')[0].trim();
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

  catalog.forEach(p => {
    p.variants.sort((a, b) => a.name.localeCompare(b.name));
  });

  return catalog;
}
