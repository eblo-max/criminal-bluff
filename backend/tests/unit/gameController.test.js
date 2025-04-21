const { expect } = require('chai');
const sinon = require('sinon');
const { startGame, submitAnswer, finishGame } = require('../../src/controllers/gameController');
const { Story, GameSession, User } = require('../../src/models');
const redisService = require('../../src/services/redisService');
const mongoose = require('mongoose');

describe('Game Controller', () => {
  let req, res, storyStub, gameSessionStub, userStub, redisStub;
  
  beforeEach(() => {
    // Создаем заглушки для req и res
    req = {
      user: {
        _id: '60d21b4667d0d8992e610c85',
        telegramId: 12345,
        username: 'testuser',
        score: 1000,
        gamesPlayed: 10,
        correctAnswers: 35,
        bestStreak: 5
      },
      body: {},
      params: {}
    };
    
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub()
    };
    
    // Создаем заглушки для моделей
    storyStub = sinon.stub(Story, 'aggregate');
    gameSessionStub = {
      save: sinon.stub().resolves(),
      findById: sinon.stub(),
      findOne: sinon.stub()
    };
    
    sinon.stub(GameSession, 'findById').callsFake(gameSessionStub.findById);
    sinon.stub(GameSession, 'findOne').callsFake(gameSessionStub.findOne);
    sinon.stub(GameSession.prototype, 'save').callsFake(gameSessionStub.save);
    
    userStub = {
      findByIdAndUpdate: sinon.stub().resolves(req.user)
    };
    sinon.stub(User, 'findByIdAndUpdate').callsFake(userStub.findByIdAndUpdate);
    
    // Создаем заглушки для Redis
    redisStub = {
      updateUserLeaderboards: sinon.stub().resolves()
    };
    sinon.stub(redisService, 'updateUserLeaderboards').callsFake(redisStub.updateUserLeaderboards);
  });
  
  afterEach(() => {
    // Восстанавливаем все заглушки
    sinon.restore();
  });
  
  describe('startGame', () => {
    it('should return 401 if user is not authenticated', async () => {
      // Подготовка тестового запроса без пользователя
      const reqWithoutUser = { user: null };
      
      // Вызов тестируемой функции
      await startGame(reqWithoutUser, res);
      
      // Проверка результатов
      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.args[0][0]).to.deep.include({
        success: false,
        message: 'Unauthorized'
      });
    });
    
    it('should start a new game with 5 random stories', async () => {
      // Подготавливаем тестовые данные
      const testStories = [
        { 
          _id: new mongoose.Types.ObjectId(), 
          text: 'История 1', 
          options: ['Вариант 1', 'Вариант 2', 'Вариант 3'], 
          correctAnswer: 0,
          explanation: 'Объяснение 1',
          difficulty: 'easy',
          category: 'bank_robbers'
        },
        { 
          _id: new mongoose.Types.ObjectId(), 
          text: 'История 2', 
          options: ['Вариант 1', 'Вариант 2', 'Вариант 3'], 
          correctAnswer: 1,
          explanation: 'Объяснение 2',
          difficulty: 'medium',
          category: 'cybercrime'
        }
      ];
      
      // Настраиваем заглушки
      storyStub.resolves(testStories);
      sinon.stub(GameSession.prototype, 'save').resolves({
        _id: new mongoose.Types.ObjectId(),
        userId: req.user._id,
        telegramId: req.user.telegramId,
        stories: testStories.map(story => story._id),
        currentStory: 0,
        streak: 0
      });
      
      // Вызов тестируемой функции
      await startGame(req, res);
      
      // Проверка результатов
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      
      const response = res.json.args[0][0];
      expect(response.success).to.be.true;
      expect(response.message).to.equal('Новая игра успешно начата');
      expect(response.stories).to.be.an('array');
      expect(response.currentStory).to.equal(0);
      expect(response.streak).to.equal(0);
    });
    
    it('should handle database errors gracefully', async () => {
      // Настраиваем заглушку для имитации ошибки
      storyStub.rejects(new Error('Database error'));
      
      // Вызов тестируемой функции
      await startGame(req, res);
      
      // Проверка результатов
      expect(res.status.calledWith(500)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.args[0][0]).to.deep.include({
        success: false,
        message: 'Ошибка при начале игры'
      });
    });
  });
  
  describe('submitAnswer', () => {
    let gameSession;
    
    beforeEach(() => {
      // Создаем тестовую игровую сессию
      gameSession = {
        _id: new mongoose.Types.ObjectId(),
        userId: req.user._id,
        telegramId: req.user.telegramId,
        stories: [
          new mongoose.Types.ObjectId(),
          new mongoose.Types.ObjectId()
        ],
        answers: [],
        currentStory: 0,
        streak: 0,
        status: 'active',
        save: sinon.stub().resolves()
      };
      
      // Настраиваем заглушки
      gameSessionStub.findById.resolves(gameSession);
      
      // Настраиваем тестовый запрос
      req.params.sessionId = gameSession._id.toString();
      req.body = {
        answer: 1,
        responseTime: 5000
      };
      
      // Заглушка для получения текущей истории
      sinon.stub(Story, 'findById').resolves({
        _id: gameSession.stories[0],
        correctAnswer: 1,
        explanation: 'Тестовое объяснение',
        text: 'Текст истории',
        options: ['Вариант 1', 'Вариант 2', 'Вариант 3']
      });
    });
    
    it('should return 401 if user is not authenticated', async () => {
      // Подготовка тестового запроса без пользователя
      const reqWithoutUser = { 
        user: null, 
        params: req.params,
        body: req.body
      };
      
      // Вызов тестируемой функции
      await submitAnswer(reqWithoutUser, res);
      
      // Проверка результатов
      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.args[0][0]).to.deep.include({
        success: false,
        message: 'Unauthorized'
      });
    });
    
    it('should validate the answer and update game session', async () => {
      // Вызов тестируемой функции
      await submitAnswer(req, res);
      
      // Проверка результатов
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      
      const response = res.json.args[0][0];
      expect(response.success).to.be.true;
      expect(response.isCorrect).to.be.true;
      expect(response.correctAnswer).to.equal(1);
      expect(response.explanation).to.equal('Тестовое объяснение');
      expect(response.points).to.be.a('number');
      expect(response.streak).to.be.a('number');
    });
    
    it('should handle incorrect answers properly', async () => {
      // Изменяем заглушку для неправильного ответа
      req.body.answer = 0;
      
      // Вызов тестируемой функции
      await submitAnswer(req, res);
      
      // Проверка результатов
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      
      const response = res.json.args[0][0];
      expect(response.success).to.be.true;
      expect(response.isCorrect).to.be.false;
      expect(response.correctAnswer).to.equal(1);
      expect(response.explanation).to.equal('Тестовое объяснение');
      expect(response.points).to.equal(0);
      expect(response.streak).to.equal(0);
    });
    
    it('should handle non-existent game sessions', async () => {
      // Настраиваем заглушку для отсутствия сессии
      gameSessionStub.findById.resolves(null);
      
      // Вызов тестируемой функции
      await submitAnswer(req, res);
      
      // Проверка результатов
      expect(res.status.calledWith(404)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.args[0][0]).to.deep.include({
        success: false,
        message: 'Игровая сессия не найдена'
      });
    });
  });
  
  describe('finishGame', () => {
    let gameSession;
    
    beforeEach(() => {
      // Создаем тестовую игровую сессию с ответами
      gameSession = {
        _id: new mongoose.Types.ObjectId(),
        userId: req.user._id,
        telegramId: req.user.telegramId,
        stories: [
          new mongoose.Types.ObjectId(),
          new mongoose.Types.ObjectId()
        ],
        answers: [
          { isCorrect: true, pointsEarned: 120 },
          { isCorrect: false, pointsEarned: 0 }
        ],
        currentStory: 2, // Все истории пройдены
        streak: 1,
        totalScore: 120,
        status: 'active',
        save: sinon.stub().resolves()
      };
      
      // Настраиваем заглушки
      gameSessionStub.findById.resolves(gameSession);
      
      // Настраиваем тестовый запрос
      req.params.sessionId = gameSession._id.toString();
    });
    
    it('should finalize the game and update user statistics', async () => {
      // Вызов тестируемой функции
      await finishGame(req, res);
      
      // Проверка результатов
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      
      const response = res.json.args[0][0];
      expect(response.success).to.be.true;
      expect(response.message).to.equal('Игра успешно завершена');
      expect(response.results).to.exist;
      expect(response.results.totalScore).to.equal(120);
      expect(response.results.correctAnswers).to.equal(1);
      
      // Проверяем, что статус сессии был обновлен
      expect(gameSession.status).to.equal('completed');
      
      // Проверяем, что пользовательская статистика была обновлена
      expect(userStub.findByIdAndUpdate.calledOnce).to.be.true;
      
      // Проверяем, что рейтинги были обновлены
      expect(redisStub.updateUserLeaderboards.calledOnce).to.be.true;
    });
    
    it('should handle non-existent game sessions', async () => {
      // Настраиваем заглушку для отсутствия сессии
      gameSessionStub.findById.resolves(null);
      
      // Вызов тестируемой функции
      await finishGame(req, res);
      
      // Проверка результатов
      expect(res.status.calledWith(404)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.args[0][0]).to.deep.include({
        success: false,
        message: 'Игровая сессия не найдена'
      });
    });
  });
}); 