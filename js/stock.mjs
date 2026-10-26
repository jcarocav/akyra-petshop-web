// ============================================================
// Reglas de stock (las usan el sitio, el generador y las pruebas).
//   - null / sin dato  → "Consultar disponibilidad": se muestra, sin tope.
//   - mayor que 0      → se muestra; el tope del "+" es el stock.
//   - 0 (o granel bajo medio kilo) → oculto ("Agotado por ahora").
// Funciones puras: no tocan la página.
// ============================================================

export const MINIMO_GRANEL = 0.5
export const UMBRAL_ULTIMAS = 5

export function normalizarUnidades(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.round(n * 1000) / 1000)
}

// ¿Se puede comprar? (true también cuando no hay dato)
export function hayStock(unidades, granel = false) {
  if (unidades === null || unidades === undefined) return true
  return granel ? unidades >= MINIMO_GRANEL : unidades > 0
}

// Tope de cantidad que se puede pedir (null = sin tope)
export function topeDe(unidades, granel = false) {
  if (unidades === null || unidades === undefined) return null
  return granel ? Math.floor(unidades * 2) / 2 : Math.floor(unidades)
}

// Estado para mostrar: { clave, texto }
export function estadoStock(unidades, granel = false) {
  if (unidades === null || unidades === undefined) return { clave: 'consultar', texto: 'Consultar disponibilidad' }
  if (!hayStock(unidades, granel)) return { clave: 'agotado', texto: 'Agotado por ahora' }
  const tope = topeDe(unidades, granel)
  if (tope <= UMBRAL_ULTIMAS) {
    if (granel) return { clave: 'ultimas', texto: `¡Últimos ${String(tope).replace('.', ',')} kg!` }
    return { clave: 'ultimas', texto: tope === 1 ? '¡Última unidad!' : `¡Últimas ${tope} unidades!` }
  }
  return { clave: 'disponible', texto: 'Disponible' }
}

// Une el catálogo (productos.json) con el stock (stock.json).
// Devuelve TODOS los productos con su stock por talla y un indicador "visible".
export function cruzarStock(productos, stock) {
  const unidades = stock?.unidades || {}
  const de = sku => (Object.prototype.hasOwnProperty.call(unidades, sku) ? normalizarUnidades(unidades[sku]) : null)
  return productos.map(p => {
    if (p.tallas) {
      const tallas = p.tallas.map(t => {
        const u = de(t.sku)
        return { ...t, unidades: u, tope: topeDe(u, false), visible: hayStock(u, false) }
      })
      const visibles = tallas.filter(t => t.visible)
      const conDato = visibles.filter(t => t.unidades !== null)
      const total = conDato.length === visibles.length && visibles.length ? conDato.reduce((s, t) => s + t.unidades, 0) : null
      return { ...p, tallas, unidades: visibles.length ? total : 0, visible: visibles.length > 0 }
    }
    const u = de(p.sku)
    return { ...p, unidades: u, tope: topeDe(u, !!p.granel), visible: hayStock(u, !!p.granel) }
  })
}
