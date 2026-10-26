// Pruebas automáticas (Playwright): npm test
// Navegadores: Chrome, Firefox y WebKit (Safari), en escritorio y celular.
import { defineConfig, devices } from '@playwright/test'

const PUERTO = 4173
const MOVIL = { viewport: { width: 390, height: 844 } }

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    locale: 'es-CL',
    timezoneId: 'America/Punta_Arenas',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: `node tools/servidor.mjs ${PUERTO}`,
    url: `http://localhost:${PUERTO}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  },
  projects: [
    // Pruebas sin navegador (reglas del catálogo, mensaje de WhatsApp, data.js sin costos)
    { name: 'unidad', testMatch: /unit\/.*\.spec\.mjs/ },
    { name: 'chromium-escritorio', testMatch: /e2e\/.*\.spec\.mjs/, use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-escritorio', testMatch: /e2e\/.*\.spec\.mjs/, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-escritorio', testMatch: /e2e\/.*\.spec\.mjs/, use: { ...devices['Desktop Safari'] } },
    { name: 'chromium-movil', testMatch: /e2e\/.*\.spec\.mjs/, use: { ...devices['Pixel 7'] } },
    { name: 'firefox-movil', testMatch: /e2e\/.*\.spec\.mjs/, use: { ...devices['Desktop Firefox'], ...MOVIL } },
    { name: 'webkit-movil', testMatch: /e2e\/.*\.spec\.mjs/, use: { ...devices['iPhone 13'] } }
  ]
})
