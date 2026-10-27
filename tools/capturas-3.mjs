#!/usr/bin/env node
// ============================================================
// Capturas antes / después de la ronda 3 (navbar, botón del catálogo, sucursales,
// Instagram, selector de granel y carrusel de marcas).
// Uso: node tools/capturas-3.mjs <url-base> <carpeta-salida>
//   ej: node tools/capturas-3.mjs http://localhost:8081 ../capturas/3-antes
// ============================================================
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const [base, salida] = process.argv.slice(2)
if (!base || !salida) {
  console.error('Uso: node tools/capturas-3.mjs <url-base> <carpeta-salida>')
  process.exit(1)
}
const carpeta = resolve(salida)
mkdirSync(carpeta, { recursive: true })

const VISTAS = {
  escritorio: { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 },
  celular: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
}
const sinError = async (fn, nombre) => { try { await fn() } catch (e) { console.log(`  (no se pudo: ${nombre}: ${e.message.split('\n')[0]})`) } }

const navegador = await chromium.launch()
for (const [vista, opciones] of Object.entries(VISTAS)) {
  const contexto = await navegador.newContext({ ...opciones, locale: 'es-CL' })
  await contexto.addInitScript(() => { try { localStorage.setItem('akyra_privacidad_aceptada', 'true') } catch { /* sin almacenamiento */ } })
  const page = await contexto.newPage()
  const foto = (nombre, destino = page, extra = {}) => destino.screenshot({ path: join(carpeta, `${vista}-${nombre}.png`), ...extra })

  await page.goto(`${base}/index.html?tema=ninguno`)
  await page.waitForLoadState('networkidle')

  if (vista === 'escritorio') {
    // Navbar con el mouse sobre una pestaña, y el botón "Ver todo el catálogo"
    await sinError(async () => {
      await page.locator('.menu__lista li:nth-child(4) a').hover()
      await page.waitForTimeout(500)
      await foto('navbar-hover', page, { clip: { x: 0, y: 0, width: 1366, height: 170 } })
      await page.mouse.move(0, 600)
      await page.waitForTimeout(400)
      await foto('boton-catalogo', page, { clip: { x: 760, y: 80, width: 606, height: 90 } })
      await page.locator('.menu__destacado a').hover()
      await page.waitForTimeout(500)
      await foto('boton-catalogo-hover', page, { clip: { x: 760, y: 80, width: 606, height: 90 } })
      await page.mouse.move(0, 600)
    }, 'navbar')
  }

  // Sucursales: con los mapas ya cargados y la fachada de Hornillas resaltando su card
  await sinError(async () => {
    const seccion = page.locator('#sucursales')
    await seccion.scrollIntoViewIfNeeded()
    await page.mouse.move(2, 2) // el mouse sobre la sección pausaría el cambio de fachadas
    await page.waitForTimeout(6000)
    if (await page.locator('.fachada').count()) {
      await page.waitForSelector('.sucursal--resaltada[data-sucursal="hornillas"]', { timeout: 15000 })
      await page.locator('.fachadas__pausa').click()
      await page.mouse.move(0, 5)
      await page.waitForTimeout(1200)
    }
    await foto('sucursales', seccion)
  }, 'sucursales')

  // Instagram (antes: la franja dentro de "Sobre Maskotería")
  await sinError(async () => {
    if (await page.locator('#instagram').count()) {
      await page.locator('#instagram').scrollIntoViewIfNeeded()
      await page.waitForTimeout(14000) // el feed es de un tercero: se le da tiempo de pintar
      await foto('instagram', page.locator('#instagram'))
    } else {
      await foto('instagram', page.locator('#nosotros'))
    }
  }, 'instagram')

  // Carrusel de marcas (quieto)
  await sinError(async () => {
    await page.locator('#marcas').scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)
    const pausa = page.locator('#marcas .cinta__pausa')
    if (await pausa.isVisible()) await pausa.click()
    await page.mouse.move(0, 5)
    await page.waitForTimeout(500)
    await foto('marcas', page.locator('#marcas'))
  }, 'marcas')

  // Selector de granel: card con 1,3 kg escrito a mano (antes: la card tal cual)
  await sinError(async () => {
    await page.goto(`${base}/catalogo.html?categoria=granel`)
    const card = page.locator('article.tarjeta').first()
    await card.waitFor()
    await card.scrollIntoViewIfNeeded()
    const campo = card.locator('.cantidad__campo')
    await campo.fill('1,3')
    await campo.press('Enter')
    await page.waitForTimeout(400)
    await foto('granel', card)
  }, 'granel')
  await contexto.close()
}
await navegador.close()
console.log(`Capturas en ${carpeta}`)
