/**
 * Контроллер для управления игровым процессом
 */
const { Story, GameSession, User } = require('../models');
const logger = require('../utils/logger');
const gameLogicService = require('../services/gameLogicService');
const cacheService = require('../services/cacheService');
const { asyncHandler } = require('../middlewares/errorMiddleware');
const { ResourceNotFoundError, GameLogicError } = require('../utils/errors');

/**
 * Получить 5 случайных историй
 * GET /api/game/stories
 */
exports.getRandomStories = async (req, res) => {
  try {
    // Пробуем получить истории из кэша
    const cachedStories = await cacheService.getStoriesCache();
    
    if (cachedStories) {
      return res.status(200).json({
        success: true,
        stories: cachedStories
      });
    }

    // Получаем случайные истории с разными категориями
    const stories = await Story.aggregate([
      { $match: { active: true } },
      { $group: { 
        _id: '$category',
        stories: { $push: '$$ROOT' }
      }},
      { $unwind: '$stories' },
      { $sample: { size: 5 } },
      { $project: {
        _id: '$stories._id',
        text: '$stories.text',
        options: '$stories.options',
        difficulty: '$stories.difficulty',
        category: '$stories.category'
      }}
    ]);

    if (stories.length < 5) {
      return res.status(404).json({
        success: false,
        message: 'Недостаточно историй для начала игры'
      });
    }

    // Кэшируем результат
    await cacheService.cacheStories(stories);

    return res.status(200).json({
      success: true,
      stories
    });
  } catch (error) {
    logger.error(`Error getting random stories: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении историй'
    });
  }
};

/**
 * @desc    Начать новую игру
 * @route   POST /api/game/start
 * @access  Private
 */
const startGame = asyncHandler(async (req, res) => {
  const { difficulty, category } = req.body;

  // Проверяем наличие активной сессии
  const activeSession = await GameSession.findOne({
    userId: req.user._id,
    status: 'active'
  });

  if (activeSession) {
    return res.status(400).json({
      success: false,
      message: 'У вас уже есть активная игровая сессия'
    });
  }

  // Получаем случайные истории
  const stories = await Story.aggregate([
    { $match: { active: true, ...(category && { category }) } },
    { $sample: { size: 5 } }
  ]);

  if (stories.length < 5) {
    return res.status(404).json({
      success: false,
      message: 'Недостаточно историй для начала игры'
    });
  }

  // Создаем новую игровую сессию
  const gameSession = await GameSession.create({
    userId: req.user._id,
    stories: stories.map(story => story._id),
    difficulty,
    category,
    startTime: new Date(),
    status: 'active'
  });

  return res.status(201).json({
    success: true,
    gameSession: {
      id: gameSession._id,
      currentStory: 0,
      totalStories: stories.length,
      stories: stories.map(({ correctAnswer, explanation, ...story }) => story)
    }
  });
});

/**
 * @desc    Отправить ответ на вопрос
 * @route   POST /api/game/answer
 * @access  Private
 */
const submitAnswer = asyncHandler(async (req, res) => {
  const { storyId, selectedAnswer, timeSpent } = req.body;

  const gameSession = await GameSession.findOne({
    userId: req.user._id,
    status: 'active'
  }).populate('stories');

  if (!gameSession) {
    return res.status(404).json({
      success: false,
      message: 'Активная игровая сессия не найдена'
    });
  }

  const currentStory = gameSession.stories[gameSession.currentStory];
  if (currentStory._id.toString() !== storyId) {
    return res.status(400).json({
      success: false,
      message: 'Неверный ID истории'
    });
  }

  const isCorrect = selectedAnswer === currentStory.correctAnswer;
  const points = calculatePoints(isCorrect, timeSpent, gameSession.difficulty);

  // Обновляем статистику сессии
  gameSession.answers.push({
    storyId,
    selectedAnswer,
    isCorrect,
    timeSpent,
    points
  });

  gameSession.currentStory += 1;
  gameSession.totalScore += points;
  gameSession.streak = isCorrect ? gameSession.streak + 1 : 0;

  if (gameSession.currentStory >= gameSession.stories.length) {
    gameSession.status = 'completed';
    gameSession.endTime = new Date();
  }

  await gameSession.save();

  return res.json({
    success: true,
    result: {
      isCorrect,
      points,
      streak: gameSession.streak,
      explanation: currentStory.explanation,
      correctAnswer: currentStory.correctAnswer
    }
  });
});

/**
 * @desc    Завершить игру
 * @route   POST /api/game/finish
 * @access  Private
 */
const finishGame = asyncHandler(async (req, res) => {
  const gameSession = await GameSession.findOne({
    userId: req.user._id,
    status: 'active'
  });

  if (!gameSession) {
    return res.status(404).json({
      success: false,
      message: 'Активная игровая сессия не найдена'
    });
  }

  gameSession.status = 'completed';
  gameSession.endTime = new Date();
  await gameSession.save();

  // Обновляем статистику пользователя
  const user = await User.findById(req.user._id);
  user.gamesPlayed += 1;
  user.totalScore += gameSession.totalScore;
  user.bestStreak = Math.max(user.bestStreak, gameSession.streak);
  await user.save();

  return res.json({
    success: true,
    stats: {
      totalScore: gameSession.totalScore,
      correctAnswers: gameSession.answers.filter(a => a.isCorrect).length,
      streak: gameSession.streak,
      averageTime: Math.round(gameSession.answers.reduce((acc, a) => acc + a.timeSpent, 0) / gameSession.answers.length)
    }
  });
});

/**
 * @desc    Получить текущую игру
 * @route   GET /api/game/current
 * @access  Private
 */
const getCurrentGame = asyncHandler(async (req, res) => {
  const gameSession = await GameSession.findOne({
    userId: req.user._id,
    status: 'active'
  }).populate('stories');

  if (!gameSession) {
    return res.status(404).json({
      success: false,
      message: 'Активная игровая сессия не найдена'
    });
  }

  // Скрываем правильные ответы для текущей и будущих историй
  const sanitizedStories = gameSession.stories.map((story, index) => {
    if (index >= gameSession.currentStory) {
      const { correctAnswer, explanation, ...safeStory } = story.toObject();
      return safeStory;
    }
    return story;
  });

  return res.json({
    success: true,
    gameSession: {
      ...gameSession.toObject(),
      stories: sanitizedStories
    }
  });
});

/**
 * Вспомогательная функция для расчета очков
 */
function calculatePoints(isCorrect, timeSpent, difficulty) {
  if (!isCorrect) return 0;

  const basePoints = {
    easy: 100,
    medium: 200,
    hard: 300
  }[difficulty] || 100;

  const timeBonus = Math.max(0, Math.floor((30000 - timeSpent) / 1000)) * 10;
  return basePoints + timeBonus;
}

module.exports = {
  startGame,
  submitAnswer,
  finishGame,
  getCurrentGame
};

/**
 * Вспомогательная функция для получения номера недели
 * @param {Date} date - дата
 * @returns {string} - номер недели в формате YYYY-WW
 */
function getWeekNumber(date) {
  // Клонируем дату, чтобы не изменять оригинал
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  
  // Устанавливаем на первый день недели (воскресенье)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  
  // Получаем первый день года
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  
  // Вычисляем номер недели
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  
  // Возвращаем в формате YYYY-WW
  return `${d.getUTCFullYear()}-${weekNum.toString().padStart(2, '0')}`;
} 