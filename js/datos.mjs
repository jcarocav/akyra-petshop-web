// ============================================================
// Datos del catálogo: une productos.json (el catálogo) con
// stock.json (unidades por SKU) al cargar la página. Así actualizar el
// stock no obliga a regenerar el catálogo.
// Lo que tiene stock 0 queda fuera de "productos" (catálogo, buscador,
// destacados), pero sigue en "productoPorId" para que su ficha diga
// "Agotado por ahora".
// ============================================================
import { cruzarStock } from './stock.mjs'
import { normalizar } from './utilidades.mjs'

export const CONFIG = window.AKYRA_CONFIG || {}

async function cargarJson(ruta) {
  const r = await fetch(ruta, { cache: 'no-cache' })
  if (!r.ok) throw new Error(`${ruta}: ${r.status}`)
  return r.json()
}

let catalogo = { productos: [], categorias: [] }
let stock = null
export let errorCarga = null
try {
  ;[catalogo, stock] = await Promise.all([
    cargarJson('productos.json'),
    cargarJson('stock.json').catch(() => null)
  ])
  // Sin stock.json (falla de red): todo se muestra como "Consultar disponibilidad"
  if (!stock) errorCarga = 'stock'
} catch (e) {
  errorCarga = 'catalogo'
  console.warn('No se pudo cargar el catálogo', e)
}

export const stockActualizado = stock?.actualizado || null
export const todos = cruzarStock(catalogo.productos || [], stock)
export const productos = todos
  .filter(p => p.visible)
  .map(p => (p.tallas ? { ...p, tallas: p.tallas.filter(t => t.visible) } : p))
export const categorias = catalogo.categorias || []
export const categoriaPorId = new Map(categorias.map(c => [c.id, c]))
const visiblesPorId = new Map(productos.map(p => [p.id, p]))
// Incluye los agotados (para su ficha), con las tallas visibles ya filtradas
export const productoPorId = new Map(todos.map(p => [p.id, visiblesPorId.get(p.id) || p]))
export const productoPorSku = new Map(productos.map(p => [p.sku, p]))

// Para las pruebas y para revisar en la consola del navegador
window.AKYRA_CATALOGO = { productos, todos, categorias, stockActualizado }

export function tallasDisponibles(producto) {
  return (producto.tallas || []).filter(t => t.visible !== false)
}

export function esVisible(producto) {
  return !!producto && producto.visible !== false
}

// ---- Precios ----
export function preciosDe(producto) {
  if (producto.tallas) return producto.tallas.map(t => t.precio).filter(n => typeof n === 'number')
  return typeof producto.precio === 'number' ? [producto.precio] : []
}

export function sinPrecio(producto) {
  return preciosDe(producto).length === 0
}

export function precioMinimo(producto) {
  const p = preciosDe(producto)
  return p.length ? Math.min(...p) : null
}

// Datos de una talla (o del producto si no tiene tallas)
export function variante(producto, talla) {
  if (!producto.tallas) {
    return { talla: null, sku: producto.sku, precio: producto.precio ?? null, tope: producto.tope ?? null, unidades: producto.unidades ?? null, visible: producto.visible !== false }
  }
  const t = producto.tallas.find(x => x.talla === talla)
  return t ? { talla: t.talla, sku: t.sku, precio: t.precio ?? null, tope: t.tope ?? null, unidades: t.unidades ?? null, visible: t.visible !== false } : null
}

// ---- Textos ----
export function textoAlternativo(producto) {
  const nombre = producto.nombre
  const marca = producto.marca && producto.marca !== 'Genérico' && !normalizar(nombre).includes(normalizar(producto.marca))
    ? `${producto.marca} — ` : ''
  return `${marca}${nombre}`
}

export function urlProducto(producto) {
  return `producto.html?id=${encodeURIComponent(producto.id)}`
}

// ---- Búsqueda (nombre, marca, código SKU) ----
const indiceBusqueda = new Map(productos.map(p => [p.id,
  normalizar([p.nombre, p.marca, p.sku, p.subcategoria, categoriaPorId.get(p.categoria)?.nombre, ...(p.tallas || []).map(t => t.sku)].join(' '))
]))

export function coincideBusqueda(producto, consulta) {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean)
  if (!palabras.length) return true
  const texto = indiceBusqueda.get(producto.id) || ''
  return palabras.every(w => texto.includes(w))
}

// "26-10-2026 09:15" (hora de Chile)
export function fechaStock() {
  if (!stockActualizado) return null
  const d = new Date(stockActualizado)
  if (Number.isNaN(d.getTime())) return null
  const partes = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Punta_Arenas', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(d).reduce((o, x) => ({ ...o, [x.type]: x.value }), {})
  return `${partes.day}-${partes.month}-${partes.year} ${partes.hour}:${partes.minute}`
}
