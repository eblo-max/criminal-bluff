/**
 * Контроллер уведомлений
 * Содержит методы для работы с уведомлениями пользователей
 */
const telegramService = require('../config/telegram');
const leaderboardController = require('./leaderboardController');
const redisService = require('../services/redisService');
const logger = require('../utils/logger');
const { User } = require('../models');

/**
 * Отправить уведомление о достижении
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.sendAchievementNotification = async (req, res) => {
  try {
    const { userId, achievement } = req.body;

    if (!userId || !achievement) {
      return res.status(400).json({
        success: false,
        message: 'Не указан ID пользователя или информация о достижении'
      });
    }

    // Находим пользователя
    const user = await User.findById(userId);

    if (!user || !user.telegramId) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден или не указан Telegram ID'
      });
    }

    // Отправляем уведомление
    const result = await telegramService.sendAchievementNotification(user.telegramId, achievement);

    if (result) {
      // Если настроено, публикуем достижение в канал
      if (achievement.shouldPublish) {
        await telegramService.publishAchievementToChannel(achievement, {
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Уведомление о достижении успешно отправлено',
        result
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Не удалось отправить уведомление'
      });
    }
  } catch (error) {
    logger.error(`Error sending achievement notification: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: `Ошибка при отправке уведомления: ${error.message}`
    });
  }
};

/**
 * Отправить уведомление о позиции в рейтинге
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.sendLeaderboardPositionNotification = async (req, res) => {
  try {
    const { userId, position, type = 'all-time' } = req.body;

    if (!userId || !position) {
      return res.status(400).json({
        success: false,
        message: 'Не указан ID пользователя или позиция в рейтинге'
      });
    }

    const result = await leaderboardController.notifyUserAboutRanking(userId, position, type);

    if (result) {
      return res.status(200).json({
        success: true,
        message: 'Уведомление о позиции в рейтинге успешно отправлено'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Не удалось отправить уведомление'
      });
    }
  } catch (error) {
    logger.error(`Error sending leaderboard position notification: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: `Ошибка при отправке уведомления: ${error.message}`
    });
  }
};

/**
 * Отправить уведомление всем пользователям
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.sendBulkNotification = async (req, res) => {
  try {
    const { message, filter, options } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Не указан текст сообщения'
      });
    }

    // Запрос на получение пользователей с применением фильтра
    let query = {};
    
    if (filter) {
      // Пример фильтра: { minScore: 100, lastActive: "7days" }
      if (filter.minScore) {
        query.score = { $gte: parseInt(filter.minScore) };
      }
      
      if (filter.lastActive) {
        let date = new Date();
        if (filter.lastActive === '24hours') {
          date.setHours(date.getHours() - 24);
        } else if (filter.lastActive === '7days') {
          date.setDate(date.getDate() - 7);
        } else if (filter.lastActive === '30days') {
          date.setDate(date.getDate() - 30);
        }
        query.lastActive = { $gte: date };
      }
    }
    
    // Только пользователи с Telegram ID
    query.telegramId = { $exists: true, $ne: null };
    
    const users = await User.find(query);
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Нет пользователей, подходящих под указанные критерии'
      });
    }
    
    // Отправляем сообщения пользователям (с ограничением скорости)
    const results = {
      total: users.length,
      succeeded: 0,
      failed: 0
    };
    
    for (const user of users) {
      try {
        // Отправляем сообщение каждому пользователю
        const sendResult = await telegramService.sendMessage(user.telegramId, message, options);
        
        if (sendResult) {
          results.succeeded++;
        } else {
          results.failed++;
        }
        
        // Небольшая задержка, чтобы не превысить лимиты Telegram API
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        logger.error(`Error sending message to user ${user._id}: ${err.message}`);
        results.failed++;
      }
    }
    
    return res.status(200).json({
      success: true,
      message: `Массовая рассылка завершена`,
      results
    });
  } catch (error) {
    logger.error(`Error sending bulk notification: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: `Ошибка при массовой рассылке: ${error.message}`
    });
  }
};

/**
 * Публикация сообщения в Telegram канал
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
exports.publishToChannel = async (req, res) => {
  try {
    const { text, parseMode = 'HTML' } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Не указан текст сообщения'
      });
    }
    
    const channelId = process.env.TELEGRAM_CHANNEL_ID;
    
    if (!channelId) {
      return res.status(500).json({
        success: false,
        message: 'ID канала не настроен в переменных окружения'
      });
    }
    
    const result = await telegramService.bot.sendMessage(channelId, text, {
      parse_mode: parseMode
    });
    
    if (result) {
      return res.status(200).json({
        success: true,
        message: 'Сообщение успешно опубликовано в канал',
        messageId: result.message_id
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Не удалось опубликовать сообщение в канал'
      });
    }
  } catch (error) {
    logger.error(`Error publishing to channel: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: `Ошибка при публикации в канал: ${error.message}`
    });
  }
}; 