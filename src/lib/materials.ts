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
 * Función de utilidad para limpiar unidades que sean UUIDs o nulas
 */
function formatUnit(unit: string | null): string {
  if (!unit) return 'Pza';
  // Si la unidad parece un UUID (contiene guiones y muchos caracteres), devolvemos un fallback
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(unit)) return 'Pza';
  return unit;
}

/**
 * Obtiene los materiales para la vista pública del cliente.
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
        unidad, 
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
        .select('id, nombre, precio, stock, unidad, descripcion, image_url')
        .order('nombre', { ascending: true });
      
      if (simpleError) throw simpleError;
      
      return (simpleData || []).map(item => ({
        id: item.id,
        name: item.nombre,
        price: item.precio,
        stock: item.stock,
        unit: formatUnit(item.unidad),
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
        unit: formatUnit(item.unidad),
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
        unidad, 
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
        unit: formatUnit(item.unidad),
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
