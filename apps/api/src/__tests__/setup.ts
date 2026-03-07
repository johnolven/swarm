// Set required env vars for tests
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';
process.env.JWT_EXPIRES_IN = '1d';
process.env.NODE_ENV = 'test';
process.env.SKIP_CAPABILITY_CHECK = 'false';
