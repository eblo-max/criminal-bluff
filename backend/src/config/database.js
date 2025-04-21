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
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/criminal_bluff';
    
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true
    };
    
    await mongoose.connect(uri, options);
    
    logger.info('MongoDB connected successfully');
    
    // После успешного подключения запускаем заполнение базы данных
    await seedDatabase();
    
    return mongoose.connection;
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Seed the database with initial data (for development)
 */
const seedDatabase = async () => {
  // Проверяем, нужно ли заполнять базу данными (только в разработке или при специальном флаге)
  if (process.env.NODE_ENV !== 'development' && process.env.FORCE_SEED !== 'true') {
    logger.info('Skipping database seed (not in development mode)');
    return;
  }
  
  const { Story, User } = require('../models');
  const { seedStories } = require('../utils/storyGenerator');

  try {
    // Проверяем наличие историй в базе
    const storiesCount = await Story.countDocuments();
    if (storiesCount > 0) {
      logger.info(`Database already has ${storiesCount} stories, skipping seed`);
      
      // Проверяем наличие администратора и добавляем его при необходимости
      await seedAdminUser();
      
      return;
    }
    
    logger.info('Seeding database with initial data...');
    
    // Заполняем базу историями
    const count = await seedStories(true, 40);
    logger.info(`${count} stories seeded successfully`);
    
    // Создаем администратора
    await seedAdminUser();
    
  } catch (error) {
    logger.error(`Error seeding database: ${error.message}`);
  }
};

/**
 * Создание администратора если он не существует
 */
const seedAdminUser = async () => {
  const { User } = require('../models');
  
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
};

module.exports = {
  connectDB,
  seedDatabase
}; 