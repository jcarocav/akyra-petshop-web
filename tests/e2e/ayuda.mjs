// Ayudas comunes para las pruebas de navegador.
import { test as base, expect } from '@playwright/test'

export const NUMERO_TIENDA = '56986969111'

export const test = base.extend({
  // Por defecto: aviso de privacidad ya aceptado y sin salir a internet
  // (WhatsApp y Google Maps se responden con una página vacía).
  conPrivacidad: [false, { option: true }],
  // Elfsight (feed de Instagram) se bloquea salvo que la prueba pida el real
  conElfsight: [false, { option: true }],
  page: async ({ page, conPrivacidad, conElfsight }, usar) => {
    if (!conPrivacidad) {
      await page.addInitScript(() => {
        try { localStorage.setItem('akyra_privacidad_aceptada', 'true') } catch { /* sin almacenamiento */ }
      })
    }
    await page.context().route(/^https:\/\/(wa\.me|api\.whatsapp\.com|www\.google\.com|www\.instagram\.com|www\.facebook\.com)\//, r =>
      r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>externo</title>' }))
    if (!conElfsight) await page.context().route(/^https:\/\/([^/]+\.)?(elfsightcdn|elfsight)\.com\//, r => r.abort())
    await usar(page)
  }
})
export { expect }

export async function catalogo(page) {
  await page.waitForFunction(() => window.AKYRA_CATALOGO && window.AKYRA_CATALOGO.productos.length > 0)
  return page.evaluate(() => window.AKYRA_CATALOGO)
}

// Cambia productos.json y/o stock.json que recibe el navegador (sin tocar los archivos)
export async function conDatos(page, { productosExtra = [], stockExtra = {} } = {}) {
  // Si la página navega mientras se arma la respuesta, la petición vieja se descarta sin error
  const modificar = cambiar => async route => {
    try {
      const r = await route.fetch()
      const datos = cambiar(await r.json())
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) })
    } catch {
      await route.abort().catch(() => {})
    }
  }
  if (productosExtra.length) {
    await page.route('**/productos.json', modificar(d => ({ ...d, productos: [...productosExtra, ...d.productos] })))
  }
  await page.route('**/stock.json', modificar(d => ({ ...d, unidades: { ...d.unidades, ...stockExtra } })))
}

// Productos que se pueden comprar (con precio), según su tipo
export async function elegirProducto(page, criterio) {
  const datos = await catalogo(page)
  const lista = datos.productos.filter(p => {
    const conPrecio = p.tallas ? p.tallas.some(t => typeof t.precio === 'number') : typeof p.precio === 'number'
    switch (criterio) {
      case 'simple-sin-tope': return !p.tallas && !p.granel && conPrecio && p.tope === null
      case 'simple-tope-chico': return !p.tallas && !p.granel && conPrecio && p.tope !== null && p.tope >= 2 && p.tope <= 4
      case 'simple-mucho-stock': return !p.tallas && !p.granel && conPrecio && p.tope !== null && p.tope >= 10
      case 'granel': return p.granel && conPrecio && (p.tope === null || p.tope >= 2)
      case 'tallas': return p.tallas && p.tallas.length >= 2 && p.tallas.every(t => typeof t.precio === 'number')
      case 'sin-precio': return !p.tallas && !conPrecio
      default: return false
    }
  })
  if (!lista.length) throw new Error(`No hay productos para el criterio ${criterio}`)
  return lista[0]
}

// Abre el catálogo filtrado por el SKU del producto y devuelve su card
export async function abrirCard(page, producto) {
  await page.goto(`/catalogo.html?buscar=${encodeURIComponent(producto.sku)}`)
  const card = page.locator(`article.tarjeta[data-producto="${producto.id}"]`)
  await expect(card).toBeVisible()
  return card
}

export async function carritoGuardado(page) {
  await page.waitForFunction(() => document.documentElement.classList.contains('js'))
  return page.evaluate(() => JSON.parse(localStorage.getItem('akyra_carrito_v2') || '[]'))
}

export function formatoCLP(n) {
  return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export async function esMovil(page) {
  return (page.viewportSize()?.width || 1200) < 560
}
