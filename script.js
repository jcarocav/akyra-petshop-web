// ============================================================
// CONFIGURACIÓN — reemplazar con los datos reales del negocio (ya cargados para Mascotería Akyra)
// ============================================================
const CONFIG = {
  whatsappNumber: '56986969111', // formato: 56 9 XXXX XXXX sin espacios ni "+"
  whatsappMessage: 'Hola, quería consultar por sus productos para mascotas 🐾'
};

function buildWhatsappLink(customMessage) {
  const message = encodeURIComponent(customMessage || CONFIG.whatsappMessage);
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${message}`;
}

// Pequeño envoltorio para no repetir el chequeo de "¿existe Umami?"
// en cada lugar — si el script de Umami no cargó (bloqueador de
// anuncios, sin internet, o todavía no configuraste tu website-id
// real), esto simplemente no hace nada, sin tirar error ni afectar
// el resto del sitio.
function trackEvent(name, data) {
  if (window.umami && typeof window.umami.track === 'function') {
    window.umami.track(name, data);
  }
}

// ============================================================
// FONDO DEL HERO — carrusel de 3 "slides", cada uno con su propia
// imagen Y su propio texto (van cambiando juntos, sincronizados).
// Cada item admite:
//  - mode: 'contain' (default) para una foto RECORTADA (fondo
//    transparente) de mascota(s) — flota sobre el magenta, con
//    sombra. align:'right' la pega contra el borde derecho (para
//    fotos con espacio vacío de un lado, pensado para dejarle
//    sitio al texto).
//  - mode: 'cover' para una foto de escena completa (fondo real) —
//    se ve centrada, ocupando el espacio disponible.
//  - heightPercent: qué porcentaje del alto del hero ocupa la
//    imagen (pegada abajo) — por defecto 82. Súbelo para que se vea
//    más grande, bájalo para que quede más chica / con más aire
//    respecto a la guirnalda de arriba. 100 la deja tocando el techo
//    del hero, sin espacio libre arriba.
//  - eyebrow / titleHtml / subtitle: el texto de ese slide. Para que
//    una palabra puntual rebote (no el título completo), envuélvela
//    en <span class="hero-bounce">...</span> dentro de titleHtml —
//    es la misma animación que titleBounce:true aplica al <h1>
//    entero.
// ============================================================
const HERO_MEDIA = [
  {
    type: 'image', src: 'assets/hero/portada-lanzamiento.png',
    alt: 'Perrito y gatito, mascotas de ejemplo dando la bienvenida al nuevo sitio web',
    mode: 'contain', align: 'right', heightPercent: 78,
    eyebrow: 'Mascotería Akyra',
    titleHtml: '¡Inauguramos<br>nuestro Sitio Web!',
    titleBounce: true,
    subtitle: 'Ven y descubre nuestras increíbles Ofertas!'
  },
  {
    type: 'image', src: 'assets/hero/portada-granel.webp',
    alt: 'Perro y gato de compras con alimento Akyra a granel',
    mode: 'contain', align: 'right', heightPercent: 72,
    eyebrow: 'Mascotería Akyra',
    titleHtml: '¡La primera petshop online donde compras a <span class="hero-bounce">Granel</span>!',
    titleBounce: false,
    subtitle: 'Elige los gramos exactos, calcula el precio al instante y recíbelo en la puerta de tu casa.'
  },
  {
    type: 'image', src: 'assets/hero/portada-fiestas-patrias.webp',
    alt: 'Perrito y gatita vestidos para Fiestas Patrias, con la bandera de Chile',
    mode: 'contain', align: 'right', heightPercent: 88,
    eyebrow: 'Mascotería Akyra',
    titleHtml: '¡Ya se acerca el 18<br>y ellos también celebran!',
    titleBounce: true,
    subtitle: 'Descubre alimentos, premios y accesorios para que tu regalón también disfrute estas fiestas!'
  }
];

function renderHeroSlideText(item) {
  const eyebrowEl = document.getElementById('hero-eyebrow');
  const titleEl = document.getElementById('hero-title');
  const subtitleEl = document.getElementById('hero-subtitle');
  if (eyebrowEl) {
    eyebrowEl.textContent = item.eyebrow || '';
    eyebrowEl.hidden = !item.eyebrow;
  }
  if (titleEl) {
    titleEl.innerHTML = item.titleHtml || '';
    titleEl.classList.toggle('hero-bounce', !!item.titleBounce);
  }
  if (subtitleEl) {
    subtitleEl.textContent = item.subtitle || '';
    subtitleEl.hidden = !item.subtitle;
  }
}

function initHeroMedia() {
  const container = document.getElementById('hero-media');
  const textContainer = document.getElementById('hero-launch-text');
  if (!container || HERO_MEDIA.length === 0) return;

  const imgs = HERO_MEDIA.map((item, i) => {
    const el = document.createElement(item.type === 'video' ? 'video' : 'img');
    if (item.type === 'video') {
      el.src = item.src;
      el.muted = true;
      el.playsInline = true;
      el.autoplay = true;
      el.loop = true;
    } else {
      el.src = item.src;
      el.alt = item.alt || 'Mascotería Akyra — tienda de mascotas';
    }
    el.classList.add(item.mode === 'cover' ? 'hero-slide-cover' : 'hero-slide-align-right');
    el.style.setProperty('--hero-img-height', (item.heightPercent || 82) + '%');
    if (i === 0) el.classList.add('active');
    container.appendChild(el);
    return el;
  });

  renderHeroSlideText(HERO_MEDIA[0]);

  if (imgs.length <= 1) return;

  let current = 0;
  setInterval(() => {
    imgs[current].classList.remove('active');
    current = (current + 1) % imgs.length;
    imgs[current].classList.add('active');

    if (textContainer) {
      textContainer.style.opacity = '0';
      setTimeout(() => {
        renderHeroSlideText(HERO_MEDIA[current]);
        textContainer.style.opacity = '1';
      }, 500);
    } else {
      renderHeroSlideText(HERO_MEDIA[current]);
    }
  }, 7000);
}

// ============================================================
// FOTOS DE "SOBRE MASCOTERÍA AKYRA" — loop de 3 que se van
// encadenando. Por ahora son fotos genéricas de ejemplo (con
// licencia libre, vía loremflickr.com) — reemplázalas por las
// rutas de tus propias fotos en assets/nosotros/ cuando las
// tengas (mismo nombre de variable, solo cambia el "src").
// ============================================================
const ABOUT_MEDIA = [
  { src: 'https://loremflickr.com/900/700/dog,owner', alt: 'Cliente con su mascota' },
  { src: 'https://loremflickr.com/900/700/cat,cute', alt: 'Gato en la tienda' },
  { src: 'https://loremflickr.com/900/700/petshop,store', alt: 'Local de Mascotería Akyra' }
];

function initAboutSlideshow() {
  const container = document.getElementById('about-slideshow');
  if (!container || ABOUT_MEDIA.length === 0) return;

  const imgs = ABOUT_MEDIA.map((item, i) => {
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = item.alt || 'Mascotería Akyra';
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
// FOTOS DE LAS SUCURSALES ("Encuéntranos aquí") — van rotando
// en loop, y cada vez que aparece una foto se ilumina la card de
// esa misma sucursal (matchean por "location", el mismo valor
// que el data-location de cada .location-card).
// ============================================================
// PENDIENTE: falta la foto real de Casa Matriz y de Circunvalación —
// mientras tanto se usan fotos genéricas de ejemplo (loremflickr).
// Hornillas ya tiene su foto real (la de la fachada con el letrero).
const LOCATIONS_MEDIA = [
  { src: 'https://loremflickr.com/900/700/petshop,storefront', alt: 'Local Mascotería Akyra — Casa Matriz', location: 'casa-matriz' },
  { src: 'assets/img/lugares/hornillas.jpg', alt: 'Fachada de Mascotería Akyra — sucursal Hornillas', location: 'hornillas' },
  { src: 'https://loremflickr.com/900/700/petstore,shop', alt: 'Local Mascotería Akyra — Circunvalación', location: 'circunvalacion' }
];

function initLocationsShowcase() {
  const container = document.getElementById('locations-bg');
  const cards = document.querySelectorAll('.location-card');
  if (!container || LOCATIONS_MEDIA.length === 0) return;

  const imgs = LOCATIONS_MEDIA.map((item, i) => {
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = item.alt || 'Mascotería Akyra';
    if (i === 0) img.classList.add('active');
    container.appendChild(img);
    return img;
  });

  function highlightCard(location) {
    cards.forEach(card => card.classList.toggle('location-card-glow', card.dataset.location === location));
  }
  highlightCard(LOCATIONS_MEDIA[0].location);

  if (imgs.length <= 1) return;

  let current = 0;
  setInterval(() => {
    imgs[current].classList.remove('active');
    current = (current + 1) % imgs.length;
    imgs[current].classList.add('active');
    highlightCard(LOCATIONS_MEDIA[current].location);
  }, 3500);
}

// ============================================================
// CARRITO — el cliente va agregando productos con su precio, ve
// el total, completa sus datos, y al final todo el detalle se
// manda armado a WhatsApp. Se guarda en localStorage para que no
// se pierda al pasar de la landing al catálogo (o entre páginas).
// ============================================================
const CART_STORAGE_KEY = 'akyra_cart';
const CUSTOMER_STORAGE_KEY = 'akyra_customer';

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

function loadCustomer() {
  const defaults = { name: '', phone: '', address: '', extra: '', payment: '' };
  try {
    const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
    // el spread de defaults primero cubre a quienes tenían datos
    // guardados de antes de agregar el campo "payment" (u otro
    // campo nuevo a futuro), para que no quede undefined.
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch (e) {
    return defaults;
  }
}

function saveCustomer() {
  try { localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customer)); } catch (e) { /* almacenamiento no disponible */ }
}

function formatCLP(amount) {
  return '$' + Math.round(amount).toLocaleString('es-CL');
}

let cart = loadCart(); // [{ id, name, price, qty }]
let customer = loadCustomer(); // { name, phone, address, extra, payment }

function addToCart(id, name, price) {
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, name, price: Number(price) || 0, qty: 1 });
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

function cartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function renderCart() {
  const itemsEl = document.getElementById('cart-items');
  const emptyEl = document.getElementById('cart-empty');
  const footerEl = document.getElementById('cart-footer');
  const badgeEl = document.getElementById('cart-badge');
  const totalEl = document.getElementById('cart-total');
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
      <div class="cart-item-main">
        <span class="cart-item-name">${item.name}</span>
        <span class="cart-item-price">${formatCLP(item.price)} c/u</span>
      </div>
      <div class="cart-item-qty">
        <button class="cart-qty-btn" data-qty-minus="${item.id}" aria-label="Quitar uno">–</button>
        <span class="cart-qty-value">${item.qty}</span>
        <button class="cart-qty-btn" data-qty-plus="${item.id}" aria-label="Agregar uno">+</button>
        <span class="cart-item-subtotal">${formatCLP(item.price * item.qty)}</span>
        <button class="cart-item-remove" data-remove="${item.id}" aria-label="Eliminar"><i data-lucide="x"></i></button>
      </div>
    `;
    itemsEl.appendChild(row);
  });
  if (window.lucide) lucide.createIcons();

  if (totalEl) totalEl.textContent = formatCLP(cartTotal());

  updateWhatsappMessage();
}

