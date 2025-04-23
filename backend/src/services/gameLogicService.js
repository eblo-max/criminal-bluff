const { User, Story } = require('../models');
const { AppError } = require('../middlewares/errorMiddleware');
const cacheService = require('./cacheService');
const leaderboardService = require('./leaderboardService');
const logger = require('../utils/logger');

// Константы для подсчета очков
const POINTS = {
  BASE: 100,
  TIME_BONUS_MAX: 50,
  STREAK_BONUS: 20,
  PERFECT_GAME_BONUS: 500
};

// Константы для достижений
const ACHIEVEMENTS = {
  FIRST_GAME: { id: 'first_game', points: 50 },
  PERFECT_GAME: { id: 'perfect_game', points: 200 },
  SPEED_DEMON: { id: 'speed_demon', points: 150 },
  STREAK_MASTER: { id: 'streak_master', points: 100 },
  VETERAN: { id: 'veteran', points: 300 }
};

// Обновляем константы для рангов
const RANKS = {
  ROOKIE: { name: 'Новичок', minScore: 0, color: '#808080', icon: '👶' },
  DETECTIVE: { name: 'Детектив', minScore: 1000, color: '#4CAF50', icon: '🔍' },
  INVESTIGATOR: { name: 'Следователь', minScore: 5000, color: '#2196F3', icon: '🕵️' },
  INSPECTOR: { name: 'Инспектор', minScore: 10000, color: '#9C27B0', icon: '👮' },
  COMMISSIONER: { name: 'Комиссар', minScore: 25000, color: '#FF9800', icon: '🎖️' },
  SUPERINTENDENT: { name: 'Суперинтендант', minScore: 50000, color: '#F44336', icon: '⭐' },
  CHIEF: { name: 'Шеф полиции', minScore: 100000, color: '#FFD700', icon: '👑' },
  LEGEND: { name: 'Легенда', minScore: 250000, color: '#E91E63', icon: '🏆' }
};

/**
 * Рассчитать ранг пользователя
 */
const calculateRank = async (score) => {
  try {
    // Находим текущий ранг
    const ranks = Object.values(RANKS).sort((a, b) => b.minScore - a.minScore);
    const currentRank = ranks.find(rank => score >= rank.minScore);
    
    // Находим следующий ранг
    const nextRankIndex = ranks.findIndex(r => r.name === currentRank.name) + 1;
    const nextRank = nextRankIndex < ranks.length ? ranks[nextRankIndex] : null;

    // Считаем прогресс
    let progress = 100;
    if (nextRank) {
      progress = Math.round(
        ((score - currentRank.minScore) / (nextRank.minScore - currentRank.minScore)) * 100
      );
    }

    return {
      current: {
        name: currentRank.name,
        color: currentRank.color,
        icon: currentRank.icon,
        minScore: currentRank.minScore
      },
      next: nextRank ? {
        name: nextRank.name,
        color: nextRank.color,
        icon: nextRank.icon,
        minScore: nextRank.minScore,
        pointsNeeded: nextRank.minScore - score
      } : null,
      progress,
      score
    };
  } catch (err) {
    logger.error(`Error calculating rank: ${err.message}`);
    throw err;
  }
};

/**
 * Разблокировать достижение
 */
const unlockAchievement = async (userId, achievementId) => {
  try {
    // Проверяем, не получено ли уже достижение
    const user = await User.findById(userId);
    if (!user || user.achievements.some(a => a.id === achievementId)) {
      return null;
    }

    // Получаем информацию о достижении
    const achievement = ACHIEVEMENTS[achievementId];
    if (!achievement) {
      throw new AppError('Достижение не найдено', 404);
    }

    // Добавляем достижение
    const newAchievement = {
      id: achievement.id,
      unlockedAt: new Date()
    };

    // Обновляем пользователя
    await User.findByIdAndUpdate(userId, {
      $push: { achievements: newAchievement },
      $inc: { score: achievement.points }
    });

    // Инвалидируем кэш профиля
    await cacheService.invalidateUserProfile(userId);

    return newAchievement;
  } catch (err) {
    logger.error(`Error unlocking achievement: ${err.message}`);
    throw err;
  }
};

/**
 * Завершить игру
 */
const finishGame = async (userId, gameSession) => {
  try {
    // Проверяем статус сессии
    if (gameSession.status !== 'completed') {
      throw new AppError('Игровая сессия не завершена', 400);
    }

    // Получаем пользователя
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('Пользователь не найден', 404);
    }

    // Считаем статистику игры
    const stats = {
      totalScore: gameSession.totalScore,
      correctAnswers: gameSession.answers.filter(a => a.isCorrect).length,
      bestStreak: Math.max(...gameSession.answers.map(a => a.streak)),
      averageTime: Math.round(
        gameSession.answers.reduce((sum, a) => sum + a.timeSpent, 0) / gameSession.answers.length
      ),
      isPerfect: gameSession.answers.every(a => a.isCorrect)
    };

    // Добавляем бонус за идеальную игру
    if (stats.isPerfect) {
      stats.totalScore += POINTS.PERFECT_GAME_BONUS;
    }

    // Обновляем статистику пользователя
    const updates = {
      $inc: {
        score: stats.totalScore,
        gamesPlayed: 1,
        correctAnswers: stats.correctAnswers
      },
      $max: { bestStreak: stats.bestStreak },
      $set: { 
        lastGameAt: new Date(),
        averageAnswerTime: Math.round(
          ((user.averageAnswerTime || 0) * user.gamesPlayed + stats.averageTime) / (user.gamesPlayed + 1)
        )
      }
    };

    // Если это первая игра
    if (user.gamesPlayed === 0) {
      await unlockAchievement(userId, ACHIEVEMENTS.FIRST_GAME.id);
    }

    // Проверяем достижение за идеальную игру
    if (stats.isPerfect) {
      await unlockAchievement(userId, ACHIEVEMENTS.PERFECT_GAME.id);
    }

    // Проверяем достижение за скорость
    if (stats.averageTime < 3000) {
      await unlockAchievement(userId, ACHIEVEMENTS.SPEED_DEMON.id);
    }

    // Проверяем достижение за серию
    if (stats.bestStreak >= 10) {
      await unlockAchievement(userId, ACHIEVEMENTS.STREAK_MASTER.id);
    }

    // Проверяем достижение ветерана
    if (user.gamesPlayed >= 100) {
      await unlockAchievement(userId, ACHIEVEMENTS.VETERAN.id);
    }

    // Обновляем пользователя
    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true });

    // Получаем новый ранг
    const rankData = await calculateRank(updatedUser.score);

    // Добавляем информацию о ранге в статистику
    stats.newRank = rankData;

    // Обновляем рейтинги
    await Promise.all([
      cacheService.invalidateUserProfile(userId),
      cacheService.invalidateLeaderboardCache('all-time'),
      cacheService.invalidateLeaderboardCache('daily'),
      cacheService.invalidateLeaderboardCache('weekly'),
      cacheService.invalidateLeaderboardCache('monthly')
    ]);

    return stats;
  } catch (err) {
    logger.error(`Error finishing game: ${err.message}`);
    throw err;
  }
};

