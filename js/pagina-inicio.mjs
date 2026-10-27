// ============================================================
// INICIO — destacados (cards reales del catálogo) y conteo de
// productos en las tarjetas de categoría.
// ============================================================
import { tarjetaProducto } from './componentes.mjs'
import { CONFIG, productoPorSku, productos, sinPrecio } from './datos.mjs'
import { $, $$, h } from './utilidades.mjs'

const CANTIDAD_DESTACADOS = 8

export function elegirDestacados() {
  const elegidos = []
  const usados = new Set()
  // Primero con foto; si no alcanzan, también sin foto (muestran el logo)
  let exigirFoto = true
  const sirve = p => p && (p.imagen || !exigirFoto) && !sinPrecio(p) && !usados.has(p.id)
  for (const sku of CONFIG.destacados || []) {
    const p = productoPorSku.get(sku)
    if (sirve(p)) { elegidos.push(p); usados.add(p.id) }
  }
  // Relleno: productos con foto y precio, alternando categorías.
  const porCategoria = new Map()
  if (productos.filter(p => p.imagen && !sinPrecio(p)).length < CANTIDAD_DESTACADOS) exigirFoto = false
  for (const p of productos) {
    if (!sirve(p) || p.granel) continue
    if (!porCategoria.has(p.categoria)) porCategoria.set(p.categoria, [])
    porCategoria.get(p.categoria).push(p)
  }
  for (const lista of porCategoria.values()) lista.sort((a, b) => (b.tope ?? 0) - (a.tope ?? 0))
  const colas = [...porCategoria.values()]
  while (elegidos.length < CANTIDAD_DESTACADOS && colas.some(c => c.length)) {
    for (const cola of colas) {
      const p = cola.shift()
      if (p && !usados.has(p.id) && elegidos.length < CANTIDAD_DESTACADOS) { elegidos.push(p); usados.add(p.id) }
    }
  }
  return elegidos.slice(0, CANTIDAD_DESTACADOS)
}

function pintarDestacados() {
  const lista = $('#destacados-lista')
  if (!lista) return
  const elegidos = elegirDestacados()
  lista.replaceChildren(...elegidos.map(p => h('li', { class: 'carrusel__item' }, tarjetaProducto(p, { nivelTitulo: 'h3' }))))
  lista.setAttribute('aria-busy', 'false')
}

function pintarConteos() {
  const conteo = new Map()
  for (const p of productos) conteo.set(p.categoria, (conteo.get(p.categoria) || 0) + 1)
  for (const el of $$('[data-conteo-categoria]')) {
    const n = conteo.get(el.dataset.conteoCategoria) || 0
    el.textContent = `${n} ${n === 1 ? 'producto' : 'productos'}`
  }
}

pintarDestacados()
pintarConteos()
