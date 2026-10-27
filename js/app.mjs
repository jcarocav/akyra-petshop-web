// ============================================================
// APP — lo común a todas las páginas: menú, buscador, aviso de
// privacidad, carrito, botones de compra, carruseles con pausa,
// mapas que se cargan al pedirlos y enlaces de WhatsApp.
// ============================================================
import { iniciarCarrito, mostrarAviso } from './carrito-ui.mjs'
import { activarCompra, cuandoSeAgregue } from './componentes.mjs'
import { CONFIG } from './datos.mjs'
import { crearDialogo } from './dialogo.mjs'
import { aplicarTemas } from './temas.mjs'
import { $, $$, almacen, h, reducirMovimiento } from './utilidades.mjs'

const MENSAJE_WHATSAPP = 'Hola, quería consultar por sus productos para mascotas 🐾'

export function enlaceConsulta(texto = MENSAJE_WHATSAPP) {
  return `https://wa.me/${CONFIG.whatsappTienda}?text=${encodeURIComponent(texto)}`
}

// ---------- Menú en celular ----------
function iniciarMenu() {
  const boton = $('#menu-boton')
  const menu = $('#menu-principal')
  if (!boton || !menu) return
  const cerrar = (devolverFoco = false) => {
    boton.setAttribute('aria-expanded', 'false')
    menu.classList.remove('abierto')
    if (devolverFoco) boton.focus()
  }
  boton.addEventListener('click', () => {
    const abrir = boton.getAttribute('aria-expanded') !== 'true'
    boton.setAttribute('aria-expanded', String(abrir))
    menu.classList.toggle('abierto', abrir)
  })
  menu.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(true) })
  boton.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar() })
  menu.addEventListener('click', e => { if (e.target.closest('a')) cerrar() })
  window.matchMedia('(min-width: 1101px)').addEventListener('change', () => cerrar())
}

// ---------- Aviso de privacidad (primera visita) ----------
function iniciarPrivacidad() {
  const panel = $('#aviso-privacidad')
  if (!panel) return
  const CLAVE = 'akyra_privacidad_aceptada'
  if (almacen.leer(CLAVE, false) || almacen.leer(CLAVE, false, true)) return
  const dialogo = crearDialogo(panel, {
    fondo: $('#aviso-privacidad-fondo'),
    alCerrar: () => almacen.guardar(CLAVE, true, true) // cerrado con Esc: no se repite en esta visita
  })
  $('#aviso-privacidad-aceptar').addEventListener('click', () => {
    almacen.guardar(CLAVE, true)
    dialogo.cerrar({ devolverFoco: false })
    $('#contenido')?.focus({ preventScroll: true })
  })
  dialogo.abrir(null, { enfocar: $('#aviso-privacidad-aceptar') })
}

// ---------- Carrusel del inicio ----------
// Las diapositivas con data-portada solo se muestran cuando su tema de temporada las activa
// (fechas en js/temas-config.mjs)
function iniciarHero(portada) {
  const hero = $('[data-carrusel]')
  if (!hero) return
  const diapositivas = $$('.hero__diapositiva', hero).filter(d => {
    const vigente = !d.dataset.portada || d.dataset.portada === portada
    if (!vigente) d.remove()
    return vigente
  })
  const boton = $('#hero-pausa')
  if (diapositivas.length < 2) { if (boton) boton.hidden = true; return }
  let actual = 0
  let pausado = reducirMovimiento()
  let temporizador = null
  const mostrar = i => {
    diapositivas.forEach((d, j) => {
      d.hidden = j !== i
      d.classList.toggle('activa', j === i)
    })
    const contador = $('#hero-contador')
    if (contador) contador.textContent = `${i + 1} de ${diapositivas.length}`
  }
  const programar = () => {
    clearInterval(temporizador)
    if (!pausado) temporizador = setInterval(() => { actual = (actual + 1) % diapositivas.length; mostrar(actual) }, 7000)
  }
  const pintarBoton = () => {
    boton.setAttribute('aria-pressed', String(pausado))
    boton.setAttribute('aria-label', pausado ? 'Reanudar el carrusel de portada' : 'Pausar el carrusel de portada')
    boton.querySelector('use').setAttribute('href', `assets/iconos.svg#${pausado ? 'play' : 'pause'}`)
  }
  boton.hidden = false
  boton.addEventListener('click', () => { pausado = !pausado; pintarBoton(); programar() })
  $('#hero-anterior')?.addEventListener('click', () => { actual = (actual - 1 + diapositivas.length) % diapositivas.length; mostrar(actual); programar() })
  $('#hero-siguiente')?.addEventListener('click', () => { actual = (actual + 1) % diapositivas.length; mostrar(actual); programar() })
  // Pausa mientras el mouse o el foco del teclado están en el carrusel
  hero.addEventListener('mouseenter', () => clearInterval(temporizador))
  hero.addEventListener('mouseleave', programar)
  hero.addEventListener('focusin', () => clearInterval(temporizador))
  hero.addEventListener('focusout', e => { if (!hero.contains(e.relatedTarget)) programar() })
  mostrar(0)
  pintarBoton()
  programar()
}

