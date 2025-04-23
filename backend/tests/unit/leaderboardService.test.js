const { expect } = require('chai');
const { getWeekNumber, updateUserLeaderboards } = require('../../src/services/leaderboardService');
const redisService = require('../../src/services/redisService');
const logger = require('../../src/utils/logger');

describe('Leaderboard Service', () => {
  describe('getWeekNumber', () => {
    it('should return the correct week number for a date', () => {
      // Тест с фиксированной датой (1 января 2023, первая неделя)
      const date = new Date(2023, 0, 1); // 1 января 2023
      const weekNumber = getWeekNumber(date);
      expect(weekNumber).to.be.a('number');
      expect(weekNumber).to.equal(1);

      // Тест с серединой года
      const midYear = new Date(2023, 5, 15); // 15 июня 2023
      const midYearWeek = getWeekNumber(midYear);
      expect(midYearWeek).to.be.a('number');
      expect(midYearWeek).to.equal(24); // 15 июня - 24-я неделя
    });

    it('should handle edge cases correctly', () => {
      // Тест с концом года
      const endYear = new Date(2023, 11, 31); // 31 декабря 2023
      const endYearWeek = getWeekNumber(endYear);
      expect(endYearWeek).to.equal(52);
      
      // Тест с високосным годом
      const leapYear = new Date(2024, 1, 29); // 29 февраля 2024
      const leapYearWeek = getWeekNumber(leapYear);
      expect(leapYearWeek).to.equal(9);
    });
  });

  describe('updateUserLeaderboards', () => {
    let redis;

    beforeEach(async () => {
      // Очищаем Redis перед каждым тестом
      redis = redisService.redis;
      await redis.flushdb();
    });

    it('should update all leaderboards correctly', async () => {
      const userId = '123456';
      const gameScore = 100;
      const totalScore = 500;

      const result = await updateUserLeaderboards(userId, gameScore, totalScore);
      expect(result).to.be.true;

      // Проверяем, что данные были записаны в Redis
      const dailyScore = await redis.zscore(`leaderboard:daily:${new Date().toISOString().split('T')[0]}`, userId);
      expect(Number(dailyScore)).to.equal(gameScore);

      const allTimeScore = await redis.zscore('leaderboard:all-time', userId);
      expect(Number(allTimeScore)).to.equal(totalScore);
    });

    it('should handle invalid parameters', async () => {
      const result1 = await updateUserLeaderboards(null, 100, 500);
      expect(result1).to.be.false;

      const result2 = await updateUserLeaderboards('123', undefined, 500);
      expect(result2).to.be.false;
    });

    it('should handle Redis errors gracefully', async () => {
      // Симулируем ошибку Redis, закрывая соединение
      await redis.quit();
      
      const result = await updateUserLeaderboards('123', 100, 500);
      expect(result).to.be.false;

      // Восстанавливаем соединение для следующих тестов
      redis = redisService.redis;
    });

    afterAll(async () => {
      await redis.quit();
    });
  });
}); 