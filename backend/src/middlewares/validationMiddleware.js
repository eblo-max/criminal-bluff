const { body, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { ValidationError } = require('../utils/errors');
const { AppError } = require('./errorMiddleware');

/**
 * Middleware для валидации запросов
 * @param {Array} validations - Массив правил валидации
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Применяем все правила валидации
    await Promise.all(validations.map(validation => validation.run(req)));

    // Получаем результаты валидации
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Если есть ошибки, форматируем их и отправляем ответ
    const formattedErrors = errors.array().map(err => ({
      field: err.param,
      message: err.msg
    }));

    throw new AppError('Ошибка валидации', 400, formattedErrors);
  };
};

/**
 * Валидация параметров игры
 */
const gameValidationRules = {
  submitAnswer: [
    body('storyId').notEmpty().withMessage('ID истории обязателен')
      .isMongoId().withMessage('Неверный формат ID истории'),
    body('selectedAnswer').isInt({ min: 0, max: 3 }).withMessage('Выбранный ответ должен быть числом от 0 до 3'),
    body('timeSpent')
      .isInt({ min: 0, max: 300000 })
      .withMessage('Время ответа должно быть между 0 и 300000 мс')
  ],
  
  finishGame: [
    body('gameSessionId').notEmpty().withMessage('ID игровой сессии обязателен')
      .isMongoId().withMessage('Неверный формат ID сессии')
  ],

  startGame: [
    body('difficulty')
      .optional()
      .isIn(['easy', 'medium', 'hard'])
      .withMessage('Неверный уровень сложности'),
    body('category')
      .optional()
      .isIn(['crime', 'detective', 'mystery'])
      .withMessage('Неверная категория')
  ]
};

/**
 * Валидация параметров пользователя
 */
const userValidationRules = {
  updateProfile: [
    body('username')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('Имя пользователя должно быть от 2 до 50 символов')
      .matches(/^[a-zA-Zа-яА-Я0-9_]+$/)
      .withMessage('Имя пользователя может содержать только буквы, цифры и подчеркивания'),
    body('firstName')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('Имя должно быть от 2 до 50 символов')
      .matches(/^[a-zA-Zа-яА-Я\s-]+$/)
      .withMessage('Имя может содержать только буквы, пробелы и дефисы'),
    body('lastName')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('Фамилия должна быть от 2 до 50 символов')
      .matches(/^[a-zA-Zа-яА-Я\s-]+$/)
      .withMessage('Фамилия может содержать только буквы, пробелы и дефисы'),
    body('photoUrl')
      .optional()
      .isURL()
      .withMessage('Некорректный URL фотографии')
  ],
  
  getAchievements: [
    query('category')
      .optional()
      .isIn(['gameplay', 'accuracy', 'streak', 'social', 'meta'])
      .withMessage('Неверная категория достижений')
  ],

  getRating: [
    query('type')
      .optional()
      .isIn(['score', 'accuracy', 'speed', 'streak', 'achievements'])
      .withMessage('Неверный тип рейтинга'),
    query('period')
      .optional()
      .isIn(['daily', 'weekly', 'monthly', 'all-time'])
      .withMessage('Неверный период')
  ]
};

/**
 * Валидация параметров рейтинга
 */
const leaderboardValidationRules = {
  getLeaderboard: [
    query('period')
      .optional()
      .isIn(['daily', 'weekly', 'monthly', 'all-time'])
      .withMessage('Неверный период'),
    query('type')
      .optional()
      .isIn(['score', 'accuracy', 'speed', 'streak', 'achievements'])
      .withMessage('Неверный тип рейтинга'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Лимит должен быть между 1 и 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Смещение должно быть положительным числом'),
    query('category')
      .optional()
      .isIn(['all', 'friends'])
      .withMessage('Неверная категория лидерборда')
  ]
};

/**
 * Валидация параметров достижений
 */
const achievementValidationRules = {
  getProgress: [
    query('achievementId')
      .optional()
      .matches(/^[a-z_]+$/)
      .withMessage('Неверный формат ID достижения'),
    query('category')
      .optional()
      .isIn(['gameplay', 'accuracy', 'streak', 'social', 'meta'])
      .withMessage('Неверная категория достижений')
  ],

  updateProgress: [
    body('achievementId').notEmpty().withMessage('ID достижения обязателен')
      .matches(/^[a-z_]+$/)
      .withMessage('Неверный формат ID достижения'),
    body('progress')
      .isInt({ min: 0, max: 100 })
      .withMessage('Прогресс должен быть между 0 и 100')
  ]
};

/**
 * Валидация данных игры
 */
exports.gameValidation = (req, res, next) => {
  try {
    const { selectedAnswer, timeSpent } = req.body;

    if (selectedAnswer === undefined) {
      throw new ValidationError('Ответ обязателен');
    }

    if (typeof timeSpent !== 'number' || timeSpent < 0) {
      throw new ValidationError('Некорректное время ответа');
    }

    next();
  } catch (error) {
    logger.error(`Game validation error: ${error.message}`);
    next(error);
  }
};

/**
 * Валидация данных пользователя
 */
exports.userValidation = (req, res, next) => {
  try {
    const { username, firstName, lastName } = req.body;

    if (username && (typeof username !== 'string' || username.length < 3)) {
      throw new ValidationError('Username должен быть строкой минимум 3 символа');
    }

    if (firstName && typeof firstName !== 'string') {
      throw new ValidationError('Имя должно быть строкой');
    }

    if (lastName && typeof lastName !== 'string') {
      throw new ValidationError('Фамилия должна быть строкой');
    }

    next();
  } catch (error) {
    logger.error(`User validation error: ${error.message}`);
    next(error);
  }
};

/**
 * Валидация параметров лидерборда
 */
exports.leaderboardValidationRules = (req, res, next) => {
  try {
    const { period, type, limit, offset } = req.query;

    // Проверка периода
    const validPeriods = ['daily', 'weekly', 'monthly', 'all-time'];
    if (period && !validPeriods.includes(period)) {
      throw new ValidationError('Некорректный период');
    }

    // Проверка типа
    const validTypes = ['score', 'accuracy', 'speed', 'streak'];
    if (type && !validTypes.includes(type)) {
      throw new ValidationError('Некорректный тип рейтинга');
    }

    // Проверка limit и offset
    if (limit && (isNaN(limit) || limit < 1)) {
      throw new ValidationError('Некорректный limit');
    }

    if (offset && (isNaN(offset) || offset < 0)) {
      throw new ValidationError('Некорректный offset');
    }

    next();
  } catch (error) {
    logger.error(`Leaderboard validation error: ${error.message}`);
    next(error);
  }
};

module.exports = {
  validate,
  gameValidationRules,
  userValidationRules,
  leaderboardValidationRules,
  achievementValidationRules
}; 