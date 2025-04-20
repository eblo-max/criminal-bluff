/**
 * Настройка планировщика задач (cron)
 * Содержит настройки и инициализацию для периодических задач
 */
const cron = require('node-cron');
const logger = require('../utils/logger');
const leaderboardService = require('../services/leaderboardService');

/**
 * Расписание для публикации дневного лидерборда
 * Запускается каждый день в 23:30
 */
const scheduleDailyLeaderboard = () => {
  try {
    cron.schedule('30 23 * * *', async () => {
      logger.info('Running daily leaderboard publication task');
      try {
        const result = await leaderboardService.publishDailyLeaderboard();
        if (result) {
          logger.info('Successfully published daily leaderboard to Telegram channel');
        } else {
          logger.warn('Failed to publish daily leaderboard to Telegram channel');
        }
      } catch (error) {
        logger.error(`Error in daily leaderboard cron task: ${error.message}`);
      }
    });
    logger.info('Daily leaderboard publication scheduled for 23:30 every day');
  } catch (error) {
    logger.error(`Error scheduling daily leaderboard task: ${error.message}`);
  }
};

/**
 * Расписание для публикации недельного лидерборда
 * Запускается каждое воскресенье в 23:45
 */
const scheduleWeeklyLeaderboard = () => {
  try {
    cron.schedule('45 23 * * 0', async () => {
      logger.info('Running weekly leaderboard publication task');
      try {
        const result = await leaderboardService.publishWeeklyLeaderboard();
        if (result) {
          logger.info('Successfully published weekly leaderboard to Telegram channel');
        } else {
          logger.warn('Failed to publish weekly leaderboard to Telegram channel');
        }
      } catch (error) {
        logger.error(`Error in weekly leaderboard cron task: ${error.message}`);
      }
    });
    logger.info('Weekly leaderboard publication scheduled for 23:45 every Sunday');
  } catch (error) {
    logger.error(`Error scheduling weekly leaderboard task: ${error.message}`);
  }
};

/**
 * Инициализация всех cron-задач
 */
const initScheduler = () => {
  logger.info('Initializing task scheduler');
  
  // Запускаем все задачи по расписанию
  scheduleDailyLeaderboard();
  scheduleWeeklyLeaderboard();
  
  logger.info('Task scheduler initialized successfully');
};

module.exports = {
  initScheduler
}; 