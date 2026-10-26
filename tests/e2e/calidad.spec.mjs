// Calidad general: consola sin errores, imágenes que cargan, seguridad básica y SEO.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, test } from './ayuda.mjs'

const RAIZ = resolve(import.meta.dirname, '..', '..')
const PAGINAS = ['/index.html', '/catalogo.html', '/catalogo.html?categoria=granel', '/producto.html?id=per-fitf-008', '/contactenos.html',
  '/politica-privacidad.html', '/politica-despacho-retiro.html', '/politica-cambios-devoluciones.html', '/accesibilidad.html']

for (const ruta of PAGINAS) {
  test(`consola sin errores e imágenes sin romper: ${ruta}`, async ({ page }) => {
    const errores = []
    page.on('console', m => { if (m.type() === 'error') errores.push(m.text()) })
    page.on('pageerror', e => errores.push(String(e)))
    const fallidas = []
    page.on('response', r => { if (r.status() >= 400 && r.url().startsWith('http://localhost')) fallidas.push(`${r.status()} ${r.url()}`) })
    await page.goto(ruta)
    await page.waitForLoadState('networkidle')
    // Fuerza la carga de las imágenes diferidas y revisa que todas se vean
    await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager' }))
    await page.waitForLoadState('networkidle')
    const rotas = await page.evaluate(() => [...document.images].filter(i => i.complete && i.naturalWidth === 0 && getComputedStyle(i).display !== 'none' && i.closest('[hidden]') === null).map(i => i.src))
    expect(rotas, 'imágenes rotas').toEqual([])
    expect(fallidas, 'recursos con error').toEqual([])
    expect(errores, 'errores en consola').toEqual([])
  })
}

test('seguridad: CSP estricta, sin scripts externos ni código inline', async ({ page }) => {
  for (const archivo of ['index.html', 'catalogo.html', 'producto.html', 'contactenos.html']) {
    const html = readFileSync(join(RAIZ, archivo), 'utf8')
    expect(html).toContain('http-equiv="Content-Security-Policy"')
    expect(html).toMatch(/script-src 'self';/)
    expect(html).not.toMatch(/unsafe-inline|unsafe-eval/)
    expect(html).not.toMatch(/<script[^>]+src="https?:/) // ningún script externo
    expect(html).not.toMatch(/<script(?![^>]*(src=|type="application\/ld\+json"))[^>]*>/) // ningún script inline ejecutable
    expect(html).not.toMatch(/\son[a-z]+="/) // sin manejadores inline (onclick=...)
  }
  await page.goto('/index.html')
  const externos = await page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name).filter(u => !u.startsWith(location.origin)))
  expect(externos).toEqual([])
})

test('seguridad: el código no usa eval, innerHTML ni document.write', () => {
  for (const archivo of ['app', 'carrito', 'carrito-ui', 'componentes', 'datos', 'dialogo', 'pagina-catalogo', 'pagina-contacto', 'pagina-inicio', 'pagina-producto', 'stock', 'utilidades', 'whatsapp']) {
    const js = readFileSync(join(RAIZ, 'js', `${archivo}.mjs`), 'utf8')
    expect(js, archivo).not.toMatch(/\beval\(|new Function\(|\.innerHTML\s*=|insertAdjacentHTML|document\.write/)
  }
})

test('formulario de contacto: valida, tiene campo trampa y largo máximo', async ({ page }) => {
  await page.goto('/contactenos.html')
  await page.getByRole('button', { name: 'Enviar formulario' }).click()
  await expect(page.locator('#contacto-errores')).toBeVisible()
  await expect(page.locator('#contacto-nombre')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#contacto-mensaje')).toHaveAttribute('maxlength', '1000')
  await expect(page.locator('#contacto-sitio-web')).toHaveAttribute('tabindex', '-1')
  // Con el campo trampa lleno (robot), no hace nada
  const form = page.locator('#form-contacto')
  await form.getByLabel('Nombre *').fill('Robot')
  await form.getByLabel('Correo electrónico *').fill('robot@ejemplo.cl')
  await form.getByLabel('Mensaje *').fill('Mensaje de un robot con texto suficiente')
  await page.locator('#contacto-sitio-web').evaluate(el => { el.value = 'http://spam' })
  await page.getByRole('button', { name: 'Enviar formulario' }).click()
  await expect(page.locator('#contacto-listo')).toBeHidden()
})

test('SEO: título y descripción únicos, un solo h1, lang es-CL', async ({ page }) => {
  const titulos = new Set()
  for (const ruta of PAGINAS) {
    await page.goto(ruta)
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-CL')
    await expect(page.locator('h1:visible')).toHaveCount(1)
    const t = await page.title()
    expect(titulos.has(t), `título repetido: ${t}`).toBe(false)
    titulos.add(t)
    expect((await page.locator('meta[name="description"]').getAttribute('content')).length).toBeGreaterThan(50)
  }
})

test('sitemap, robots, security.txt y llms.txt al día', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).toContain('accesibilidad.html')
  expect(sitemap).toContain('producto.html?id=')
  const stock = JSON.parse(readFileSync(join(RAIZ, 'stock.json'), 'utf8'))
  const agotado = Object.entries(stock.unidades).find(([, v]) => v === 0)
  if (agotado) expect(sitemap).not.toContain(`id=${agotado[0].toLowerCase()}<`)
  expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap:')
  expect((await request.get('/.well-known/security.txt')).ok()).toBe(true)
  expect(await (await request.get('/llms.txt')).text()).toContain('catalogo.html')
})
