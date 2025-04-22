/**
 * Criminal Bluff Telegram Mini App - Server Entry Point
 */

// Подключаем инструментацию Sentry в начале файла
require('./instrument');

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
const { initSentry, sentryMiddleware, sentryErrorHandler, addSentryTestRoute } = require('./config/sentry');

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

// Настройка для работы за прокси (Railway, Heroku и т.д.)
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// Initialize Sentry for error monitoring
initSentry(app);

// Apply Sentry middleware (if configured)
const sentryMiddlewares = sentryMiddleware(app);
for (const middleware of sentryMiddlewares) {
  app.use(middleware);
}

// Security and utility middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://telegram.org", "https://*.telegram.org"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https://telegram.org", "https://*.telegram.org", "blob:"],
      connectSrc: ["'self'", "https://*.railway.app", "wss://*.railway.app", "https://*.telegram.org", "https://api.telegram.org"],
      frameSrc: ["'self'", "https://telegram.org", "https://*.telegram.org"],
      workerSrc: ["'self'", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Auth-Token', 'Telegram-Data', 'X-Telegram-Init-Data']
}));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// Middleware для обработки заголовков авторизации Telegram WebApp
app.use((req, res, next) => {
  try {
    // Проверяем заголовки для Telegram WebApp
    const telegramData = req.headers['telegram-data'] || req.headers['x-telegram-init-data'];
    
    // Проверяем наличие данных в теле запроса и в заголовках
    if (!req.body.initData && telegramData) {
      req.body.initData = telegramData;
      console.log('initData скопирован из заголовка в тело запроса');
    }
    
    // Для отладки выводим информацию о типах данных в заголовках и теле запроса
    if (process.env.NODE_ENV === 'development') {
      const hasBodyInitData = !!req.body.initData;
      const hasHeaderInitData = !!telegramData;
      
      console.log(`[WebApp Headers Debug] Body initData: ${hasBodyInitData}, Header initData: ${hasHeaderInitData}`);
      
      if (hasBodyInitData) {
        const initDataStart = req.body.initData.substring(0, 30);
        console.log(`[WebApp Headers Debug] Body initData start: ${initDataStart}...`);
      }
    }
    
    next();
  } catch (error) {
    console.error('Ошибка в middleware обработки WebApp заголовков:', error);
    next();
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // 100 запросов с одного IP в течение windowMs
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: false,
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

// Serve static files from the 'frontend' directory in production
if (config.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../public')));
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

// Добавляем тестовый маршрут для Sentry
addSentryTestRoute(app);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'UP', 
    version: require('../package.json').version,
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV
  });
});

// Тестовый маршрут для входа без Telegram (только для отладки)
app.post('/api/debug-login', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEBUG_LOGIN) {
      return res.status(403).json({ 
        success: false, 
        message: 'Debug login is not allowed in production' 
      });
    }

    // Создаем или обновляем тестового пользователя
    const User = require('./models/User');
    let user = await User.findOne({ telegramId: 123456789 });
    
    if (!user) {
      user = new User({
        telegramId: 123456789,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        isActive: true,
        score: 100
      });
      await user.save();
      logger.info('Created debug user');
    }

    // Создаем JWT токен
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { telegramId: user.telegramId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        score: user.score
      }
    });
  } catch (error) {
    logger.error(`Debug login error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Route for SPA - this should be after API routes
if (config.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
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