const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const app = require('../../src/server');
const { Story, GameSession, User } = require('../../src/models');
const redisService = require('../../src/services/redisService');
const mongoose = require('mongoose');

describe('Game Routes', () => {
  let token;
  let user;
  let storyStub;
  let gameSession;
  let gameSessionStub;
  let userStub;
  let redisStub;
  
  before(async () => {
    // Создаем тестового пользователя
    user = {
      _id: '60d21b4667d0d8992e610c85',
      telegramId: 12345,
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      score: 1000,
      gamesPlayed: 10,
      correctAnswers: 35,
      bestStreak: 5
    };
    
    // Создаем токен авторизации
    token = jwt.sign(
      { telegramId: user.telegramId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
    
    // Создаем заглушку для модели Story
    storyStub = sinon.stub(Story, 'aggregate');
    
    // Создаем заглушку для GameSession
    gameSessionStub = {
      findById: sinon.stub(),
      save: sinon.stub()
    };
    
    sinon.stub(GameSession, 'findById').callsFake(gameSessionStub.findById);
    sinon.stub(GameSession.prototype, 'save').callsFake(gameSessionStub.save);
    
    // Создаем заглушку для User
    userStub = {
      findOne: sinon.stub().resolves(user),
      findById: sinon.stub().resolves(user),
      findByIdAndUpdate: sinon.stub().resolves(user)
    };
    
    sinon.stub(User, 'findOne').callsFake(userStub.findOne);
    sinon.stub(User, 'findById').callsFake(userStub.findById);
    sinon.stub(User, 'findByIdAndUpdate').callsFake(userStub.findByIdAndUpdate);
    
    // Создаем заглушку для Redis
    redisStub = {
      updateUserLeaderboards: sinon.stub().resolves()
    };
    
    sinon.stub(redisService, 'updateUserLeaderboards').callsFake(redisStub.updateUserLeaderboards);
  });
  
  beforeEach(() => {
    // Создаем тестовые данные для каждого теста
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
    
    storyStub.resolves(testStories);
    
    gameSession = {
      _id: new mongoose.Types.ObjectId(),
      userId: user._id,
      telegramId: user.telegramId,
      stories: testStories.map(story => story._id),
      answers: [],
      currentStory: 0,
      streak: 0,
      totalScore: 0,
      status: 'active',
      save: sinon.stub().resolves(),
      toJSON: function() {
        return {
          _id: this._id,
          userId: this.userId,
          telegramId: this.telegramId,
          stories: this.stories,
          answers: this.answers,
          currentStory: this.currentStory,
          streak: this.streak,
          totalScore: this.totalScore,
          status: this.status
        };
      }
    };
    
    // Заглушка для создания новой игровой сессии
    sinon.stub(GameSession.prototype, 'toJSON').callsFake(() => gameSession.toJSON());
    
    // Заглушка для поиска истории
    sinon.stub(Story, 'findById').callsFake((id) => {
      const story = testStories.find(s => s._id.toString() === id.toString());
      return {
        exec: () => Promise.resolve(story)
      };
    });
  });
  
  afterEach(() => {
    // Восстанавливаем заглушки, которые создаются в beforeEach
    Story.findById.restore();
    GameSession.prototype.toJSON.restore();
  });
  
  after(() => {
    // Восстанавливаем все заглушки
    sinon.restore();
  });
  
  describe('POST /api/game/start', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/game/start')
        .expect(401);
      
      expect(response.body).to.deep.include({
        success: false
      });
    });
    
    it('should start a new game with valid token', async () => {
      // Заглушка для создания новой игровой сессии
      sinon.stub(GameSession.prototype, 'save').resolves(gameSession);
      
      const response = await request(app)
        .post('/api/game/start')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).to.deep.include({
        success: true,
        message: 'Новая игра успешно начата'
      });
      
      expect(response.body.stories).to.be.an('array');
      expect(response.body.currentStory).to.equal(0);
      
      // Восстанавливаем заглушку
      GameSession.prototype.save.restore();
    });
  });
  
  describe('POST /api/game/:sessionId/answer', () => {
    beforeEach(() => {
      gameSessionStub.findById.resolves(gameSession);
    });
    
    it('should return 401 without token', async () => {
      const response = await request(app)
        .post(`/api/game/${gameSession._id}/answer`)
        .send({
          answer: 0,
          responseTime: 5000
        })
        .expect(401);
      
      expect(response.body).to.deep.include({
        success: false
      });
    });
    
    it('should process correct answer', async () => {
      const response = await request(app)
        .post(`/api/game/${gameSession._id}/answer`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          answer: 0, // correct for first story
          responseTime: 5000
        })
        .expect(200);
      
      expect(response.body).to.deep.include({
        success: true,
        isCorrect: true,
        correctAnswer: 0
      });
      
      expect(response.body.points).to.be.a('number');
      expect(response.body.streak).to.be.a('number');
    });
    
    it('should process incorrect answer', async () => {
      const response = await request(app)
        .post(`/api/game/${gameSession._id}/answer`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          answer: 2, // incorrect for first story
          responseTime: 5000
        })
        .expect(200);
      
      expect(response.body).to.deep.include({
        success: true,
        isCorrect: false,
        correctAnswer: 0
      });
      
      expect(response.body.points).to.equal(0);
      expect(response.body.streak).to.equal(0);
    });
    
    it('should return 404 for invalid session', async () => {
      gameSessionStub.findById.resolves(null);
      
      const response = await request(app)
        .post(`/api/game/invalidSessionId/answer`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          answer: 0,
          responseTime: 5000
        })
        .expect(404);
      
      expect(response.body).to.deep.include({
        success: false,
        message: 'Игровая сессия не найдена'
      });
    });
  });
  
  describe('POST /api/game/:sessionId/finish', () => {
    beforeEach(() => {
      // Настраиваем игровую сессию как завершенную
      gameSession.currentStory = gameSession.stories.length;
      gameSession.answers = [
        { isCorrect: true, pointsEarned: 120 },
        { isCorrect: false, pointsEarned: 0 }
      ];
      gameSession.totalScore = 120;
      
      gameSessionStub.findById.resolves(gameSession);
    });
    
    it('should return 401 without token', async () => {
      const response = await request(app)
        .post(`/api/game/${gameSession._id}/finish`)
        .expect(401);
      
      expect(response.body).to.deep.include({
        success: false
      });
    });
    
    it('should finalize the game and return results', async () => {
      const response = await request(app)
        .post(`/api/game/${gameSession._id}/finish`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body).to.deep.include({
        success: true,
        message: 'Игра успешно завершена'
      });
      
      expect(response.body.results).to.exist;
      expect(response.body.results.totalScore).to.equal(120);
      expect(response.body.results.correctAnswers).to.equal(1);
    });
    
    it('should return 404 for invalid session', async () => {
      gameSessionStub.findById.resolves(null);
      
      const response = await request(app)
        .post(`/api/game/invalidSessionId/finish`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      
      expect(response.body).to.deep.include({
        success: false,
        message: 'Игровая сессия не найдена'
      });
    });
  });
}); 