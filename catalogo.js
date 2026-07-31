// ============================================================
// PRODUCTOS DE EJEMPLO — mientras se conecta Google Sheets (ver
// plan acordado), el catálogo se arma con esta lista fija. Cada
// producto necesita: id único, name, category, subcategory,
// price (texto, admite rango), priceKg (opcional, solo alimentos
// en bolsa), image, badge (opcional).
//
// Para agregar la categoría "Gatos" u "Otros productos" con datos
// reales, esta misma lista es la plantilla: solo se agregan más
// objetos con su "category" correspondiente.
// ============================================================
const PRODUCTS = [
  // ---- PERROS ----
  { id: 'perro-alimento-adulto', name: 'Alimento premium adulto', category: 'perros', subcategory: 'Comida',
    price: '$19.990 – $68.900', priceKg: 'desde $4.594 x kg', badge: '20% dcto. 2da unidad',
    image: 'https://loremflickr.com/400/300/dog,food' },
  { id: 'perro-alimento-cachorro', name: 'Alimento premium cachorro', category: 'perros', subcategory: 'Comida',
    price: '$17.990', priceKg: '$5.200 x kg',
    image: 'https://loremflickr.com/400/300/puppy,food' },
  { id: 'perro-correa-collar', name: 'Set correa y collar', category: 'perros', subcategory: 'Accesorios',
    price: '$8.990', image: 'https://loremflickr.com/400/300/dog,leash' },
  { id: 'perro-cama', name: 'Cama acolchada', category: 'perros', subcategory: 'Accesorios',
    price: '$24.990', image: 'https://loremflickr.com/400/300/dog,bed' },
  { id: 'perro-chaleco', name: 'Chaleco de invierno', category: 'perros', subcategory: 'Ropa',
    price: '$12.990', image: 'https://loremflickr.com/400/300/dog,sweater' },
  { id: 'perro-pechera', name: 'Pechera ajustable', category: 'perros', subcategory: 'Ropa',
    price: '$9.990', image: 'https://loremflickr.com/400/300/dog,harness' },
  { id: 'perro-mordedor', name: 'Juguete mordedor', category: 'perros', subcategory: 'Juguetes',
    price: '$6.990', image: 'https://loremflickr.com/400/300/dog,toy' },
  { id: 'perro-pelota', name: 'Pelota interactiva', category: 'perros', subcategory: 'Juguetes',
    price: '$5.990', image: 'https://loremflickr.com/400/300/dog,ball' },

  // ---- GATOS ----
  { id: 'gato-alimento-adulto', name: 'Alimento premium adulto', category: 'gatos', subcategory: 'Comida',
    price: '$18.990 – $54.900', priceKg: 'desde $4.980 x kg', badge: '20% dcto. 2da unidad',
    image: 'https://loremflickr.com/400/300/cat,food' },
  { id: 'gato-alimento-humedo', name: 'Alimento húmedo (pack x6)', category: 'gatos', subcategory: 'Comida',
    price: '$6.990', image: 'https://loremflickr.com/400/300/cat,wetfood' },
  { id: 'gato-arena-aglomerante', name: 'Arena aglomerante', category: 'gatos', subcategory: 'Arena',
    price: '$7.990', priceKg: '$1.330 x kg', image: 'https://loremflickr.com/400/300/cat,litter' },
  { id: 'gato-arena-silice', name: 'Arena de sílice', category: 'gatos', subcategory: 'Arena',
    price: '$9.990', image: 'https://loremflickr.com/400/300/cat,sand' },
  { id: 'gato-rascador', name: 'Rascador para gato', category: 'gatos', subcategory: 'Accesorios',
    price: '$24.990', image: 'https://loremflickr.com/400/300/cat,toy' },
  { id: 'gato-transportadora', name: 'Transportadora', category: 'gatos', subcategory: 'Accesorios',
    price: '$18.990', image: 'https://loremflickr.com/400/300/cat,carrier' },
  { id: 'gato-plumas', name: 'Juguete con plumas', category: 'gatos', subcategory: 'Juguetes',
    price: '$4.990', image: 'https://loremflickr.com/400/300/cat,feather' },
  { id: 'gato-tunel', name: 'Túnel de juego', category: 'gatos', subcategory: 'Juguetes',
    price: '$12.990', image: 'https://loremflickr.com/400/300/cat,tunnel' },

  // ---- OTRAS MASCOTAS ----
  { id: 'aves-alimento', name: 'Alimento para aves', category: 'otras-mascotas', subcategory: 'Aves',
    price: '$5.990', image: 'https://loremflickr.com/400/300/bird,food' },
  { id: 'aves-juguete', name: 'Juguete para jaula', category: 'otras-mascotas', subcategory: 'Aves',
    price: '$4.490', image: 'https://loremflickr.com/400/300/bird,toy' },
  { id: 'roedor-jaula', name: 'Jaula para hámster', category: 'otras-mascotas', subcategory: 'Roedores',
    price: '$22.990', image: 'https://loremflickr.com/400/300/hamster,cage' },
  { id: 'roedor-heno', name: 'Heno para roedores', category: 'otras-mascotas', subcategory: 'Roedores',
    price: '$3.490', image: 'https://loremflickr.com/400/300/hamster,hay' },
  { id: 'peces-alimento', name: 'Alimento para peces', category: 'otras-mascotas', subcategory: 'Peces',
    price: '$3.990', image: 'https://loremflickr.com/400/300/fish,food' },
  { id: 'peces-pecera', name: 'Pecera pequeña', category: 'otras-mascotas', subcategory: 'Peces',
    price: '$15.990', image: 'https://loremflickr.com/400/300/fish,tank' },
  { id: 'otros-bebedero', name: 'Bebedero para conejo', category: 'otras-mascotas', subcategory: 'Varios',
    price: '$4.990', image: 'https://loremflickr.com/400/300/rabbit' },
  { id: 'otros-vitaminas', name: 'Vitaminas multipropósito', category: 'otras-mascotas', subcategory: 'Varios',
    price: '$6.990', image: 'https://loremflickr.com/400/300/pets' }
];

// ============================================================
// METADATA DE CADA CATEGORÍA — título de la página y sus
// subfiltros. Para agregar una categoría nueva, se suma acá
// y se agregan sus productos arriba con ese mismo "category".
// ============================================================
const CATEGORY_META = {
  'perros': { label: 'Perros', title: 'Productos para Perros', subfilters: ['Comida', 'Ropa', 'Juguetes', 'Accesorios'] },
  'gatos': { label: 'Gatos', title: 'Productos para Gatos', subfilters: ['Comida', 'Arena', 'Juguetes', 'Accesorios'] },
  'otras-mascotas': { label: 'Otros productos', title: 'Otros Productos', subfilters: ['Aves', 'Roedores', 'Peces', 'Varios'] }
};

let currentCategory = 'perros';
let currentSubfilter = 'Todos';

function productCardHTML(product) {
  const badge = product.badge ? `<span class="offer-badge">${product.badge}</span>` : '';
  const priceKg = product.priceKg ? `<span class="product-price-kg">${product.priceKg}</span>` : '';
  return `
    <div class="product-card" data-product-id="${product.id}" data-product-name="${product.name}">
      ${badge}
      <img src="${product.image}" alt="${product.name}" class="product-img" loading="lazy">
      <div class="product-info">
        <span class="product-tag">${product.subcategory}</span>
        <h4>${product.name}</h4>
        <span class="product-price">${product.price}</span>
        ${priceKg}
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

document.addEventListener('DOMContentLoaded', () => {
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

  switchCategory(initialCategory, false);
});
