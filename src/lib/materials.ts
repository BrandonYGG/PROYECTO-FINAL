export type Material = {
  name: string; // Este será el nombre único en el menú desplegable, ej., "Cemento (Tonelada)"
  productName: string; // ej., "Cemento"
  price: number;
  unit: 'bulto' | 'tonelada' | 'media tonelada' | 'pieza' | 'kg' | 'm³';
  notes?: string;
  deliverable: boolean;
};

export const allMaterials: Material[] = [
  // Cemento
  { productName: 'Cemento', name: 'Cemento (Bulto)', price: 250, unit: 'bulto', notes: 'Venta solo en tienda (recolección)', deliverable: false },
  { productName: 'Cemento', name: 'Cemento (Media Tonelada)', price: 2400, unit: 'media tonelada', deliverable: true },
  { productName: 'Cemento', name: 'Cemento (Tonelada)', price: 4700, unit: 'tonelada', deliverable: true },
  // Arena
  { productName: 'Arena', name: 'Arena (Bulto)', price: 50, unit: 'bulto', notes: 'Venta solo en tienda (recolección)', deliverable: false },
  { productName: 'Arena', name: 'Arena (Media Tonelada)', price: 450, unit: 'media tonelada', deliverable: true },
  { productName: 'Arena', name: 'Arena (Tonelada)', price: 800, unit: 'tonelada', deliverable: true },
  // Grava
  { productName: 'Grava', name: 'Grava (Bulto)', price: 55, unit: 'bulto', notes: 'Venta solo en tienda (recolección)', deliverable: false },
  { productName: 'Grava', name: 'Grava (Media Tonelada)', price: 500, unit: 'media tonelada', deliverable: true },
  { productName: 'Grava', name: 'Grava (Tonelada)', price: 900, unit: 'tonelada', deliverable: true },
  // Mortero
  { productName: 'Mortero', name: 'Mortero (Bulto)', price: 220, unit: 'bulto', notes: 'Venta solo en tienda (recolección)', deliverable: false },
  { productName: 'Mortero', name: 'Mortero (Media Tonelada)', price: 2100, unit: 'media tonelada', deliverable: true },
  { productName: 'Mortero', name: 'Mortero (Tonelada)', price: 4100, unit: 'tonelada', deliverable: true },
  // Pega Azulejo
  { productName: 'Pega Azulejo', name: 'Pega Azulejo (Bulto)', price: 180, unit: 'bulto', notes: 'Venta solo en tienda (recolección)', deliverable: false },
  // Cemento Blanco
  { productName: 'Cemento Blanco', name: 'Cemento Blanco (Bulto)', price: 350, unit: 'bulto', notes: 'Venta solo en tienda (recolección)', deliverable: false },
  // Ladrillo
  { productName: 'Ladrillo', name: 'Ladrillo', price: 5, unit: 'pieza', deliverable: true },
  // Piedra
  { productName: 'Piedra', name: 'Piedra (Bulto)', price: 40, unit: 'bulto', notes: 'Venta solo en tienda (recolección)', deliverable: false },
  { productName: 'Piedra', name: 'Piedra (Media Tonelada)', price: 400, unit: 'media tonelada', deliverable: true },
  { productName: 'Piedra', name: 'Piedra (Tonelada)', price: 750, unit: 'tonelada', deliverable: true },
];

/**
 * Lista de materiales disponibles para entrega, para usar en el formulario de pedido.
 */
export const materialsList: {name: string, price: number, unit: string}[] = allMaterials
  .filter(m => m.deliverable)
  .map(({ name, price, unit }) => {
    // Para productos de una sola unidad, no se agrega la unidad al nombre.
    const displayName = name.includes('(') || unit === 'pieza' ? name : `${name} (${unit})`;
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
