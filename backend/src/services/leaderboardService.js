/**
 * Leaderboard service
 * Сервис для работы с рейтингами игроков
 */
const redisService = require('./redisService');
const { User } = require('../models');
const logger = require('../utils/logger');
const leaderboardController = require('../controllers/leaderboardController');

/**
 * Обновить рейтинги пользователя
 * @param {string} userId - ID пользователя
 * @param {number} gameScore - Очки, полученные за игру
 * @param {number} totalScore - Общее количество очков пользователя
 * @returns {Promise<boolean>} - Успешность обновления
 */
const updateUserLeaderboards = async (userId, gameScore, totalScore) => {
  try {
    // Проверяем входные данные
    if (!userId || gameScore === undefined || totalScore === undefined) {
      logger.error('Invalid parameters for updateUserLeaderboards');
      return false;
    }

    // Сегодняшняя дата в формате YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    
    // Получаем текущий номер недели для ключа
    const currentDate = new Date();
    const weekNumber = getWeekNumber(currentDate);
    const year = currentDate.getFullYear();
    
    // Ключи для сортированных множеств в Redis
    const dailyKey = `leaderboard:daily:${today}`;
    const weeklyKey = `leaderboard:weekly:${year}-${weekNumber}`;
    const allTimeKey = 'leaderboard:all-time';
    
    // ID пользователя в строковом формате, если еще не строка
    const userIdStr = userId.toString();
    
    // Сохраняем предыдущие позиции пользователя для отслеживания изменений
    const prevDailyRank = await redisService.getRank(dailyKey, userIdStr);
    const prevWeeklyRank = await redisService.getRank(weeklyKey, userIdStr);
    const prevAllTimeRank = await redisService.getRank(allTimeKey, userIdStr);
    
    // Обновление рейтингов
    await Promise.all([
      // Для ежедневного рейтинга добавляем очки за текущую игру
      redisService.addToSortedSet(dailyKey, gameScore, userIdStr),
      // Для недельного рейтинга получаем текущий счет и добавляем очки за текущую игру
      updateWeeklyLeaderboard(weeklyKey, userIdStr, gameScore),
      // Для глобального рейтинга используем общее количество очков пользователя
      redisService.addToSortedSet(allTimeKey, totalScore, userIdStr)
    ]);
    
    // Устанавливаем время жизни для дневного и недельного рейтингов
    await Promise.all([
      redisService.setValue(`${dailyKey}:expires`, 1, 86400), // 24 часа
      redisService.setValue(`${weeklyKey}:expires`, 1, 604800) // 7 дней
    ]);
    
    // Проверяем, изменилась ли позиция пользователя и отправляем уведомления
    await Promise.all([
      checkRankChangeAndNotify(userIdStr, dailyKey, prevDailyRank, 'daily'),
      checkRankChangeAndNotify(userIdStr, weeklyKey, prevWeeklyRank, 'weekly'),
      checkRankChangeAndNotify(userIdStr, allTimeKey, prevAllTimeRank, 'all-time')
    ]);
    
    return true;
  } catch (error) {
    logger.error(`Error updating leaderboards: ${error.message}`);
    return false;
  }
};

/**
 * Проверка изменения ранга пользователя и отправка уведомления, если необходимо
 * @param {string} userId - ID пользователя
 * @param {string} leaderboardKey - Ключ лидерборда
 * @param {number|null} prevRank - Предыдущий ранг (0-based)
 * @param {string} leaderboardType - Тип лидерборда ('daily', 'weekly', 'all-time')
 * @returns {Promise<boolean>} - Результат операции
 */
const checkRankChangeAndNotify = async (userId, leaderboardKey, prevRank, leaderboardType) => {
  try {
    // Получаем новый ранг
    const newRank = await redisService.getRank(leaderboardKey, userId);
    
    // Если это первое попадание пользователя в рейтинг
    if (prevRank === null && newRank !== null) {
      // Человекочитаемый ранг (1-based)
      const humanReadableRank = newRank + 1;
      
      // Если пользователь попал в топ-10, отправляем уведомление
      if (humanReadableRank <= 10) {
        await leaderboardController.notifyUserAboutRanking(userId, humanReadableRank, leaderboardType);
        return true;
      }
    } 
    // Если пользователь поднялся в рейтинге
    else if (prevRank !== null && newRank !== null && newRank < prevRank) {
      // Значительное изменение ранга или попадание в топ (порог можно настроить)
      const rankDifference = prevRank - newRank;
      const humanReadableRank = newRank + 1;
      
      // Условия для отправки уведомления:
      // 1. Пользователь попал в топ-3
      // 2. Пользователь попал в топ-10 и поднялся минимум на 3 позиции
      // 3. Пользователь поднялся минимум на 10 позиций
      if (humanReadableRank <= 3 || 
          (humanReadableRank <= 10 && rankDifference >= 3) || 
          rankDifference >= 10) {
        await leaderboardController.notifyUserAboutRanking(userId, humanReadableRank, leaderboardType);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    logger.error(`Error checking rank change: ${error.message}`);
    return false;
  }
};

/**
 * Обновление еженедельного рейтинга
 * @param {string} weeklyKey - Ключ еженедельного рейтинга
 * @param {string} userId - ID пользователя
 * @param {number} score - Очки за текущую игру
 * @returns {Promise<void>}
 */
const updateWeeklyLeaderboard = async (weeklyKey, userId, score) => {
  try {
    // Получаем текущий счет пользователя в еженедельном рейтинге
    const currentScore = await redisService.getScore(weeklyKey, userId) || 0;
    
    // Обновляем счет, добавляя очки за текущую игру
    const newScore = currentScore + score;
    
    // Записываем обновленный счет
    await redisService.addToSortedSet(weeklyKey, newScore, userId);
  } catch (error) {
    logger.error(`Error updating weekly leaderboard: ${error.message}`);
    throw error;
  }
};

/**
 * Получение недельного рейтинга в формате YYYY-WW
 * @param {Date} date - Дата
 * @returns {number} - Номер недели (1-53)
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Публикация еженедельного лидерборда по расписанию (крон)
 * @returns {Promise<boolean>} - Успешность публикации
 */
const publishWeeklyLeaderboard = async () => {
  try {
    return await leaderboardController.publishLeaderboardToTelegram('weekly');
  } catch (error) {
    logger.error(`Error publishing weekly leaderboard: ${error.message}`);
    return false;
  }
};

/**
 * Публикация дневного лидерборда по расписанию (крон)
 * @returns {Promise<boolean>} - Успешность публикации
 */
const publishDailyLeaderboard = async () => {
  try {
    return await leaderboardController.publishLeaderboardToTelegram('daily');
  } catch (error) {
    logger.error(`Error publishing daily leaderboard: ${error.message}`);
    return false;
  }
};

module.exports = {
  updateUserLeaderboards,
  getWeekNumber,
  publishWeeklyLeaderboard,
  publishDailyLeaderboard,
  checkRankChangeAndNotify
}; 