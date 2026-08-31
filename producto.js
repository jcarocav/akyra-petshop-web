// ============================================================
// PRODUCTO.JS — ficha de detalle de un producto. Lee el id desde
// la URL (?id=...), busca el producto en PRODUCTS (data.js) y
// arma la página: imagen, precio, descripción, selector de
// variante (talla/color, si el producto tiene) y cantidad. Recién
// al apretar "Añadir al carrito" se suma al carrito compartido
// del sitio (mismas funciones de script.js que usa el resto).
// ============================================================

let selectedVariant = null;

function findProduct(id) {
  return PRODUCTS.find(p => p.id === id && !p.bulk);
}

function variantSelectorHTML(product) {
  if (!product.variants) return '';
  const { label, options } = product.variants;
  selectedVariant = options[0];
  return `
    <div class="variant-group">
      <label>${label}</label>
      <div class="variant-options" id="variant-options">
        ${options.map((opt, i) => `
          <button type="button" class="variant-btn ${i === 0 ? 'active' : ''}" data-variant="${opt}">${opt}</button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderBreadcrumb(product) {
  const el = document.getElementById('breadcrumb');
  if (!el) return;
  const meta = CATEGORY_META[product.category];
  el.innerHTML = `
    <a href="index.html">Inicio</a>
    <span>/</span>
    <a href="catalogo.html?categoria=${product.category}">${meta ? meta.label : product.category}</a>
    <span>/</span>
    <span class="breadcrumb-current">${product.name}</span>
  `;
}

function renderProductDetail(product) {
  const wrap = document.getElementById('product-detail');
  if (!wrap) return;

  const badge = product.badge ? `<span class="offer-badge">${product.badge}</span>` : '';
  const priceKg = product.priceKg ? `<span class="price-kg">${product.priceKg}</span>` : '';
  const note = product.note ? `<span class="product-note product-note-lg">${product.note}</span>` : '';
  const brand = product.brand ? `<p class="product-detail-brand">${product.brand}</p>` : '';

  wrap.innerHTML = `
    <div class="product-detail-media">
      ${badge}
      <img src="${product.image}" alt="${product.name}">
    </div>
    <div class="product-detail-info">
      <p class="eyebrow">${product.subcategory}</p>
      ${brand}
      <h1>${product.name}</h1>
      <div class="product-detail-price">
        <span class="price-now">${product.priceLabel}</span>
        ${priceKg}
      </div>
      ${note}
      <p class="product-detail-desc">${product.description || ''}</p>

      ${variantSelectorHTML(product)}

      <div class="product-detail-qty">
        <label>Cantidad</label>
        <div class="qty-stepper">
          <button type="button" id="qty-minus" aria-label="Restar">−</button>
          <input type="number" id="qty-input" value="1" min="1">
          <button type="button" id="qty-plus" aria-label="Sumar">+</button>
        </div>
      </div>

      <button class="btn btn-primary product-detail-add" id="pdp-add-to-cart">Añadir al carrito</button>

      <a href="catalogo.html?categoria=${product.category}" class="back-to-catalog">
        <i data-lucide="arrow-left"></i> Volver al catálogo
      </a>
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  // Selector de variante (talla/color) — un solo botón activo a la vez
  document.getElementById('variant-options')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.variant-btn');
    if (!btn) return;
    selectedVariant = btn.dataset.variant;
    document.querySelectorAll('.variant-btn').forEach(b => b.classList.toggle('active', b === btn));
  });

  // Stepper de cantidad
  const qtyInput = document.getElementById('qty-input');
  document.getElementById('qty-minus')?.addEventListener('click', () => {
    qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
  });
  document.getElementById('qty-plus')?.addEventListener('click', () => {
    qtyInput.value = (parseInt(qtyInput.value, 10) || 1) + 1;
  });

  // Añadir al carrito — recién acá se suma, con la variante y
  // cantidad elegidas (mismo carrito/localStorage que el resto del sitio)
  document.getElementById('pdp-add-to-cart')?.addEventListener('click', () => {
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    const variantSuffix = selectedVariant ? ` (${product.variants.label}: ${selectedVariant})` : '';
    const cartId = selectedVariant ? `${product.id}-${selectedVariant}` : product.id;
    const cartName = `${product.name}${variantSuffix}`;

    addToCart(cartId, cartName, product.price);
    const item = cart.find(i => i.id === cartId);
    if (item) { item.qty = qty; saveCart(); renderCart(); }

    showCartToast(`${cartName} — agregado al carrito`);
    bumpCartIcon();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const product = id ? findProduct(id) : null;

  const detailWrap = document.getElementById('product-detail');
  const notFound = document.getElementById('product-not-found');

  if (!product) {
    if (detailWrap) detailWrap.hidden = true;
    if (notFound) notFound.hidden = false;
    return;
  }

  document.getElementById('page-title').textContent = `${product.name} — Mascotería Akyra`;
  renderBreadcrumb(product);
  renderProductDetail(product);
});
