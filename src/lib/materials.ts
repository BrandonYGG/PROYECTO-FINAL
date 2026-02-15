export type Material = {
  name: string; // Este será el nombre único en el menú desplegable, ej., "Cemento (Tonelada)"
  productName: string; // ej., "Cemento"
  price: number;
  unit: 'bulto' | 'tonelada' | 'media tonelada' | 'pieza' | 'kg' | 'm³' | 'rollo';
  notes?: string;
  deliverable: boolean;
};

export const allMaterials: Material[] = [
  // Piedra
  { productName: 'Piedra', name: 'Piedra (Bulto)', price: 40, unit: 'bulto', notes: 'Venta solo en tienda (recolección)', deliverable: false },
  { productName: 'Piedra', name: 'Piedra (Media Tonelada)', price: 400, unit: 'media tonelada', deliverable: true },
  { productName: 'Piedra', name: 'Piedra (Tonelada)', price: 750, unit: 'tonelada', deliverable: true },
  // Nuevos materiales
  { productName: 'Varilla', name: 'Varilla', price: 150, unit: 'pieza', deliverable: true },
  { productName: 'Malla Electrosoldada', name: 'Malla Electrosoldada', price: 850, unit: 'rollo', deliverable: true },
  { productName: 'Mortero Azul', name: 'Mortero Azul (Bulto)', price: 280, unit: 'bulto', notes: 'Especial para albercas', deliverable: true },
  { productName: 'PVC', name: 'Tubo de PVC', price: 120, unit: 'pieza', deliverable: true },
  { productName: 'Block', name: 'Block', price: 12, unit: 'pieza', deliverable: true },
];

/**
 * Lista de materiales disponibles para entrega, para usar en el formulario de pedido.
 */
export const materialsList: {name: string, price: number, unit: string}[] = allMaterials
  .filter(m => m.deliverable)
  .map(({ name, price, unit }) => {
    // Para productos de una sola unidad, no se agrega la unidad al nombre.
    const displayName = name.includes('(') || unit === 'pieza' || unit === 'rollo' ? name : `${name} (${unit})`;
    return { name: displayName, price, unit };
  });

/**
 * Un catálogo agrupado de todos los productos para mostrar en la página de productos.
 */
export const productCatalog = allMaterials.reduce((acc, material) => {
    const existing = acc.find(p => p.productName === material.productName);
    if (existing) {
        existing.variants.push(material);
    } else {
        acc.push({
            productName: material.productName,
            variants: [material]
        });
    }
    return acc;
}, [] as { productName: string, variants: Material[] }[]);
