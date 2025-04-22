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
    if (process.env.NODE_ENV === 'development' || process.env.SKIP_TELEGRAM_AUTH === 'true') {
      logger.info('Проверка данных Telegram пропущена в режиме разработки');
      return true;
    }
    
    // Дополнительная проверка для тестирования в браузере
    if (initData && initData.includes('test_mode=1')) {
      logger.info('Используется тестовый режим для WebApp');
      return true;
    }
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      logger.error('TELEGRAM_BOT_TOKEN не задан в переменных окружения');
      return false;
    }
    
    // Парсим initData от Telegram
    const params = new URLSearchParams(initData);
    
    // Проверяем актуальность данных (не более 24 часов)
    const authDate = params.get('auth_date');
    if (authDate) {
      const currentTime = Math.floor(Date.now() / 1000);
      const maxAge = 24 * 60 * 60; // 24 часа
      
      if (currentTime - parseInt(authDate) > maxAge) {
        logger.error(`Устаревшие данные авторизации: ${authDate}, текущее время: ${currentTime}`);
        return false;
      }
    }
    
    // Определяем формат данных - WebApp или Callback Query
    const isWebAppFormat = params.has('hash');
    const isCallbackFormat = params.has('signature');
    
    // Если это формат WebApp с hash
    if (isWebAppFormat) {
      return verifyWebAppHash(params, botToken);
    }
    
    // Если это формат Callback Query с signature
    if (isCallbackFormat) {
      return verifyCallbackSignature(params, botToken);
    }
    
    logger.error('Неизвестный формат данных Telegram: не найден ни hash, ни signature');
    return false;
  } catch (error) {
    logger.error(`Ошибка проверки данных Telegram: ${error.message}`);
    return false;
  }
};

/**
 * Проверка хеша в формате WebApp
 * @param {URLSearchParams} params - Параметры из initData
 * @param {string} botToken - Токен бота
 * @returns {boolean} - Результат проверки
 */
const verifyWebAppHash = (params, botToken) => {
  try {
    const hash = params.get('hash');
    
    if (!hash) {
      logger.error('Отсутствует hash в данных WebApp');
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
    const isValid = hash === expectedHash;
    
    if (!isValid) {
      logger.error(`Неверный hash для WebApp. Ожидалось: ${expectedHash}, получено: ${hash}`);
      // Добавляем больше логирования для отладки
      logger.error(`Детали проверки для отладки:`);
      logger.error(`- Длина параметров: ${paramsList.length} символов`);
      logger.error(`- Первые 100 символов параметров: ${paramsList.substring(0, 100)}...`);
      logger.error(`- Время auth_date: ${params.get('auth_date')}, текущее время: ${Math.floor(Date.now() / 1000)}`);
      logger.error(`- Версия бота: ${process.env.BOT_VERSION || 'не задана'}`);
    } else {
      logger.info('WebApp hash проверен успешно');
    }
    
    return isValid;
  } catch (error) {
    logger.error(`Ошибка проверки WebApp hash: ${error.message}`);
    return false;
  }
};

/**
 * Проверка signature для Callback Query
 * @param {URLSearchParams} params - Параметры из данных callback
 * @param {string} botToken - Токен бота
 * @returns {boolean} - Результат проверки
 */
const verifyCallbackSignature = (params, botToken) => {
  try {
    const signature = params.get('signature');
    
    if (!signature) {
      logger.error('Отсутствует signature в данных Callback Query');
      return false;
    }
    
    // Для callback query проверка проводится по-другому
    // В режиме разработки или тестирования можно разрешить авторизацию без проверки
    if (process.env.ALLOW_DEBUG_LOGIN === 'true') {
      logger.warn('Проверка подписи callback query пропущена (ALLOW_DEBUG_LOGIN)');
      return true;
    }
    
    // Для Callback Query пока не реализована полная проверка
    // из-за особенностей формирования данных
    // Но делаем базовую проверку наличия обязательных полей
    const hasRequiredFields = params.has('user') && 
                             params.has('auth_date') && 
                             params.has('chat_instance');
    
    if (!hasRequiredFields) {
      logger.error('В данных Callback Query отсутствуют обязательные поля');
      return false;
    }
    
    // Проверяем актуальность данных (не более 24 часов)
    const authDate = params.get('auth_date');
    const currentTime = Math.floor(Date.now() / 1000);
    const maxAge = 24 * 60 * 60; // 24 часа
    
    if (currentTime - parseInt(authDate) > maxAge) {
      logger.error(`Устаревшие данные авторизации: ${authDate}`);
      return false;
    }
    
    // В данном случае мы условно принимаем данные, если они свежие и содержат все поля
    logger.info('Принимаем callback query данные без полной проверки подписи');
    return true;
  } catch (error) {
    logger.error(`Ошибка проверки Callback Query signature: ${error.message}`);
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
        // Если в режиме разработки или включен флаг отладки, пропускаем проверку
        if (process.env.ALLOW_DEBUG_LOGIN === 'true') {
          logger.warn('Пропускаем проверку данных в режиме отладки (ALLOW_DEBUG_LOGIN)');
        } else {
          return res.status(401).json({
            success: false,
            message: 'Недействительные данные Telegram.'
          });
        }
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
    // В этом middleware мы не блокируем запрос даже при невалидных данных
    verifyTelegramWebAppData(initData);
    
    // Парсим данные пользователя из initData
    const params = new URLSearchParams(initData);
    const userData = JSON.parse(params.get('user') || '{}');
    
    // Прикрепляем данные пользователя к запросу
    req.telegramUser = userData;
    
    // Другие данные из initData
    req.telegramWebApp = {
      auth_date: params.get('auth_date'),
      query_id: params.get('query_id'),
      start_param: params.get('start_param'),
      // Добавляем информацию о callback query при наличии
      chat_instance: params.get('chat_instance'),
      chat_type: params.get('chat_type')
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