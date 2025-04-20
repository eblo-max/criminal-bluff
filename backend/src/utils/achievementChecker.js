/**
 * Утилита для проверки и выдачи достижений пользователям
 */
const { User } = require('../models');
const logger = require('./logger');

/**
 * Список всех возможных достижений
 */
const ACHIEVEMENTS = {
  // Базовые достижения
  newbie: {
    name: 'Новичок',
    description: 'Сыграть первую игру',
    checkFn: (user) => user.gamesPlayed > 0
  },
  
  // Достижения за серии
  streak: {
    name: 'Эксперт',
    description: '10 правильных ответов подряд',
    checkFn: (user) => user.bestStreak >= 10
  },
  
  // Достижения за точность
  master: {
    name: 'Мастер дедукции',
    description: '100% точность в игре (5 из 5)',
    checkFn: (user, gameStats) => gameStats && gameStats.correctAnswers === 5
  },
  
  // Достижения за скорость
  speed: {
    name: 'Скоростной детектив',
    description: 'Правильный ответ за 3 секунды',
    checkFn: (user, gameStats) => gameStats && gameStats.fastAnswer
  },
  
  // Достижения за количество игр
  serial: {
    name: 'Серийный игрок',
    description: '100 сыгранных игр',
    checkFn: (user) => user.gamesPlayed >= 100
  }
};

/**
 * Проверить и выдать достижение пользователю
 * @param {string} userId - ID пользователя
 * @param {string} achievementCode - Код достижения
 * @param {Object} [gameStats] - Статистика текущей игры (опционально)
 * @returns {Promise<Object|null>} - Объект достижения или null, если достижение не выдано
 */
const checkAchievements = async (userId, achievementCode, gameStats = null) => {
  try {
    // Проверяем существование достижения
    const achievement = ACHIEVEMENTS[achievementCode];
    if (!achievement) {
      logger.warn(`Unknown achievement code: ${achievementCode}`);
      return null;
    }
    
    // Получаем пользователя
    const user = await User.findById(userId);
    if (!user) {
      logger.error(`User not found for achievement check: ${userId}`);
      return null;
    }
    
    // Проверяем, есть ли уже это достижение у пользователя
    const hasAchievement = user.achievements.some(a => a.name === achievement.name);
    if (hasAchievement) {
      return null; // Достижение уже получено
    }
    
    // Проверяем условие достижения
    if (achievement.checkFn(user, gameStats)) {
      // Добавляем достижение пользователю
      const newAchievement = {
        name: achievement.name,
        description: achievement.description,
        unlockedAt: new Date()
      };
      
      user.achievements.push(newAchievement);
      await user.save();
      
      logger.info(`Achievement unlocked for user ${userId}: ${achievement.name}`);
      return newAchievement;
    }
    
    return null; // Условие достижения не выполнено
  } catch (error) {
    logger.error(`Error checking achievement: ${error.message}`);
    return null;
  }
};

/**
 * Проверить все достижения для пользователя
 * @param {string} userId - ID пользователя
 * @returns {Promise<Array>} - Массив новых достижений
 */
const checkAllAchievements = async (userId) => {
  try {
    // Получаем пользователя
    const user = await User.findById(userId);
    if (!user) {
      logger.error(`User not found for achievements check: ${userId}`);
      return [];
    }
    
    const newAchievements = [];
    
    // Проверяем каждое достижение
    for (const [code, achievement] of Object.entries(ACHIEVEMENTS)) {
      // Проверяем, есть ли уже это достижение у пользователя
      const hasAchievement = user.achievements.some(a => a.name === achievement.name);
      if (hasAchievement) {
        continue; // Достижение уже получено
      }
      
      // Проверяем условие достижения
      if (achievement.checkFn(user)) {
        // Добавляем достижение пользователю
        const newAchievement = {
          name: achievement.name,
          description: achievement.description,
          unlockedAt: new Date()
        };
        
        newAchievements.push(newAchievement);
      }
    }
    
    // Если есть новые достижения, сохраняем их
    if (newAchievements.length > 0) {
      user.achievements.push(...newAchievements);
      await user.save();
      
      logger.info(`${newAchievements.length} new achievements unlocked for user ${userId}`);
    }
    
    return newAchievements;
  } catch (error) {
    logger.error(`Error checking all achievements: ${error.message}`);
    return [];
  }
};

/**
 * Получить список всех доступных достижений
 * @returns {Object} - Список достижений
 */
const getAllAchievements = () => {
  const achievements = {};
  
  for (const [code, achievement] of Object.entries(ACHIEVEMENTS)) {
    achievements[code] = {
      name: achievement.name,
      description: achievement.description
    };
  }
  
  return achievements;
};

module.exports = {
  checkAchievements,
  checkAllAchievements,
  getAllAchievements
}; 