#!/usr/bin/env node
// Corre Lighthouse CI. Usa el Chrome instalado en el computador si existe;
// si no (por ejemplo en GitHub Actions), el Chromium que instaló Playwright.
import { chromium } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const candidatos = [
  process.env.CHROME_PATH,
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  chromium.executablePath()
].filter(Boolean)
const chrome = candidatos.find(c => existsSync(c))
const r = spawnSync('npx', ['lhci', 'autorun'], { stdio: 'inherit', env: { ...process.env, CHROME_PATH: chrome }, shell: true })
process.exit(r.status ?? 1)