function updateWhatsappMessage() {
  const whatsappBtn = document.getElementById('cart-whatsapp');
  const hintEl = document.getElementById('cart-form-hint');
  if (!whatsappBtn) return;

  const ready = customer.name.trim() !== '' && customer.phone.trim() !== '' && customer.payment.trim() !== '';
  whatsappBtn.classList.toggle('btn-disabled', !ready);
  if (hintEl) hintEl.hidden = ready;

  const lines = cart.map(item =>
    `- ${item.qty}x ${item.name} (${formatCLP(item.price)} c/u) = ${formatCLP(item.price * item.qty)}`
  ).join('\n');

  let message = `Hola, quiero hacer este pedido:\n${lines}\n\nTotal: ${formatCLP(cartTotal())}`;
  message += `\n\nNombre: ${customer.name || '-'}`;
  message += `\nTeléfono: ${customer.phone || '-'}`;
  if (customer.address.trim()) message += `\nDirección: ${customer.address}`;
  if (customer.payment.trim()) message += `\nMétodo de pago: ${customer.payment}`;
  if (customer.extra.trim()) message += `\nOtra información: ${customer.extra}`;
  message += `\n\n¿Podrían confirmarme precio final y disponibilidad?`;

  whatsappBtn.href = ready ? buildWhatsappLink(message) : '#';
}

