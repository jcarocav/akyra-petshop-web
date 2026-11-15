#!/usr/bin/env node
// Vuelve a mirar las fotos de assets/productos/ (y su tipo en fotos-progreso.json) sobre el catálogo base
// (.tmp/catalogo-base.json) y reescribe productos.json + stock.json con las mismas reglas del generador:
// ajustes del catálogo y regla de publicación. No necesita el Excel.
// Un producto de Mondo, Marben o Leon Pet que estaba oculto por falta de foto se publica solo al tener foto.
// Uso: node tools/catalogo/aplicar-fotos.mjs
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tipoDeImagen } from './fotos.mjs'
import { guardarBase, leerBase, publicarYEscribir } from './proceso.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const base = leerBase()
const skuPorCodigo = new Map(base.productos.flatMap(p => (p.tallas ? p.tallas.map(t => [t.codigo, t.sku]) : [[p.codigo, p.sku]])))
const hay = sku => existsSync(join(RAIZ, 'assets', 'productos', `${sku}.webp`))

for (const p of base.productos) {
  const candidatos = [p.sku]
  if (p.granel && p.codigoSaco && skuPorCodigo.get(p.codigoSaco)) candidatos.push(skuPorCodigo.get(p.codigoSaco))
  const foto = candidatos.find(hay)
  delete p.imagen
  delete p.imagenTipo
  if (foto) { p.imagen = `assets/productos/${foto}.webp`; p.imagenTipo = tipoDeImagen(foto) }
}
guardarBase(base)
const { resumen } = publicarYEscribir(base)
console.log(`productos.json actualizado: ${resumen.publicados} publicados de ${resumen.total} · ocultos por falta de foto: ${resumen.ocultosFaltaFoto}.`)
