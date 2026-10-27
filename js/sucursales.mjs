// ============================================================
// SUCURSALES — mapas de Google que se cargan al acercarse la sección
// y fachadas de fondo que cambian cada 3 s (la tarjeta de la sucursal se ilumina).
// ============================================================
import { $, $$, h, reducirMovimiento } from './utilidades.mjs'

const CADA_MS = 3000

function cargarMapas(seccion) {
  for (const contenedor of $$('[data-mapa]', seccion)) {
    if (contenedor.firstElementChild) continue
    contenedor.append(h('iframe', {
      src: contenedor.dataset.mapa,
      title: contenedor.dataset.titulo,
      loading: 'lazy',
      referrerpolicy: 'no-referrer-when-downgrade',
      class: 'mapa__iframe'
    }))
  }
}

function iniciarFachadas(seccion) {
  const fotos = $$('.fachada', seccion)
  const tarjetas = fotos.map(f => $(`.sucursal[data-sucursal="${f.dataset.sucursal}"]`, seccion))
  const boton = $('.fachadas__pausa', seccion)
  if (!fotos.length || tarjetas.some(t => !t)) return
  for (const t of tarjetas) t.prepend(h('span', { class: 'sucursal__etiqueta' }, 'Foto de fondo'))
  let actual = 0
  let pausadoPorPersona = reducirMovimiento()
  let encima = false
  let visible = false
  let temporizador = null
  const mostrar = i => {
    actual = i
    fotos.forEach((f, j) => f.classList.toggle('fachada--activa', j === i))
    tarjetas.forEach((t, j) => t.classList.toggle('sucursal--resaltada', j === i))
  }
  const detener = () => { clearInterval(temporizador); temporizador = null }
  const actualizar = () => {
    detener()
    if (!pausadoPorPersona && !encima && visible) temporizador = setInterval(() => mostrar((actual + 1) % fotos.length), CADA_MS)
  }
  const pintarBoton = () => {
    boton.hidden = false
    boton.setAttribute('aria-pressed', String(pausadoPorPersona))
    boton.setAttribute('aria-label', `${pausadoPorPersona ? 'Reanudar' : 'Pausar'} el cambio de fotos de fondo`)
    boton.querySelector('use').setAttribute('href', `assets/iconos.svg#${pausadoPorPersona ? 'play' : 'pause'}`)
  }
  boton.addEventListener('click', () => { pausadoPorPersona = !pausadoPorPersona; pintarBoton(); actualizar() })
  seccion.addEventListener('mouseenter', () => { encima = true; actualizar() })
  seccion.addEventListener('mouseleave', () => { encima = false; actualizar() })
  seccion.addEventListener('focusin', () => { encima = true; actualizar() })
  seccion.addEventListener('focusout', e => { if (!seccion.contains(e.relatedTarget)) { encima = false; actualizar() } })
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; actualizar() }).observe(seccion)
  mostrar(0)
  pintarBoton()
}

export function iniciarSucursales() {
  const seccion = $('[data-fachadas]')
  if (!seccion) return
  iniciarFachadas(seccion)
  const cargar = () => cargarMapas(seccion)
  if (!('IntersectionObserver' in window)) return cargar()
  const observador = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return
    observador.disconnect()
    cargar()
  }, { rootMargin: '700px 0px' })
  observador.observe(seccion)
}
