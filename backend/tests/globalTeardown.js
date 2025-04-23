const mongoose = require('mongoose');

module.exports = async () => {
  // Отключаемся от MongoDB
  await mongoose.disconnect();
  
  // Останавливаем MongoDB сервер
  if (global.__MONGO_SERVER__) {
    await global.__MONGO_SERVER__.stop();
  }
  
  // Очищаем глобальные переменные
  delete global.__MONGO_URI__;
  delete global.__MONGO_SERVER__;
}; 