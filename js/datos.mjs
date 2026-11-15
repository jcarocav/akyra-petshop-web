// ============================================================
// Datos del catálogo: une productos.json (solo productos publicados) con
// stock.json (disponibilidad por SKU: 'con-stock' | 'consultar', sin unidades).
// El stock ya no oculta productos: solo decide el aviso "Consultar disponibilidad".
// ============================================================
import { cruzarDisponibilidad } from './stock.mjs'
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

export const productos = cruzarDisponibilidad(catalogo.productos || [], stock)
export const categorias = catalogo.categorias || []
export const categoriaPorId = new Map(categorias.map(c => [c.id, c]))
export const productoPorId = new Map(productos.map(p => [p.id, p]))
export const productoPorSku = new Map(productos.map(p => [p.sku, p]))

// Para las pruebas y para revisar en la consola del navegador
window.AKYRA_CATALOGO = { productos, categorias }

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
    return { talla: null, sku: producto.sku, precio: producto.precio ?? null, disponibilidad: producto.disponibilidad || 'consultar' }
  }
  const t = producto.tallas.find(x => x.talla === talla)
  return t ? { talla: t.talla, sku: t.sku, precio: t.precio ?? null, disponibilidad: t.disponibilidad || 'consultar' } : null
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
