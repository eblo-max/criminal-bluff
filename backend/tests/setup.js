const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const logger = require('../src/utils/logger');
const config = require('../src/config/redis');

// Increase timeout for tests
jest.setTimeout(30000);

// Disable logs during tests
logger.silent = true;

let mongoServer;
let redis;

// Connect to test DB and Redis before tests
beforeAll(async () => {
  try {
    // MongoDB in-memory server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Real Redis connection
    redis = new Redis({
      host: config.host,
      port: config.port,
      db: 15 // Use separate DB for tests
    });
    
    global.redis = redis;
  } catch (error) {
    console.error('Error setting up test environment:', error);
    throw error;
  }
});

// Cleanup after each test
afterEach(async () => {
  try {
    await mongoose.connection.dropDatabase();
    await global.redis.flushdb(); // Only flush test database
  } catch (error) {
    console.error('Error cleaning up after test:', error);
    throw error;
  }
});

// Disconnect after all tests
afterAll(async () => {
  try {
    await mongoose.disconnect();
    await mongoServer.stop();
    await global.redis.quit();
  } catch (error) {
    console.error('Error tearing down test environment:', error);
    throw error;
  }
}); 