#!/usr/bin/env node
// Lighthouse (celular) usando el Chromium de Playwright, para equipos donde el
// lanzador de Lighthouse no puede abrir Chrome. Mismos umbrales que lighthouserc.cjs.
import { chromium } from '@playwright/test'
import lighthouse from 'lighthouse'
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUERTO = 4176
const UMBRALES = { performance: 0.9, accessibility: 0.95, 'best-practices': 0.95, seo: 0.95 }
const RUTAS = ['/index.html', '/catalogo.html', '/producto.html?id=gat-roya-002']

const servidor = spawn(process.execPath, [join(RAIZ, 'tools', 'servidor.mjs'), String(PUERTO)], { stdio: 'ignore' })
await new Promise(r => setTimeout(r, 800))
const navegador = await chromium.launch({ args: ['--remote-debugging-port=9333'] })
let falla = false
try {
  for (const ruta of RUTAS) {
    const corridas = []
    for (let i = 0; i < 3; i++) {
      const r = await lighthouse(`http://localhost:${PUERTO}${ruta}`, { port: 9333, output: 'json', logLevel: 'error' })
      corridas.push(Object.fromEntries(Object.keys(UMBRALES).map(k => [k, r.lhr.categories[k].score])))
      if (i === 0) {
        const malos = Object.values(r.lhr.audits).filter(a => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative').map(a => `${a.id} (${a.score})`)
        if (malos.length) console.log(`  ${ruta} — auditorías por mejorar: ${malos.slice(0, 12).join(', ')}`)
        console.log(`  ${ruta} — LCP ${r.lhr.audits['largest-contentful-paint'].displayValue}, TBT ${r.lhr.audits['total-blocking-time'].displayValue}, CLS ${r.lhr.audits['cumulative-layout-shift'].displayValue}`)
      }
    }
    const mediana = Object.fromEntries(Object.keys(UMBRALES).map(k => [k, corridas.map(c => c[k]).sort((a, b) => a - b)[1]]))
    const texto = Object.entries(mediana).map(([k, v]) => `${k} ${Math.round(v * 100)}`).join(' · ')
    const ok = Object.entries(UMBRALES).every(([k, min]) => mediana[k] >= min)
    if (!ok) falla = true
    console.log(`${ok ? '✓' : '✗'} ${ruta}: ${texto}`)
  }
} finally {
  await navegador.close()
  servidor.kill()
}
process.exit(falla ? 1 : 0)
