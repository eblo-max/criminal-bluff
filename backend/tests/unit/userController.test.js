const { expect } = require('chai');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const { getUserProfile, getUserStats } = require('../../src/controllers/userController');
const User = require('../../src/models/User');
const redisService = require('../../src/services/redisService');

describe('User Controller', () => {
  let req, res, userFindByIdStub, redisGetUserRankStub;
  
  beforeEach(() => {
    // Создаем заглушки для req и res
    req = {
      user: {
        _id: '60d21b4667d0d8992e610c85',
        telegramId: 12345,
        username: 'testuser',
        score: 1000,
        gamesPlayed: 50,
        correctAnswers: 200,
        bestStreak: 10,
        achievements: [
          { name: 'Новичок', unlockedAt: new Date() }
        ]
      }
    };
    
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub()
    };
    
    // Создаем заглушки для моделей и сервисов
    userFindByIdStub = sinon.stub(User, 'findById');
    redisGetUserRankStub = sinon.stub(redisService, 'getUserRank');
  });
  
  afterEach(() => {
    // Восстанавливаем все заглушки
    sinon.restore();
  });
  
  describe('getUserProfile', () => {
    it('should return 401 if user is not authenticated', async () => {
      // Подготовка тестового запроса без пользователя
      const reqWithoutUser = { user: null };
      
      // Вызов тестируемой функции
      await getUserProfile(reqWithoutUser, res);
      
      // Проверка результатов
      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.args[0][0]).to.deep.include({
        success: false,
        message: 'Unauthorized'
      });
    });
    
    it('should return user profile if authenticated', async () => {
      // Настраиваем заглушку для поиска пользователя
      userFindByIdStub.resolves(req.user);
      
      // Вызов тестируемой функции
      await getUserProfile(req, res);
      
      // Проверка результатов
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.args[0][0]).to.deep.include({
        success: true,
        user: {
          id: req.user._id,
          telegramId: req.user.telegramId,
          username: req.user.username,
          score: req.user.score,
          gamesPlayed: req.user.gamesPlayed,
          correctAnswers: req.user.correctAnswers,
          bestStreak: req.user.bestStreak,
          achievements: req.user.achievements
        }
      });
    });
    
    it('should handle database errors gracefully', async () => {
      // Настраиваем заглушку для имитации ошибки базы данных
      userFindByIdStub.rejects(new Error('Database error'));
      
      // Вызов тестируемой функции
      await getUserProfile(req, res);
      
      // Проверка результатов
      expect(res.status.calledWith(500)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.args[0][0]).to.deep.include({
        success: false,
        message: 'Ошибка при получении профиля'
      });
    });
  });
  
  describe('getUserStats', () => {
    beforeEach(() => {
      // Настраиваем дополнительные заглушки для редиса
      redisGetUserRankStub.withArgs('leaderboard:global', req.user.telegramId.toString()).resolves(5);
      redisGetUserRankStub.withArgs('leaderboard:weekly', req.user.telegramId.toString()).resolves(3);
      redisGetUserRankStub.withArgs('leaderboard:daily', req.user.telegramId.toString()).resolves(1);
    });
    
    it('should return 401 if user is not authenticated', async () => {
      // Подготовка тестового запроса без пользователя
      const reqWithoutUser = { user: null };
      
      // Вызов тестируемой функции
      await getUserStats(reqWithoutUser, res);
      
      // Проверка результатов
      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.args[0][0]).to.deep.include({
        success: false,
        message: 'Unauthorized'
      });
    });
    
    it('should return user statistics with rankings', async () => {
      // Настраиваем заглушку для поиска пользователя
      userFindByIdStub.resolves(req.user);
      
      // Вызов тестируемой функции
      await getUserStats(req, res);
      
      // Проверка результатов
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      
      // Проверяем наличие всех ожидаемых полей в ответе
      const response = res.json.args[0][0];
      expect(response.success).to.be.true;
      expect(response.stats).to.exist;
      expect(response.stats.score).to.equal(req.user.score);
      expect(response.stats.gamesPlayed).to.equal(req.user.gamesPlayed);
      expect(response.stats.correctAnswers).to.equal(req.user.correctAnswers);
      
      // Проверяем вычисляемые поля
      expect(response.stats.accuracy).to.be.a('number');
      expect(response.stats.averageScore).to.be.a('number');
      
      // Проверяем информацию о рейтинге
      expect(response.stats.rankings).to.deep.include({
        global: 5,
        weekly: 3,
        daily: 1
      });
    });
    
    it('should handle Redis errors gracefully', async () => {
      // Настраиваем заглушки для имитации ошибок Redis
      userFindByIdStub.resolves(req.user);
      redisGetUserRankStub.rejects(new Error('Redis error'));
      
      // Вызов тестируемой функции
      await getUserStats(req, res);
      
      // Проверка результатов
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      
      // Проверяем, что данные пользователя вернулись корректно, несмотря на ошибку Redis
      const response = res.json.args[0][0];
      expect(response.success).to.be.true;
      expect(response.stats).to.exist;
      
      // Проверяем, что для рейтингов установлены значения по умолчанию
      expect(response.stats.rankings).to.deep.include({
        global: null,
        weekly: null,
        daily: null
      });
    });
    
    it('should handle database errors gracefully', async () => {
      // Настраиваем заглушку для имитации ошибки базы данных
      userFindByIdStub.rejects(new Error('Database error'));
      
      // Вызов тестируемой функции
      await getUserStats(req, res);
      
      // Проверка результатов
      expect(res.status.calledWith(500)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.args[0][0]).to.deep.include({
        success: false,
        message: 'Ошибка при получении статистики пользователя'
      });
    });
  });
}); 