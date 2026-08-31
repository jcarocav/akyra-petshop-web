// ============================================================
// CATALOGO.JS — grilla filtrable de productos.
// PRODUCTS y CATEGORY_META viven en data.js (se carga antes que
// este archivo). Acá va toda la lógica de la página: filtros de
// sidebar (checkbox, multi-selección), chips de filtros activos,
// orden, y el render de las tarjetas de producto.
// ============================================================

let currentCategory = 'perros';
let selectedSubcats = new Set();
let selectedBrands = new Set();
let selectedAges = new Set();
let onlyOffers = false;
let sortOrder = 'relevancia';
let searchQuery = ''; // si no está vacío, ignora currentCategory y busca en TODO el catálogo

// Sin tildes ni mayúsculas, para que la búsqueda encuentre
// "Alimento" aunque el usuario escriba "alimento" o "aliménto".
function normalize(str) {
  return (str || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getCategoryProducts() {
  if (searchQuery) {
    const q = normalize(searchQuery);
    return PRODUCTS.filter(p =>
      normalize(p.name).includes(q) ||
      normalize(p.subcategory).includes(q) ||
      normalize(p.brand).includes(q) ||
      normalize(p.category).includes(q)
    );
  }
  return PRODUCTS.filter(p => p.category === currentCategory);
}

// Productos que cumplen todos los filtros activos EXCEPTO el
// facet indicado — así el conteo junto a cada checkbox refleja
// "cuántos resultados más" sumaría marcarlo, no el total fijo de
// la categoría completa.
function productsMatching(exceptFacet) {
  return getCategoryProducts().filter(p => {
    if (exceptFacet !== 'subcat' && selectedSubcats.size && !selectedSubcats.has(p.subcategory)) return false;
    if (exceptFacet !== 'brand' && selectedBrands.size && !selectedBrands.has(p.brand)) return false;
    if (exceptFacet !== 'age' && selectedAges.size && !selectedAges.has(p.ageStage)) return false;
    if (exceptFacet !== 'offers' && onlyOffers && !p.badge) return false;
    return true;
  });
}

function countBy(list, key) {
  const counts = {};
  list.forEach(p => {
    const val = p[key];
    if (!val) return;
    counts[val] = (counts[val] || 0) + 1;
  });
  return counts;
}

function applyFilters() {
  let list = productsMatching(null);

  switch (sortOrder) {
    case 'precio-asc':
      list = [...list].sort((a, b) => (a.price ?? a.pricePerKg) - (b.price ?? b.pricePerKg));
      break;
    case 'precio-desc':
      list = [...list].sort((a, b) => (b.price ?? b.pricePerKg) - (a.price ?? a.pricePerKg));
      break;
    case 'nombre-az':
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'));
      break;
    default:
      break; // 'relevancia' = orden original del catálogo
  }
  return list;
}

function bulkPrice(pricePerKg, grams) {
  return Math.round((pricePerKg * grams) / 1000);
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
          <button class="btn-add-cart" data-add-to-cart>Agregar</button>
        </div>
      </div>
    `;
  }

  const badge = product.badge ? `<span class="offer-badge">${product.badge}</span>` : '';
  const priceKg = product.priceKg ? `<span class="product-price-kg">${product.priceKg}</span>` : '';
  const note = product.note ? `<span class="product-note">${product.note}</span>` : '';
  return `
    <a href="producto.html?id=${encodeURIComponent(product.id)}" class="product-card" data-product-id="${product.id}">
      ${badge}
      <img src="${product.image}" alt="${product.name}" class="product-img" loading="lazy">
      <div class="product-info">
        <span class="product-tag">${product.subcategory}</span>
        <h4>${product.name}</h4>
        <span class="product-price">${product.priceLabel}</span>
        ${priceKg}
        ${note}
        <span class="btn-add-cart btn-view-details">Ver detalles</span>
      </div>
    </a>
  `;
}

// ============================================================
// SIDEBAR DE FILTROS
// ============================================================
function filterOptionHTML(facet, value, count, checked) {
  return `
    <label class="filter-checkbox">
      <input type="checkbox" data-facet="${facet}" value="${escapeAttr(value)}" ${checked ? 'checked' : ''}>
      <span>${value}</span>
      <span class="filter-count">${count}</span>
    </label>
  `;
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

function renderFilters() {
  const meta = CATEGORY_META[currentCategory];

  // ---- Tipo de producto (subcategoría) ----
  const subcatCounts = countBy(productsMatching('subcat'), 'subcategory');
  const subcatGroup = document.getElementById('filter-group-subcat');
  const subcatBox = document.getElementById('filter-options-subcat');
  const subcatOptions = meta.subfilters.filter(s => subcatCounts[s] > 0 || selectedSubcats.has(s));
  if (subcatBox) {
    subcatBox.innerHTML = subcatOptions
      .map(s => filterOptionHTML('subcat', s, subcatCounts[s] || 0, selectedSubcats.has(s)))
      .join('');
  }
  if (subcatGroup) subcatGroup.hidden = subcatOptions.length === 0;

  // ---- Marca ----
  const brandCounts = countBy(productsMatching('brand'), 'brand');
  const brandGroup = document.getElementById('filter-group-brand');
  const brandBox = document.getElementById('filter-options-brand');
  const brandOptions = Object.keys(brandCounts).sort((a, b) => a.localeCompare(b, 'es'));
  if (brandBox) {
    brandBox.innerHTML = brandOptions
      .map(b => filterOptionHTML('brand', b, brandCounts[b], selectedBrands.has(b)))
      .join('');
  }
  if (brandGroup) brandGroup.hidden = brandOptions.length === 0;

  // ---- Edad ----
  const ageCounts = countBy(productsMatching('age'), 'ageStage');
  const ageOrder = ['Cachorro', 'Adulto', 'Senior', 'Todas las edades'];
  const ageGroup = document.getElementById('filter-group-age');
  const ageBox = document.getElementById('filter-options-age');
  const ageOptions = ageOrder.filter(a => ageCounts[a] > 0);
  if (ageBox) {
    ageBox.innerHTML = ageOptions
      .map(a => filterOptionHTML('age', a, ageCounts[a], selectedAges.has(a)))
      .join('');
  }
  if (ageGroup) ageGroup.hidden = ageOptions.length === 0;

  // ---- Solo ofertas ----
  const offersCount = productsMatching('offers').filter(p => p.badge).length;
  const offersWrap = document.getElementById('filter-offers')?.closest('.filter-group');
  if (offersWrap) offersWrap.hidden = offersCount === 0 && !onlyOffers;
  const offersCheckbox = document.getElementById('filter-offers');
  if (offersCheckbox) offersCheckbox.checked = onlyOffers;

  if (window.lucide) lucide.createIcons();
}

// ============================================================
// CHIPS DE FILTROS ACTIVOS
// ============================================================
function renderActiveChips() {
  const wrap = document.getElementById('active-filters');
  if (!wrap) return;

  const chips = [];
  selectedSubcats.forEach(v => chips.push({ facet: 'subcat', value: v }));
  selectedBrands.forEach(v => chips.push({ facet: 'brand', value: v }));
  selectedAges.forEach(v => chips.push({ facet: 'age', value: v }));
  if (onlyOffers) chips.push({ facet: 'offers', value: 'Solo ofertas' });

  if (!chips.length) {
    wrap.innerHTML = '';
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  wrap.innerHTML = chips.map(c => `
    <button class="filter-chip" type="button" data-remove-facet="${c.facet}" data-remove-value="${escapeAttr(c.value)}">
      ${c.value} <i data-lucide="x"></i>
    </button>
  `).join('') + `<button class="filter-chip filter-chip-clear" type="button" id="chips-clear-all">Limpiar todo</button>`;

  if (window.lucide) lucide.createIcons();
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================
function renderProducts() {
  const grid = document.getElementById('catalog-grid');
  const emptyMsg = document.getElementById('catalog-empty');
  const countEl = document.getElementById('catalog-count');
  if (!grid) return;

  const filtered = applyFilters();

  grid.innerHTML = filtered.map(productCardHTML).join('');
  if (emptyMsg) emptyMsg.hidden = filtered.length > 0;
  if (countEl) countEl.textContent = `${filtered.length} producto${filtered.length === 1 ? '' : 's'}`;
  if (window.lucide) lucide.createIcons();
}

function renderAll() {
  renderFilters();
  renderActiveChips();
  renderProducts();
}

function setActiveTab() {
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === currentCategory);
  });
  const titleEl = document.getElementById('catalog-title');
  if (titleEl) titleEl.textContent = CATEGORY_META[currentCategory].title;
}

// Modo búsqueda: se activa desde el buscador del navbar (funciona
// en cualquier página — acá, en catalogo.html, se aplica al toque
// sin recargar). Ignora la categoría/tabs mientras esté activo, y
// busca en TODO el catálogo (nombre, subcategoría, marca).
function setSearchQuery(query) {
  searchQuery = (query || '').trim();
  selectedSubcats = new Set();
  selectedBrands = new Set();
  selectedAges = new Set();
  onlyOffers = false;
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.value = 'relevancia';
  sortOrder = 'relevancia';

  const tabsWrap = document.querySelector('.category-tabs-wrap');
  const titleEl = document.getElementById('catalog-title');
  const subEl = document.getElementById('catalog-search-note');
  if (tabsWrap) tabsWrap.hidden = true;
  if (titleEl) titleEl.textContent = `Resultados para "${searchQuery}"`;
  if (subEl) subEl.hidden = false;

  const input = document.getElementById('nav-search-input');
  if (input) input.value = searchQuery;

  const url = new URL(window.location);
  url.searchParams.set('buscar', searchQuery);
  url.searchParams.delete('categoria');
  url.searchParams.delete('ofertas');
  window.history.replaceState({}, '', url);

  renderAll();
}

function clearSearch() {
  searchQuery = '';
  const tabsWrap = document.querySelector('.category-tabs-wrap');
  const subEl = document.getElementById('catalog-search-note');
  if (tabsWrap) tabsWrap.hidden = false;
  if (subEl) subEl.hidden = true;
  const input = document.getElementById('nav-search-input');
  if (input) input.value = '';
  switchCategory('perros');
}

function switchCategory(category, updateUrl = true) {
  if (!CATEGORY_META[category]) category = 'perros';
  currentCategory = category;
  selectedSubcats = new Set();
  selectedBrands = new Set();
  selectedAges = new Set();
  onlyOffers = false;
  sortOrder = 'relevancia';
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) sortSelect.value = 'relevancia';
  setActiveTab();
  renderAll();
  if (updateUrl) {
    const url = new URL(window.location);
    url.searchParams.set('categoria', category);
    url.searchParams.delete('ofertas');
    url.searchParams.delete('buscar');
    window.history.replaceState({}, '', url);
  }
}

function toggleFacetValue(facet, value) {
  const setByFacet = { subcat: selectedSubcats, brand: selectedBrands, age: selectedAges };
  if (facet === 'offers') {
    onlyOffers = !onlyOffers;
    renderAll();
    return;
  }
  const set = setByFacet[facet];
  if (!set) return;
  if (set.has(value)) set.delete(value);
  else set.add(value);
  renderAll();
}

function clearAllFilters() {
  selectedSubcats.clear();
  selectedBrands.clear();
  selectedAges.clear();
  onlyOffers = false;
  const offersCheckbox = document.getElementById('filter-offers');
  if (offersCheckbox) offersCheckbox.checked = false;
  renderAll();
}

// ============================================================
// PANEL DE FILTROS EN MOBILE (se abre como un cajón lateral)
// ============================================================
function openFiltersPanel() {
  document.getElementById('filters-sidebar')?.classList.add('open');
  document.getElementById('filters-overlay')?.classList.add('open');
}
function closeFiltersPanel() {
  document.getElementById('filters-sidebar')?.classList.remove('open');
  document.getElementById('filters-overlay')?.classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  // Categoría inicial: la que venga en la URL (?categoria=perros),
  // o "perros" por defecto si no hay ninguna o no existe. También
  // soporta ?ofertas=1 para abrir directo con "Solo ofertas" marcado
  // (usado por el botón "Ver todas las ofertas" del home), y
  // ?buscar=texto para entrar directo en modo búsqueda (desde el
  // buscador del navbar, en cualquier página).
  const params = new URLSearchParams(window.location.search);
  const initialCategory = params.get('categoria') || 'perros';
  const initialOffers = params.get('ofertas') === '1';
  const initialSearch = params.get('buscar') || '';

  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', () => { switchCategory(tab.dataset.category); closeFiltersPanel(); });
  });

  // Buscador del navbar: en esta página filtra al toque, sin
  // recargar (en el resto del sitio, el form simplemente navega
  // acá con ?buscar=... — comportamiento normal de un form GET).
  document.getElementById('nav-search')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('nav-search-input');
    const q = input?.value.trim();
    if (q) setSearchQuery(q); else clearSearch();
  });
  document.getElementById('catalog-search-clear')?.addEventListener('click', clearSearch);

  // Delegado: cualquier checkbox de filtro dentro del sidebar
  document.getElementById('filters-sidebar')?.addEventListener('change', (e) => {
    const input = e.target.closest('[data-facet]');
    if (!input) return;
    toggleFacetValue(input.dataset.facet, input.value);
  });

  // Delegado: quitar un chip individual, o "Limpiar todo"
  document.getElementById('active-filters')?.addEventListener('click', (e) => {
    const clearAll = e.target.closest('#chips-clear-all');
    if (clearAll) { clearAllFilters(); return; }
    const chip = e.target.closest('[data-remove-facet]');
    if (!chip) return;
    toggleFacetValue(chip.dataset.removeFacet, chip.dataset.removeValue);
  });

  document.getElementById('filters-clear')?.addEventListener('click', clearAllFilters);

  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    sortOrder = e.target.value;
    renderProducts();
  });

  document.getElementById('filters-toggle')?.addEventListener('click', openFiltersPanel);
  document.getElementById('filters-close')?.addEventListener('click', closeFiltersPanel);
  document.getElementById('filters-apply-mobile')?.addEventListener('click', closeFiltersPanel);
  document.getElementById('filters-overlay')?.addEventListener('click', closeFiltersPanel);

  if (initialSearch) {
    setSearchQuery(initialSearch);
  } else {
    switchCategory(initialCategory, false);
    if (initialOffers) toggleFacetValue('offers');
  }
});