// ---------- Cintas en movimiento (reseñas y marcas) ----------
function iniciarCintas() {
  for (const cinta of $$('[data-cinta]')) {
    const pista = $('.cinta__pista', cinta)
    // Se duplica el contenido para que el giro continuo no tenga corte;
    // la copia queda oculta para lectores de pantalla y teclado.
    const copia = pista.cloneNode(true)
    copia.setAttribute('aria-hidden', 'true')
    copia.classList.add('cinta__pista--copia')
    $$('a, button', copia).forEach(el => el.setAttribute('tabindex', '-1'))
    pista.after(copia)
    const boton = $('.cinta__pausa', cinta)
    if (!boton) continue
    const nombre = boton.dataset.nombre || 'animación'
    const pintar = pausada => {
      cinta.classList.toggle('cinta--pausada', pausada)
      boton.setAttribute('aria-pressed', String(pausada))
      boton.setAttribute('aria-label', `${pausada ? 'Reanudar' : 'Pausar'} ${nombre}`)
      boton.querySelector('use').setAttribute('href', `assets/iconos.svg#${pausada ? 'play' : 'pause'}`)
    }
    pintar(reducirMovimiento())
    boton.addEventListener('click', () => pintar(!cinta.classList.contains('cinta--pausada')))
  }
}

// ---------- Mapas: solo se cargan si la persona los pide ----------
function iniciarMapas() {
  for (const boton of $$('[data-mapa]')) {
    boton.addEventListener('click', () => {
      const iframe = h('iframe', {
        src: boton.dataset.mapa,
        title: boton.dataset.titulo,
        loading: 'lazy',
        referrerpolicy: 'no-referrer-when-downgrade',
        class: 'mapa__iframe'
      })
      const contenedor = boton.closest('.mapa')
      contenedor.replaceChildren(iframe)
      iframe.focus()
    })
  }
}

function iniciarEnlacesWhatsapp() {
  for (const a of $$('[data-whatsapp]')) {
    a.href = enlaceConsulta(a.dataset.whatsapp || MENSAJE_WHATSAPP)
  }
}

// ---------- Buscador de la cabecera ----------
function iniciarBuscador() {
  const form = $('#buscador')
  if (!form) return
  form.addEventListener('submit', e => {
    const campo = $('#buscador-campo')
    campo.value = campo.value.trim().slice(0, 80)
    if (!campo.value) { e.preventDefault(); campo.focus() }
  })
}

export function iniciarApp() {
  document.documentElement.classList.add('js')
  iniciarMenu()
  iniciarBuscador()
  iniciarEnlacesWhatsapp()
  iniciarCarrito()
  activarCompra()
  cuandoSeAgregue(mostrarAviso)
  const { portada } = aplicarTemas()
  iniciarHero(portada)
  iniciarCintas()
  iniciarMapas()
  iniciarPrivacidad()
  const anio = $('#anio-actual')
  if (anio) anio.textContent = String(new Date().getFullYear())
}

iniciarApp()
