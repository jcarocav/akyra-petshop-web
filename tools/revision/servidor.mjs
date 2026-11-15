#!/usr/bin/env node
// ============================================================
// HERRAMIENTA DE REVISIÓN DEL CATÁLOGO (con Rosa en el PC y Joaquín en el celular).
// Se abre con doble clic en REVISAR-CATALOGO.bat (carpeta akyra-petshop). No cambia el sitio publicado:
// todo se guarda en akyra-petshop/revision-catalogo/ (fuera del repositorio).
//
// Seguridad: solo responde a la red local (Wi-Fi de la casa o zona Wi-Fi del celular) y solo con la clave
// aleatoria de esta sesión (cambia cada vez que se abre). Sin la clave → 403. Nada queda expuesto a internet.
//
// Opciones (para pruebas): PORT, AKYRA_CLAVE, AKYRA_REVISION_DIR, AKYRA_BASE (catálogo JSON en vez del Excel),
// AKYRA_EXCEL, --sin-navegador.
// ============================================================
import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { basename, dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import { publicarCatalogo } from '../catalogo/publicar.mjs'
import { CATEGORIAS } from '../catalogo/reglas.mjs'
import { Revision } from './estado.mjs'
import { ColaFotos, cerrarTrabajadores, leerCodigoBarras, procesarFoto, rembgDisponible } from './fotos.mjs'
import { exportarTodo } from './exportar.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(AQUI, '..', '..')
let PUERTO = Number(process.env.PORT ?? 8090) // 0 = uno libre (pruebas)
const CLAVE = process.env.AKYRA_CLAVE || randomBytes(12).toString('hex')
const DATOS = resolve(process.env.AKYRA_REVISION_DIR || join(RAIZ, '..', 'revision-catalogo'))
const FOTOS = join(DATOS, 'fotos')
const MAX_FOTO = 30 * 1024 * 1024
const SIN_NAVEGADOR = process.argv.includes('--sin-navegador')

// ---------- Red local ----------
export function esRedLocal(direccion = '') {
  const ip = direccion.replace(/^::ffff:/, '')
  if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('127.')) return true
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true
  const m = ip.match(/^172\.(\d+)\./)
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true
  if (/^f[cd][0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip)) return true
  return false
}
const esEsteEquipo = d => ['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(d)

export function direccionesLocales() {
  const salida = []
  for (const [nombre, lista] of Object.entries(networkInterfaces())) {
    if (/vethernet|virtualbox|vmware|wsl|hyper-v|loopback|docker|tailscale|zerotier|bluetooth|vpn/i.test(nombre)) continue
    for (const d of lista || []) {
      if (d.family !== 'IPv4' || d.internal || !esRedLocal(d.address) || d.address.startsWith('169.254.')) continue
      salida.push({ nombre, ip: d.address })
    }
  }
  // Wi-Fi primero (es la que usa el celular)
  return salida.sort((a, b) => (/wi-?fi|wlan|inal/i.test(b.nombre) ? 1 : 0) - (/wi-?fi|wlan|inal/i.test(a.nombre) ? 1 : 0))
}

let perfilRed = null // { nombre, categoria } en Windows
function revisarPerfilRed() {
  if (process.platform !== 'win32') return
  execFile('powershell', ['-NoProfile', '-Command', 'Get-NetConnectionProfile | Select-Object Name,InterfaceAlias,NetworkCategory | ConvertTo-Json -Compress'], { windowsHide: true, timeout: 15000 }, (error, salida) => {
    if (error) return
    try {
      const lista = [JSON.parse(salida)].flat()
      perfilRed = lista.map(p => ({ nombre: p.Name, interfaz: p.InterfaceAlias, categoria: ['Public', 'Private', 'DomainAuthenticated'][p.NetworkCategory] ?? String(p.NetworkCategory) }))
    } catch { /* sin datos */ }
  })
}

// ---------- Catálogo ----------
function buscarExcel() {
  if (process.env.AKYRA_EXCEL) return resolve(process.env.AKYRA_EXCEL)
  const carpetas = [RAIZ, resolve(RAIZ, '..')]
  const candidatos = carpetas.flatMap(c => readdirSync(c).filter(f => /^Inventario.*\.xlsx$/i.test(f) && !f.startsWith('~$') && !/_precios\.xlsx$/i.test(f)).map(f => join(c, f)))
  return candidatos.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] || null
}

