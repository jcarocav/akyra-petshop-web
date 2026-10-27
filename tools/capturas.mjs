#!/usr/bin/env node
// ============================================================
// Capturas para comparar versiones (antes / después) del sitio.
// Uso: node tools/capturas.mjs <url-base> <carpeta-salida> [--tema halloween]
//   ej: node tools/capturas.mjs http://localhost:8081 ../capturas/antes
// Saca, en escritorio (1366 px) y celular (390 px): cabecera, carrito abierto
// con un producto, botón flotante de WhatsApp e inicio completo.
// ============================================================
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const [base, salida] = process.argv.slice(2)
if (!base || !salida) {
  console.error('Uso: node tools/capturas.mjs <url-base> <carpeta-salida> [--tema nombre]')
  process.exit(1)
}
const i = process.argv.indexOf('--tema')
const tema = i > 0 ? process.argv[i + 1] : null
const carpeta = resolve(salida)
mkdirSync(carpeta, { recursive: true })

const VISTAS = {
  escritorio: { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 },
  celular: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
}

const navegador = await chromium.launch()
for (const [nombre, opciones] of Object.entries(VISTAS)) {
  const contexto = await navegador.newContext({ ...opciones, locale: 'es-CL', reducedMotion: 'reduce' })
  await contexto.addInitScript(() => {
    try { localStorage.setItem('akyra_privacidad_aceptada', 'true') } catch { /* sin almacenamiento */ }
  })
  await contexto.route(/^https:\/\/(?!localhost)/, r => r.abort())
  const pagina = await contexto.newPage()
  const archivo = parte => join(carpeta, `${nombre}-${parte}.png`)
  const url = tema ? `${base}/index.html?tema=${tema}` : `${base}/index.html`
  await pagina.goto(url, { waitUntil: 'networkidle' })
  await pagina.evaluate(() => document.fonts.ready)

  await pagina.locator('.cabecera').screenshot({ path: archivo('cabecera') })
  const tamano = pagina.viewportSize()
  await pagina.screenshot({ path: archivo('whatsapp'), clip: { x: tamano.width - 120, y: tamano.height - 120, width: 120, height: 120 } })
  await pagina.screenshot({ path: archivo('pantalla'), fullPage: false })
  // Recorre la página para que carguen las imágenes diferidas (loading="lazy")
  await pagina.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)) }
    window.scrollTo(0, 0)
  })
  await pagina.waitForLoadState('networkidle')
  await pagina.screenshot({ path: archivo('inicio-completo'), fullPage: true })
  const secciones = await pagina.locator('main > section, main > div > section, footer').all()
  let n = 0
  for (const s of secciones) {
    if (!(await s.isVisible())) continue
    const id = (await s.getAttribute('id')) || (await s.evaluate(e => e.className.split(' ')[0]))
    await s.screenshot({ path: archivo(`seccion-${String(++n).padStart(2, '0')}-${id}`) })
  }

  // Carrito con un producto
  const anadir = pagina.locator('#destacados button:has-text("Añadir"):not([aria-disabled="true"])').first()
  if (await anadir.count()) {
    await anadir.evaluate(b => b.click())
    await pagina.waitForTimeout(300)
  }
  await pagina.locator('#boton-carrito').click()
  await pagina.waitForTimeout(400)
  await pagina.screenshot({ path: archivo('carrito') })
  await contexto.close()
}
await navegador.close()
console.log(`Capturas guardadas en ${carpeta}`)
