// Herramienta de revisión: guardado por dato, historial, deshacer, respaldos y conversión a ajustes del catálogo.
import { expect, test } from '@playwright/test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Revision } from '../../tools/revision/estado.mjs'
import { cambioGrande, cambiosAAjustes, formatoPrecio, leerPrecio } from '../../tools/revision/convertir.mjs'

const carpeta = () => mkdtempSync(join(tmpdir(), 'akyra-rev-'))

test('formato chileno: "12345", "12.345" y "$12.345" dan lo mismo; solo enteros positivos', () => {
  for (const t of ['12345', '12.345', '$12.345', ' $ 12.345 ', 12345]) expect(leerPrecio(t)).toBe(12345)
  for (const t of ['', 'abc', '12,5', '-300', '0', '1.2345', '12.34']) expect(leerPrecio(t)).toBeNull()
  expect(formatoPrecio(1234567)).toBe('$1.234.567')
  expect(cambioGrande(10000, 16000)).toBe(true)
  expect(cambioGrande(10000, 4000)).toBe(true)
  expect(cambioGrande(10000, 14000)).toBe(false)
  expect(cambioGrande(null, 5000)).toBe(false) // "Consultar precio" que recibe precio: sin aviso
})

test('se guarda por dato: precio desde el PC y foto desde el celular quedan los dos; el mismo dato gana el último', () => {
  const dir = carpeta()
  const r = new Revision(dir)
  r.cambiar({ sku: 'A-1', campo: 'precio', valor: 1000, dispositivo: 'PC' })
  r.cambiar({ sku: 'A-1', campo: 'foto', valor: { archivo: 'fotos/A-1.webp' }, dispositivo: 'Celular' })
  r.cambiar({ sku: 'A-1', campo: 'precio', valor: 1200, dispositivo: 'Celular' })
  const guardado = JSON.parse(readFileSync(join(dir, 'revision.json'), 'utf8'))
  expect(guardado.cambios['A-1'].precio).toMatchObject({ valor: 1200, dispositivo: 'Celular' })
  expect(guardado.cambios['A-1'].foto.valor.archivo).toBe('fotos/A-1.webp')
  const log = readFileSync(join(dir, 'historial.log'), 'utf8')
  expect(log).toMatch(/Celular · A-1 · precio: \$1\.000 → \$1\.200 \[reemplazó un cambio de PC/)
  expect(existsSync(join(dir, 'revision.json.tmp'))).toBe(false) // guardado seguro: temporal + renombrar
})

test('deshacer vuelve al valor anterior, y se valida lo que llega', () => {
  const r = new Revision(carpeta())
  r.cambiar({ sku: 'A-1', campo: 'disponibilidad', valor: 'consultar' })
  r.cambiar({ sku: 'A-1', campo: 'eliminar', valor: { motivo: 'no se vende' } })
  r.deshacer({ sku: 'A-1' })
  expect(r.valor('A-1', 'eliminar')).toBeNull()
  r.deshacer({ sku: 'A-1' })
  expect(r.datos.cambios['A-1']).toBeUndefined()
  expect(r.deshacer({ sku: 'A-1' }).ok).toBe(false)
  expect(r.cambiar({ sku: 'A-1', campo: 'precio', valor: 12.5 }).ok).toBe(false)
  expect(r.cambiar({ sku: 'A-1', campo: 'precio', valor: -3 }).ok).toBe(false)
  expect(r.cambiar({ sku: '../x', campo: 'precio', valor: 3 }).ok).toBe(false)
  expect(r.cambiar({ sku: 'A-1', campo: 'costo', valor: 3 }).ok).toBe(false)
})

test('respaldo cada 10 minutos: solo si hubo cambios, deja las últimas 5 copias y recupera un archivo dañado', () => {
  const dir = carpeta()
  const r = new Revision(dir)
  r.cambiar({ sku: 'A-1', campo: 'revisado', valor: true })
  const respaldos = join(dir, 'respaldos')
  mkdirSync(respaldos, { recursive: true })
  for (let i = 1; i <= 7; i++) writeFileSync(join(respaldos, `revision-2000010${i}-000000.json`), '{}') // copias viejas
  expect(r.respaldar()).toMatch(/^revision-\d{8}-\d{6}\.json$/)
  expect(r.respaldos()).toHaveLength(5)
  expect(r.respaldos()[0]).toBe('revision-20000104-000000.json') // se borran las más viejas
  expect(r.respaldar()).toBeNull() // sin cambios nuevos: no respalda
  // Si el archivo se daña, se usa el último respaldo
  writeFileSync(join(dir, 'revision.json'), '{ dañado')
  expect(new Revision(dir).valor('A-1', 'revisado')).toBe(true)
})

test('revisión → ajustes del catálogo (excluidos, modificados por talla, foto propia, agregados)', () => {
  const c = (valor) => ({ valor, fecha: '2026-11-15T00:00:00Z', dispositivo: 'PC' })
  const ajustes = cambiosAAjustes({
    'A-1': { eliminar: c({ motivo: 'ya no' }) },
    'A-2': { precio: c(5000), disponibilidad: c('con-stock'), foto: c({ archivo: 'fotos/A-2.webp' }), nota: c('solo para Joaquín') },
    'A-3': { 'precio@M': c(9000), 'disponibilidad@S': c('consultar') },
    'NUEVO-X': { nuevo: c(true), nombre: c('Producto Nuevo'), codigo: c('7801'), marca: c('Leon Pet'), categoria: c('gatos'), precio: c(2990) }
  })
  expect(ajustes.excluidos).toEqual({ 'A-1': { motivo: 'ya no' } })
  expect(ajustes.modificados['A-2']).toEqual({ precio: 5000, disponibilidad: 'con-stock', imagen: 'assets/productos/A-2.webp', imagenTipo: 'exacta' })
  expect(ajustes.modificados['A-3']).toEqual({ tallas: { M: { precio: 9000 }, S: { disponibilidad: 'consultar' } } })
  expect(ajustes.agregados[0]).toMatchObject({ sku: 'NUEVO-X', nombre: 'Producto Nuevo', codigo: '7801', categoria: 'gatos', precio: 2990, disponibilidad: 'consultar' })
})
