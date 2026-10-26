// Hook PreToolUse (Edit|Write): bloquea la edición de archivos que no deben tocarse a mano.
//  - .env* (secretos locales; este sitio no debería tener ninguno).
//  - package-lock.json (lo actualiza npm).
//  - productos.json y stock.json (los generan npm run catalogo y el GitHub Action de stock).
//  - planillas .xlsx (el inventario tiene costos y no va al repositorio).
// Salida con código 2 = bloquea y le explica el motivo a Claude.
import { readFileSync } from 'node:fs'
import { basename, relative, resolve, sep } from 'node:path'

const entrada = JSON.parse(readFileSync(0, 'utf8'))
const ruta = entrada.tool_input?.file_path
if (!ruta) process.exit(0)

const raiz = process.env.CLAUDE_PROJECT_DIR || entrada.cwd || process.cwd()
const rel = relative(raiz, resolve(raiz, ruta)).split(sep).join('/')
const nombre = basename(rel)

function bloquear(motivo) {
  process.stderr.write(`Bloqueado por .claude/hooks/proteger-archivos.mjs: ${motivo}\n`)
  process.exit(2)
}

if (nombre.startsWith('.env')) bloquear(`${rel} guarda secretos; este sitio estático no lleva secretos.`)
if (nombre === 'package-lock.json') bloquear('package-lock.json lo actualiza npm; no se edita a mano.')
if (rel === 'productos.json' || rel === 'stock.json') bloquear(`${rel} se genera con \`npm run catalogo\` o el Action de stock; cambia el script o el Excel.`)
if (/\.xlsx?$/i.test(nombre)) bloquear('Las planillas no se editan desde Claude Code.')
