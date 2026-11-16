// ============================================================
// REVISIÓN DEL CATÁLOGO — archivo de cambios (revision-catalogo/revision.json).
//
// Los cambios se guardan POR DATO: cambios[SKU][campo] = { valor, fecha, dispositivo }.
// Si Rosa cambia el precio mientras el celular sube la foto del mismo producto, quedan las dos cosas.
// Solo si dos dispositivos cambian el MISMO dato gana el último, y queda anotado en historial.log.
//
// Campos: eliminar ({ motivo }), revisado (true), nombre, marca, descripcion, categoria, subcategoria,
//   precio, precio@<talla>, disponibilidad, disponibilidad@<talla>, nota, foto ({ archivo, original, ... }).
//   Productos nuevos: SKU "NUEVO-…" con nuevo: true, codigo, tallas ([{ talla, precio, disponibilidad }]), granel.
// valor null = se quita el cambio (vuelve al dato original).
//
// Seguridad del archivo: se escribe a un temporal y se renombra (nunca queda a medio guardar);
// respaldo automático cada 10 minutos (las últimas 5 copias en revision-catalogo/respaldos/).
// ============================================================
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// 'Propuesta' = cambios precargados desde el Word de la dueña y la lista de Joaquín (para que Rosa los confirme)
export const DISPOSITIVOS = ['PC', 'Celular', 'Propuesta']
const CAMPO_VALIDO = /^(eliminar|revisado|nombre|marca|descripcion|categoria|subcategoria|precio|disponibilidad|nota|foto|nuevo|codigo|tallas|granel)(@[^\s@]{1,12})?$/
const MAX_PILA = 60
const RESPALDOS = 5

function estadoVacio() {
  const ahora = new Date().toISOString()
  return { version: 0, creado: ahora, actualizado: ahora, cambios: {}, pila: {}, resumen: null }
}

