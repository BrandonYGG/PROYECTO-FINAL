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
 * Obtiene los materiales para la vista pública del cliente.
 * Se eliminó el campo 'unidad' que no existe en la tabla y se usa 'Pza' por defecto.
 */
export async function getPublicMaterials(): Promise<PublicMaterial[]> {
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
        subfamilias (
          nombre,
          familias (
            nombre
          )
        )
      `)
      .order('nombre', { ascending: true });

    if (error) {
      console.warn("Supabase Join falló, intentando consulta simple:", error.message);
      const { data: simpleData, error: simpleError } = await supabase
        .from('materiales')
        .select('id, nombre, precio, stock, descripcion, image_url')
        .order('nombre', { ascending: true });
      
      if (simpleError) throw simpleError;
      
      return (simpleData || []).map(item => ({
        id: item.id,
        name: item.nombre,
        price: item.precio,
        stock: item.stock,
        unit: 'Pza',
        description: item.descripcion || '',
        imageUrl: item.image_url || null,
        family: 'General',
        subfamily: 'Varios',
      }));
    }

    return (data || []).map(item => {
      const subfam = Array.isArray(item.subfamilias) ? item.subfamilias[0] : item.subfamilias;
      const fam = subfam ? (Array.isArray(subfam.familias) ? subfam.familias[0] : subfam.familias) : null;

      return {
        id: item.id,
        name: item.nombre,
        price: item.precio,
        stock: item.stock,
        unit: 'Pza',
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
 * Obtiene los materiales para la vista de administrador.
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

    if (error) {
      console.error("Error de Supabase al obtener materiales (Admin):", error.message);
      return [];
    }

    return (data || []).map(item => {
      const subfam = Array.isArray(item.subfamilias) ? item.subfamilias[0] : item.subfamilias;
      const fam = subfam ? (Array.isArray(subfam.familias) ? subfam.familias[0] : subfam.familias) : null;

      return {
        id: item.id,
        name: item.nombre,
        price: item.precio,
        stock: item.stock,
        unit: 'Pza',
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
 * Actualiza el stock de un material en Supabase restando la cantidad solicitada.
 */
export async function updateMaterialStock(materialId: number, quantityToSubtract: number) {
  try {
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

export async function getProductCatalog(): Promise<ProductCatalogItem[]> {
  const materials = await getPublicMaterials();

  const catalog = materials.reduce((acc, material) => {
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

  catalog.forEach(p => {
    p.variants.sort((a, b) => a.name.localeCompare(b.name));
  });

  return catalog;
}
