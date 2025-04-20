/**
 * Database configuration
 */
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Connect to MongoDB
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Options are now included by default in mongoose 8+
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Seed the database with initial data (for development)
 */
const seedDatabase = async () => {
  // Only seed in development mode
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const { Story, User } = require('../models');

  try {
    // Check if we already have stories
    const storiesCount = await Story.countDocuments();
    if (storiesCount > 0) {
      logger.info('Database already has stories, skipping seed');
      return;
    }

    logger.info('Seeding database with initial data...');

    // Sample stories
    const stories = [
      {
        text: 'Вор проник в музей и украл редкую картину. Чтобы сбить с толку полицию, он оставил на месте преступления несколько отпечатков пальцев, но допустил критическую ошибку. Какую?',
        options: [
          'Он оставил отпечатки левой руки, но сам был левшой',
          'Он оставил отпечатки большого пальца на месте, куда невозможно дотянуться',
          'Он оставил отпечатки, которые уже были в базе данных полиции'
        ],
        correctAnswer: 2,
        explanation: 'Преступник оставил отпечатки пальцев, которые уже были в базе данных полиции. Если преступник хочет сбить полицию с толку поддельными отпечатками, он должен использовать отпечатки человека, которого нет в базе данных правоохранительных органов.',
        difficulty: 'medium',
        category: 'museum_heist'
      },
      {
        text: 'Грабитель банка захватил заложников и потребовал выкуп. Когда полиция согласилась на его условия, он сделал роковую ошибку, которая привела к его аресту. Что он сделал неправильно?',
        options: [
          'Он снял маску перед камерой видеонаблюдения',
          'Он использовал свой личный телефон для звонков',
          'Он назвал своё настоящее имя в переговорах'
        ],
        correctAnswer: 1,
        explanation: 'Преступник использовал свой личный телефон для переговоров. Сотовые телефоны оставляют цифровой след, включая данные о местоположении и уникальные идентификаторы устройства. Полиция может легко отследить владельца телефона по этим данным.',
        difficulty: 'easy',
        category: 'bank_robbers'
      },
      {
        text: 'Хакер взломал корпоративную сеть и похитил конфиденциальные данные. При продаже этих данных на черном рынке он совершил ошибку. Какую?',
        options: [
          'Он забыл удалить метаданные, указывающие на его личность',
          'Он использовал биткоин, думая, что транзакции невозможно отследить',
          'Он подключился к даркнету без использования VPN'
        ],
        correctAnswer: 1,
        explanation: 'Хакер использовал биткоин, ошибочно полагая, что транзакции невозможно отследить. Хотя биткоин предлагает псевдонимность, все транзакции записываются в публичный блокчейн и могут быть прослежены при должном анализе. Правоохранительные органы имеют продвинутые инструменты для анализа блокчейна.',
        difficulty: 'hard',
        category: 'cybercrime'
      }
    ];

    await Story.insertMany(stories);
    logger.info(`${stories.length} stories seeded successfully`);

    // Sample admin user
    if (process.env.ADMIN_TELEGRAM_ID) {
      const adminExists = await User.findOne({ telegramId: parseInt(process.env.ADMIN_TELEGRAM_ID) });
      
      if (!adminExists) {
        await User.create({
          telegramId: parseInt(process.env.ADMIN_TELEGRAM_ID),
          username: 'admin',
          score: 0,
          isAdmin: true
        });
        logger.info('Admin user created successfully');
      }
    }

  } catch (error) {
    logger.error(`Error seeding database: ${error.message}`);
  }
};

module.exports = {
  connectDB,
  seedDatabase
}; 