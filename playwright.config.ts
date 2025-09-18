import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/test/integration',
  outputDir: './test-results',

  // Таймауты
  timeout: 30 * 1000,
  expect: {
    timeout: 10000,
  },

  // Запуск тестов
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,

  // Репортеры
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
  ],

  // Общие настройки
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Проекты для разных браузеров
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // WebServer для автоматического запуска Next.js
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
