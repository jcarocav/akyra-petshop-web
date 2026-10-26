// Hook PostToolUse (Edit|Write): revisa solo el archivo editado.
//  - .js/.mjs → oxlint
//  - .html    → html-validate
// Si hay problemas, sale con código 2 y le devuelve el detalle a Claude para que los corrija.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const entrada = JSON.parse(readFileSync(0, 'utf8'))
const ruta = entrada.tool_input?.file_path
if (!ruta || !/\.(js|mjs|html)$/.test(ruta)) process.exit(0)

const raiz = process.env.CLAUDE_PROJECT_DIR || entrada.cwd || process.cwd()
const absoluta = resolve(raiz, ruta)
const rel = relative(raiz, absoluta)
if (rel.startsWith('..') || rel.startsWith('node_modules') || rel.startsWith('.claude') || !existsSync(absoluta)) process.exit(0)

const esHtml = rel.endsWith('.html')
const bin = esHtml
  ? join(raiz, 'node_modules', 'html-validate', 'bin', 'html-validate.mjs')
  : join(raiz, 'node_modules', 'oxlint', 'bin', 'oxlint')
if (!existsSync(bin)) process.exit(0)

const args = esHtml ? [bin, rel] : [bin, '--deny-warnings', rel]
const r = spawnSync(process.execPath, args, { cwd: raiz, encoding: 'utf8' })
if (r.status !== 0) {
  process.stderr.write(`${esHtml ? 'html-validate' : 'oxlint'} encontró problemas en ${rel}:\n${r.stdout}${r.stderr}`)
  process.exit(2)
}
