// ============================================================
// CATÁLOGO — los productos se cargan desde Google Sheets (ver
// bloque SHEETS_CONFIG más abajo). Este archivo también trae las
// pestañas de categoría, los subfiltros, y el armado de cada
// tarjeta de producto (normal o a granel).
// ============================================================
// ============================================================
// CATÁLOGO DESDE GOOGLE SHEETS
// ============================================================
// El catálogo ya no vive en un arreglo fijo acá — se trae en vivo
// desde una planilla de Google Sheets publicada como CSV. Así,
// cambiar un precio o el stock en la planilla actualiza el sitio
// solo, sin tocar código.
//
// CÓMO CONECTARLO (una vez, ver instrucciones completas aparte):
//  1) Crea la planilla con las columnas: id, nombre, categoria,
//     subcategoria, tipo (normal/granel), precio, precio_label,
//     precio_kg_info, precio_por_kg, badge, imagen, stock
//  2) Archivo > Compartir > Publicar en la web > formato CSV
//  3) Pega la URL que te da Google Sheets acá abajo, en
//     SHEETS_CONFIG.csvUrl
// ============================================================
const SHEETS_CONFIG = {
  // Reemplaza esta URL por la que te entrega Google Sheets al
  // publicar la planilla como CSV (Archivo > Compartir >
  // Publicar en la web). Mientras esté vacía, se usan los
  // productos de respaldo de abajo.
  csvUrl: ''
};

// Productos de respaldo: se usan SOLO si la planilla todavía no
// está conectada, o si por algún motivo no se pudo leer (sin
// internet, la planilla se borró, etc.) — así el catálogo nunca
// queda completamente vacío.
const FALLBACK_PRODUCTS = [
  { id: 'perro-alimento-adulto', name: 'Alimento premium adulto', category: 'perros', subcategory: 'Comida',
    price: 19990, priceLabel: 'desde $19.990', priceKg: 'desde $4.594 x kg', badge: '20% dcto. 2da unidad', stock: 0,
    image: 'https://loremflickr.com/400/300/dog,food' },
  { id: 'gato-alimento-adulto', name: 'Alimento premium adulto', category: 'gatos', subcategory: 'Comida',
    price: 18990, priceLabel: 'desde $18.990', priceKg: 'desde $4.980 x kg', stock: 0,
    image: 'https://loremflickr.com/400/300/cat,food' },
  { id: 'granel-perro-pollo', name: 'Granel Perro — Pollo y arroz', category: 'granel', subcategory: 'Perro',
    bulk: true, pricePerKg: 4500, stock: 0, image: 'https://loremflickr.com/400/300/dog,kibble' }
];

let PRODUCTS = [];

