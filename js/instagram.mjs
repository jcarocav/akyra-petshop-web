// ============================================================
// INSTAGRAM — feed de Elfsight (de un tercero). El script se inyecta solo al acercarse la sección,
// para no afectar la carga del inicio. Si no carga (bloqueador, sin conexión, Elfsight caído),
// queda el botón "Síguenos en Instagram".
// ============================================================
import { $, h } from './utilidades.mjs'

const SCRIPT = 'https://elfsightcdn.com/platform.js'
const ESPERA_MS = 12000

export function iniciarInstagram() {
  const seccion = $('[data-instagram]')
  if (!seccion) return
  const widget = $('[class^="elfsight-app-"]', seccion)
  const respaldo = $('.instagram__respaldo', seccion)
  const cargar = () => {
    respaldo.hidden = true
    const mostrarRespaldo = () => { respaldo.hidden = false }
    const script = h('script', { src: SCRIPT, async: '' })
    script.addEventListener('error', mostrarRespaldo)
    document.head.append(script)
    // El widget se pinta dentro de su contenedor; si pasado un rato sigue vacío, se muestra el botón
    setTimeout(() => { if (!widget.querySelector('*')) mostrarRespaldo() }, ESPERA_MS)
  }
  if (!('IntersectionObserver' in window)) return cargar()
  const observador = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return
    observador.disconnect()
    cargar()
  }, { rootMargin: '500px 0px' })
  observador.observe(seccion)
}
