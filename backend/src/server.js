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
const { initScheduler } = require('./config/scheduler');

// Import API routes
const gameRoutes = require('./routes/gameRoutes');
const userRoutes = require('./routes/userRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const telegramRoutes = require('./routes/telegramRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Initialize Express app
const app = express();
const PORT = config.PORT;

// Security and utility middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after some time'
});
app.use('/api', apiLimiter);

// API Routes
app.use('/api/game', gameRoutes);
app.use('/api/user', userRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Telegram webhook route (без rate limiting)
app.use('/', telegramRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

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

// Error handling middleware
app.use(errorHandler);

// Connect to MongoDB and start the server
mongoose
  .connect(config.MONGODB_URI)
  .then(() => {
    // Создаем первого администратора, если задан ADMIN_TELEGRAM_ID
    if (config.ADMIN_TELEGRAM_ID) {
      const { User } = require('./models');
      User.findOneAndUpdate(
        { telegramId: config.ADMIN_TELEGRAM_ID },
        { isAdmin: true },
        { new: true }
      )
      .then(user => {
        if (user) {
          logger.info(`Admin user updated: ${user.username || user.telegramId}`);
        } else {
          logger.warn(`Admin user with telegramId ${config.ADMIN_TELEGRAM_ID} not found`);
        }
      })
      .catch(err => {
        logger.error(`Error updating admin user: ${err.message}`);
      });
    }

    // Инициализируем планировщик задач
    initScheduler();

    app.listen(PORT, () => {
      logger.info(`Server running in ${config.NODE_ENV} mode on port ${PORT}`);
      logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((err) => {
    logger.error(`Error connecting to MongoDB: ${err.message}`);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err}`);
  // Close server & exit process
  process.exit(1);
});

module.exports = app; // For testing purposes 