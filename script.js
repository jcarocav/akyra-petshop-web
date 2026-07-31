// ============================================================
// CONFIGURACIÓN — reemplazar con los datos reales de Maskotería Akyra
// ============================================================
const CONFIG = {
  whatsappNumber: '56900000000', // formato: 56 9 XXXX XXXX sin espacios ni "+"
  whatsappMessage: 'Hola, quería consultar por sus productos para mascotas 🐾'
};

function buildWhatsappLink(customMessage) {
  const message = encodeURIComponent(customMessage || CONFIG.whatsappMessage);
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${message}`;
}

// ============================================================
// FONDO DEL HERO — una imagen fija por ahora. Si más adelante
// quieres agregar más fotos o un video, solo suma entradas acá
// como { type: 'video', src: '...' } y arma un carrusel simple
// como el que usamos en el sitio del jiu-jitsu.
// ============================================================
const HERO_MEDIA = [
  { type: 'image', src: 'assets/hero/portada-hero.png', alt: 'Productos para mascotas en Maskotería Akyra' }
];

function initHeroMedia() {
  const container = document.getElementById('hero-media');
  if (!container || HERO_MEDIA.length === 0) return;
  const item = HERO_MEDIA[0];
  const el = document.createElement(item.type === 'video' ? 'video' : 'img');
  if (item.type === 'video') {
    el.src = item.src;
    el.muted = true;
    el.playsInline = true;
    el.autoplay = true;
    el.loop = true;
  } else {
    el.src = item.src;
    el.alt = item.alt || 'Maskotería Akyra — tienda de mascotas';
  }
  el.classList.add('active');
  container.appendChild(el);
}

// ============================================================
// FOTOS DE "SOBRE PATITAS" — loop de 3 que se van encadenando.
// Por ahora son fotos genéricas de ejemplo (con licencia libre,
// vía loremflickr.com) — reemplázalas por las rutas de tus
// propias fotos en assets/nosotros/ cuando las tengas (mismo
// nombre de variable, solo cambia el "src").
// ============================================================
const ABOUT_MEDIA = [
  { src: 'https://loremflickr.com/900/700/dog,owner', alt: 'Cliente con su mascota' },
  { src: 'https://loremflickr.com/900/700/cat,cute', alt: 'Gato en la tienda' },
  { src: 'https://loremflickr.com/900/700/pets', alt: 'Productos para mascotas' }
];

function initAboutSlideshow() {
  const container = document.getElementById('about-slideshow');
  if (!container || ABOUT_MEDIA.length === 0) return;

  const imgs = ABOUT_MEDIA.map((item, i) => {
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = item.alt || 'Maskotería Akyra';
    if (i === 0) img.classList.add('active');
    container.appendChild(img);
    return img;
  });

  if (imgs.length <= 1) return;

  let current = 0;
  setInterval(() => {
    imgs[current].classList.remove('active');
    current = (current + 1) % imgs.length;
    imgs[current].classList.add('active');
  }, 4000);
}

// ============================================================
// CARRITO — el cliente va agregando productos y al final el
// detalle se manda armado a WhatsApp (sin precios: el catálogo
// con precios reales llega en la próxima etapa). Se guarda en
// localStorage para que no se pierda al pasar de la landing al
// catálogo (o entre categorías).
// ============================================================
const CART_STORAGE_KEY = 'akyra_cart';

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCart() {
  try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch (e) { /* almacenamiento no disponible */ }
}

let cart = loadCart(); // [{ id, name, qty }]

function addToCart(id, name) {
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, name, qty: 1 });
  }
  saveCart();
  renderCart();
}

function updateQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => i.id !== id);
  }
  saveCart();
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  renderCart();
}

function renderCart() {
  const itemsEl = document.getElementById('cart-items');
  const emptyEl = document.getElementById('cart-empty');
  const footerEl = document.getElementById('cart-footer');
  const badgeEl = document.getElementById('cart-badge');
  if (!itemsEl) return;

  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);

  if (badgeEl) {
    badgeEl.textContent = totalQty;
    badgeEl.hidden = totalQty === 0;
  }

  if (cart.length === 0) {
    itemsEl.innerHTML = '';
    if (emptyEl) emptyEl.hidden = false;
    if (footerEl) footerEl.hidden = true;
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  if (footerEl) footerEl.hidden = false;

  itemsEl.innerHTML = '';
  cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <span class="cart-item-name">${item.name}</span>
      <div class="cart-item-qty">
        <button class="cart-qty-btn" data-qty-minus="${item.id}" aria-label="Quitar uno">–</button>
        <span class="cart-qty-value">${item.qty}</span>
        <button class="cart-qty-btn" data-qty-plus="${item.id}" aria-label="Agregar uno">+</button>
        <button class="cart-item-remove" data-remove="${item.id}" aria-label="Eliminar"><i data-lucide="x"></i></button>
      </div>
    `;
    itemsEl.appendChild(row);
  });
  if (window.lucide) lucide.createIcons();

  const whatsappBtn = document.getElementById('cart-whatsapp');
  if (whatsappBtn) {
    const lines = cart.map(item => `- ${item.qty}x ${item.name}`).join('\n');
    const message = `Hola, quería consultar por estos productos:\n${lines}\n\n¿Podrían confirmarme precio y disponibilidad?`;
    whatsappBtn.href = buildWhatsappLink(message);
  }
}

