// ============================================================
// Fotos de la revisión: cola de procesamiento (una a la vez, sin trabar la herramienta).
// Por cada foto subida se arman DOS versiones (.webp cuadradas de máx. 800 px y < 60 KB):
//   - "procesada": sin fondo (rembg), fondo blanco puro, producto centrado con margen parejo;
//   - "simple": la misma foto sin quitar el fondo (para bolsas transparentes, peluches…).
// Ambas: rotación corregida (EXIF) y brillo corregido si la foto está oscura.
// rembg y zxing-cpp corren en Python (tools/revision/trabajador.py), en procesos que quedan abiertos.
// Sin Python/rembg la herramienta sigue funcionando: la "procesada" sale sin quitar el fondo y se avisa.
// ============================================================
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'
import sharp from 'sharp'

const AQUI = dirname(fileURLToPath(import.meta.url))
export const LADO = 800
export const MAXIMO_BYTES = 60 * 1024
const MARGEN = 0.08

// ---------- Trabajador de Python ----------
class Trabajador {
  constructor(modo) {
    this.modo = modo
    this.pendientes = new Map()
    this.contador = 0
    this.listo = this.iniciar()
  }

  iniciar() {
    return new Promise(resolver => {
      const python = process.env.AKYRA_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
      let proceso
      try {
        proceso = spawn(python, ['-X', 'utf8', join(AQUI, 'trabajador.py'), this.modo], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
      } catch (e) { resolver({ listo: false, error: e.message }); return }
      this.proceso = proceso
      let primera = true
      proceso.on('error', e => { if (primera) { primera = false; resolver({ listo: false, error: e.message }) } })
      proceso.on('exit', () => {
        if (primera) { primera = false; resolver({ listo: false, error: 'Python no está instalado' }) }
        for (const [, p] of this.pendientes) p({ ok: false, error: 'El proceso de Python se cerró' })
        this.pendientes.clear()
        this.proceso = null
      })
      proceso.stderr.on('data', () => {}) // avisos de onnxruntime, etc.
      createInterface({ input: proceso.stdout }).on('line', linea => {
        let datos
        try { datos = JSON.parse(linea) } catch { return }
        if (primera) { primera = false; resolver(datos); return }
        const fn = this.pendientes.get(datos.id)
        if (fn) { this.pendientes.delete(datos.id); fn(datos) }
      })
    })
  }

  async pedir(orden, espera = 180000) {
    const estado = await this.listo
    if (!estado.listo || !this.proceso) return { ok: false, error: estado.error || 'No disponible' }
    const id = ++this.contador
    return new Promise(resolver => {
      const reloj = setTimeout(() => { this.pendientes.delete(id); resolver({ ok: false, error: 'Tardó demasiado' }) }, espera)
      this.pendientes.set(id, r => { clearTimeout(reloj); resolver(r) })
      this.proceso.stdin.write(JSON.stringify({ ...orden, id }) + '\n')
    })
  }

  cerrar() { this.proceso?.kill() }
}

let fondo = null
let codigo = null
const trabajadorFondo = () => (fondo ||= new Trabajador('fondo'))
const trabajadorCodigo = () => (codigo ||= new Trabajador('codigo'))
export function cerrarTrabajadores() { fondo?.cerrar(); codigo?.cerrar() }
export async function rembgDisponible() { return (await trabajadorFondo().listo).listo === true }

// ---------- Imagen ----------
// WebP bajo 60 KB: se baja la calidad de a poco
export async function webpLiviano(entrada) {
  let calidad = 84
  let buffer
  do {
    buffer = await sharp(entrada).webp({ quality: calidad, effort: 5 }).toBuffer()
    calidad -= 8
  } while (buffer.length > MAXIMO_BYTES && calidad >= 28)
  if (buffer.length > MAXIMO_BYTES) buffer = await sharp(entrada).resize(640, 640).webp({ quality: 50 }).toBuffer()
  return buffer
}

// Rotación EXIF + brillo si está oscura. Devuelve un buffer PNG (máx. 1600 px para trabajar rápido).
export async function prepararOriginal(bufferOriginal) {
  const rotada = await sharp(bufferOriginal).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).toBuffer()
  const { channels } = await sharp(rotada).greyscale().stats()
  const media = channels[0].mean
  if (media < 105) {
    const factor = Math.min(1.7, 135 / Math.max(media, 20))
    return { buffer: await sharp(rotada).modulate({ brightness: factor }).png().toBuffer(), aclarada: true }
  }
  return { buffer: await sharp(rotada).png().toBuffer(), aclarada: false }
}