const fechaLocal = (d = new Date()) => {
  const p = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Punta_Arenas', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .formatToParts(d).reduce((o, x) => ({ ...o, [x.type]: x.value }), {})
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`
}

// Texto corto de un valor para el historial ("$12.345", "Disponible", …)
export function describirValor(campo, valor) {
  if (valor === null || valor === undefined) return '(original)'
  const base = campo.split('@')[0]
  if (base === 'precio' && typeof valor === 'number') return '$' + String(valor).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  if (base === 'disponibilidad') return valor === 'con-stock' ? 'Disponible' : 'Consultar disponibilidad'
  if (base === 'eliminar') return `eliminar${valor.motivo ? ` (${valor.motivo})` : ''}`
  if (base === 'foto') return valor.archivo || 'foto'
  if (typeof valor === 'object') return JSON.stringify(valor).slice(0, 120)
  return String(valor).slice(0, 120)
}

export function validarCambio({ sku, campo, valor }) {
  if (typeof sku !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,40}$/.test(sku)) return 'SKU no válido'
  if (typeof campo !== 'string' || !CAMPO_VALIDO.test(campo)) return 'Dato no válido'
  if (valor === null) return null
  const base = campo.split('@')[0]
  if (base === 'precio' && !(Number.isInteger(valor) && valor > 0 && valor < 100000000)) return 'El precio debe ser un número entero positivo'
  if (base === 'disponibilidad' && !['con-stock', 'consultar'].includes(valor)) return 'Disponibilidad no válida'
  if (['nombre', 'marca', 'descripcion', 'categoria', 'subcategoria', 'nota', 'codigo'].includes(base) && (typeof valor !== 'string' || valor.length > 600)) return 'Texto no válido'
  if (base === 'eliminar' && (typeof valor !== 'object' || (valor.motivo && String(valor.motivo).length > 200))) return 'Motivo no válido'
  if (['revisado', 'nuevo', 'granel'].includes(base) && typeof valor !== 'boolean') return 'Valor no válido'
  if (base === 'tallas' && !Array.isArray(valor)) return 'Tallas no válidas'
  return null
}

export class Revision {
  constructor(carpeta, { alCambiar = () => {} } = {}) {
    this.carpeta = carpeta
    this.ruta = join(carpeta, 'revision.json')
    this.rutaHistorial = join(carpeta, 'historial.log')
    this.carpetaRespaldos = join(carpeta, 'respaldos')
    this.alCambiar = alCambiar
    mkdirSync(carpeta, { recursive: true })
    this.datos = this.leer()
    this.versionRespaldada = this.datos.version
  }

  leer() {
    if (!existsSync(this.ruta)) return estadoVacio()
    try {
      return { ...estadoVacio(), ...JSON.parse(readFileSync(this.ruta, 'utf8')) }
    } catch {
      // Archivo dañado (no debería pasar por el guardado seguro): se usa el último respaldo
      const respaldo = this.respaldos().at(-1)
      if (respaldo) return { ...estadoVacio(), ...JSON.parse(readFileSync(join(this.carpetaRespaldos, respaldo), 'utf8')) }
      return estadoVacio()
    }
  }

  // Guardado seguro: temporal + renombrar
  guardar() {
    this.datos.actualizado = new Date().toISOString()
    const temporal = this.ruta + '.tmp'
    writeFileSync(temporal, JSON.stringify(this.datos, null, 1))
    renameSync(temporal, this.ruta)
  }

  registrar(texto) {
    appendFileSync(this.rutaHistorial, `${fechaLocal()} · ${texto}\n`)
  }

  // Cambia UN dato. Devuelve { ok, version, evento } o { ok: false, error }.
  cambiar({ sku, campo, valor, dispositivo = 'PC', nombre = '' }, { apilar = true, etiqueta = '' } = {}) {
    const error = validarCambio({ sku, campo, valor })
    if (error) return { ok: false, error }
    const disp = DISPOSITIVOS.includes(dispositivo) ? dispositivo : 'PC'
    const cambios = this.datos.cambios[sku] || (this.datos.cambios[sku] = {})
    const anterior = cambios[campo]
    const ahora = new Date().toISOString()
    if (valor === null) delete cambios[campo]
    else cambios[campo] = { valor, fecha: ahora, dispositivo: disp }
    if (!Object.keys(cambios).length) delete this.datos.cambios[sku]
    if (apilar) {
      const pila = this.datos.pila[sku] || (this.datos.pila[sku] = [])
      pila.push({ campo, anterior: anterior ? anterior.valor : null, fecha: ahora, dispositivo: disp })
      if (pila.length > MAX_PILA) pila.shift()
    }
    this.datos.version++
    this.guardar()
    const pisado = anterior && anterior.dispositivo !== disp && valor !== null ? ` [reemplazó un cambio de ${anterior.dispositivo} del ${fechaLocal(new Date(anterior.fecha))}]` : ''
    this.registrar(`${disp} · ${sku}${nombre ? ` (${nombre})` : ''} · ${campo}: ${describirValor(campo, anterior?.valor)} → ${describirValor(campo, valor)}${pisado}${etiqueta ? ` (${etiqueta})` : apilar ? '' : ' (deshacer)'}`)
    const evento = { tipo: 'cambio', version: this.datos.version, sku, campo, valor: valor === null ? null : cambios[campo] || null, dispositivo: disp, pila: this.datos.pila[sku]?.length || 0 }
    this.alCambiar(evento)
    return { ok: true, version: this.datos.version, evento }
  }

  // Deshace la última acción hecha sobre ese producto (venga del dispositivo que venga).
  deshacer({ sku, dispositivo = 'PC', nombre = '' }) {
    const pila = this.datos.pila[sku]
    if (!pila || !pila.length) return { ok: false, error: 'No hay nada que deshacer en este producto' }
    const ultimo = pila.pop()
    if (!pila.length) delete this.datos.pila[sku]
    const r = this.cambiar({ sku, campo: ultimo.campo, valor: ultimo.anterior, dispositivo, nombre }, { apilar: false, etiqueta: 'deshacer' })
    return { ...r, campo: ultimo.campo }
  }

  valor(sku, campo) {
    return this.datos.cambios[sku]?.[campo]?.valor ?? null
  }

  // ---- Respaldos (cada 10 minutos, últimas 5) ----
  respaldos() {
    if (!existsSync(this.carpetaRespaldos)) return []
    return readdirSync(this.carpetaRespaldos).filter(f => /^revision-\d{8}-\d{6}\.json$/.test(f)).sort()
  }

  respaldar({ forzar = false } = {}) {
    if (!existsSync(this.ruta)) return null
    if (!forzar && this.datos.version === this.versionRespaldada) return null
    mkdirSync(this.carpetaRespaldos, { recursive: true })
    const nombre = `revision-${fechaLocal().replace(/[-: ]/g, '').replace(/^(\d{8})(\d{6})$/, '$1-$2')}.json`
    copyFileSync(this.ruta, join(this.carpetaRespaldos, nombre))
    this.versionRespaldada = this.datos.version
    const lista = this.respaldos()
    for (const viejo of lista.slice(0, Math.max(0, lista.length - RESPALDOS))) unlinkSync(join(this.carpetaRespaldos, viejo))
    return nombre
  }

  iniciarRespaldos(minutos = 10) {
    this.temporizador = setInterval(() => { try { this.respaldar() } catch (e) { console.error('Respaldo:', e.message) } }, minutos * 60000)
    this.temporizador.unref?.()
  }

  guardarResumen(resumen) {
    this.datos.resumen = resumen
    this.guardar()
  }
}
