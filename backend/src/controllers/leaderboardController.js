/**
 * Контроллер для управления рейтингами
 */
const { User } = require('../models');
const redisService = require('../services/redisService');
const logger = require('../utils/logger');
const telegramService = require('../config/telegram');
const { startTransaction, captureException } = require('../config/sentry');

/**
 * Получить глобальный рейтинг (за все время)
 */
async function getGlobalLeaderboard(req, res) {
  const transaction = startTransaction({
    op: 'leaderboard',
    name: 'get_global_leaderboard'
  });

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    
    // Ключ для глобального рейтинга в Redis
    const leaderboardKey = 'leaderboard:all-time';
    
    // Получаем записи из рейтинга с позициями (от лучших к худшим)
    const leaderboardData = await redisService.getLeaderboardRange(leaderboardKey, start, end);
    
    if (!leaderboardData || leaderboardData.length === 0) {
      transaction.setStatus('data_error');
      transaction.finish();
      return res.status(200).json({
        success: true,
        message: 'Рейтинг пуст или еще не сформирован',
        leaderboard: [],
        pagination: {
          total: 0,
          page,
          limit,
          pages: 0
        }
      });
    }
    
    // Получаем общее количество записей в рейтинге
    const total = await redisService.getLeaderboardSize(leaderboardKey);
    
    // Получаем пользовательские данные для ID из рейтинга
    const userIds = leaderboardData.map(entry => entry.id);
    const users = await User.find(
      { _id: { $in: userIds } },
      {
        _id: 1,
        username: 1,
        firstName: 1,
        lastName: 1,
        photoUrl: 1,
        score: 1
      }
    );
    
    // Сопоставляем данные рейтинга с данными пользователей
    const leaderboard = leaderboardData.map((entry, index) => {
      const user = users.find(u => u._id.toString() === entry.id);
      if (!user) return null;
      
      return {
        position: start + index + 1, // Позиция в рейтинге (1-based)
        id: user._id,
        username: user.username || `user_${user._id}`,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        photoUrl: user.photoUrl || '',
        score: entry.score // Берем счет из Redis для точности
      };
    }).filter(Boolean); // Удаляем null значения
    
    transaction.finish();
    
    return res.status(200).json({
      success: true,
      message: 'Глобальный рейтинг успешно получен',
      leaderboard,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    transaction.setStatus('error');
    transaction.finish();
    
    captureException(error, {
      tags: {
        component: 'leaderboardController',
        method: 'getGlobalLeaderboard'
      }
    });
    
    logger.error(`Error getting global leaderboard: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении глобального рейтинга'
    });
  }
}

/**
 * Получить еженедельный рейтинг
 */
async function getWeeklyLeaderboard(req, res) {
  const transaction = startTransaction({
    op: 'leaderboard',
    name: 'get_weekly_leaderboard'
  });

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    
    // Получаем текущий номер недели для ключа
    const currentDate = new Date();
    const weekNumber = getWeekNumber(currentDate);
    const year = currentDate.getFullYear();
    
    // Ключ для еженедельного рейтинга в Redis
    const leaderboardKey = `leaderboard:weekly:${year}-${weekNumber}`;
    
    // Получаем записи из рейтинга с позициями (от лучших к худшим)
    const leaderboardData = await redisService.getLeaderboardRange(leaderboardKey, start, end);
    
    if (!leaderboardData || leaderboardData.length === 0) {
      transaction.setStatus('data_error');
      transaction.finish();
      return res.status(200).json({
        success: true,
        message: 'Еженедельный рейтинг пуст или еще не сформирован',
        leaderboard: [],
        week: {
          year,
          week: weekNumber
        },
        pagination: {
          total: 0,
          page,
          limit,
          pages: 0
        }
      });
    }
    
    // Получаем общее количество записей в рейтинге
    const total = await redisService.getLeaderboardSize(leaderboardKey);
    
    // Получаем пользовательские данные для ID из рейтинга
    const userIds = leaderboardData.map(entry => entry.id);
    const users = await User.find(
      { _id: { $in: userIds } },
      {
        _id: 1,
        username: 1,
        firstName: 1,
        lastName: 1,
        photoUrl: 1
      }
    );
    
    // Сопоставляем данные рейтинга с данными пользователей
    const leaderboard = leaderboardData.map((entry, index) => {
      const user = users.find(u => u._id.toString() === entry.id);
      if (!user) return null;
      
      return {
        position: start + index + 1, // Позиция в рейтинге (1-based)
        id: user._id,
        username: user.username || `user_${user._id}`,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        photoUrl: user.photoUrl || '',
        score: entry.score // Берем счет из Redis для точности
      };
    }).filter(Boolean); // Удаляем null значения
    
    transaction.finish();
    
    return res.status(200).json({
      success: true,
      message: 'Еженедельный рейтинг успешно получен',
      leaderboard,
      week: {
        year,
        week: weekNumber
      },
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    transaction.setStatus('error');
    transaction.finish();
    
    captureException(error, {
      tags: {
        component: 'leaderboardController',
        method: 'getWeeklyLeaderboard'
      }
    });
    
    logger.error(`Error getting weekly leaderboard: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении еженедельного рейтинга'
    });
  }
}

