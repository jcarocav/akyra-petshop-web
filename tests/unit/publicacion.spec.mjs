// Qué se publica sin Gesnex (tools/catalogo/publicar.mjs): el stock no oculta nada; los excluidos en la
// revisión no se publican; Mondo Mascota, Marben Pets y Leon Pet sin ninguna foto no se publican.
import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { marcaConFotoObligatoria, publicarCatalogo } from '../../tools/catalogo/publicar.mjs'

const RAIZ = resolve(import.meta.dirname, '..', '..')
const FOTO = 'assets/productos/ACC-AMER-001.webp'
const prod = (sku, extra = {}) => ({ id: sku.toLowerCase(), sku, nombre: `Producto ${sku}`, marca: 'Genérico', categoria: 'accesorios', subcategoria: 'Varios', precio: 1000, codigo: `780${sku.length}`, fabricante: '', nombreExcel: `PRODUCTO ${sku}`, ...extra })

const base = {
  productos: [
    prod('A-STOCK0', { fabricante: 'Bioline', marca: 'Bioline' }),
    prod('A-MONDO-SIN', { fabricante: 'Mondo Mascota', marca: 'Mondo Mascota' }),
    prod('A-MUNDO-SIN', { fabricante: 'Buen Amigo', nombreExcel: 'ARNES MUNDO MASCOTA TALLA S' }),
    prod('A-MARBEN-REF', { fabricante: 'Marben Pets', marca: 'Marben Pets', imagen: FOTO, imagenTipo: 'referencial' }),
    prod('A-WONDER-SIN', { fabricante: 'Otro', nombreExcel: 'JUGUETE WONDER DOG HUESO' }),
    prod('A-LEON-EXA', { fabricante: 'Leon Pet', marca: 'Leon Pet', imagen: FOTO, imagenTipo: 'exacta' }),
    prod('A-LEONARDO', { fabricante: 'Leonardo', marca: 'Leonardo' }),
    prod('A-OTRA-SIN', { fabricante: 'Alfa Dog', marca: 'Alfa Dog' }),
    prod('A-TALLAS', { fabricante: 'Mondo Mascota', marca: 'Mondo Mascota', imagen: FOTO, imagenTipo: 'exacta', precio: undefined,
      tallas: [{ talla: 'S', sku: 'A-T-S', precio: 3000, codigo: '1' }, { talla: 'M', sku: 'A-T-M', precio: 3500, codigo: '2' }] })
  ],
  unidades: { 'A-STOCK0': 0, 'A-OTRA-SIN': 7, 'A-LEON-EXA': null, 'A-T-S': 0, 'A-T-M': 4 }
}
const porSku = r => new Map(r.todos.map(p => [p.sku, p]))

test('detecta todas las formas de escribir Mondo, Marben y Leon Pet (y no confunde Leonardo)', () => {
  expect(marcaConFotoObligatoria({ fabricante: 'Mondo Mascota' })).toBe('Mondo Mascota')
  expect(marcaConFotoObligatoria({ nombreExcel: 'ARNES PERRO BUEN AMIGO TALLA M MONDO (11177)' })).toBe('Mondo Mascota')
  expect(marcaConFotoObligatoria({ nombreExcel: 'SNACK TASTY FARM MARBENPETS POLLO' })).toBe('Marben Pets')
  expect(marcaConFotoObligatoria({ nombreExcel: 'ARENA CRYSTAL CAT MARBEN PET 7,6 LT' })).toBe('Marben Pets')
  expect(marcaConFotoObligatoria({ marca: 'Wonder Cat' })).toBe('Marben Pets')
  expect(marcaConFotoObligatoria({ marca: 'León Pet' })).toBe('Leon Pet')
  expect(marcaConFotoObligatoria({ fabricante: 'Leonardo' })).toBeNull()
  expect(marcaConFotoObligatoria({ fabricante: 'Bioline', nombreExcel: 'SNACK MUNDIAL' })).toBeNull()
})

test('el stock ya no oculta: stock 0 se publica como "consultar" y con stock no lleva aviso', () => {
  const r = publicarCatalogo(base)
  const p = porSku(r)
  expect(p.get('A-STOCK0').publicado).toBe(true)
  expect(r.disponibilidad['A-STOCK0']).toBe('consultar')
  expect(r.disponibilidad['A-OTRA-SIN']).toBe('con-stock')
  expect(r.disponibilidad['A-LEON-EXA']).toBe('consultar') // sin cantidad registrada
  expect(r.disponibilidad['A-T-S']).toBe('consultar')
  expect(r.disponibilidad['A-T-M']).toBe('con-stock')
  for (const v of Object.values(r.disponibilidad)) expect(['con-stock', 'consultar']).toContain(v)
})

