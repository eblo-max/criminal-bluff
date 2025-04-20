/**
 * Контроллер для управления пользователями
 */
const { User } = require('../models');
const { generateToken } = require('../utils/tokenGenerator');
const logger = require('../utils/logger');
const redisService = require('../services/redisService');

/**
 * Получить/создать пользователя по данным из Telegram
 */
exports.getOrCreateUser = async (req, res) => {
  try {
    const { telegramData } = req;
    
    if (!telegramData || !telegramData.id) {
      return res.status(400).json({
        success: false,
        message: 'Недостаточно данных для авторизации'
      });
    }
    
    // Поиск пользователя по Telegram ID
    let user = await User.findOne({ telegramId: telegramData.id });
    
    // Если пользователь не найден, создаем нового
    if (!user) {
      user = new User({
        telegramId: telegramData.id,
        username: telegramData.username || `user_${telegramData.id}`,
        firstName: telegramData.first_name || '',
        lastName: telegramData.last_name || '',
        photoUrl: telegramData.photo_url || '',
        language: telegramData.language_code || 'ru',
        registeredAt: new Date()
      });
      
      await user.save();
      logger.info(`New user registered: ${user.username} (ID: ${user._id})`);
    } else {
      // Обновляем данные пользователя, если что-то изменилось
      const updates = {};
      
      if (telegramData.username && telegramData.username !== user.username) {
        updates.username = telegramData.username;
      }
      
      if (telegramData.first_name && telegramData.first_name !== user.firstName) {
        updates.firstName = telegramData.first_name;
      }
      
      if (telegramData.last_name && telegramData.last_name !== user.lastName) {
        updates.lastName = telegramData.last_name;
      }
      
      if (telegramData.photo_url && telegramData.photo_url !== user.photoUrl) {
        updates.photoUrl = telegramData.photo_url;
      }
      
      if (telegramData.language_code && telegramData.language_code !== user.language) {
        updates.language = telegramData.language_code;
      }
      
      if (Object.keys(updates).length > 0) {
        user = await User.findByIdAndUpdate(user._id, updates, { new: true });
        logger.info(`User data updated: ${user.username} (ID: ${user._id})`);
      }
    }
    
    // Генерируем JWT токен для аутентификации
    const token = generateToken(user);
    
    // Сохраняем токен в Redis с небольшим временем жизни для оптимизации проверок
    await redisService.setValue(`auth:${user._id}`, token, 3600); // 1 час
    
    return res.status(200).json({
      success: true,
      message: 'Авторизация успешна',
      token,
      user: {
        id: user._id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        language: user.language,
        score: user.score,
        gamesPlayed: user.gamesPlayed,
        correctAnswers: user.correctAnswers,
        bestStreak: user.bestStreak,
        achievements: user.achievements
      }
    });
    
  } catch (error) {
    logger.error(`Error in user authentication: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при авторизации пользователя'
    });
  }
};

/**
 * Получить профиль текущего пользователя
 */
exports.getUserProfile = async (req, res) => {
  try {
    const user = req.user;
    
    // Получаем позицию в рейтинге
    let position = null;
    
    try {
      const allTimeKey = 'leaderboard:all-time';
      position = await redisService.getRank(allTimeKey, user._id.toString());
      
      // Redis возвращает 0-based позицию, прибавляем 1 для human-readable
      if (position !== null) {
        position += 1;
      }
    } catch (redisError) {
      logger.error(`Error getting user position: ${redisError.message}`);
      // Не прерываем выполнение в случае ошибки Redis
    }
    
    return res.status(200).json({
      success: true,
      message: 'Профиль пользователя успешно получен',
      user: {
        id: user._id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        language: user.language,
        score: user.score,
        gamesPlayed: user.gamesPlayed,
        correctAnswers: user.correctAnswers,
        bestStreak: user.bestStreak,
        position,
        achievements: user.achievements
      }
    });
    
  } catch (error) {
    logger.error(`Error getting user profile: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении профиля пользователя'
    });
  }
};

/**
 * Получить достижения пользователя
 */
exports.getUserAchievements = async (req, res) => {
  try {
    const user = req.user;
    
    const achievements = user.achievements || [];
    
    return res.status(200).json({
      success: true,
      message: 'Достижения пользователя успешно получены',
      achievements
    });
    
  } catch (error) {
    logger.error(`Error getting user achievements: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении достижений пользователя'
    });
  }
};

/**
 * Получить статистику пользователя
 */
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Используем сервис статистики для получения подробной информации
    const statsService = require('../services/statsService');
    const stats = await statsService.getUserStats(userId);
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'Не удалось получить статистику пользователя'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Статистика пользователя успешно получена',
      stats
    });
    
  } catch (error) {
    logger.error(`Error getting user stats: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики пользователя'
    });
  }
};

