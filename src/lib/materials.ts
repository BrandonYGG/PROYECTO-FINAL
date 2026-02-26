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

export async function getPublicMaterials(): Promise<PublicMaterial[]> {
  const { data, error } = await supabase
    .from('materiales')
    .select('id, nombre, precio, stock, categoria, descripcion, image_url')
    .order('nombre', { ascending: true });

  if (error) {
    return [];
  }

  return (data || []).map(item => ({
    id: item.id,
    name: item.nombre,
    price: item.precio,
    stock: item.stock,
    unit: item.categoria || '',
    description: item.descripcion || '',
    imageUrl: item.image_url || null,
  }));
}

export async function getAdminMaterials(): Promise<AdminMaterial[]> {
  const { data, error } = await supabase
    .from('materiales')
    .select('id, nombre, precio, stock, categoria, descripcion, image_url, cost, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return [];
  }

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
}

export async function getMaterials(): Promise<PublicMaterial[]> {
  return getPublicMaterials();
}

export async function getProductCatalog(): Promise<ProductCatalogItem[]> {
  const materials = await getPublicMaterials();

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

  catalog.forEach(p => {
    p.variants.sort((a, b) => a.name.localeCompare(b.name));
  });

  return catalog;
}
