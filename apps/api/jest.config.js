/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        types: ['node', 'jest'],
      },
    }],
  },
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  moduleNameMapper: {
    '^@swarm/types$': '<rootDir>/../../../packages/types/src/index.ts',
  },
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  clearMocks: true,
};
