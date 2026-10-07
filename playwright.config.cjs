const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  workers: 1,
  retries: 0,
  maxFailures: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:48731/pdbview/',
    viewport: { width: 1440, height: 1000 },
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-compositing', '--num-raster-threads=1', '--renderer-process-limit=1'] },
  },
  webServer: {
    command: 'node tests/server.cjs',
    url: 'http://127.0.0.1:48731/pdbview/',
    reuseExistingServer: false,
  },
});