/**
 * Получить информацию о другом пользователе по ID
 */
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Не указан ID пользователя'
      });
    }
    
    const user = await User.findById(userId, {
      _id: 1,
      username: 1,
      firstName: 1,
      lastName: 1,
      photoUrl: 1,
      score: 1,
      gamesPlayed: 1,
      correctAnswers: 1,
      bestStreak: 1,
      achievements: { $size: '$achievements' }
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }
    
    // Получаем позицию в рейтинге
    let position = null;
    
    try {
      const allTimeKey = 'leaderboard:all-time';
      position = await redisService.getRank(allTimeKey, userId);
      
      // Redis возвращает 0-based позицию, прибавляем 1 для human-readable
      if (position !== null) {
        position += 1;
      }
    } catch (redisError) {
      logger.error(`Error getting user position: ${redisError.message}`);
      // Не прерываем выполнение в случае ошибки Redis
    }
    
    // Вычисляем процент правильных ответов
    const correctPercentage = user.gamesPlayed > 0 
      ? Math.round((user.correctAnswers / (user.gamesPlayed * 5)) * 100) 
      : 0;
    
    return res.status(200).json({
      success: true,
      message: 'Информация о пользователе успешно получена',
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        score: user.score,
        gamesPlayed: user.gamesPlayed,
        correctPercentage,
        bestStreak: user.bestStreak,
        position,
        achievements: user.achievements
      }
    });
    
  } catch (error) {
    logger.error(`Error getting user by ID: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении информации о пользователе'
    });
  }
};

/**
 * Telegram WebApp авторизация
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.telegramAuth = async (req, res) => {
  try {
    const { initData } = req.body;
    
    if (!initData) {
      return res.status(400).json({
        success: false,
        message: 'Отсутствуют данные инициализации Telegram WebApp'
      });
    }
    
    // Проверяем данные инициализации
    const crypto = require('crypto');
    
    // Парсим initData от Telegram
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      return res.status(400).json({
        success: false,
        message: 'Отсутствует hash в данных инициализации'
      });
    }
    
    // Удаляем hash из параметров для проверки
    params.delete('hash');
    
    // Сортируем параметры
    const paramsList = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Генерируем секретный ключ
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      logger.error('TELEGRAM_BOT_TOKEN не задан в переменных окружения');
      return res.status(500).json({
        success: false,
        message: 'Ошибка конфигурации сервера'
      });
    }
    
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
    if (hash !== expectedHash) {
      return res.status(401).json({
        success: false,
        message: 'Неверные данные инициализации'
      });
    }
    
    // Получаем данные пользователя из проверенных данных
    const userData = JSON.parse(params.get('user') || '{}');
    
    if (!userData.id) {
      return res.status(400).json({
        success: false,
        message: 'Отсутствует ID пользователя в данных инициализации'
      });
    }
    
    // Ищем пользователя в базе
    let user = await User.findOne({ telegramId: userData.id });
    
    // Если пользователь не найден, создаем нового
    if (!user) {
      user = new User({
        telegramId: userData.id,
        username: userData.username || `user_${userData.id}`,
        firstName: userData.first_name || '',
        lastName: userData.last_name || '',
        photoUrl: userData.photo_url || '',
        language: userData.language_code || 'en',
        registeredAt: new Date(),
        score: 0,
        gamesPlayed: 0,
        correctAnswers: 0,
        bestStreak: 0,
        achievements: []
      });
      
      await user.save();
      logger.info(`New user registered via Telegram WebApp: ${user.username} (ID: ${user.telegramId})`);
    } else {
      // Обновляем информацию о пользователе
      user.username = userData.username || user.username;
      user.firstName = userData.first_name || user.firstName;
      user.lastName = userData.last_name || user.lastName;
      user.photoUrl = userData.photo_url || user.photoUrl;
      user.language = userData.language_code || user.language;
      user.lastActive = new Date();
      
      await user.save();
      logger.info(`User logged in via Telegram WebApp: ${user.username} (ID: ${user.telegramId})`);
    }
    
    // Создаем JWT токен для последующих запросов
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { telegramId: user.telegramId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Успешная авторизация через Telegram',
      token,
      user: {
        id: user._id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        score: user.score,
        gamesPlayed: user.gamesPlayed,
        correctAnswers: user.correctAnswers,
        bestStreak: user.bestStreak,
        achievements: user.achievements
      }
    });
  } catch (error) {
    logger.error(`Error in telegramAuth: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при авторизации через Telegram'
    });
  }
};

/**
 * Получить данные для инициализации мини-приложения
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.getWebAppConfig = async (req, res) => {
  try {
    // Проверяем авторизацию пользователя
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    // Формируем конфигурацию для клиента
    const webAppConfig = {
      // Основные настройки
      app_name: 'Криминальный Блеф',
      version: '1.0.0',
      
      // Настройки интерфейса
      theme: {
        use_telegram_theme: true,  // Использовать тему из Telegram
        fallback_theme: 'dark',    // Запасная тема, если Telegram-тема недоступна
        primary_color: '#2AABEE',
        secondary_color: '#66B2FF',
        background_color: '#1E1E1E'
      },
      
      // Настройки игры
      game: {
        questions_per_round: 5,
        time_limit_seconds: 60,
        points_base: 100,
        points_time_bonus: 50,
        points_streak_bonus: 20
      },
      
      // Настройки пользователя
      user_settings: {
        show_animations: true,
        sound_enabled: true,
        notifications_enabled: true
      },
      
      // Настройки для Telegram WebApp
      telegram_webapp: {
        expand_by_default: true,
        show_back_button: true,
        use_theme_colors: true
      }
    };
    
    return res.status(200).json({
      success: true,
      config: webAppConfig
    });
  } catch (error) {
    logger.error(`Error getting WebApp config: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении конфигурации приложения'
    });
  }
}; 