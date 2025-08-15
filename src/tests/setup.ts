// Setup Jest environment
import 'dotenv/config';

// Mock fetch globally for tests
global.fetch = jest.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock process.exit to prevent tests from exiting
const originalExit = process.exit;
beforeAll(() => {
  process.exit = jest.fn() as any;
});

afterAll(() => {
  process.exit = originalExit;
});

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.SQLITE_PATH = ':memory:';
process.env.DETECTION_SOURCES = 'BITHUMB_WS,NOTICE_POLLER';
process.env.TRADING_ENABLED = 'false';
process.env.DRY_RUN = 'true';


