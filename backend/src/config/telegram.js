/**
 * Конфигурация Telegram бота
 * Содержит настройки и инициализацию для работы с Telegram API
 */
const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');

// Инициализация бота
const token = process.env.TELEGRAM_BOT_TOKEN;
let bot = null;

/**
 * Инициализация бота и настройка вебхуков
 */
const initializeBot = () => {
  try {
    // Проверяем наличие токена
    if (!token) {
      logger.warn('Telegram bot token is not set, bot features will be disabled');
      return null;
    }

    if (process.env.NODE_ENV === 'production') {
      // Используем webhook в production
      const domain = process.env.TELEGRAM_WEBHOOK_DOMAIN;
      
      if (!domain) {
        logger.error('Telegram webhook domain is not set in production mode');
        return null;
      }
      
      const webhookPath = `/telegram-webhook/${token}`;
      const webhookUrl = `${domain}${webhookPath}`;
      
      // Создаем бота в режиме webhook
      bot = new TelegramBot(token);
      
      // Устанавливаем webhook
      bot.setWebHook(webhookUrl)
        .then(() => logger.info(`Telegram webhook set to ${webhookUrl}`))
        .catch(err => logger.error(`Error setting Telegram webhook: ${err.message}`));
      
      return {
        bot,
        webhookPath
      };
    } else {
      // Используем long polling в development
      bot = new TelegramBot(token, { polling: true });
      logger.info('Telegram bot started in polling mode');
      
      // Обрабатываем ошибки
      bot.on('polling_error', (error) => {
        logger.error(`Telegram polling error: ${error.message}`);
      });
      
      return {
        bot,
        webhookPath: null
      };
    }
  } catch (error) {
    logger.error(`Error initializing Telegram bot: ${error.message}`);
    return null;
  }
};

/**
 * Отправить сообщение пользователю
 * @param {number} chatId - ID чата (telegramId пользователя)
 * @param {string} text - Текст сообщения
 * @param {Object} options - Опции сообщения
 * @returns {Promise<Object|null>} - Результат отправки сообщения
 */
const sendMessage = async (chatId, text, options = {}) => {
  try {
    if (!bot) {
      logger.warn('Trying to send message, but bot is not initialized');
      return null;
    }
    
    return await bot.sendMessage(chatId, text, options);
  } catch (error) {
    logger.error(`Error sending Telegram message: ${error.message}`);
    return null;
  }
};

/**
 * Отправить уведомление о достижении
 * @param {number} telegramId - Telegram ID пользователя
 * @param {Object} achievement - Достижение пользователя
 * @returns {Promise<Object|null>} - Результат отправки сообщения
 */
const sendAchievementNotification = async (telegramId, achievement) => {
  if (!telegramId || !achievement) return null;
  
  const text = `🏆 Поздравляем! Вы получили новое достижение!\n\n` +
    `<b>${achievement.name}</b>\n` +
    `${achievement.description}\n\n` +
    `Продолжайте играть в "Криминальный Блеф", чтобы открыть больше достижений!`;
  
  return await sendMessage(telegramId, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 Играть сейчас', web_app: { url: process.env.TELEGRAM_WEB_APP_URL } }]
      ]
    }
  });
};

/**
 * Отправить уведомление о рекорде в рейтинге
 * @param {number} telegramId - Telegram ID пользователя
 * @param {number} position - Позиция в рейтинге
 * @param {string} period - Период рейтинга ('daily', 'weekly', 'all-time')
 * @returns {Promise<Object|null>} - Результат отправки сообщения
 */
const sendLeaderboardNotification = async (telegramId, position, period) => {
  if (!telegramId || !position) return null;
  
  let periodText = '';
  switch (period) {
    case 'daily':
      periodText = 'дневном';
      break;
    case 'weekly':
      periodText = 'недельном';
      break;
    case 'all-time':
      periodText = 'общем';
      break;
    default:
      periodText = 'общем';
  }
  
  const text = `🏅 Поздравляем! Вы поднялись на ${position} место в ${periodText} рейтинге!\n\n` +
    `Продолжайте в том же духе, чтобы стать лучшим детективом!`;
  
  return await sendMessage(telegramId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 Играть сейчас', web_app: { url: process.env.TELEGRAM_WEB_APP_URL } }],
        [{ text: '📊 Посмотреть рейтинг', web_app: { url: `${process.env.TELEGRAM_WEB_APP_URL}?start=leaderboard` } }]
      ]
    }
  });
};

/**
 * Публикация результатов игры в канал
 * @param {Object} gameResult - Результаты игры пользователя
 * @param {Object} user - Информация о пользователе
 * @returns {Promise<Object|null>} - Результат отправки сообщения
 */