/**
 * Получить ежедневный рейтинг
 */
async function getDailyLeaderboard(req, res) {
  const transaction = startTransaction({
    op: 'leaderboard',
    name: 'get_daily_leaderboard'
  });

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    
    // Получаем текущую дату для ключа
    const currentDate = new Date();
    const formattedDate = currentDate.toISOString().split('T')[0]; // Формат YYYY-MM-DD
    
    // Ключ для дневного рейтинга в Redis
    const leaderboardKey = `leaderboard:daily:${formattedDate}`;
    
    // Получаем записи из рейтинга с позициями (от лучших к худшим)
    const leaderboardData = await redisService.getLeaderboardRange(leaderboardKey, start, end);
    
    if (!leaderboardData || leaderboardData.length === 0) {
      transaction.setStatus('data_error');
      transaction.finish();
      return res.status(200).json({
        success: true,
        message: 'Дневной рейтинг пуст или еще не сформирован',
        leaderboard: [],
        date: formattedDate,
        pagination: {
          total: 0,
          page,
          limit,
          pages: 0
        }
      });
    }
    
    // Получаем общее количество записей в рейтинге
    const total = await redisService.getLeaderboardSize(leaderboardKey);
    
    // Получаем пользовательские данные для ID из рейтинга
    const userIds = leaderboardData.map(entry => entry.id);
    const users = await User.find(
      { _id: { $in: userIds } },
      {
        _id: 1,
        username: 1,
        firstName: 1,
        lastName: 1,
        photoUrl: 1
      }
    );
    
    // Сопоставляем данные рейтинга с данными пользователей
    const leaderboard = leaderboardData.map((entry, index) => {
      const user = users.find(u => u._id.toString() === entry.id);
      if (!user) return null;
      
      return {
        position: start + index + 1, // Позиция в рейтинге (1-based)
        id: user._id,
        username: user.username || `user_${user._id}`,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        photoUrl: user.photoUrl || '',
        score: entry.score // Берем счет из Redis для точности
      };
    }).filter(Boolean); // Удаляем null значения
    
    transaction.finish();
    
    return res.status(200).json({
      success: true,
      message: 'Дневной рейтинг успешно получен',
      leaderboard,
      date: formattedDate,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    transaction.setStatus('error');
    transaction.finish();
    
    captureException(error, {
      tags: {
        component: 'leaderboardController',
        method: 'getDailyLeaderboard'
      }
    });
    
    logger.error(`Error getting daily leaderboard: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении дневного рейтинга'
    });
  }
}

/**
 * Получить позицию пользователя в рейтингах
 */
async function getUserPosition(req, res) {
  const transaction = startTransaction({
    op: 'leaderboard',
    name: 'get_user_position'
  });

  try {
    const userId = req.user._id.toString();
    
    // Получаем позицию пользователя в глобальном рейтинге
    const globalKey = 'leaderboard:all-time';
    let globalPosition = await redisService.getRank(globalKey, userId);
    
    // Если позиция найдена, прибавляем 1 для human-readable (Redis возвращает 0-based индекс)
    if (globalPosition !== null) {
      globalPosition += 1;
    }
    
    // Получаем текущий номер недели для ключа
    const currentDate = new Date();
    const weekNumber = getWeekNumber(currentDate);
    const year = currentDate.getFullYear();
    
    // Ключ для еженедельного рейтинга в Redis
    const weeklyKey = `leaderboard:weekly:${year}-${weekNumber}`;
    
    // Получаем позицию пользователя в еженедельном рейтинге
    let weeklyPosition = await redisService.getRank(weeklyKey, userId);
    
    // Если позиция найдена, прибавляем 1 для human-readable (Redis возвращает 0-based индекс)
    if (weeklyPosition !== null) {
      weeklyPosition += 1;
    }
    
    // Получаем глобальный и еженедельный счет пользователя
    const globalScore = await redisService.getScore(globalKey, userId) || 0;
    const weeklyScore = await redisService.getScore(weeklyKey, userId) || 0;
    
    // Получаем ключ дневного рейтинга и позицию пользователя
    const formattedDate = currentDate.toISOString().split('T')[0];
    const dailyKey = `leaderboard:daily:${formattedDate}`;
    
    let dailyPosition = await redisService.getRank(dailyKey, userId);
    if (dailyPosition !== null) {
      dailyPosition += 1;
    }
    
    const dailyScore = await redisService.getScore(dailyKey, userId) || 0;
    
    transaction.finish();
    
    return res.status(200).json({
      success: true,
      message: 'Позиция пользователя в рейтингах успешно получена',
      positions: {
        global: {
          position: globalPosition,
          score: globalScore
        },
        weekly: {
          position: weeklyPosition,
          score: weeklyScore,
          year,
          week: weekNumber
        },
        daily: {
          position: dailyPosition,
          score: dailyScore,
          date: formattedDate
        }
      }
    });
    
  } catch (error) {
    transaction.setStatus('error');
    transaction.finish();
    
    captureException(error, {
      tags: {
        component: 'leaderboardController',
        method: 'getUserPosition'
      }
    });
    
    logger.error(`Error getting user position: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении позиции пользователя в рейтингах'
    });
  }
}

