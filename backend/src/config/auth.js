const config = {
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpire: process.env.JWT_EXPIRE || '7d',
  saltRounds: 10,
  tokenType: 'Bearer'
};

module.exports = config; 