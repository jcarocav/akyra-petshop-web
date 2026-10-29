#!/usr/bin/env node
// Capturas antes / después de las categorías con foto y el hero más bajo.
// Uso: node tools/capturas-4.mjs <url-base> <carpeta-salida>
//   ej: node tools/capturas-4.mjs http://localhost:8081 ../capturas/4-antes
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const [base, salida] = process.argv.slice(2)
if (!base || !salida) { console.error('Uso: node tools/capturas-4.mjs <url-base> <carpeta-salida>'); process.exit(1) }
const carpeta = resolve(salida)
mkdirSync(carpeta, { recursive: true })
const VISTAS = {
  '1366x768': { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
  '1920x1080': { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  celular: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
}
const navegador = await chromium.launch()
for (const [vista, opciones] of Object.entries(VISTAS)) {
  const contexto = await navegador.newContext({ ...opciones, locale: 'es-CL', reducedMotion: 'reduce' })
  await contexto.addInitScript(() => { try { localStorage.setItem('akyra_privacidad_aceptada', 'true') } catch { /* sin almacenamiento */ } })
  const page = await contexto.newPage()
  await page.goto(`${base}/index.html?tema=ninguno`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(carpeta, `${vista}-hero.png`) })
  const medidas = await page.evaluate(() => ({ hero: Math.round(document.querySelector('.hero').getBoundingClientRect().height), finFranja: Math.round(document.querySelector('.atajos').getBoundingClientRect().bottom) }))
  console.log(vista, JSON.stringify(medidas))
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager' }))
  await page.locator('#categorias').scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  await page.locator('#categorias').screenshot({ path: join(carpeta, `${vista}-categorias.png`) })
  await contexto.close()
}
await navegador.close()
