// ============================================================
// TEMAS DE TEMPORADA — decide qué tema corresponde a una fecha (hora de Chile)
// y pone sus decoraciones. El calendario está en js/temas-config.mjs.
// Vista previa: ?tema=halloween (o el id que sea) · ?tema=ninguno para ver el sitio sin tema.
// Las funciones de fechas son puras (las usan las pruebas).
// ============================================================
import { TEMAS } from './temas-config.mjs'

const ZONA = 'America/Punta_Arenas'
const DIA = 86_400_000

// Fecha de hoy en Chile como { anio, mes, dia }
export function fechaChile(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ahora)
  const valor = tipo => Number(partes.find(p => p.type === tipo).value)
  return { anio: valor('year'), mes: valor('month'), dia: valor('day') }
}

const dia = (anio, mes, d) => Date.UTC(anio, mes - 1, d)
const deMMDD = (anio, mmdd) => { const [m, d] = mmdd.split('-').map(Number); return dia(anio, m, d) }

// N-ésimo domingo de un mes (numero 1 = primero)
export function enesimoDomingo(anio, mes, numero) {
  const primero = new Date(dia(anio, mes, 1)).getUTCDay() // 0 = domingo
  return dia(anio, mes, 1 + ((7 - primero) % 7) + (numero - 1) * 7)
}

// Rango [inicio, fin] (milisegundos UTC, días completos) de un tema en un año
export function rangoDelTema(tema, anio) {
  const f = tema.fechas
  if (f.desde) {
    const inicio = deMMDD(anio, f.desde)
    let fin = deMMDD(anio, f.hasta)
    if (fin < inicio) fin = deMMDD(anio + 1, f.hasta) // cruza el año (ej. 26-dic al 2-ene)
    return [inicio, fin]
  }
  if (f.alrededor) {
    const centro = deMMDD(anio, f.alrededor)
    return [centro - f.dias * DIA, centro + f.dias * DIA]
  }
  if (f.domingo) {
    const domingo = enesimoDomingo(anio, f.domingo.mes, f.domingo.numero)
    return [domingo - (f.diasAntes || 0) * DIA, domingo]
  }
  throw new Error(`Tema "${tema.id}": fechas no reconocidas`)
}

export function temaVigente(tema, { anio, mes, dia: d }) {
  const hoy = dia(anio, mes, d)
  // Se revisa también el rango del año anterior (temas que cruzan el año)
  return [anio - 1, anio].some(a => { const [i, f] = rangoDelTema(tema, a); return hoy >= i && hoy <= f })
}

function portadaVigente(tema, fecha) {
  if (!tema?.portada) return null
  const { desde, hasta } = tema.portada
  if (!desde) return tema.portada.id
  return temaVigente({ id: tema.id, fechas: { desde, hasta } }, fecha) ? tema.portada.id : null
}

// { principal, detalles, portada } para una fecha. Con "forzado" (vista previa) se ignora la fecha.
export function temasDelDia(fecha, { temas = TEMAS, forzado = null } = {}) {
  if (forzado === 'ninguno') return { principal: null, detalles: [], portada: null }
  if (forzado) {
    const tema = temas.find(t => t.id === forzado)
    if (tema) {
      const esDetalle = tema.capa === 'detalle'
      return { principal: esDetalle ? null : tema, detalles: esDetalle ? [tema] : [], portada: tema.portada?.id || null }
    }
  }
  const vigentes = temas.filter(t => temaVigente(t, fecha)).sort((a, b) => b.prioridad - a.prioridad)
  const principal = vigentes.find(t => t.capa !== 'detalle') || null
  const detalles = vigentes.filter(t => t.capa === 'detalle')
  return { principal, detalles, portada: portadaVigente(principal, fecha) }
}

// Tema pedido en la URL (?tema=...): solo ids conocidos o "ninguno"
export function temaDesdeUrl(busqueda, temas = TEMAS) {
  const pedido = new URLSearchParams(busqueda).get('tema')
  if (!pedido) return null
  return pedido === 'ninguno' || temas.some(t => t.id === pedido) ? pedido : null
}

// ---------- Decoraciones en la página ----------
function adorno(src, clase) {
  const img = document.createElement('img')
  img.src = src
  img.alt = ''
  img.setAttribute('aria-hidden', 'true')
  img.decoding = 'async'
  img.className = clase
  return img
}

export function aplicarTemas({ ahora = new Date(), busqueda = location.search } = {}) {
  const resultado = temasDelDia(fechaChile(ahora), { forzado: temaDesdeUrl(busqueda) })
  const { principal, detalles } = resultado
  const raiz = document.documentElement
  if (principal) raiz.dataset.tema = principal.id
  const main = document.querySelector('main')
  const guirnalda = principal?.decoracion?.guirnalda
  if (guirnalda && main) {
    const tira = document.createElement('div')
    tira.className = 'tema-guirnalda'
    tira.setAttribute('aria-hidden', 'true')
    tira.style.backgroundImage = `url("${guirnalda}")`
    main.prepend(tira)
    raiz.classList.add('con-guirnalda')
  }
  const hero = document.querySelector('.hero')
  if (hero) {
    const piezas = [principal, ...detalles].filter(t => t?.decoracion?.hero)
    piezas.forEach((t, i) => hero.append(adorno(t.decoracion.hero, `tema-adorno tema-adorno--${i === 0 ? 'principal' : 'secundario'}`)))
  }
  const pie = document.querySelector('.pie__arriba')
  if (pie && principal?.decoracion?.pie) pie.append(adorno(principal.decoracion.pie, 'tema-adorno-pie'))
  return resultado
}