test('Mondo / Marben / Leon Pet sin ninguna foto no se publican; con foto exacta o referencial sí', () => {
  const p = porSku(publicarCatalogo(base))
  expect(p.get('A-MONDO-SIN')).toMatchObject({ publicado: false, motivo: 'falta-foto' })
  expect(p.get('A-MUNDO-SIN')).toMatchObject({ publicado: false, motivo: 'falta-foto' })
  expect(p.get('A-WONDER-SIN')).toMatchObject({ publicado: false, motivo: 'falta-foto' })
  expect(p.get('A-MARBEN-REF')).toMatchObject({ publicado: true, imagenTipo: 'referencial' })
  expect(p.get('A-LEON-EXA').publicado).toBe(true)
  expect(p.get('A-TALLAS').publicado).toBe(true)
})

test('las demás marcas se publican aunque no tengan foto (usan la imagen de relleno)', () => {
  const r = publicarCatalogo(base)
  const otra = r.publicados.find(x => x.sku === 'A-OTRA-SIN')
  expect(otra).toBeTruthy()
  expect(otra.imagen).toBeUndefined()
  expect(r.publicados.find(x => x.sku === 'A-LEONARDO')).toBeTruthy()
})

test('productos.json solo trae campos públicos (sin código de barras, fabricante ni disponibilidad)', () => {
  const r = publicarCatalogo(base)
  for (const p of r.publicados) for (const k of ['codigo', 'fabricante', 'nombreExcel', 'publicado', 'motivo', 'disponibilidad']) expect(p).not.toHaveProperty(k)
})

test('los ajustes ganan sobre el Excel: excluido no vuelve; precio, texto y disponibilidad no vuelven al original', () => {
  const ajustes = {
    excluidos: { 'A-OTRA-SIN': { motivo: 'ya no se vende' } },
    modificados: {
      'A-STOCK0': { nombre: 'Nombre corregido', precio: 12345, disponibilidad: 'con-stock', descripcion: 'Texto nuevo' },
      'A-TALLAS': { tallas: { S: { precio: 3990, disponibilidad: 'con-stock' } } },
      'A-MONDO-SIN': { imagen: FOTO, imagenTipo: 'exacta' }
    },
    agregados: [{ sku: 'NUEVO-001', codigo: '7801234567890', nombre: 'Producto Nuevo', marca: 'Leon Pet', categoria: 'Accesorios', precio: 5000, disponibilidad: 'consultar' },
      { sku: 'NUEVO-002', codigo: '7801234567891', nombre: 'Otro Nuevo Leon Pet', marca: 'Leon Pet', categoria: 'Accesorios', precio: 5000, imagen: FOTO }]
  }
  // Se "regenera" dos veces desde la misma base (como si se volviera a leer el Excel): mismo resultado
  for (let vez = 0; vez < 2; vez++) {
    const r = publicarCatalogo(base, ajustes)
    const p = porSku(r)
    expect(p.get('A-OTRA-SIN')).toMatchObject({ publicado: false, motivo: 'eliminado' })
    expect(p.get('A-STOCK0')).toMatchObject({ nombre: 'Nombre corregido', precio: 12345, descripcion: 'Texto nuevo' })
    expect(r.disponibilidad['A-STOCK0']).toBe('con-stock')
    expect(p.get('A-TALLAS').tallas[0]).toMatchObject({ precio: 3990 })
    expect(r.disponibilidad['A-T-S']).toBe('con-stock')
    // un Mondo que recibe foto en la revisión se publica solo, sin cambiar reglas
    expect(p.get('A-MONDO-SIN')).toMatchObject({ publicado: true, imagenTipo: 'exacta' })
    // agregado de Leon Pet sin foto: no se publica; con foto: sí
    expect(p.get('NUEVO-001')).toMatchObject({ publicado: false, motivo: 'falta-foto' })
    expect(p.get('NUEVO-002')).toMatchObject({ publicado: true, nuevo: true })
  }
  expect(base.productos[0].nombre).toBe('Producto A-STOCK0') // la base no se toca
})

test('el catálogo publicado: ningún Mondo / Marben / Leon Pet usa la imagen de relleno', () => {
  const productos = JSON.parse(readFileSync(join(RAIZ, 'productos.json'), 'utf8')).productos
  const conMarca = productos.filter(marcaConFotoObligatoria)
  expect(conMarca.length).toBeGreaterThan(50)
  for (const p of conMarca) expect(p.imagen, p.sku).toBeTruthy()
  // En el PC del dueño (con el Excel) se revisa también con la columna fabricante
  const rutaBase = join(RAIZ, '.tmp', 'catalogo-base.json')
  if (existsSync(rutaBase)) {
    const publicados = new Set(productos.map(p => p.sku))
    const todos = JSON.parse(readFileSync(rutaBase, 'utf8')).productos
    for (const p of todos.filter(x => publicados.has(x.sku) && marcaConFotoObligatoria(x))) expect(publicados.has(p.sku) && !!productos.find(x => x.sku === p.sku).imagen, p.sku).toBe(true)
  }
})
