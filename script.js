// ============================================================
// CONFIGURACIÓN — reemplazar con los datos reales de Patitas
// ============================================================
const CONFIG = {
  whatsappNumber: '56985480078', // formato: 56 9 XXXX XXXX sin espacios ni "+"
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
  { type: 'image', src: 'assets/hero/portada-hero.png', alt: 'Productos para mascotas en Patitas' }
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
    el.alt = item.alt || 'Patitas — tienda de mascotas';
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
  { src: 'assets/img/almacen1.jpg', alt: 'Cliente con su mascota' },
  { src: 'assets/img/almacen2.jpg', alt: 'Gato en la tienda' },
  { src: 'assets/img/almacen3.jpg', alt: 'Productos para mascotas' }
];

function initAboutSlideshow() {
  const container = document.getElementById('about-slideshow');
  if (!container || ABOUT_MEDIA.length === 0) return;

  const imgs = ABOUT_MEDIA.map((item, i) => {
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = item.alt || 'Patitas';
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

document.addEventListener('DOMContentLoaded', () => {

  // Iconos Lucide
  if (window.lucide) lucide.createIcons();

  // Fondo del hero
  initHeroMedia();

  // Loop de fotos de "Sobre Patitas"
  initAboutSlideshow();

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