// Versión "sin quitar fondo": cuadrada, foto completa centrada sobre blanco
export async function versionSimple(buffer) {
  const cuadrada = await sharp(await sharp(buffer).resize(LADO, LADO, { fit: 'contain', background: '#ffffff' }).png().toBuffer()).flatten({ background: '#ffffff' }).removeAlpha().png().toBuffer()
  return webpLiviano(cuadrada)
}

// PNG con transparencia (rembg) → recorte al producto, margen parejo, fondo blanco, cuadrada
export async function versionSinFondo(pngTransparente) {
  const recortada = await sharp(pngTransparente).trim({ threshold: 10 }).png().toBuffer().catch(() => pngTransparente)
  const { width, height } = await sharp(recortada).metadata()
  const lado = Math.ceil(Math.max(width, height) / (1 - 2 * MARGEN))
  // (en dos pasos: sharp hace el resize antes que el extend si van en la misma cadena)
  const conMargen = await sharp(recortada)
    .extend({ top: Math.floor((lado - height) / 2), bottom: Math.ceil((lado - height) / 2), left: Math.floor((lado - width) / 2), right: Math.ceil((lado - width) / 2), background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png().toBuffer()
  const cuadrada = await sharp(conMargen).flatten({ background: '#ffffff' }).resize(LADO, LADO, { fit: 'fill' }).removeAlpha().png().toBuffer()
  return webpLiviano(cuadrada)
}

// Procesa una foto: escribe <destino>-procesada.webp y <destino>-simple.webp. Devuelve { procesada, simple, sinFondo, aviso }
export async function procesarFoto(bufferOriginal, destinoBase) {
  mkdirSync(dirname(destinoBase), { recursive: true })
  const { buffer, aclarada } = await prepararOriginal(bufferOriginal)
  const simple = await versionSimple(buffer)
  writeFileSync(`${destinoBase}-simple.webp`, simple)
  let procesada = simple
  let sinFondo = false
  let aviso = null
  const temporalEntrada = `${destinoBase}-entrada.png`
  const temporalSalida = `${destinoBase}-recorte.png`
  writeFileSync(temporalEntrada, buffer)
  const r = await trabajadorFondo().pedir({ entrada: temporalEntrada, salida: temporalSalida })
  if (r.ok && existsSync(temporalSalida)) {
    procesada = await versionSinFondo(temporalSalida)
    sinFondo = true
  } else aviso = 'No se pudo quitar el fondo en este computador (falta rembg): se usa la foto sin quitar el fondo.'
  for (const t of [temporalEntrada, temporalSalida]) if (existsSync(t)) unlinkSync(t)
  writeFileSync(`${destinoBase}-procesada.webp`, procesada)
  return { procesada: `${destinoBase}-procesada.webp`, simple: `${destinoBase}-simple.webp`, sinFondo, aclarada, aviso, bytes: procesada.length }
}

// Lee los códigos de barras de una foto. Devuelve { ok, codigos: [] }
export async function leerCodigoBarras(bufferFoto, carpetaTemporal) {
  mkdirSync(carpetaTemporal, { recursive: true })
  const ruta = join(carpetaTemporal, `codigo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`)
  writeFileSync(ruta, await sharp(bufferFoto).rotate().resize(2000, 2000, { fit: 'inside', withoutEnlargement: true }).png().toBuffer())
  const r = await trabajadorCodigo().pedir({ entrada: ruta }, 30000)
  if (existsSync(ruta)) unlinkSync(ruta)
  return { ok: !!r.ok, codigos: r.codigos || [], error: r.ok ? null : r.error }
}

// ---------- Cola ----------
export class ColaFotos {
  constructor(procesar) {
    this.procesar = procesar
    this.lista = []
    this.trabajando = false
  }

  agregar(tarea) {
    return new Promise((resolver, rechazar) => {
      this.lista.push({ tarea, resolver, rechazar })
      this.siguiente()
    })
  }

  get largo() { return this.lista.length + (this.trabajando ? 1 : 0) }

  async siguiente() {
    if (this.trabajando || !this.lista.length) return
    this.trabajando = true
    const { tarea, resolver, rechazar } = this.lista.shift()
    try { resolver(await this.procesar(tarea)) } catch (e) { rechazar(e) } finally {
      this.trabajando = false
      setImmediate(() => this.siguiente())
    }
  }
}
