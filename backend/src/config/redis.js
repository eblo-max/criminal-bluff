const config = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.NODE_ENV === 'test' ? 1 : 0,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 5,
  connectTimeout: 10000,
  commandTimeout: 5000,
  autoReconnect: true,
  ...(process.env.NODE_ENV === 'test' && {
    enableReadyCheck: false,
    maxRetriesPerRequest: null
  })
};

module.exports = config; 