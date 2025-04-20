/**
 * Сервис для аналитики и статистики игроков
 * Предоставляет методы для сбора, анализа и получения статистики игроков
 */
const { User, GameSession } = require('../models');
const logger = require('../utils/logger');
const { analyzePlayerStats } = require('../utils/scoreCalculator');
const redisService = require('./redisService');

/**
 * Сервис для работы со статистикой пользователей
 */
const statsService = {
  /**
   * Получить полную статистику пользователя
   * @param {string} userId - ID пользователя
   * @returns {Object} - Объект со статистикой
   */
  getUserStats: async (userId) => {
    try {
      // Получаем основные данные пользователя
      const user = await User.findById(userId);
      
      if (!user) {
        logger.error(`User not found: ${userId}`);
        return null;
      }
      
      // Вычисляем процент правильных ответов
      const correctPercentage = user.gamesPlayed > 0 
        ? Math.round((user.correctAnswers / (user.gamesPlayed * 5)) * 100) 
        : 0;
      
      // Позиция в рейтинге
      let position = null;
      let weeklyPosition = null;
      
      try {
        // Получаем позицию во всех рейтингах
        const allTimeKey = 'leaderboard:all-time';
        position = await redisService.getRank(allTimeKey, userId);
        
        // Получаем позицию в недельном рейтинге
        const date = new Date();
        const year = date.getFullYear();
        const weekNumber = getWeekNumber(date);
        const weeklyKey = `leaderboard:weekly:${year}-${weekNumber}`;
        
        weeklyPosition = await redisService.getRank(weeklyKey, userId);
        
        // Redis возвращает 0-based позицию, прибавляем 1 для human-readable
        if (position !== null) position += 1;
        if (weeklyPosition !== null) weeklyPosition += 1;
      } catch (redisError) {
        logger.error(`Error getting user position: ${redisError.message}`);
        // Не прерываем выполнение в случае ошибки Redis
      }
      
      // Получаем последние игры пользователя (последние 5)
      const recentGames = await User.aggregate([
        { $match: { _id: user._id } },
        {
          $lookup: {
            from: 'gamesessions',
            localField: '_id',
            foreignField: 'userId',
            as: 'games'
          }
        },
        { $unwind: '$games' },
        { $match: { 'games.status': 'completed' } },
        { $sort: { 'games.completedAt': -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: '$games._id',
            totalScore: '$games.totalScore',
            correctAnswers: {
              $size: {
                $filter: {
                  input: '$games.answers',
                  as: 'answer',
                  cond: { $eq: ['$$answer.isCorrect', true] }
                }
              }
            },
            completedAt: '$games.completedAt'
          }
        }
      ]);
      
      // Формируем и возвращаем статистику
      return {
        gamesPlayed: user.gamesPlayed,
        score: user.score,
        correctAnswers: user.correctAnswers,
        correctPercentage,
        bestStreak: user.bestStreak,
        position,
        weeklyPosition,
        recentGames,
        achievements: user.achievements.length
      };
      
    } catch (error) {
      logger.error(`Error in statsService.getUserStats: ${error.message}`);
      throw error;
    }
  },

  /**
   * Получить агрегированную статистику пользователя
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>} - Объект с агрегированной статистикой
   */
  getAggregatedStats: async (userId) => {
    try {
      // Получаем все завершенные игровые сессии пользователя
      const sessions = await GameSession.find({
        userId,
        status: 'completed'
      }).populate('stories');
      
      if (!sessions || sessions.length === 0) {
        return {
          averageScore: 0,
          averageResponseTime: 0,
          categoryDistribution: {},
          difficultyDistribution: {},
          weeklyActivity: {}
        };
      }
      
      // Вычисляем средний счет за игру
      const totalScore = sessions.reduce((sum, session) => sum + session.totalScore, 0);
      const averageScore = Math.round(totalScore / sessions.length);
      
      // Вычисляем среднее время ответа
      let responseTimes = [];
      sessions.forEach(session => {
        session.answers.forEach(answer => {
          if (answer.responseTime) {
            responseTimes.push(answer.responseTime);
          }
        });
      });
      
      const averageResponseTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length)
        : 0;
      
      // Сортируем ответы по категориям и сложности
      const categories = {};
      const difficulties = {
        easy: 0,
        medium: 0,
        hard: 0
      };
      
      sessions.forEach(session => {
        // Если истории загружены, анализируем распределение по категориям и сложности
        if (session.stories && session.stories.length > 0) {
          session.stories.forEach(story => {
            // Подсчет по категориям
            if (story.category) {
              categories[story.category] = (categories[story.category] || 0) + 1;
            }
            
            // Подсчет по сложности
            if (story.difficulty) {
              difficulties[story.difficulty] = (difficulties[story.difficulty] || 0) + 1;
            }
          });
        }
      });
      
      // Анализ активности по неделям
      const weeklyActivity = getWeeklyActivity(sessions);
      
      return {
        averageScore,
        averageResponseTime,
        categoryDistribution: categories,
        difficultyDistribution: difficulties,
        weeklyActivity
      };
    } catch (error) {
      logger.error(`Error getting aggregated stats: ${error.message}`);
      return {
        averageScore: 0,
        averageResponseTime: 0,
        categoryDistribution: {},
        difficultyDistribution: {},
        weeklyActivity: {}
      };
    }
  },

  /**
   * Получить анализ активности по неделям
   * @param {Array} sessions - Массив игровых сессий
   * @returns {Object} - Активность по неделям
   */
  getWeeklyActivity: (sessions) => {
    const weeklyActivity = {};
    
    // Создаем запись для каждой недели за последние 10 недель
    const now = new Date();
    for (let i = 0; i < 10; i++) {
      const weekDate = new Date(now);
      weekDate.setDate(weekDate.getDate() - (i * 7));
      const weekKey = getWeekKey(weekDate);
      weeklyActivity[weekKey] = {
        gamesPlayed: 0,
        averageScore: 0,
        totalScore: 0
      };
    }
    
    // Распределяем сессии по неделям
    sessions.forEach(session => {
      if (session.completedAt) {
        const weekKey = getWeekKey(new Date(session.completedAt));
        
        // Если эта неделя включена в наш диапазон
        if (weeklyActivity[weekKey]) {
          weeklyActivity[weekKey].gamesPlayed += 1;
          weeklyActivity[weekKey].totalScore += session.totalScore || 0;
        }
      }
    });
    
    // Вычисляем средний счет для каждой недели
    Object.keys(weeklyActivity).forEach(week => {
      const activity = weeklyActivity[week];
      if (activity.gamesPlayed > 0) {
        activity.averageScore = Math.round(activity.totalScore / activity.gamesPlayed);
      }
    });
    
    return weeklyActivity;
  },

  /**
   * Получить ключ недели в формате YYYY-WW
   * @param {Date} date - Дата
   * @returns {string} - Ключ недели
   */
  getWeekKey: (date) => {
    const year = date.getFullYear();
    const weekNumber = getWeekNumber(date);
    return `${year}-${weekNumber.toString().padStart(2, '0')}`;
  },

  /**
   * Получить номер недели для даты
   * @param {Date} date - Дата
   * @returns {number} - Номер недели
   */
  getWeekNumber: (date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  },

  /**
   * Получить позицию пользователя в глобальном рейтинге
   * @param {string} userId - ID пользователя
   * @returns {Promise<number|null>} - Позиция пользователя или null
   */
  getUserRankPosition: async (userId) => {
    try {
      // Ключ для глобального рейтинга
      const allTimeKey = 'leaderboard:all-time';
      
      // Получаем позицию (0-based)
      const position = await redisService.getRank(allTimeKey, userId.toString());
      
      // Преобразуем в 1-based для удобства использования
      return position !== null ? position + 1 : null;
    } catch (error) {
      logger.error(`Error getting user rank position: ${error.message}`);
      return null;
    }
  },

  /**
   * Рассчитать процентиль на основе позиции в рейтинге
   * @param {number} position - Позиция пользователя
   * @returns {number} - Процентиль (0-100)
   */
  calculatePercentile: async (position) => {
    try {
      // Получаем общее количество игроков в рейтинге
      const allTimeKey = 'leaderboard:all-time';
      const totalPlayers = await redisService.getLeaderboardSize(allTimeKey);
      
      if (!totalPlayers || totalPlayers === 0) {
        return null;
      }
      
      // Рассчитываем процентиль (позиция 1 = 100%, последняя позиция = 0%)
      return Math.round(((totalPlayers - position) / totalPlayers) * 100);
    } catch (error) {
      logger.error(`Error calculating percentile: ${error.message}`);
      return null;
    }
  },

  /**
   * Получить статистику лучших игроков
   * @param {number} limit - Количество игроков
   * @returns {Promise<Array>} - Массив с данными лучших игроков
   */
  getTopPlayersStats: async (limit = 10) => {
    try {
      // Получаем лучших игроков из рейтинга
      const allTimeKey = 'leaderboard:all-time';
      const topPlayers = await redisService.getLeaderboardRange(allTimeKey, 0, limit - 1);
      
      if (!topPlayers || topPlayers.length === 0) {
        return [];
      }
      
      // Получаем данные пользователей
      const userIds = topPlayers.map(player => player.id);
      const users = await User.find(
        { _id: { $in: userIds } },
        {
          _id: 1,
          username: 1,
          firstName: 1,
          lastName: 1,
          photoUrl: 1,
          score: 1,
          gamesPlayed: 1,
          bestStreak: 1,
          achievements: { $size: '$achievements' }
        }
      );
      
      // Сопоставляем данные рейтинга с данными пользователей
      return topPlayers.map((player, index) => {
        const user = users.find(u => u._id.toString() === player.id);
        if (!user) return null;
        
        return {
          position: index + 1,
          id: user._id,
          username: user.username || `user_${user._id}`,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          photoUrl: user.photoUrl || '',
          score: player.score,
          gamesPlayed: user.gamesPlayed || 0,
          bestStreak: user.bestStreak || 0,
          achievementsCount: user.achievements || 0
        };
      }).filter(Boolean);
    } catch (error) {
      logger.error(`Error getting top players stats: ${error.message}`);
      return [];
    }
  },

  /**
   * Получить общую статистику системы (для админ-панели)
   * @returns {Promise<Object>} - Объект с общей статистикой
   */
  getSystemStats: async () => {
    try {
      // Общее количество пользователей
      const totalUsers = await User.countDocuments();
      
      // Общее количество игровых сессий
      const totalSessions = await GameSession.countDocuments();
      const completedSessions = await GameSession.countDocuments({ status: 'completed' });
      
      // Статистика по активности за последние 7 дней
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const newUsers = await User.countDocuments({ createdAt: { $gte: weekAgo } });
      const activeSessions = await GameSession.countDocuments({ 
        startedAt: { $gte: weekAgo }
      });
      
      // Получаем средний счет за игру
      const averageScoreResult = await GameSession.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, avgScore: { $avg: '$totalScore' } } }
      ]);
      
      const averageScore = averageScoreResult.length > 0 
        ? Math.round(averageScoreResult[0].avgScore)
        : 0;
      
      return {
        users: {
          total: totalUsers,
          newLast7Days: newUsers
        },
        games: {
          totalSessions,
          completedSessions,
          activeLast7Days: activeSessions,
          averageScore
        },
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`Error getting system stats: ${error.message}`);
      return null;
    }
  }
};

module.exports = statsService; 