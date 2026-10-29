#!/usr/bin/env node
// Pone en productos.json la foto (imagen) y su tipo (imagenTipo) de cada producto según lo que hay en
// assets/productos/ y en fotos-progreso.json. No toca stock.json ni lee el Excel (a diferencia de `npm run catalogo`),
// así que se puede correr sin pisar el stock del día.
// Uso: node tools/catalogo/aplicar-fotos.mjs
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { escribirCatalogo } from './escritura.mjs'
import { tipoDeImagen } from './fotos.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const datos = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8'))
const { internos } = JSON.parse(readFileSync(join(RAIZ, '.tmp', 'catalogo-interno.json'), 'utf8'))
const interno = new Map(internos.map(i => [i.sku, i]))
const skuPorCodigo = new Map(internos.map(i => [i.codigo, i.sku]))
const hay = sku => existsSync(join(RAIZ, 'assets', 'productos', `${sku}.webp`))

let con = 0
for (const p of datos.productos) {
  const candidatos = [p.sku]
  const i = interno.get(p.sku)
  if (p.granel && i?.codigoSaco && skuPorCodigo.get(i.codigoSaco)) candidatos.push(skuPorCodigo.get(i.codigoSaco))
  const foto = candidatos.find(hay)
  delete p.imagen
  delete p.imagenTipo
  if (foto) { p.imagen = `assets/productos/${foto}.webp`; p.imagenTipo = tipoDeImagen(foto); con++ }
}
escribirCatalogo(datos.productos, { fuente: datos.fuente })
console.log(`productos.json actualizado: ${con} de ${datos.productos.length} con foto.`)
