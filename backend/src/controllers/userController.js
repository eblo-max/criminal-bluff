/**
 * Контроллер для управления пользователями
 */
const { User } = require('../models');
const logger = require('../utils/logger');
const redisService = require('../services/redisService');
const cacheService = require('../services/cacheService');
const { asyncHandler } = require('../middlewares/errorMiddleware');
const { ResourceNotFoundError, ValidationError } = require('../utils/errors');
const jwt = require('jsonwebtoken');
const { generateToken } = require('../utils/tokenGenerator');
const { leaderboardController } = require('./leaderboardController');
const gameLogicService = require('../services/gameLogicService');
const { userValidation } = require('../middlewares/validationMiddleware');
const { userValidationRules } = require('../middlewares/validationMiddleware');

/**
 * Создать/обновить пользователя по данным из Telegram
 * POST /api/user/create
 */
exports.createUser = async (req, res) => {
  try {
    const { telegramId, username, firstName, lastName, photoUrl, languageCode } = req.body;

    if (!telegramId) {
      return res.status(400).json({
        success: false,
        message: 'Telegram ID обязателен'
      });
    }

    // Ищем существующего пользователя
    let user = await User.findOne({ telegramId });

    if (user) {
      // Обновляем существующего пользователя
      user = await User.findOneAndUpdate(
        { telegramId },
        {
          $set: {
            username: username || user.username,
            firstName: firstName || user.firstName,
            lastName: lastName || user.lastName,
            photoUrl: photoUrl || user.photoUrl,
            languageCode: languageCode || user.languageCode,
            updatedAt: new Date()
          }
        },
        { new: true }
      );
    } else {
      // Создаем нового пользователя
      user = new User({
        telegramId,
        username,
        firstName,
        lastName,
        photoUrl,
        languageCode,
        score: 0,
        gamesPlayed: 0,
        correctAnswers: 0,
        bestStreak: 0,
        achievements: [],
        registeredAt: new Date()
      });
      await user.save();
    }

    // Генерируем токен
    const token = generateToken(user);

    // Кэшируем токен
    await redisService.setValue(`auth:${user._id}`, token, 3600);

    return res.status(200).json({
      success: true,
      message: user.isNew ? 'Пользователь создан' : 'Пользователь обновлен',
      user: {
        id: user._id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        score: user.score,
        gamesPlayed: user.gamesPlayed,
        token
      }
    });

  } catch (error) {
    logger.error(`Error creating/updating user: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при создании/обновлении пользователя'
    });
  }
};

/**
 * Получить профиль пользователя
 * GET /api/user/profile
 */
exports.getProfile = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Пробуем получить из кэша
  let user = await cacheService.getUserProfileCache(userId);
  
  if (!user) {
    user = await User.findById(userId)
      .select('username firstName lastName photoUrl score rank achievements')
      .lean();

    if (!user) {
      throw new ResourceNotFoundError('Пользователь', userId);
    }

    // Кэшируем результат
    await cacheService.cacheUserProfile(userId, user);
  }

  return res.success({
    profile: user
  });
});

/**
 * Получить достижения пользователя
 * GET /api/user/achievements
 */
exports.getAchievements = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { category } = req.query;

  // Пробуем получить из кэша
  let achievements = await cacheService.getUserAchievementsCache(userId);
  
  if (!achievements) {
    const user = await User.findById(userId)
      .select('achievements achievementProgress')
      .lean();

    if (!user) {
      throw new ResourceNotFoundError('Пользователь', userId);
    }

    achievements = {
      unlocked: user.achievements,
      progress: user.achievementProgress
    };

    // Кэшируем результат
    await cacheService.cacheUserAchievements(userId, achievements);
  }

  // Фильтруем по категории если указана
  if (category) {
    achievements.unlocked = achievements.unlocked.filter(a => a.category === category);
    achievements.progress = Object.fromEntries(
      Object.entries(achievements.progress).filter(([key]) => 
        achievements.unlocked.some(a => a.id === key && a.category === category)
      )
    );
  }

  return res.success({
    achievements: achievements.unlocked,
    progress: achievements.progress
  });
});

/**
 * Get user achievements
 * GET /api/user/achievements
 */
exports.getUserAchievements = asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const user = await User.findById(userId);

  if (!user) {
    throw new ResourceNotFoundError('User not found', userId);
  }

  // Try to get from cache first
  let achievements = await cacheService.getUserAchievementsCache(userId);

  if (!achievements) {
    // Cache miss - fetch from database
    achievements = await Achievement.find({ userId });
    
    // Get progress for incomplete achievements
    const inProgressAchievements = await AchievementProgress.find({ userId });
    
    // Format response
    achievements = {
      unlocked: achievements.map(a => ({
        id: a._id,
        name: a.name,
        description: a.description,
        unlockedAt: a.unlockedAt,
        reward: a.reward
      })),
      inProgress: inProgressAchievements.map(p => ({
        id: p.achievementId,
        name: p.name,
        description: p.description, 
        currentProgress: p.currentProgress,
        targetProgress: p.targetProgress,
        percentComplete: (p.currentProgress / p.targetProgress) * 100
      }))
    };

    // Cache the results
    await cacheService.cacheUserAchievements(userId, achievements);
  }

  res.json({
    status: 'success',
    data: achievements
  });
});

/**
 * Получить профиль текущего пользователя
 */
exports.getUserProfile = async (req, res) => {
  try {
    const user = req.user;
    
    // Получаем позицию в рейтинге и ранг
    const [position, rank] = await Promise.all([
      redisService.getRank('leaderboard:all-time', user._id.toString()),
      gameLogicService.calculateRank(user.score)
    ]);
    
    // Redis возвращает 0-based позицию, прибавляем 1 для human-readable
    const rankPosition = position !== null ? position + 1 : null;
    
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
        position: rankPosition,
        rank: rank.currentRank,
        nextRank: rank.nextRank,
        rankProgress: rank.progress,
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
    
    console.log('===== НАЧАЛО ПРОЦЕССА АВТОРИЗАЦИИ TELEGRAM WEBAPP =====');
    console.log('Request headers:', JSON.stringify(req.headers));
    console.log('initData получен из тела запроса:', initData ? 'Да' : 'Нет');
    
    if (!initData) {
      // Проверяем режим отладки
      if (process.env.ALLOW_DEBUG_LOGIN === 'true' && process.env.NODE_ENV !== 'production') {
        console.log('Включен режим отладки. Использую тестовую аутентификацию.');
        return handleDebugLogin(req, res);
      }
      
      console.error('ОШИБКА: Отсутствуют данные инициализации Telegram WebApp');
      return res.status(400).json({
        success: false,
        message: 'Отсутствуют данные инициализации Telegram WebApp'
      });
    }
    
    // Логируем первые 50 символов для отладки
    console.log('initData (первые 50 символов):', initData.substring(0, 50) + '...');
    
    // Определяем формат данных
    const params = new URLSearchParams(initData);
    const isWebAppFormat = params.has('hash');
    const isCallbackFormat = params.has('signature');
    
    console.log('Формат данных:', isWebAppFormat ? 'WebApp' : (isCallbackFormat ? 'Callback Query' : 'Неизвестный'));
    
    // Проверяем валидность данных через middleware
    const { verifyTelegramWebAppData } = require('../middlewares/webAppMiddleware');
    const isValid = verifyTelegramWebAppData(initData);
    
    if (!isValid) {
      // Если включен режим отладки, пропускаем проверку
      if (process.env.ALLOW_DEBUG_LOGIN === 'true' && process.env.NODE_ENV !== 'production') {
        console.warn('Пропускаем проверку данных в режиме отладки');
      } else {
        console.error('ОШИБКА ПРОВЕРКИ: Неверные данные инициализации');
        
        // Добавляем расширенную информацию для отладки
        const authDate = params.get('auth_date');
        const currentTime = Math.floor(Date.now() / 1000);
        const timeDiff = currentTime - parseInt(authDate || '0');
        
        return res.status(401).json({
          success: false,
          message: 'Неверные данные инициализации',
          debug: {
            format: isWebAppFormat ? 'WebApp' : (isCallbackFormat ? 'Callback Query' : 'Неизвестный'),
            authDateAge: `${timeDiff} секунд`,
            environment: process.env.NODE_ENV,
            telegramInitDataLength: initData.length
          }
        });
      }
    }
    
    // Получаем данные пользователя из проверенных данных
    const userData = JSON.parse(params.get('user') || '{}');
    
    console.log('Данные пользователя получены из initData:', userData ? 'Да' : 'Нет');
    
    if (!userData.id) {
      console.error('ОШИБКА: Отсутствует ID пользователя в данных инициализации');
      return res.status(400).json({
        success: false,
        message: 'Отсутствует ID пользователя в данных инициализации'
      });
    }
    
    console.log('ID пользователя из Telegram:', userData.id);
    
    // Ищем пользователя в базе
    let user = await User.findOne({ telegramId: userData.id });
    
    console.log('Пользователь найден в базе:', user ? 'Да' : 'Нет');
    
    // Если пользователь не найден, создаем нового
    if (!user) {
      console.log('Создаем нового пользователя с telegramId:', userData.id);
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
      console.log('Обновляем информацию о существующем пользователе:', user.username);
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
    
    console.log('JWT токен создан успешно');
    console.log('===== ЗАВЕРШЕНИЕ ПРОЦЕССА АВТОРИЗАЦИИ TELEGRAM WEBAPP =====');
    
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
    console.error('КРИТИЧЕСКАЯ ОШИБКА в telegramAuth:', error.message);
    console.error(error.stack);
    logger.error(`Error in telegramAuth: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при авторизации через Telegram',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Обработка тестовой аутентификации в режиме отладки
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
async function handleDebugLogin(req, res) {
  try {
    console.log('Выполняем тестовую аутентификацию в режиме отладки');
    
    // Определяем ID для тестового пользователя (либо из запроса, либо используем дефолтный)
    const debugUserId = req.body.debugUserId || 5428724191; // Используем ID из примера или константу
    
    // Ищем пользователя или создаем нового тестового
    let user = await User.findOne({ telegramId: debugUserId });
    
    if (!user) {
      user = new User({
        telegramId: debugUserId,
        username: `debug_user_${debugUserId}`,
        firstName: 'Debug',
        lastName: 'User',
        registeredAt: new Date(),
        score: 100, // Тестовое значение
        gamesPlayed: 5,
        correctAnswers: 20,
        bestStreak: 4,
        achievements: []
      });
      
      await user.save();
      logger.info(`Created debug user: ${user.username} (ID: ${user.telegramId})`);
    }
    
    // Генерируем JWT токен с длительным сроком жизни для отладки
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { telegramId: user.telegramId },
      process.env.JWT_SECRET,
      { expiresIn: '30d' } // 30 дней для тестирования
    );
    
    console.log('Тестовая аутентификация выполнена успешно. Токен создан.');
    console.log('===== ЗАВЕРШЕНИЕ ПРОЦЕССА ТЕСТОВОЙ АУТЕНТИФИКАЦИИ =====');
    
    return res.status(200).json({
      success: true,
      message: 'Тестовая авторизация успешна',
      debug: true,
      token,
      user: {
        id: user._id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl || '',
        score: user.score,
        gamesPlayed: user.gamesPlayed,
        correctAnswers: user.correctAnswers,
        bestStreak: user.bestStreak,
        achievements: user.achievements
      }
    });
  } catch (error) {
    console.error('Ошибка при тестовой аутентификации:', error.message);
    logger.error(`Debug login error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при тестовой авторизации',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Внутренняя ошибка сервера'
    });
  }
}

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

/**
 * Обновить аватар пользователя
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.updateUserAvatar = async (req, res) => {
  try {
    // Проверяем авторизацию пользователя
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    const { photoUrl } = req.body;
    
    if (!photoUrl) {
      return res.status(400).json({
        success: false,
        message: 'URL фотографии обязателен'
      });
    }
    
    // Обновляем фото пользователя
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { photoUrl },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }
    
    logger.info(`User ${user.username} (ID: ${user._id}) updated avatar`);
    
    return res.status(200).json({
      success: true,
      message: 'Аватар успешно обновлен',
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl
      }
    });
  } catch (error) {
    logger.error(`Error updating user avatar: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении аватара'
    });
  }
};

/**
 * Обновить профиль пользователя
 * PUT /api/user/profile
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const { username, firstName, lastName, photoUrl } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new ResourceNotFoundError('Пользователь', userId);
  }

  // Проверяем уникальность username
  if (username && username !== user.username) {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      throw new ValidationError('Такой username уже занят');
    }
  }

  // Обновляем поля
  Object.assign(user, {
    ...(username && { username }),
    ...(firstName && { firstName }),
    ...(lastName && { lastName }),
    ...(photoUrl && { photoUrl })
  });

  await user.save();
  
  // Инвалидируем кэш
  await cacheService.invalidateUserCaches(userId);

  return res.success({
    profile: user
  });
}); 