// Calendario de temas de temporada: fechas fijas, móviles, cruces de año y prioridades.
import { expect, test } from '@playwright/test'
import { enesimoDomingo, fechaChile, temaDesdeUrl, temasDelDia } from '../../js/temas.mjs'
import { TEMAS } from '../../js/temas-config.mjs'

const f = texto => { const [anio, mes, dia] = texto.split('-').map(Number); return { anio, mes, dia } }
const principal = texto => temasDelDia(f(texto)).principal?.id ?? null
const iso = ms => new Date(ms).toISOString().slice(0, 10)

test('cada tema tiene fechas válidas, prioridad y archivos en assets/temas', () => {
  const ids = new Set()
  for (const t of TEMAS) {
    expect(ids.has(t.id), `id repetido: ${t.id}`).toBe(false)
    ids.add(t.id)
    expect(typeof t.prioridad).toBe('number')
    for (const ruta of Object.values(t.decoracion || {})) expect(ruta).toMatch(/^assets\/temas\/[a-z-]+\.svg$/)
    expect(() => temasDelDia(f('2026-01-01'), { temas: [t] })).not.toThrow()
  }
})

test('fechas fijas: Fiestas Patrias, Halloween, Navidad, Año Nuevo y San Valentín', () => {
  expect(principal('2026-09-01')).toBe('fiestas-patrias')
  expect(principal('2026-09-30')).toBe('fiestas-patrias')
  expect(principal('2026-10-15')).toBe('halloween')
  expect(principal('2026-10-31')).toBe('halloween')
  expect(principal('2026-11-01')).toBe(null)
  expect(principal('2026-12-25')).toBe('navidad')
  expect(principal('2026-12-26')).toBe('ano-nuevo')
  expect(principal('2027-01-02')).toBe('ano-nuevo') // cruza el año
  expect(principal('2027-01-03')).toBe(null)
  expect(principal('2027-02-07')).toBe('san-valentin')
  expect(principal('2027-02-15')).toBe(null)
})

test('fechas móviles: Día de la Madre, del Padre y del Niño se calculan solas cada año', () => {
  expect(iso(enesimoDomingo(2026, 5, 2))).toBe('2026-05-10')
  expect(iso(enesimoDomingo(2027, 5, 2))).toBe('2027-05-09')
  expect(iso(enesimoDomingo(2026, 6, 3))).toBe('2026-06-21')
  expect(iso(enesimoDomingo(2026, 8, 2))).toBe('2026-08-09')
  expect(principal('2026-05-03')).toBe('dia-madre') // semana anterior
  expect(principal('2026-05-10')).toBe('dia-madre')
  expect(principal('2026-05-11')).toBe(null)
  expect(principal('2027-05-02')).toBe('dia-madre')
  expect(principal('2026-06-14')).toBe('dia-padre')
  expect(principal('2026-06-21')).toBe('dia-padre')
  expect(principal('2026-08-02')).toBe('dia-nino')
})

test('días de mascotas: una semana alrededor y prioridad sobre el Día del Niño', () => {
  expect(principal('2026-07-23')).toBe('dia-perro')
  expect(principal('2026-07-29')).toBe('dia-perro')
  expect(principal('2026-07-30')).toBe(null)
  // 2026: Día del Niño el domingo 9 de agosto (semana del 2 al 9) y del Gato el 8 (del 5 al 11)
  expect(principal('2026-08-04')).toBe('dia-nino')
  expect(principal('2026-08-09')).toBe('dia-gato') // se cruzan: gana la prioridad del gato
  expect(principal('2026-08-11')).toBe('dia-gato')
  expect(principal('2026-08-12')).toBe(null)
})

test('el Día del Animal se comparte con Halloween sin taparlo', () => {
  const r = temasDelDia(f('2026-10-04'))
  expect(r.principal.id).toBe('halloween')
  expect(r.detalles.map(t => t.id)).toEqual(['dia-animal'])
  expect(temasDelDia(f('2026-10-20')).detalles).toEqual([])
})

test('portada de Fiestas Patrias solo del 1 al 20 de septiembre', () => {
  expect(temasDelDia(f('2026-09-20')).portada).toBe('fiestas-patrias')
  expect(temasDelDia(f('2026-09-21')).portada).toBe(null)
  expect(temasDelDia(f('2026-09-25')).principal.id).toBe('fiestas-patrias') // la guirnalda sigue
})

test('vista previa por URL y fecha en hora de Chile', () => {
  expect(temaDesdeUrl('?tema=navidad')).toBe('navidad')
  expect(temaDesdeUrl('?tema=ninguno')).toBe('ninguno')
  expect(temaDesdeUrl('?tema=<script>')).toBe(null)
  expect(temasDelDia(f('2026-03-10'), { forzado: 'halloween' }).principal.id).toBe('halloween')
  expect(temasDelDia(f('2026-10-10'), { forzado: 'ninguno' }).principal).toBe(null)
  // 1-nov 02:00 UTC todavía es 31-oct en Punta Arenas (UTC-3)
  expect(fechaChile(new Date('2026-11-01T02:00:00Z'))).toEqual({ anio: 2026, mes: 10, dia: 31 })
})
