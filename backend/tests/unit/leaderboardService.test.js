const { expect } = require('chai');
const sinon = require('sinon');
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
      expect(midYearWeek).to.be.greaterThan(1);
    });

    it('should handle edge cases correctly', () => {
      // Тест с концом года
      const endYear = new Date(2023, 11, 31); // 31 декабря 2023
      const endYearWeek = getWeekNumber(endYear);
      expect(endYearWeek).to.be.a('number');
      
      // Тест с високосным годом
      const leapYear = new Date(2024, 1, 29); // 29 февраля 2024
      const leapYearWeek = getWeekNumber(leapYear);
      expect(leapYearWeek).to.be.a('number');
    });
  });

  describe('updateUserLeaderboards', () => {
    let redisAddToSortedSetStub;
    let redisSetValueStub;
    let redisGetScoreStub;
    let loggerErrorStub;

    beforeEach(() => {
      // Создаем заглушки для методов Redis и логгера
      redisAddToSortedSetStub = sinon.stub(redisService, 'addToSortedSet').resolves();
      redisSetValueStub = sinon.stub(redisService, 'setValue').resolves();
      redisGetScoreStub = sinon.stub(redisService, 'getScore').resolves(0);
      loggerErrorStub = sinon.stub(logger, 'error');
    });

    afterEach(() => {
      // Восстанавливаем оригинальные методы
      redisAddToSortedSetStub.restore();
      redisSetValueStub.restore();
      redisGetScoreStub.restore();
      loggerErrorStub.restore();
    });

    it('should update all leaderboards correctly', async () => {
      const userId = '123456';
      const gameScore = 100;
      const totalScore = 500;

      const result = await updateUserLeaderboards(userId, gameScore, totalScore);
      
      expect(result).to.be.true;
      expect(redisAddToSortedSetStub.calledThrice).to.be.true;
      expect(redisSetValueStub.calledTwice).to.be.true;
    });

    it('should handle invalid parameters', async () => {
      const result1 = await updateUserLeaderboards(null, 100, 500);
      expect(result1).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;

      loggerErrorStub.reset();
      
      const result2 = await updateUserLeaderboards('123', undefined, 500);
      expect(result2).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
    });

    it('should handle Redis errors gracefully', async () => {
      redisAddToSortedSetStub.rejects(new Error('Redis connection error'));
      
      const result = await updateUserLeaderboards('123', 100, 500);
      
      expect(result).to.be.false;
      expect(loggerErrorStub.calledOnce).to.be.true;
      expect(loggerErrorStub.firstCall.args[0]).to.include('Error updating leaderboards');
    });
  });
}); 