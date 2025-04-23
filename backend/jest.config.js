module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['./tests/setup.js'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testTimeout: 60000,
  // Добавляем игнорируемые пути
  testPathIgnorePatterns: ['/node_modules/'],
  // Настройки покрытия кода
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/coverage/'
  ],
  // Настройки для работы с MongoDB
  globalSetup: './tests/globalSetup.js',
  globalTeardown: './tests/globalTeardown.js'
}; 