/** Convierte un valor de celda a número, o null si viene vacío. */
function celdaANumero_(valor) {
  if (valor == null || String(valor).trim() === '') return null;
  const n = Number(String(valor).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : n;
}

/** Traduce una fila de la planilla (ya parseada por PapaParse) al
 *  mismo formato de objeto que usa el resto del catálogo. */
function filaAProducto_(fila) {
  const esGranel = String(fila.tipo || '').trim().toLowerCase() === 'granel';
  const base = {
    id: String(fila.id || '').trim(),
    name: String(fila.nombre || '').trim(),
    category: String(fila.categoria || '').trim(),
    subcategory: String(fila.subcategoria || '').trim(),
    image: String(fila.imagen || '').trim(),
    stock: celdaANumero_(fila.stock) ?? 0
  };
  if (String(fila.badge || '').trim()) base.badge = String(fila.badge).trim();

  if (esGranel) {
    return { ...base, bulk: true, pricePerKg: celdaANumero_(fila.precio_por_kg) || 0 };
  }

  const precioLabel = String(fila.precio_label || '').trim();
  const precio = celdaANumero_(fila.precio) || 0;
  const precioKg = String(fila.precio_kg_info || '').trim();
  return {
    ...base,
    price: precio,
    priceLabel: precioLabel || `$${precio.toLocaleString('es-CL')}`,
    ...(precioKg ? { priceKg: precioKg } : {})
  };
}

/** Descarga y parsea la planilla publicada. Lanza error si algo
 *  sale mal, para que quien llama decida qué mostrar. */
function cargarProductosDesdeSheet_() {
  return new Promise((resolve, reject) => {
    if (!SHEETS_CONFIG.csvUrl) {
      reject(new Error('SHEETS_CONFIG.csvUrl todavía no está configurada'));
      return;
    }
    Papa.parse(SHEETS_CONFIG.csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (resultado) => {
        try {
          const productos = resultado.data
            .filter(fila => String(fila.id || '').trim() !== '')
            .map(filaAProducto_);
          if (productos.length === 0) throw new Error('La planilla no tiene filas con datos');
          resolve(productos);
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(err)
    });
  });
}

// ============================================================
// METADATA DE CADA CATEGORÍA — título de la página y sus
// subfiltros. Para agregar una categoría nueva, se suma acá
// y se agregan sus productos en la planilla con ese "categoria".
// ============================================================
const CATEGORY_META = {
  'perros': { label: 'Perros', title: 'Productos para Perros', subfilters: ['Comida', 'Ropa', 'Juguetes', 'Accesorios'] },
  'gatos': { label: 'Gatos', title: 'Productos para Gatos', subfilters: ['Comida', 'Arena', 'Juguetes', 'Accesorios'] },
  'otras-mascotas': { label: 'Otros productos', title: 'Otros Productos', subfilters: ['Aves', 'Roedores', 'Peces', 'Varios'] },
  'granel': { label: 'Alimento a Granel', title: 'Alimento a Granel', subfilters: ['Perro', 'Gato'] }
};

let currentCategory = 'perros';
let currentSubfilter = 'Todos';

function bulkPrice(pricePerKg, grams) {
  return Math.round((pricePerKg * grams) / 1000);
}

function stockLineHTML_(product) {
  if (product.stock == null) return '';
  return product.stock > 0
    ? `<span class="product-stock">Stock: ${product.stock} unidades</span>`
    : `<span class="product-stock product-stock-out">Sin stock por ahora</span>`;
}

function productCardHTML(product) {
  if (product.bulk) {
    const defaultGrams = 500;
    return `
      <div class="product-card product-card-bulk" data-product-id="${product.id}" data-product-name="${product.name}" data-price-per-kg="${product.pricePerKg}">
        <img src="${product.image}" alt="${product.name}" class="product-img" loading="lazy">
        <div class="product-info">
          <span class="product-tag">${product.subcategory}</span>
          <h4>${product.name}</h4>
          <span class="product-price">${formatCLP(product.pricePerKg)} / kg</span>
          <div class="bulk-qty-row">
            <label>Cantidad</label>
            <div class="bulk-input-wrap">
              <input type="number" class="bulk-grams-input" min="50" step="50" value="${defaultGrams}">
              <span class="bulk-unit">g</span>
            </div>
          </div>
          <span class="bulk-subtotal-preview">Subtotal: <strong data-bulk-preview>${formatCLP(bulkPrice(product.pricePerKg, defaultGrams))}</strong></span>
          ${stockLineHTML_(product)}
          <button class="btn-add-cart" data-add-to-cart>Agregar</button>
        </div>
      </div>
    `;
  }

  const badge = product.badge ? `<span class="offer-badge">${product.badge}</span>` : '';
  const priceKg = product.priceKg ? `<span class="product-price-kg">${product.priceKg}</span>` : '';
  return `
    <div class="product-card" data-product-id="${product.id}" data-product-name="${product.name}" data-product-price="${product.price}">
      ${badge}
      <img src="${product.image}" alt="${product.name}" class="product-img" loading="lazy">
      <div class="product-info">
        <span class="product-tag">${product.subcategory}</span>
        <h4>${product.name}</h4>
        <span class="product-price">${product.priceLabel}</span>
        ${priceKg}
        ${stockLineHTML_(product)}
        <button class="btn-add-cart" data-add-to-cart>Agregar</button>
      </div>
    </div>
  `;
}

function renderSubfilters() {
  const bar = document.getElementById('subfilter-bar');
  if (!bar) return;
  const options = ['Todos', ...CATEGORY_META[currentCategory].subfilters];
  bar.innerHTML = options.map(opt =>
    `<button class="subfilter-btn ${opt === currentSubfilter ? 'active' : ''}" data-subfilter="${opt}">${opt}</button>`
  ).join('');
}

function renderProducts() {
  const grid = document.getElementById('catalog-grid');
  const emptyMsg = document.getElementById('catalog-empty');
  if (!grid) return;

  const filtered = PRODUCTS.filter(p =>
    p.category === currentCategory &&
    (currentSubfilter === 'Todos' || p.subcategory === currentSubfilter)
  );

  grid.innerHTML = filtered.map(productCardHTML).join('');
  if (emptyMsg) emptyMsg.hidden = filtered.length > 0;
  if (window.lucide) lucide.createIcons();
}

function setActiveTab() {
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === currentCategory);
  });
  const titleEl = document.getElementById('catalog-title');
  if (titleEl) titleEl.textContent = CATEGORY_META[currentCategory].title;
}

function switchCategory(category, updateUrl = true) {
  if (!CATEGORY_META[category]) category = 'perros';
  currentCategory = category;
  currentSubfilter = 'Todos';
  setActiveTab();
  renderSubfilters();
  renderProducts();
  if (updateUrl) {
    const url = new URL(window.location);
    url.searchParams.set('categoria', category);
    window.history.replaceState({}, '', url);
  }
}

function switchSubfilter(subfilter) {
  currentSubfilter = subfilter;
  document.querySelectorAll('.subfilter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.subfilter === subfilter);
  });
  renderProducts();
}

document.addEventListener('DOMContentLoaded', async () => {
  // Categoría inicial: la que venga en la URL (?categoria=perros),
  // o "perros" por defecto si no hay ninguna o no existe.
  const params = new URLSearchParams(window.location.search);
  const initialCategory = params.get('categoria') || 'perros';

  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', () => switchCategory(tab.dataset.category));
  });

  document.getElementById('subfilter-bar')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-subfilter]');
    if (btn) switchSubfilter(btn.dataset.subfilter);
  });

  const grid = document.getElementById('catalog-grid');
  const emptyMsg = document.getElementById('catalog-empty');
  if (grid) grid.innerHTML = '<p class="catalog-loading">Cargando productos…</p>';
  if (emptyMsg) emptyMsg.hidden = true;

  try {
    PRODUCTS = await cargarProductosDesdeSheet_();
  } catch (err) {
    console.warn('No se pudo cargar la planilla, usando productos de respaldo:', err.message);
    PRODUCTS = FALLBACK_PRODUCTS;
    const banner = document.getElementById('catalog-sheet-error');
    if (banner) banner.hidden = false;
  }

  switchCategory(initialCategory, false);
});
