import '@testing-library/jest-dom';

// Mock environment variables
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/testdb';
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise during tests
const originalError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: ReactDOM.render is deprecated')
  ) {
    return;
  }
  originalError.call(console, ...args);
};

// Global test timeout
jest.setTimeout(30000);