/**
 * Получить соседей пользователя в рейтинге
 */
async function getUserNeighbors(req, res) {
  const transaction = startTransaction({
    op: 'leaderboard',
    name: 'get_user_neighbors'
  });

  try {
    const userId = req.user._id.toString();
    const range = parseInt(req.query.range) || 5; // Количество соседей в каждую сторону
    
    // Ключ для глобального рейтинга в Redis
    const leaderboardKey = 'leaderboard:all-time';
    
    // Получаем позицию пользователя в рейтинге
    let userPosition = await redisService.getRank(leaderboardKey, userId);
    
    if (userPosition === null) {
      transaction.finish();
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден в рейтинге'
      });
    }
    
    // Вычисляем диапазон для получения соседей
    const startAbove = Math.max(0, userPosition - range);
    const endBelow = Math.min(userPosition + range, await redisService.getLeaderboardSize(leaderboardKey) - 1);
    
    // Получаем записи из рейтинга для заданного диапазона
    const leaderboardData = await redisService.getLeaderboardRange(leaderboardKey, startAbove, endBelow);
    
    if (!leaderboardData || leaderboardData.length === 0) {
      transaction.finish();
      return res.status(200).json({
        success: true,
        message: 'Нет соседей в рейтинге',
        neighbors: [],
        userPosition: userPosition + 1 // +1 для human-readable
      });
    }
    
    // Получаем пользовательские данные для ID из рейтинга
    const userIds = leaderboardData.map(entry => entry.id);
    const users = await User.find(
      { _id: { $in: userIds } },
      {
        _id: 1,
        username: 1,
        firstName: 1,
        lastName: 1,
        photoUrl: 1
      }
    );
    
    // Сопоставляем данные рейтинга с данными пользователей
    const neighbors = leaderboardData.map((entry, index) => {
      const user = users.find(u => u._id.toString() === entry.id);
      if (!user) return null;
      
      return {
        position: startAbove + index + 1, // Позиция в рейтинге (1-based)
        id: user._id,
        username: user.username || `user_${user._id}`,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        photoUrl: user.photoUrl || '',
        score: entry.score, // Берем счет из Redis для точности
        isCurrent: entry.id === userId
      };
    }).filter(Boolean); // Удаляем null значения
    
    transaction.finish();
    
    return res.status(200).json({
      success: true,
      message: 'Соседи пользователя в рейтинге успешно получены',
      neighbors,
      userPosition: userPosition + 1 // +1 для human-readable
    });
    
  } catch (error) {
    transaction.setStatus('error');
    transaction.finish();
    
    captureException(error, {
      tags: {
        component: 'leaderboardController',
        method: 'getUserNeighbors'
      }
    });
    
    logger.error(`Error getting user neighbors: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении соседей пользователя в рейтинге'
    });
  }
}

/**
 * Вспомогательная функция для получения номера недели
 * @param {Date} date - Дата
 * @returns {Number} Номер недели (1-53)
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Автоматическая публикация обновлений рейтинга в Telegram канал
 * @param {string} leaderboardType - Тип лидерборда ('daily', 'weekly', 'all-time')
 * @returns {Promise<boolean>} - Успешность публикации
 */
async function publishLeaderboardToTelegram(leaderboardType = 'weekly') {
    const transaction = startTransaction({
        op: 'leaderboard',
        name: 'publish_leaderboard_to_telegram'
    });

    try {
        // Получаем топ-3 из соответствующего лидерборда
        let key;
        if (leaderboardType === 'daily') {
            const today = new Date();
            const dateStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
            key = `leaderboard:daily:${dateStr}`;
        } else if (leaderboardType === 'weekly') {
            const now = new Date();
            const weekNumber = getWeekNumber(now);
            key = `leaderboard:weekly:${now.getFullYear()}-${weekNumber}`;
        } else {
            key = 'leaderboard:global';
        }

        // Получаем топ-3 из Redis
        const leaderboardData = await redisService.getLeaderboardRange(key, 0, 2);
        
        if (!leaderboardData || leaderboardData.length === 0) {
            logger.warn(`No data found for leaderboard type: ${leaderboardType}`);
            transaction.setStatus('data_error');
            transaction.finish();
            return false;
        }

        // Форматируем данные для отправки
        const formattedLeaderboard = leaderboardData.map(item => ({
            userId: item.member,
            firstName: item.firstName || 'Игрок',
            lastName: item.lastName || '',
            score: item.score
        }));

        // Публикуем в Telegram канал
        const result = await telegramService.publishLeaderboardToChannel(formattedLeaderboard, leaderboardType);
        
        if (result) {
            logger.info(`Published ${leaderboardType} leaderboard to Telegram channel successfully`);
            transaction.finish();
            return true;
        } else {
            logger.warn(`Failed to publish ${leaderboardType} leaderboard to Telegram channel`);
            transaction.setStatus('error');
            transaction.finish();
            return false;
        }
    } catch (error) {
        logger.error(`Error publishing leaderboard to Telegram: ${error.message}`);
        transaction.setStatus('error');
        transaction.finish();
        return false;
    }
}

/**
 * Публикация индивидуального достижения в рейтинге
 * @param {string} userId - ID пользователя
 * @param {number} position - Позиция в рейтинге
 * @param {string} type - Тип рейтинга ('daily', 'weekly', 'all-time')
 * @returns {Promise<boolean>} - Успешность публикации
 */
async function notifyUserAboutRanking(userId, position, type) {
    const transaction = startTransaction({
        op: 'leaderboard',
        name: 'notify_user_about_ranking'
    });

    try {
        // Получаем данные пользователя
        const userData = await redisService.getUserDataById(userId);
        
        if (!userData || !userData.telegramId) {
            logger.warn(`Cannot notify user ${userId} about ranking: user data or telegramId not found`);
            transaction.setStatus('user_not_found');
            transaction.finish();
            return false;
        }

        // Отправляем личное уведомление пользователю
        const personalResult = await telegramService.sendLeaderboardNotification(
            userData.telegramId, 
            position, 
            type
        );

        // Если пользователь в топ-3, публикуем особое сообщение в канал
        if (position <= 3) {
            // Получаем данные лидерборда для определения типа
            let leaderboardKey;
            if (type === 'daily') {
                const today = new Date();
                const dateStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
                leaderboardKey = `leaderboard:daily:${dateStr}`;
            } else if (type === 'weekly') {
                const now = new Date();
                const weekNumber = getWeekNumber(now);
                leaderboardKey = `leaderboard:weekly:${now.getFullYear()}-${weekNumber}`;
            } else {
                leaderboardKey = 'leaderboard:global';
            }

            // Получаем топ-3 из Redis
            const leaderboardData = await redisService.getLeaderboardRange(leaderboardKey, 0, 2);
            
            if (!leaderboardData || leaderboardData.length === 0) {
                logger.warn(`No data found for leaderboard type: ${type}`);
                transaction.setStatus('data_error');
                transaction.finish();
                return !!personalResult;
            }

            // Форматируем данные для отправки
            const formattedLeaderboard = leaderboardData.map(item => ({
                userId: item.member,
                firstName: item.firstName || 'Игрок',
                lastName: item.lastName || '',
                score: item.score
            }));

            // Публикуем в Telegram канал
            const channelResult = await telegramService.publishLeaderboardToChannel(formattedLeaderboard, type);
            
            logger.info(`Published user rank achievement to Telegram: personal notification=${!!personalResult}, channel publication=${!!channelResult}`);
            transaction.finish();
            return !!personalResult || !!channelResult;
        }

        logger.info(`Sent leaderboard position notification to user ${userId}, position: ${position}, type: ${type}`);
        transaction.finish();
        return !!personalResult;
    } catch (error) {
        logger.error(`Error notifying user about ranking: ${error.message}`);
        transaction.setStatus('error');
        transaction.finish();
        return false;
    }
}

// Экспортируем функции
module.exports = {
    getGlobalLeaderboard,
    getWeeklyLeaderboard,
    getDailyLeaderboard,
    getUserPosition,
    getUserNeighbors,
    getAllTimeLeaderboard: getGlobalLeaderboard,
    publishLeaderboardToTelegram,
    notifyUserAboutRanking
};