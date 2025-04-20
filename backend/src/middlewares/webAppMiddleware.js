/**
 * Middleware для Telegram WebApp
 * Содержит функции для обработки данных Telegram WebApp
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * Проверка данных Telegram WebApp
 * @param {string} initData - Строка инициализации от Telegram WebApp
 * @returns {boolean} - Результат проверки
 */
const verifyTelegramWebAppData = (initData) => {
  try {
    // В режиме разработки можно пропустить проверку
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_TELEGRAM_AUTH === 'true') {
      return true;
    }
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      logger.error('TELEGRAM_BOT_TOKEN не задан в переменных окружения');
      return false;
    }
    
    // Парсим initData от Telegram
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      return false;
    }
    
    // Удаляем hash из параметров для проверки
    params.delete('hash');
    
    // Сортируем параметры
    const paramsList = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Генерируем секретный ключ
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    
    // Вычисляем ожидаемый хеш
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(paramsList)
      .digest('hex');
    
    // Проверяем хеш
    return hash === expectedHash;
  } catch (error) {
    logger.error(`Ошибка проверки данных Telegram: ${error.message}`);
    return false;
  }
};

/**
 * Middleware для авторизации через Telegram WebApp
 * Проверяет данные инициализации или JWT токен
 */
const webAppAuthMiddleware = async (req, res, next) => {
  try {
    // Сначала проверяем заголовок авторизации (JWT)
    const token = req.headers.authorization?.split(' ')[1];
    // Или проверяем данные инициализации от Telegram
    const initData = req.headers['telegram-data'] || req.body.initData;
    
    // Если нет ни токена, ни данных инициализации
    if (!token && !initData) {
      return res.status(401).json({
        success: false,
        message: 'Требуется авторизация. Пожалуйста, предоставьте действительные учетные данные.'
      });
    }
    
    // Если предоставлен JWT токен
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Находим пользователя
        const user = await User.findOne({ telegramId: decoded.telegramId });
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'Пользователь не найден.'
          });
        }
        
        // Прикрепляем пользователя к запросу
        req.user = user;
        return next();
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Недействительный или просроченный токен.'
        });
      }
    }
    
    // Если предоставлены данные инициализации Telegram
    if (initData) {
      // Проверяем данные Telegram
      const isValid = verifyTelegramWebAppData(initData);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Недействительные данные Telegram.'
        });
      }
      
      // Парсим данные пользователя из initData
      const params = new URLSearchParams(initData);
      const userData = JSON.parse(params.get('user') || '{}');
      
      if (!userData.id) {
        return res.status(401).json({
          success: false,
          message: 'ID пользователя не найден в данных Telegram.'
        });
      }
      
      // Ищем пользователя
      const user = await User.findOne({ telegramId: userData.id });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Пользователь не найден. Пожалуйста, создайте профиль сначала.'
        });
      }
      
      // Прикрепляем пользователя к запросу
      req.user = user;
      
      // Генерируем JWT токен для последующих запросов
      const newToken = jwt.sign(
        { telegramId: userData.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );
      
      // Добавляем токен в заголовок ответа
      res.setHeader('X-Auth-Token', newToken);
      
      return next();
    }
  } catch (error) {
    logger.error(`Ошибка авторизации: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка авторизации. Пожалуйста, попробуйте еще раз.'
    });
  }
};

/**
 * Middleware для получения данных пользователя из Telegram WebApp
 * Не требует авторизации, только проверяет данные инициализации
 */
const webAppDataMiddleware = async (req, res, next) => {
  try {
    const initData = req.headers['telegram-data'] || req.body.initData;
    
    if (!initData) {
      return next();
    }
    
    // Проверяем данные Telegram
    const isValid = verifyTelegramWebAppData(initData);
    if (!isValid) {
      return next();
    }
    
    // Парсим данные пользователя из initData
    const params = new URLSearchParams(initData);
    const userData = JSON.parse(params.get('user') || '{}');
    
    // Прикрепляем данные пользователя к запросу
    req.telegramUser = userData;
    
    // Другие данные из initData
    req.telegramWebApp = {
      auth_date: params.get('auth_date'),
      query_id: params.get('query_id'),
      start_param: params.get('start_param')
    };
    
    return next();
  } catch (error) {
    logger.error(`Ошибка обработки данных WebApp: ${error.message}`);
    return next();
  }
};

module.exports = {
  verifyTelegramWebAppData,
  webAppAuthMiddleware,
  webAppDataMiddleware
}; 