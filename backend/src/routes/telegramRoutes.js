/**
 * Маршруты для Telegram вебхуков
 * Обрабатывает вебхуки от Telegram
 */
const express = require('express');
const router = express.Router();
const telegramConfig = require('../config/telegram');
const logger = require('../utils/logger');
const { User } = require('../models');

// Инициализация бота
const botConfig = telegramConfig.initializeBot();

// Если бот и путь вебхука настроены
if (botConfig && botConfig.bot && botConfig.webhookPath) {
  const { bot, webhookPath } = botConfig;
  
  /**
   * Обработка вебхука от Telegram
   */
  router.post(webhookPath, async (req, res) => {
    try {
      // Проверка валидности запроса
      if (!req.body) {
        return res.status(400).json({ success: false, message: 'Invalid webhook data' });
      }
      
      // Обработка входящего обновления
      await processUpdate(req.body);
      
      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error(`Error processing Telegram webhook: ${error.message}`);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
  
  // Настраиваем обработчики команд для режима long polling
  setupBotHandlers(bot);
}

/**
 * Настройка обработчиков команд бота
 * @param {Object} bot - Экземпляр Telegram бота
 */
function setupBotHandlers(bot) {
  if (!bot) return;
  
  // Обработка команды /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || `user_${msg.from.id}`;
    
    try {
      // Проверяем, есть ли пользователь в базе
      const user = await User.findOne({ telegramId: msg.from.id });
      
      // Отправляем приветственное сообщение
      const text = user 
        ? `Привет, ${user.firstName || username}! Рад видеть тебя снова! 🕵️‍♂️`
        : `Привет! Добро пожаловать в игру "Криминальный Блеф"! 🕵️‍♂️`;
      
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 Играть', web_app: { url: process.env.TELEGRAM_WEB_APP_URL } }]
          ]
        }
      };
      
      await bot.sendMessage(chatId, text, options);
    } catch (error) {
      logger.error(`Error handling /start command: ${error.message}`);
      await bot.sendMessage(chatId, 'Произошла ошибка при обработке команды. Пожалуйста, попробуйте позже.');
    }
  });
  
  // Обработка команды /stats
  bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      // Проверяем, есть ли пользователь в базе
      const user = await User.findOne({ telegramId: msg.from.id });
      
      if (!user) {
        return await bot.sendMessage(chatId, 'Вы еще не играли в "Криминальный Блеф". Нажмите /start, чтобы начать!');
      }
      
      // Считаем процент правильных ответов
      const correctPercentage = user.gamesPlayed > 0 
        ? Math.round((user.correctAnswers / (user.gamesPlayed * 5)) * 100) 
        : 0;
      
      // Формируем текст статистики
      const text = `📊 <b>Ваша статистика</b>\n\n` +
        `🎮 Игр сыграно: <b>${user.gamesPlayed}</b>\n` +
        `✅ Правильных ответов: <b>${user.correctAnswers}</b>\n` +
        `📈 Точность: <b>${correctPercentage}%</b>\n` +
        `🔥 Лучшая серия: <b>${user.bestStreak}</b>\n` +
        `🏆 Достижений: <b>${user.achievements.length}</b>\n`;
      
      const options = {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 Играть сейчас', web_app: { url: process.env.TELEGRAM_WEB_APP_URL } }],
            [{ text: '📊 Полная статистика', web_app: { url: `${process.env.TELEGRAM_WEB_APP_URL}?start=profile` } }]
          ]
        }
      };
      
      await bot.sendMessage(chatId, text, options);
    } catch (error) {
      logger.error(`Error handling /stats command: ${error.message}`);
      await bot.sendMessage(chatId, 'Произошла ошибка при получении статистики. Пожалуйста, попробуйте позже.');
    }
  });
  
  // Обработка команды /leaderboard
  bot.onText(/\/leaderboard/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      await bot.sendMessage(chatId, '📊 <b>Таблица лидеров</b>\n\nНажмите на кнопку ниже, чтобы посмотреть рейтинг:', {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 Открыть рейтинг', web_app: { url: `${process.env.TELEGRAM_WEB_APP_URL}?start=leaderboard` } }]
          ]
        }
      });
    } catch (error) {
      logger.error(`Error handling /leaderboard command: ${error.message}`);
      await bot.sendMessage(chatId, 'Произошла ошибка при получении рейтинга. Пожалуйста, попробуйте позже.');
    }
  });
  
  // Обработка команды /help
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    
    const text = `📖 <b>Помощь</b>\n\n` +
      `"Криминальный Блеф" - это игра-викторина, в которой вы читаете криминальные истории и ищете ошибки преступников.\n\n` +
      `<b>Как играть:</b>\n` +
      `- Откройте мини-приложение через кнопку "Играть"\n` +
      `- Прочитайте историю\n` +
      `- Выберите, какая деталь является ошибкой преступника\n` +
      `- Отвечайте быстро для получения бонусов!\n\n` +
      `<b>Доступные команды:</b>\n` +
      `/start - начать игру\n` +
      `/stats - ваша статистика\n` +
      `/leaderboard - таблица лидеров\n` +
      `/help - эта справка`;
    
    await bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎮 Играть', web_app: { url: process.env.TELEGRAM_WEB_APP_URL } }]
        ]
      }
    });
  });
  
  // Обработка данных из мини-приложения
  bot.on('web_app_data', async (msg) => {
    try {
      const chatId = msg.chat.id;
      const data = JSON.parse(msg.web_app_data.data);
      
      // Обработка действия "share_results"
      if (data.action === 'share_results') {
        await bot.sendMessage(chatId, data.text);
      }
    } catch (error) {
      logger.error(`Error processing web_app_data: ${error.message}`);
    }
  });
}

/**
 * Обработка обновления от Telegram
 * @param {Object} update - Обновление от Telegram
 */
async function processUpdate(update) {
  try {
    if (!botConfig || !botConfig.bot) return;
    
    const bot = botConfig.bot;
    
    // Обновление от webhook передаем напрямую в бота для обработки
    bot.processUpdate(update);
  } catch (error) {
    logger.error(`Error processing update: ${error.message}`);
  }
}

module.exports = router; 