// Lighthouse CI (celular): npm run lighthouse
// Umbrales: Rendimiento ≥ 90, Accesibilidad / Buenas prácticas / SEO ≥ 95
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'node tools/servidor.mjs 4175',
      startServerReadyPattern: 'localhost:4175',
      url: [
        'http://localhost:4175/index.html',
        'http://localhost:4175/catalogo.html',
        'http://localhost:4175/producto.html?id=gat-roya-002'
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --headless=new',
        // Lighthouse no sabe de GitHub Pages: el servidor local imita su compresión
        skipAudits: ['uses-http2']
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9, aggregationMethod: 'median-run' }],
        'categories:accessibility': ['error', { minScore: 0.95, aggregationMethod: 'median-run' }],
        'categories:best-practices': ['error', { minScore: 0.95, aggregationMethod: 'median-run' }],
        'categories:seo': ['error', { minScore: 0.95, aggregationMethod: 'median-run' }]
      }
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci' }
  }
}
