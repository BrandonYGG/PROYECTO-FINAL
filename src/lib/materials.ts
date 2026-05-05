import { supabase } from './supabaseClient';

export interface PublicMaterial {
  id: number;
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
 * Obtiene los materiales usando los nombres de columna confirmados por el usuario.
 */
export async function getPublicMaterials(): Promise<PublicMaterial[]> {
  try {
    const { data, error } = await supabase
      .from('materiales')
      .select('id, nombre, precio, stock, descripcion, image_url, unit, categoria, marca')
      .order('nombre', { ascending: true });

    if (error) throw error;
    
    return (data || []).map(item => ({
      id: item.id,
      name: item.nombre,
      price: item.precio,
      stock: item.stock,
      unit: item.unit || 'Pza',
      description: item.descripcion || '',
      imageUrl: item.image_url || null,
      family: item.marca || 'General',
      subfamily: item.categoria || 'Varios',
    }));
  } catch (error: any) {
    console.error("Error crítico en getPublicMaterials:", error?.message || "Error desconocido");
    return [];
  }
}

/**
 * Obtiene los materiales para la vista de administrador.
 */
export async function getAdminMaterials(): Promise<AdminMaterial[]> {
  try {
    const { data, error } = await supabase
      .from('materiales')
      .select('id, nombre, precio, stock, descripcion, image_url, unit, cost, created_at, categoria, marca')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      name: item.nombre,
      price: item.precio,
      stock: item.stock,
      unit: item.unit || 'Pza',
      description: item.descripcion || '',
      imageUrl: item.image_url || null,
      family: item.marca || 'General',
      subfamily: item.categoria || 'Varios',
      cost: item.cost || 0,
      createdAt: item.created_at,
    }));
  } catch (error: any) {
    console.error("Error crítico en getAdminMaterials:", error?.message || "Error desconocido");
    return [];
  }
}

/**
 * Actualiza el stock de un material restando la cantidad.
 */
export async function updateMaterialStock(materialId: number, quantityToSubtract: number) {
  try {
    // Obtenemos el stock actual primero para asegurar una resta precisa
    const { data: material, error: fetchError } = await supabase
      .from('materiales')
      .select('stock')
      .eq('id', materialId)
      .single();

    if (fetchError || !material) throw new Error(`Material ID ${materialId} no encontrado`);

    const newStock = material.stock - quantityToSubtract;
    
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
 * Agrupa los materiales por su nombre base (sin variantes) para el catálogo.
 */
export async function getProductCatalog(): Promise<ProductCatalogItem[]> {
  const materials = await getPublicMaterials();

  const catalog = materials.reduce((acc, material) => {
    // Limpia el nombre para agrupar variantes (ej: "Varilla (3/8)" -> "Varilla")
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

/**
 * Obtiene solo algunos productos destacados, uno por cada familia principal.
 */
export async function getHomePageFeaturedProducts(): Promise<ProductCatalogItem[]> {
  const catalog = await getProductCatalog();
  const featuredByFamily: Record<string, ProductCatalogItem> = {};
  
  catalog.forEach(item => {
    const family = item.variants[0]?.family || 'Varios';
    // Si la familia aún no tiene un representante, lo asignamos
    if (!featuredByFamily[family]) {
      featuredByFamily[family] = item;
    }
  });

  // Convertimos a array y limitamos a 8 para que la página cargue rápido y se vea bien
  return Object.values(featuredByFamily).slice(0, 8);
}
