// ============================================================
// Disponibilidad (la usan el sitio, el generador y las pruebas).
// stock.json ya NO publica unidades: solo { disponibilidad: { SKU: 'con-stock' | 'consultar' } }.
//   - 'con-stock'  → se vende normal, sin ningún aviso ni número de unidades.
//   - 'consultar'  → aviso amarillo "Consultar disponibilidad" (stock 0 o sin cantidad registrada).
// El stock ya no decide si un producto se ve: eso lo decide el generador
// (tools/catalogo/publicar.mjs) y productos.json solo trae los publicados.
// Funciones puras: no tocan la página.
// ============================================================

export const MINIMO_GRANEL = 0.1
export const CON_STOCK = 'con-stock'
export const CONSULTAR = 'consultar'
export const TEXTO_CONSULTAR = 'Consultar disponibilidad'

export function normalizarUnidades(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.round(n * 1000) / 1000)
}

// Unidades conocidas (Excel o, si se reactiva, un sistema de ventas) → disponibilidad pública, sin números.
export function disponibilidadDesdeUnidades(unidades, granel = false) {
  const u = normalizarUnidades(unidades)
  if (u === null) return CONSULTAR
  return (granel ? u >= MINIMO_GRANEL : u > 0) ? CON_STOCK : CONSULTAR
}

export function normalizarDisponibilidad(valor) {
  return valor === CON_STOCK ? CON_STOCK : CONSULTAR
}

// Estado para mostrar: { clave, texto }. Con stock no se muestra nada (texto vacío).
export function estadoDisponibilidad(disponibilidad) {
  return normalizarDisponibilidad(disponibilidad) === CON_STOCK
    ? { clave: CON_STOCK, texto: '' }
    : { clave: CONSULTAR, texto: TEXTO_CONSULTAR }
}

// Une el catálogo (productos.json) con stock.json. Lo que no aparece en stock.json = "consultar".
// Un producto con tallas tiene stock si alguna talla lo tiene (cada talla conserva el suyo).
export function cruzarDisponibilidad(productos, stock) {
  const mapa = stock?.disponibilidad || {}
  const de = sku => normalizarDisponibilidad(Object.prototype.hasOwnProperty.call(mapa, sku) ? mapa[sku] : null)
  return productos.map(p => {
    if (p.tallas) {
      const tallas = p.tallas.map(t => ({ ...t, disponibilidad: de(t.sku) }))
      return { ...p, tallas, disponibilidad: tallas.some(t => t.disponibilidad === CON_STOCK) ? CON_STOCK : CONSULTAR }
    }
    return { ...p, disponibilidad: de(p.sku) }
  })
}
