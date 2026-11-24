import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    reducedMotion: 'reduce',
    // Headless CI checks the renderer's flat fallback; fur needs a hardware GPU.
    launchOptions: { args: ['--disable-webgl'] }
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } }
  ],
  webServer: {
    command: 'node node_modules/next/dist/bin/next start -p 3100',
    env: { UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '', VERCEL: '0' },
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 30_000
  }
})