let toastTimer = null;
function showCartToast(message) {
  const toast = document.getElementById('cart-toast');
  const textEl = document.getElementById('cart-toast-text');
  if (!toast) return;
  if (textEl) textEl.textContent = message;
  if (window.lucide) lucide.createIcons();
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function bumpCartIcon() {
  const bump = document.getElementById('cart-bump');
  if (!bump) return;
  bump.classList.remove('animate');
  void bump.offsetWidth; // fuerza el reflow para poder repetir la animación si se agrega rápido varias veces
  bump.classList.add('animate');
}

function showCartStep(step) {
  const step1 = document.getElementById('cart-step-1');
  const step2 = document.getElementById('cart-step-2');
  if (!step1 || !step2) return;
  step1.hidden = step !== 1;
  step2.hidden = step !== 2;
}

function openCart() {
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('cart-overlay').classList.add('open');
  showCartStep(1); // siempre empieza mostrando el resumen, no el formulario
}
function closeCart() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('open');
}

function updateDeliveryPaymentNote() {
  const note = document.getElementById('cart-delivery-payment-note');
  if (note) note.hidden = !customer.address.trim();
}

function initCart() {
  // Restaura los datos del cliente que haya escrito antes (en esta
  // u otra página del sitio)
  const nameEl = document.getElementById('cart-name');
  const phoneEl = document.getElementById('cart-phone');
  const addressEl = document.getElementById('cart-address');
  const extraEl = document.getElementById('cart-extra');
  if (nameEl) nameEl.value = customer.name;
  if (phoneEl) phoneEl.value = customer.phone;
  if (addressEl) addressEl.value = customer.address;
  if (extraEl) extraEl.value = customer.extra;

  [['cart-name', 'name'], ['cart-phone', 'phone'], ['cart-address', 'address'], ['cart-extra', 'extra']]
    .forEach(([elId, field]) => {
      const el = document.getElementById(elId);
      if (!el) return;
      el.addEventListener('input', () => {
        customer[field] = el.value;
        saveCustomer();
        updateWhatsappMessage();
        if (field === 'address') updateDeliveryPaymentNote();
      });
    });

  // Botones de método de pago — selección única (como radio buttons,
  // pero con el mismo look que otros botones del sitio). Restaura la
  // selección guardada, si había una.
  const paymentBtns = document.querySelectorAll('.cart-payment-btn');
  paymentBtns.forEach(btn => {
    if (customer.payment && btn.dataset.payment === customer.payment) {
      btn.classList.add('active');
    }
    btn.addEventListener('click', () => {
      paymentBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      customer.payment = btn.dataset.payment;
      saveCustomer();
      updateWhatsappMessage();
    });
  });
  updateDeliveryPaymentNote();

  renderCart();

  // Si el botón de WhatsApp está deshabilitado (falta nombre/teléfono),
  // no lo dejamos abrir el link vacío — solo avisa cuál dato falta.
  const whatsappBtn = document.getElementById('cart-whatsapp');
  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', (e) => {
      if (whatsappBtn.classList.contains('btn-disabled')) {
        e.preventDefault();
        document.getElementById('cart-form-hint')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      // El evento más importante de todos: alguien terminó de armar
      // un pedido y lo mandó — con el total, para tener una idea del
      // ticket promedio directo en el panel de Umami.
      trackEvent('cart-checkout-whatsapp', {
        total: cartTotal(),
        items: cart.reduce((sum, item) => sum + item.qty, 0),
        pago: customer.payment,
        despacho: customer.address.trim() ? 'domicilio' : 'retiro'
      });
    });
  }

  // Delegado en <body> (no en cada botón) para que también funcione
  // con tarjetas de producto que se agregan dinámicamente después,
  // como el grillado del catálogo al cambiar de categoría/filtro.
  document.body.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add-to-cart]');
    if (!addBtn) return;
    const card = addBtn.closest('[data-product-id]');
    if (!card) return;

    let addedName;

    if (card.dataset.pricePerKg) {
      // Producto a granel: el precio depende de los gramos que haya
      // escrito el cliente en esta misma tarjeta.
      const gramsInput = card.querySelector('.bulk-grams-input');
      const grams = Math.max(50, parseInt(gramsInput?.value, 10) || 0);
      if (!grams) return;
      const pricePerKg = Number(card.dataset.pricePerKg);
      const linePrice = Math.round((pricePerKg * grams) / 1000);
      const id = `${card.dataset.productId}-${grams}g`;
      addedName = `${card.dataset.productName} (${grams} g)`;
      addToCart(id, addedName, linePrice);
    } else {
      addedName = card.dataset.productName;
      addToCart(card.dataset.productId, addedName, card.dataset.productPrice);
    }

    addBtn.textContent = 'Agregado ✓';
    addBtn.classList.add('just-added');
    setTimeout(() => {
      addBtn.textContent = 'Agregar';
      addBtn.classList.remove('just-added');
    }, 1200);

    showCartToast(`${addedName} — agregado al carrito`);
    bumpCartIcon();
  });

  // Vista previa del subtotal a granel mientras el cliente escribe
  // los gramos (no agrega al carrito todavía, solo informa)
  document.body.addEventListener('input', (e) => {
    const input = e.target.closest('.bulk-grams-input');
    if (!input) return;
    const card = input.closest('[data-price-per-kg]');
    if (!card) return;
    const preview = card.querySelector('[data-bulk-preview]');
    if (!preview) return;
    const grams = Math.max(0, parseInt(input.value, 10) || 0);
    const pricePerKg = Number(card.dataset.pricePerKg);
    preview.textContent = formatCLP(Math.round((pricePerKg * grams) / 1000));
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

  const continueShopping = document.getElementById('cart-continue-shopping');
  const goCheckout = document.getElementById('cart-go-checkout');
  const backToCart = document.getElementById('cart-back-to-cart');
  if (continueShopping) continueShopping.addEventListener('click', closeCart);
  if (goCheckout) goCheckout.addEventListener('click', () => showCartStep(2));
  if (backToCart) backToCart.addEventListener('click', () => showCartStep(1));
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
// RESEÑAS — carrusel continuo (mismo patrón que el de marcas de
// arriba: lista duplicada + animación CSS en loop). Reseñas reales
// de Google que pasó la dueña — cámbialas acá si suman/cambian
// reseñas más adelante.
// ============================================================
const REVIEWS = [
  { name: 'Camilo Cárdenas Hernández', meta: 'Local Guide · 49 opiniones · 453 fotos', time: 'Hace 3 años', text: 'Buena calidad de alimentos, tanto para gatos como para perros. Buenos precios además. Cuentan con accesorios para mascotas.' },
  { name: 'Ariel Santana', meta: '6 opiniones', time: 'Hace 4 meses', text: 'Buenos precios y buena atención' },
  { name: 'Maria Soledad Campos Muñoz', meta: 'Local Guide · 10 opiniones', time: 'Hace 3 años', text: 'Son muy amable y siempre tienen la comida de mi perrito tiene muchas variedades de aliento de cachorro y gatos a buen precio' },
  { name: 'Fernanda Hernández', meta: '1 opinión', time: 'Hace un año', text: 'Buenos precios!, siempre compro ahí las cositas para mi Chucky 🐈🐈' },
  { name: 'Meg', meta: '1 opinión', time: 'Hace 4 meses', text: 'Buena atención y variedad' },
  { name: 'sebastian Leiva', meta: 'Local Guide · 21 opiniones · 8 fotos', time: 'Hace un año', text: 'Excelente mascotería con mucha variedad de productos y una atención espectacular sin duda volveré a comprar' }
];

function initReviewsMarquee() {
  const track = document.getElementById('reviews-track');
  if (!track || REVIEWS.length === 0) return;

  const fullList = [...REVIEWS, ...REVIEWS]; // duplicado para el loop continuo
  fullList.forEach(review => {
    const card = document.createElement('div');
    card.className = 'review-card';
    card.innerHTML = `
      <div class="stars">★★★★★</div>
      <p>"${review.text}"</p>
      <span class="review-author">${review.name}</span>
      <span class="review-meta">${review.meta} · ${review.time}</span>
    `;
    track.appendChild(card);
  });
}

// ============================================================
// INDICADOR "SIGUE BAJANDO" — se desvanece apenas el usuario
// empieza a bajar la página, invitando a seguir scrolleando.
// ============================================================
function initScrollCue() {
  const scrollCue = document.getElementById('scroll-cue');
  if (!scrollCue) return;
  const cueThreshold = 40;

  function update() {
    scrollCue.classList.toggle('is-hidden', window.scrollY > cueThreshold);
  }

  update();
  window.addEventListener('scroll', update, { passive: true });
}

// ============================================================
// AVISO DE PRIVACIDAD — pop-up que sale la primera vez que alguien
// entra al sitio (en cualquier página), avisando que sus datos
// (nombre, teléfono, dirección) solo se usan para coordinar la
// compra/despacho y no se comparten ni se guardan para otra cosa.
// Se recuerda con localStorage para no mostrarlo en cada visita.
// ============================================================
function initPrivacyNotice() {
  const overlay = document.getElementById('privacy-overlay');
  if (!overlay) return;
  const STORAGE_KEY = 'akyra_privacy_accepted';

  if (!localStorage.getItem(STORAGE_KEY)) {
    overlay.hidden = false;
  }

  document.getElementById('privacy-accept')?.addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEY, '1');
    overlay.hidden = true;
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

  // Aviso de privacidad (pop-up, primera visita)
  initPrivacyNotice();

  // Indicador "Sigue bajando" en el hero
  initScrollCue();

  // Fondo del hero
  initHeroMedia();

  // Loop de fotos de "Sobre Mascotería Akyra"
  initAboutSlideshow();

  // Fotos de las sucursales en loop, con la card iluminándose según corresponda
  initLocationsShowcase();

  // Carrito de consulta
  initCart();

  // Carrusel de ofertas
  initOffersCarousel();

  // Carrusel de marcas
  initBrandsMarquee();

  // Carrusel de reseñas
  initReviewsMarquee();

  // Aplica el link de WhatsApp a todos los botones/links relevantes,
  // y registra el clic como evento en Umami — así se puede ver
  // cuántas visitas terminan realmente escribiendo, no solo cuántas
  // entran al sitio.
  const whatsappTargets = [
    'nav-whatsapp',
    'about-whatsapp',
    'footer-whatsapp-consulta',
    'whatsapp-float',
    'help-strip-whatsapp',
    'contact-page-whatsapp'
  ];
  whatsappTargets.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.href = buildWhatsappLink();
    el.addEventListener('click', () => trackEvent('whatsapp-click', { origen: id }));
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