async function cargarCatalogo() {
  const excel = buscarExcel()
  if (process.env.AKYRA_BASE) {
    const base = JSON.parse(readFileSync(process.env.AKYRA_BASE, 'utf8'))
    return { base, codigosBaseRosa: base.codigosBaseRosa || [], excel }
  }
  if (!excel) throw new Error('No encontré el Excel de inventario (Inventario*.xlsx) en la carpeta akyra-petshop.')
  const { leerExcel, construirCatalogo } = await import('../generar-catalogo.mjs')
  const datos = await leerExcel(excel)
  const { productos, stock } = construirCatalogo(datos)
  const codigosBaseRosa = [...datos.maestro.values()].map(m => ({ codigo: m.codigo, nombre: m.nombreExcel }))
  return { base: { fuente: basename(excel), productos, unidades: stock }, codigosBaseRosa, excel }
}

function leerAjustesRepo() {
  const ruta = join(RAIZ, 'tools', 'catalogo', 'ajustes-catalogo.json')
  return existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : null
}

// ---------- Utilidades HTTP ----------
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }
const CSP = "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"

function enviarJson(res, codigo, datos) {
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(datos))
}

function enviarArchivo(res, ruta, { cache = 'no-store' } = {}) {
  if (!existsSync(ruta) || !statSync(ruta).isFile()) { res.writeHead(404); res.end('No encontrado'); return }
  res.writeHead(200, { 'Content-Type': TIPOS[extname(ruta).toLowerCase()] || 'application/octet-stream', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': CSP, 'Referrer-Policy': 'no-referrer' })
  createReadStream(ruta).pipe(res)
}

// Ruta segura dentro de una carpeta (sin salir con ../)
function dentroDe(carpeta, relativa) {
  const ruta = normalize(join(carpeta, decodeURIComponent(relativa)))
  return ruta.startsWith(carpeta + sep) ? ruta : null
}

function leerCuerpo(req, limite) {
  return new Promise((resolver, rechazar) => {
    const partes = []
    let largo = 0
    req.on('data', d => {
      largo += d.length
      if (largo > limite) { rechazar(new Error('Archivo demasiado grande')); req.destroy(); return }
      partes.push(d)
    })
    req.on('end', () => resolver(Buffer.concat(partes)))
    req.on('error', rechazar)
  })
}
const leerJson = async req => JSON.parse((await leerCuerpo(req, 1024 * 1024)).toString('utf8') || '{}')

function claveDe(req, url) {
  const q = url.searchParams.get('clave')
  if (q) return q
  const cookie = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('akyra_clave='))
  return cookie ? decodeURIComponent(cookie.slice('akyra_clave='.length)) : null
}

function dispositivoDe(req, url) {
  const pedido = req.headers['x-dispositivo'] || url.searchParams.get('dispositivo')
  if (pedido === 'PC' || pedido === 'Celular') return pedido
  return esEsteEquipo(req.socket.remoteAddress) ? 'PC' : 'Celular'
}

const fechaArchivo = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)