/**
 * Начать новую игру
 */
const startNewGame = async (userId) => {
  try {
    // Получаем случайные истории
    const stories = await Story.aggregate([
      { $match: { active: true } },
      { $sample: { size: 5 } },
      { $project: { _id: 1, text: 1, options: 1, category: 1, difficulty: 1 } }
    ]);

    if (stories.length < 5) {
      throw new AppError('Недостаточно историй для начала игры', 400);
    }

    // Создаем игровую сессию
    const gameSession = {
      userId,
      stories: stories.map(s => s._id),
      answers: [],
      streak: 0,
      totalScore: 0,
      status: 'active',
      startedAt: new Date()
    };

    return {
      session: gameSession,
      stories
    };
  } catch (err) {
    logger.error(`Error starting new game: ${err.message}`);
    throw err;
  }
};

/**
 * Обработать ответ пользователя
 */
const processAnswer = async (userId, storyId, selectedAnswer, timeSpent, gameSession) => {
  try {
    // Проверяем валидность входных данных
    if (!gameSession.stories.includes(storyId)) {
      throw new AppError('История не найдена в текущей сессии', 400);
    }

    if (timeSpent < 0 || timeSpent > 60000) {
      throw new AppError('Некорректное время ответа', 400);
    }

    // Получаем историю
    const story = await Story.findById(storyId);
    if (!story) {
      throw new AppError('История не найдена', 404);
    }

    // Проверяем правильность ответа
    const isCorrect = story.correctAnswer === selectedAnswer;
    
    // Считаем очки
    let points = 0;
    if (isCorrect) {
      // Базовые очки
      points += POINTS.BASE;
      
      // Бонус за время (максимум при ответе до 5 секунд)
      const timeBonus = Math.max(0, POINTS.TIME_BONUS_MAX * (1 - timeSpent / 5000));
      points += Math.round(timeBonus);
      
      // Бонус за серию
      if (gameSession.streak > 0) {
        points += POINTS.STREAK_BONUS * Math.min(5, gameSession.streak);
      }
    }

    // Обновляем сессию
    gameSession.answers.push({
      storyId,
      selectedAnswer,
      isCorrect,
      timeSpent,
      points
    });

    // Обновляем серию правильных ответов
    if (isCorrect) {
      gameSession.streak++;
      gameSession.totalScore += points;
    } else {
      gameSession.streak = 0;
    }

    // Проверяем завершение игры
    if (gameSession.answers.length === gameSession.stories.length) {
      gameSession.status = 'completed';
      await finishGame(userId, gameSession);
    }

    // Кэшируем обновленную сессию
    await cacheService.cacheGameSession(userId, gameSession);

    return {
      isCorrect,
      points,
      streak: gameSession.streak,
      totalScore: gameSession.totalScore,
      isCompleted: gameSession.status === 'completed'
    };
  } catch (err) {
    logger.error(`Error processing answer: ${err.message}`);
    throw err;
  }
};

// Добавляем функцию для расчета рейтинга по разным критериям
const calculateRating = async (user, type = 'score') => {
  try {
    switch (type) {
      case 'score':
        return {
          value: user.score,
          label: 'Общий счет'
        };
      
      case 'accuracy':
        const accuracy = user.gamesPlayed > 0 
          ? Math.round((user.correctAnswers / (user.gamesPlayed * 5)) * 100)
          : 0;
        return {
          value: accuracy,
          label: 'Точность',
          suffix: '%'
        };
      
      case 'speed':
        return {
          value: user.averageAnswerTime || 0,
          label: 'Среднее время',
          suffix: 'мс'
        };
      
      case 'streak':
        return {
          value: user.bestStreak || 0,
          label: 'Лучшая серия'
        };
      
      case 'achievements':
        return {
          value: user.achievements.length,
          label: 'Достижения'
        };
      
      default:
        throw new Error('Неверный тип рейтинга');
    }
  } catch (err) {
    logger.error(`Error calculating rating: ${err.message}`);
    throw err;
  }
};

module.exports = {
  processAnswer,
  finishGame,
  startNewGame,
  unlockAchievement,
  calculateRank,
  calculateRating,
  POINTS,
  ACHIEVEMENTS,
  RANKS
}; 