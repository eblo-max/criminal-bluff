/**
 * Criminal Bluff Telegram Mini App - Server Entry Point
 */

// Import required packages
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./docs/swagger.json');

// Import custom modules
const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorHandler');
const config = require('./config/env');
const { connectDB } = require('./config/database');
const { initScheduler } = require('./config/scheduler');
const { initSentry, sentryMiddleware, sentryErrorHandler } = require('./config/sentry');

// Import API routes
const gameRoutes = require('./routes/gameRoutes');
const userRoutes = require('./routes/userRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const telegramRoutes = require('./routes/telegramRoutes');
const adminRoutes = require('./routes/adminRoutes');
const webAppRoutes = require('./routes/webAppRoutes');

// Initialize Express app
const app = express();
const PORT = config.PORT;

// Initialize Sentry for error monitoring
initSentry(app);

// Apply Sentry middleware (if configured)
app.use(...sentryMiddleware(app));

// Security and utility middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // 100 запросов с одного IP в течение windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Слишком много запросов с вашего IP, пожалуйста, попробуйте позже'
  }
});
app.use('/api/', limiter);

// Request logging
if (config.NODE_ENV !== 'test') {
  app.use(morgan('dev', {
    stream: { write: message => logger.info(message.trim()) }
  }));
}

// API routes
app.use('/api/game', gameRoutes);
app.use('/api/user', userRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webapp', webAppRoutes);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    docExpansion: 'none',
    filter: true,
    showRequestDuration: true,
  }
}));

// Serve static files from the 'frontend' directory in production
if (config.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

// Apply Sentry error handler (before our own error handler)
app.use(sentryErrorHandler());

// Error handling middleware
app.use(errorHandler);

// Connect to the database
if (config.NODE_ENV !== 'test') {
  connectDB()
    .then(() => {
      // Initialize scheduler
      initScheduler();
      
      // Start the server
      app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT} in ${config.NODE_ENV} mode`);
      });
    })
    .catch(err => {
      logger.error(`Failed to connect to the database: ${err.message}`);
      process.exit(1);
    });
}

// Export app for testing
module.exports = app; 