const publishGameResultToChannel = async (gameResult, user) => {
  try {
    if (!bot) {
      logger.warn('Trying to publish to channel, but bot is not initialized');
      return null;
    }
    
    // ID канала из переменных окружения
    const channelId = process.env.TELEGRAM_CHANNEL_ID;
    
    if (!channelId) {
      logger.warn('Telegram channel ID is not set, cannot publish game result');
      return null;
    }
    
    // Формируем текст сообщения
    const text = `🕵️‍♂️ <b>Новый рекорд в игре "Криминальный Блеф"!</b>\n\n` +
      `Игрок: <b>${user.firstName} ${user.lastName || ''}</b>\n` +
      `Счет: <b>${gameResult.totalScore}</b> очков\n` +
      `Правильных ответов: <b>${gameResult.correctAnswers}/${gameResult.totalQuestions}</b>\n` +
      `Лучшая серия: <b>${gameResult.bestStreak}</b>\n\n` +
      `🎮 Сможете ли вы побить этот рекорд?`;
    
    // Отправляем сообщение в канал
    const result = await bot.sendMessage(channelId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎮 Играть', web_app: { url: process.env.TELEGRAM_WEB_APP_URL } }]
        ]
      }
    });
    
    logger.info(`Game result published to channel: ${channelId}, message ID: ${result.message_id}`);
    return result;
  } catch (error) {
    logger.error(`Error publishing game result to channel: ${error.message}`);
    return null;
  }
};

/**
 * Публикация новых достижений пользователя в канал
 * @param {Object} achievement - Информация о достижении
 * @param {Object} user - Информация о пользователе
 * @returns {Promise<Object|null>} - Результат отправки сообщения
 */
const publishAchievementToChannel = async (achievement, user) => {
  try {
    if (!bot) {
      logger.warn('Trying to publish to channel, but bot is not initialized');
      return null;
    }
    
    // ID канала из переменных окружения
    const channelId = process.env.TELEGRAM_CHANNEL_ID;
    
    if (!channelId) {
      logger.warn('Telegram channel ID is not set, cannot publish achievement');
      return null;
    }
    
    // Формируем текст сообщения
    const text = `🏆 <b>Новое достижение разблокировано!</b>\n\n` +
      `Игрок <b>${user.firstName} ${user.lastName || ''}</b> получил достижение:\n\n` +
      `<b>${achievement.name}</b>\n` +
      `${achievement.description}\n\n` +
      `Играйте в "Криминальный Блеф" и открывайте новые достижения!`;
    
    // Отправляем сообщение в канал
    const result = await bot.sendMessage(channelId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎮 Играть', web_app: { url: process.env.TELEGRAM_WEB_APP_URL } }]
        ]
      }
    });
    
    logger.info(`Achievement published to channel: ${channelId}, message ID: ${result.message_id}`);
    return result;
  } catch (error) {
    logger.error(`Error publishing achievement to channel: ${error.message}`);
    return null;
  }
};

/**
 * Публикация обновления лидерборда в канал
 * @param {Array} leaderboard - Топ-3 лидерборда
 * @param {string} type - Тип лидерборда ('daily', 'weekly', 'all-time')
 * @returns {Promise<Object|null>} - Результат отправки сообщения
 */
const publishLeaderboardToChannel = async (leaderboard, type = 'weekly') => {
  try {
    if (!bot) {
      logger.warn('Trying to publish to channel, but bot is not initialized');
      return null;
    }
    
    // ID канала из переменных окружения
    const channelId = process.env.TELEGRAM_CHANNEL_ID;
    
    if (!channelId) {
      logger.warn('Telegram channel ID is not set, cannot publish leaderboard');
      return null;
    }
    
    // Определяем заголовок в зависимости от типа
    let titleText = '';
    switch (type) {
      case 'daily':
        titleText = 'дневного';
        break;
      case 'weekly':
        titleText = 'недельного';
        break;
      case 'all-time':
        titleText = 'общего';
        break;
      default:
        titleText = 'недельного';
    }
    
    // Формируем текст с топ-3 лидерами
    let leaderboardText = '';
    leaderboard.forEach((item, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
      leaderboardText += `${medal} <b>${item.firstName} ${item.lastName || ''}</b> - ${item.score} очков\n`;
    });
    
    // Формируем текст сообщения
    const text = `📊 <b>Обновление ${titleText} рейтинга "Криминальный Блеф"</b>\n\n` +
      `Топ-3 игрока:\n${leaderboardText}\n` +
      `Играйте и поднимайтесь в рейтинге!`;
    
    // Отправляем сообщение в канал
    const result = await bot.sendMessage(channelId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎮 Играть', web_app: { url: process.env.TELEGRAM_WEB_APP_URL } }],
          [{ text: '📊 Полный рейтинг', web_app: { url: `${process.env.TELEGRAM_WEB_APP_URL}?start=leaderboard` } }]
        ]
      }
    });
    
    logger.info(`Leaderboard published to channel: ${channelId}, message ID: ${result.message_id}`);
    return result;
  } catch (error) {
    logger.error(`Error publishing leaderboard to channel: ${error.message}`);
    return null;
  }
};

// Экспортируем функции и объекты
module.exports = {
  initializeBot,
  sendMessage,
  sendAchievementNotification,
  sendLeaderboardNotification,
  publishGameResultToChannel,
  publishAchievementToChannel,
  publishLeaderboardToChannel
}; 