// ============================================================
export async function iniciar() {
  mkdirSync(join(FOTOS, 'originales'), { recursive: true })
  mkdirSync(join(FOTOS, 'pendientes'), { recursive: true })
  const clientes = new Set() // { res, dispositivo }
  const emitir = evento => {
    const texto = `data: ${JSON.stringify(evento)}\n\n`
    for (const c of clientes) c.res.write(texto)
  }
  const presencia = () => ({ tipo: 'presencia', PC: [...clientes].some(c => c.dispositivo === 'PC'), Celular: [...clientes].some(c => c.dispositivo === 'Celular') })
  const revision = new Revision(DATOS, { alCambiar: emitir })
  revision.iniciarRespaldos(10)

  console.log('Leyendo el catálogo…')
  const { base, codigosBaseRosa, excel } = await cargarCatalogo()
  const ajustesRepo = leerAjustesRepo()
  const originales = publicarCatalogo(base, ajustesRepo || undefined).todos
  const porSku = new Map(originales.map(p => [p.sku, p]))
  const nombreDe = sku => porSku.get(sku)?.nombre || revision.valor(sku, 'nombre') || ''
  const existe = sku => porSku.has(sku) || revision.valor(sku, 'nuevo') === true
  revisarPerfilRed()
  const rembg = rembgDisponible() // empieza a cargar Python de inmediato

  // ---- Fotos ----
  const nombreArchivoFoto = sku => {
    const p = porSku.get(sku)
    const codigo = p ? null : revision.valor(sku, 'codigo')
    return (p ? sku : (codigo && /^\d{6,14}$/.test(codigo) ? codigo : sku)).replace(/[^A-Za-z0-9-]/g, '')
  }
  const cola = new ColaFotos(async ({ sku, buffer, dispositivo, id }) => {
    const nombre = nombreArchivoFoto(sku)
    const destinoBase = join(FOTOS, 'pendientes', `${nombre}-${id}`)
    const r = await procesarFoto(buffer, destinoBase)
    const actual = revision.valor(sku, 'foto')
    if (!actual || actual.id !== id) return null // la cambiaron o la descartaron mientras se procesaba
    copyFileSync(r.procesada, join(FOTOS, `${nombre}.webp`))
    revision.cambiar({
      sku, campo: 'foto', dispositivo, nombre: nombreDe(sku),
      valor: { ...actual, estado: 'lista', archivo: `fotos/${nombre}.webp`, procesada: `fotos/pendientes/${basename(r.procesada)}`, simple: `fotos/pendientes/${basename(r.simple)}`, eleccion: 'procesada', sinFondo: r.sinFondo, aviso: r.aviso, bytes: r.bytes, listaEn: new Date().toISOString() }
    }, { apilar: false, etiqueta: r.sinFondo ? 'foto procesada' : 'foto procesada sin quitar el fondo' })
    return r
  })

  async function recibirFoto({ sku, buffer, extension, dispositivo }) {
    const id = randomBytes(4).toString('hex')
    const nombre = nombreArchivoFoto(sku)
    const original = `fotos/originales/${nombre}-${fechaArchivo()}-${id}.${extension}`
    writeFileSync(join(DATOS, original), buffer)
    const r = revision.cambiar({ sku, campo: 'foto', dispositivo, nombre: nombreDe(sku), valor: { id, estado: 'procesando', original, tipo: 'propia', fecha: new Date().toISOString() } })
    cola.agregar({ sku, original, buffer, dispositivo, id }).catch(e => {
      console.error('Foto:', e.message)
      const actual = revision.valor(sku, 'foto')
      if (actual?.id === id) revision.cambiar({ sku, campo: 'foto', dispositivo, valor: { ...actual, estado: 'error', aviso: 'No se pudo procesar la foto. Prueba sacarla de nuevo.' } }, { apilar: false, etiqueta: 'error al procesar' })
    })
    return { ...r, id, enCola: cola.largo }
  }

  const extensionDe = tipo => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heic', 'image/gif': 'gif' })[String(tipo || '').split(';')[0].trim()] || null

  // ---- Servidor ----
  const servidor = createServer(async (req, res) => {
    try {
      if (!esRedLocal(req.socket.remoteAddress)) { req.socket.destroy(); return }
      const url = new URL(req.url, 'http://local')
      if (claveDe(req, url) !== CLAVE) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Acceso no permitido: abre la herramienta con el código QR o el enlace con la clave.'); return }
      const ruta = url.pathname
      const dispositivo = dispositivoDe(req, url)

      if (req.method === 'GET' && (ruta === '/' || ruta === '/index.html')) {
        res.setHeader('Set-Cookie', `akyra_clave=${encodeURIComponent(CLAVE)}; Path=/; HttpOnly; SameSite=Strict`)
        return enviarArchivo(res, join(AQUI, 'publico', 'index.html'))
      }
      if (req.method === 'GET' && ruta.startsWith('/publico/')) {
        const archivo = dentroDe(join(AQUI, 'publico'), ruta.slice('/publico/'.length))
        return archivo ? enviarArchivo(res, archivo) : enviarJson(res, 404, { error: 'No encontrado' })
      }
      // Módulos del sitio que también usa la herramienta (las mismas reglas de publicación)
      const MODULOS = { '/repo/tools/catalogo/publicar.mjs': 'tools/catalogo/publicar.mjs', '/repo/tools/catalogo/reglas.mjs': 'tools/catalogo/reglas.mjs', '/repo/js/stock.mjs': 'js/stock.mjs', '/repo/tools/revision/convertir.mjs': 'tools/revision/convertir.mjs' }
      if (req.method === 'GET' && MODULOS[ruta]) return enviarArchivo(res, join(RAIZ, MODULOS[ruta]))
      if (req.method === 'GET' && /^\/repo\/assets\/(productos\/[A-Za-z0-9-]+\.webp|logo\/logo-akyra-recortado\.svg|fuentes\/[a-z0-9-]+\.woff2)$/i.test(ruta)) {
        return enviarArchivo(res, join(RAIZ, ruta.slice('/repo/'.length)), { cache: 'max-age=3600' })
      }
      if (req.method === 'GET' && ruta.startsWith('/fotos/')) {
        const archivo = dentroDe(FOTOS, ruta.slice('/fotos/'.length))
        return archivo ? enviarArchivo(res, archivo) : enviarJson(res, 404, { error: 'No encontrado' })
      }

      // ---- API ----
      if (req.method === 'GET' && ruta === '/api/catalogo') {
        return enviarJson(res, 200, { base, ajustesRepo, codigosBaseRosa, categorias: CATEGORIAS.map(c => ({ id: c.id, nombre: c.nombre })), fuente: base.fuente })
      }
      if (req.method === 'GET' && ruta === '/api/estado') {
        return enviarJson(res, 200, { ...revision.datos, pila: Object.fromEntries(Object.entries(revision.datos.pila).map(([k, v]) => [k, v.length])), dispositivo, rembg: await Promise.race([rembg, new Promise(r => setTimeout(() => r(null), 50))]) })
      }
      if (req.method === 'GET' && ruta === '/api/eventos') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
        res.write(`retry: 2000\ndata: ${JSON.stringify({ tipo: 'hola', version: revision.datos.version, dispositivo })}\n\n`)
        const cliente = { res, dispositivo }
        clientes.add(cliente)
        emitir(presencia())
        const latido = setInterval(() => res.write(': latido\n\n'), 15000)
        req.on('close', () => { clearInterval(latido); clientes.delete(cliente); emitir(presencia()) })
        return
      }
      if (req.method === 'GET' && ruta === '/api/conexion') {
        const direcciones = direccionesLocales()
        const enlaces = direcciones.map(d => ({ ...d, url: `http://${d.ip}:${PUERTO}/?clave=${CLAVE}` }))
        const qr = enlaces[0] ? await QRCode.toString(enlaces[0].url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' }) : null
        return enviarJson(res, 200, { enlaces, qr, perfilRed, puerto: PUERTO })
      }
      if (req.method === 'POST' && ruta === '/api/cambio') {
        const { sku, campo, valor } = await leerJson(req)
        if (!existe(sku) && !(campo === 'nuevo' && valor === true && sku.startsWith('NUEVO-'))) return enviarJson(res, 404, { ok: false, error: 'Producto no encontrado' })
        const r = revision.cambiar({ sku, campo, valor, dispositivo, nombre: nombreDe(sku) })
        return enviarJson(res, r.ok ? 200 : 400, r)
      }
      if (req.method === 'POST' && ruta === '/api/cambios') { // varios datos de una vez (formulario "Modificar" / "Agregar")
        const { sku, datos } = await leerJson(req)
        if (!datos || typeof datos !== 'object') return enviarJson(res, 400, { ok: false, error: 'Sin datos' })
        if (!existe(sku) && !(datos.nuevo === true && sku.startsWith('NUEVO-'))) return enviarJson(res, 404, { ok: false, error: 'Producto no encontrado' })
        const orden = Object.keys(datos).sort((a, b) => (a === 'nuevo' ? -1 : b === 'nuevo' ? 1 : 0))
        const resultados = orden.map(campo => revision.cambiar({ sku, campo, valor: datos[campo], dispositivo, nombre: nombreDe(sku) || datos.nombre || '' }))
        const error = resultados.find(r => !r.ok)
        return enviarJson(res, error ? 400 : 200, { ok: !error, error: error?.error, version: revision.datos.version })
      }
      if (req.method === 'POST' && ruta === '/api/deshacer') {
        const { sku } = await leerJson(req)
        const r = revision.deshacer({ sku, dispositivo, nombre: nombreDe(sku) })
        return enviarJson(res, r.ok ? 200 : 400, r)
      }
      if (req.method === 'POST' && ruta === '/api/foto') {
        const sku = url.searchParams.get('sku') || ''
        if (!existe(sku)) return enviarJson(res, 404, { ok: false, error: 'Producto no encontrado' })
        const extension = extensionDe(req.headers['content-type'])
        if (!extension) return enviarJson(res, 415, { ok: false, error: 'El archivo no es una imagen (JPG, PNG o WebP).' })
        const buffer = await leerCuerpo(req, MAX_FOTO)
        if (buffer.length < 100) return enviarJson(res, 400, { ok: false, error: 'La imagen llegó vacía.' })
        return enviarJson(res, 200, await recibirFoto({ sku, buffer, extension, dispositivo }))
      }
      if (req.method === 'POST' && ruta === '/api/foto-enlace') {
        const { sku, enlace } = await leerJson(req)
        if (!existe(sku)) return enviarJson(res, 404, { ok: false, error: 'Producto no encontrado' })
        let destino
        try { destino = new URL(enlace) } catch { return enviarJson(res, 400, { ok: false, error: 'El enlace no es válido.' }) }
        if (!/^https?:$/.test(destino.protocol)) return enviarJson(res, 400, { ok: false, error: 'El enlace debe empezar con http:// o https://' })
        let respuesta
        try { respuesta = await fetch(destino, { redirect: 'follow', signal: AbortSignal.timeout(20000) }) } catch { return enviarJson(res, 502, { ok: false, error: 'No se pudo descargar la imagen (¿hay internet?).' }) }
        const extension = extensionDe(respuesta.headers.get('content-type'))
        if (!respuesta.ok || !extension) return enviarJson(res, 400, { ok: false, error: 'Ese enlace no es una imagen.' })
        const buffer = Buffer.from(await respuesta.arrayBuffer())
        if (buffer.length > MAX_FOTO) return enviarJson(res, 400, { ok: false, error: 'La imagen es demasiado grande.' })
        return enviarJson(res, 200, await recibirFoto({ sku, buffer, extension, dispositivo }))
      }
      if (req.method === 'POST' && ruta === '/api/foto/elegir') {
        const { sku, eleccion } = await leerJson(req)
        const actual = revision.valor(sku, 'foto')
        if (!actual) return enviarJson(res, 404, { ok: false, error: 'Ese producto no tiene foto nueva.' })
        if (eleccion === 'repetir') return enviarJson(res, 200, revision.cambiar({ sku, campo: 'foto', valor: null, dispositivo, nombre: nombreDe(sku) }))
        if (!['procesada', 'simple'].includes(eleccion) || actual.estado !== 'lista') return enviarJson(res, 400, { ok: false, error: 'La foto todavía se está procesando.' })
        const fuente = join(DATOS, actual[eleccion])
        copyFileSync(fuente, join(DATOS, actual.archivo))
        return enviarJson(res, 200, revision.cambiar({ sku, campo: 'foto', dispositivo, nombre: nombreDe(sku), valor: { ...actual, eleccion, cambio: Date.now() } }, { apilar: false, etiqueta: eleccion === 'simple' ? 'usar sin quitar fondo' : 'usar foto procesada' }))
      }
      if (req.method === 'POST' && ruta === '/api/codigo-barras') {
        if (!extensionDe(req.headers['content-type'])) return enviarJson(res, 415, { ok: false, error: 'El archivo no es una imagen.' })
        const buffer = await leerCuerpo(req, MAX_FOTO)
        return enviarJson(res, 200, await leerCodigoBarras(buffer, join(DATOS, 'temporal')))
      }
      if (req.method === 'POST' && ruta === '/api/exportar') {
        const resumen = await exportarTodo({
          productos: originales, cambios: revision.datos.cambios, carpeta: DATOS, excelOrigen: excel, ajustesRepo,
          rutas: { cambios: join(DATOS, 'cambios-catalogo.xlsx'), inventario: join(DATOS, 'Inventario_Mascoteria_Akyra_v54_precios.xlsx'), ajustes: join(DATOS, 'ajustes-catalogo.propuesto.json') }
        })
        revision.guardarResumen(resumen)
        revision.registrar(`${dispositivo} · Exportar: ${JSON.stringify(resumen.conteos)}`)
        revision.respaldar({ forzar: true })
        return enviarJson(res, 200, { ok: true, resumen })
      }
      enviarJson(res, 404, { error: 'No encontrado' })
    } catch (e) {
      console.error(e)
      if (!res.headersSent) enviarJson(res, 500, { ok: false, error: e.message === 'Archivo demasiado grande' ? 'La foto es demasiado grande.' : 'Algo falló en el PC. Vuelve a intentarlo.' })
      else res.end()
    }
  })

  await new Promise((resolver, rechazar) => {
    servidor.once('error', e => rechazar(e.code === 'EADDRINUSE' ? new Error(`El puerto ${PUERTO} está ocupado: ¿ya está abierta la herramienta en otra ventana?`) : e))
    servidor.listen(PUERTO, '0.0.0.0', resolver)
  })
  PUERTO = servidor.address().port
  const local = `http://localhost:${PUERTO}/?clave=${CLAVE}`
  console.log(`\nHerramienta de revisión lista.\n  En este PC: ${local}`)
  for (const d of direccionesLocales()) console.log(`  En el celular (${d.nombre}): http://${d.ip}:${PUERTO}/?clave=${CLAVE}`)
  console.log(`  Cambios: ${join(DATOS, 'revision.json')}\n\nNo cierres esta ventana mientras trabajan. Para terminar, ciérrala.\n`)
  if (!SIN_NAVEGADOR && process.platform === 'win32') execFile('cmd', ['/c', 'start', '', local], { windowsHide: true })

  const cerrar = () => { try { revision.respaldar() } catch { /* nada */ } cerrarTrabajadores(); process.exit(0) }
  process.on('SIGINT', cerrar)
  process.on('SIGTERM', cerrar)
  return { servidor, revision, clave: CLAVE }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  iniciar().catch(e => { console.error('\nERROR: ' + e.message); process.exit(1) })
}
