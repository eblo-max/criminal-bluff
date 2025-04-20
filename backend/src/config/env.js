/**
 * Конфигурация переменных окружения
 * Проверка и настройка обязательных переменных окружения
 */
const dotenv = require('dotenv');
const path = require('path');
const logger = require('../utils/logger');

// Загружаем .env файл из корня проекта
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Проверяем обязательные переменные окружения
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error(`Отсутствуют обязательные переменные окружения: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Конфигурация переменных окружения
module.exports = {
  // Общие настройки
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  
  // База данных
  MONGODB_URI: process.env.MONGODB_URI,
  
  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 минут
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100, // 100 запросов
  
  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBHOOK_DOMAIN: process.env.TELEGRAM_WEBHOOK_DOMAIN,
  TELEGRAM_WEB_APP_URL: process.env.TELEGRAM_WEB_APP_URL,
  
  // Логирование
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // Админ пользователь
  ADMIN_TELEGRAM_ID: process.env.ADMIN_TELEGRAM_ID 
    ? parseInt(process.env.ADMIN_TELEGRAM_ID, 10) 
    : null
}; 