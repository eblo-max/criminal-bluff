const request = require('supertest');
const app = require('../../src/app');
const { User, GameSession } = require('../../src/models');
const gameLogicService = require('../../src/services/gameLogicService');
const cacheService = require('../../src/services/cacheService');

describe('Game Controller', () => {
  let user;
  let token;
  let gameSession;

  beforeEach(async () => {
    // Создаем тестового пользователя
    user = await User.create({
      telegramId: '123456789',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User'
    });

    // Создаем тестовую сессию
    gameSession = await GameSession.create({
      userId: user._id,
      status: 'active',
      currentQuestion: 0,
      score: 0,
      streak: 0
    });

    // Мокаем кэш
    jest.spyOn(cacheService, 'getGameSession').mockResolvedValue(gameSession);
  });

  describe('POST /api/game/start', () => {
    it('should start a new game session', async () => {
      const response = await request(app)
        .post('/api/game/start')
        .set('Authorization', `Bearer ${token}`)
        .send({
          difficulty: 'medium',
          category: 'crime'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessionId');
    });
  });

  describe('POST /api/game/submit', () => {
    it('should process answer submission', async () => {
      const response = await request(app)
        .post('/api/game/submit')
        .set('Authorization', `Bearer ${token}`)
        .send({
          selectedAnswer: 1,
          timeSpent: 5000
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('score');
      expect(response.body.data).toHaveProperty('isCorrect');
    });

    it('should handle invalid answer submission', async () => {
      const response = await request(app)
        .post('/api/game/submit')
        .set('Authorization', `Bearer ${token}`)
        .send({
          selectedAnswer: 5, // Invalid answer
          timeSpent: -1000 // Invalid time
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/game/finish', () => {
    it('should finish game session', async () => {
      const response = await request(app)
        .post('/api/game/finish')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('gameStats');
      expect(response.body.data.gameStats).toHaveProperty('totalScore');
    });
  });

  describe('GET /api/game/current', () => {
    it('should get current game session', async () => {
      const response = await request(app)
        .get('/api/game/current')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessionId');
      expect(response.body.data).toHaveProperty('status');
    });
  });

  describe('POST /api/game/cancel', () => {
    it('should cancel current game session', async () => {
      const response = await request(app)
        .post('/api/game/cancel')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
}); 