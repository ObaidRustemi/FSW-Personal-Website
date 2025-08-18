// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run sequentially for more stable results
  forbidOnly: !!process.env.CI,
  retries: 1, // Allow one retry for flaky tests
  workers: 1, // Single worker for consistency
  reporter: [['html'], ['list']], // Both HTML and console output
  
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // More lenient timeouts
    actionTimeout: 10000,
    navigationTimeout: 10000,
  },

  // Focus on most important browsers first
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Skip mobile for quick testing - can add back later
  ],

  webServer: {
    command: 'python3 -m http.server 8080',
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 5000,
  },
});