function openCart() {
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('cart-overlay').classList.add('open');
}
function closeCart() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('open');
}

function initCart() {
  renderCart();

  // Delegado en <body> (no en cada botón) para que también funcione
  // con tarjetas de producto que se agregan dinámicamente después,
  // como el grillado del catálogo al cambiar de categoría/filtro.
  document.body.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add-to-cart]');
    if (!addBtn) return;
    const card = addBtn.closest('[data-product-id]');
    if (!card) return;
    addToCart(card.dataset.productId, card.dataset.productName);
    addBtn.textContent = 'Agregado ✓';
    addBtn.classList.add('just-added');
    setTimeout(() => {
      addBtn.textContent = 'Agregar';
      addBtn.classList.remove('just-added');
    }, 1200);
    openCart();
  });

  document.getElementById('cart-items').addEventListener('click', (e) => {
    const minusId = e.target.closest('[data-qty-minus]')?.dataset.qtyMinus;
    const plusId = e.target.closest('[data-qty-plus]')?.dataset.qtyPlus;
    const removeId = e.target.closest('[data-remove]')?.dataset.remove;
    if (minusId) updateQty(minusId, -1);
    if (plusId) updateQty(plusId, 1);
    if (removeId) removeFromCart(removeId);
  });

  const cartToggle = document.getElementById('cart-toggle');
  const cartClose = document.getElementById('cart-close');
  const cartOverlay = document.getElementById('cart-overlay');
  if (cartToggle) cartToggle.addEventListener('click', openCart);
  if (cartClose) cartClose.addEventListener('click', closeCart);
  if (cartOverlay) cartOverlay.addEventListener('click', closeCart);
}

// ============================================================
// CARRUSEL DE MARCAS — nombres de ejemplo por ahora. Reemplaza
// esta lista por las marcas reales que vende la tienda (si
// tienes sus logos, dime y los agregamos como <img> en vez de
// texto). La lista se duplica una vez para que el giro continuo
// no se note el corte.
// ============================================================
const BRANDS = [
  'Marca 1', 'Marca 2', 'Marca 3', 'Marca 4',
  'Marca 5', 'Marca 6', 'Marca 7', 'Marca 8'
];

function initBrandsMarquee() {
  const track = document.getElementById('brands-track');
  if (!track || BRANDS.length === 0) return;

  const fullList = [...BRANDS, ...BRANDS]; // duplicado para el loop continuo
  fullList.forEach(name => {
    const pill = document.createElement('span');
    pill.className = 'brand-pill';
    pill.textContent = name;
    track.appendChild(pill);
  });
}

// ============================================================
// CARRUSEL DE OFERTAS — mueve el scroll horizontal con las flechas
// ============================================================
function initOffersCarousel() {
  const track = document.getElementById('offers-carousel');
  const prevBtn = document.getElementById('offers-prev');
  const nextBtn = document.getElementById('offers-next');
  if (!track || !prevBtn || !nextBtn) return;

  const scrollAmount = () => track.querySelector('.product-card')?.offsetWidth + 20 || 260;

  prevBtn.addEventListener('click', () => track.scrollBy({ left: -scrollAmount(), behavior: 'smooth' }));
  nextBtn.addEventListener('click', () => track.scrollBy({ left: scrollAmount(), behavior: 'smooth' }));
}

document.addEventListener('DOMContentLoaded', () => {

  // Iconos Lucide
  if (window.lucide) lucide.createIcons();

  // Fondo del hero
  initHeroMedia();

  // Loop de fotos de "Sobre Patitas"
  initAboutSlideshow();

  // Carrito de consulta
  initCart();

  // Carrusel de ofertas
  initOffersCarousel();

  // Carrusel de marcas
  initBrandsMarquee();

  // Aplica el link de WhatsApp a todos los botones/links relevantes
  const whatsappTargets = [
    'nav-whatsapp',
    'hero-whatsapp',
    'about-whatsapp',
    'footer-whatsapp-link',
    'footer-whatsapp-consulta',
    'footer-whatsapp-btn',
    'whatsapp-float'
  ];
  whatsappTargets.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = buildWhatsappLink();
  });

  // Menú móvil
  const menuToggle = document.getElementById('menu-toggle');
  const mainNav = document.getElementById('main-nav');
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      mainNav.classList.toggle('open');
    });
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => mainNav.classList.remove('open'));
    });
  }

  // Reveal on scroll
  const revealEls = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealEls.forEach(el => observer.observe(el));

});
