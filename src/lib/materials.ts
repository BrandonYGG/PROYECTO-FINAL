import { supabase } from './supabaseClient';

export interface PublicMaterial {
  id: number;
  name: string;
  price: number;
  stock: number;
  unit: string;
  description: string;
  imageUrl: string | null;
}

export interface AdminMaterial {
  id: number;
  name: string;
  price: number;
  stock: number;
  unit: string;
  description: string;
  imageUrl: string | null;
  cost: number;
  createdAt: string;
}

export interface ProductCatalogItem {
  productName: string;
  variants: PublicMaterial[];
}

export type Material = PublicMaterial;

/**
 * Obtiene los materiales para la vista pública del cliente.
 */
export async function getPublicMaterials(): Promise<PublicMaterial[]> {
  try {
    const { data, error } = await supabase
      .from('materiales')
      .select('id, nombre, precio, stock, categoria, descripcion, image_url')
      .order('nombre', { ascending: true });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      name: item.nombre,
      price: item.precio,
      stock: item.stock,
      unit: item.categoria || '',
      description: item.descripcion || '',
      imageUrl: item.image_url || null, // Aseguramos que se mapee correctamente
    }));
  } catch (error) {
    console.error("Error fetching materials:", error);
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
      .select('id, nombre, precio, stock, categoria, descripcion, image_url, cost, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      name: item.nombre,
      price: item.precio,
      stock: item.stock,
      unit: item.categoria || '',
      description: item.descripcion || '',
      imageUrl: item.image_url || null,
      cost: item.cost || 0,
      createdAt: item.created_at,
    }));
  } catch (error) {
    console.error("Error fetching admin materials:", error);
    return [];
  }
}

export async function getMaterials(): Promise<PublicMaterial[]> {
  return getPublicMaterials();
}

/**
 * Agrupa los materiales por nombre base para el catálogo.
 */
export async function getProductCatalog(): Promise<ProductCatalogItem[]> {
  const materials = await getPublicMaterials();

  const catalog = materials.reduce((acc, material) => {
    // Agrupar por nombre antes del paréntesis para manejar variantes (ej. "Varilla (3/8)")
    const productName = material.name.split(' (')[0].trim();
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

  // Ordenar variantes por nombre dentro de cada grupo
  catalog.forEach(p => {
    p.variants.sort((a, b) => a.name.localeCompare(b.name));
  });

  return catalog;
}
