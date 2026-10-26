#!/usr/bin/env node
// Corre Lighthouse CI usando el Chromium que ya instaló Playwright (no hace falta otro Chrome).
import { chromium } from '@playwright/test'
import { spawnSync } from 'node:child_process'

const env = { ...process.env, CHROME_PATH: process.env.CHROME_PATH || chromium.executablePath() }
const r = spawnSync('npx', ['lhci', 'autorun'], { stdio: 'inherit', env, shell: true })
process.exit(r.status ?? 1)
