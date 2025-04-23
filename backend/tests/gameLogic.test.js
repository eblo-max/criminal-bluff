const { expect } = require('chai');
const sinon = require('sinon');
const { 
  processAnswer, 
  finishGame,
  startNewGame,
  calculateRank,
  calculateRating,
  checkAndProcessAchievements 
} = require('../src/services/gameLogicService');
const { ACHIEVEMENTS } = require('../src/models/achievement');
const { User } = require('../src/models/User');
const { GameSession } = require('../src/models/GameSession');
const cacheService = require('../src/services/cacheService');

describe('Сервис игровой логики', () => {
  let sandbox;
  let mockUser;
  let mockGameSession;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    mockUser = {
      _id: '123',
      telegramId: '456',
      username: 'testUser',
      score: 1000,
      gamesPlayed: 10,
      achievements: [],
      achievementProgress: new Map(),
      save: sandbox.stub().resolves()
    };

    mockGameSession = {
      userId: mockUser._id,
      answers: [],
      startTime: Date.now(),
      endTime: null,
      status: 'active',
      currentQuestion: 0,
      score: 0,
      streak: 0,
      save: sandbox.stub().resolves()
    };

    sandbox.stub(cacheService, 'getGameSession').resolves(mockGameSession);
    sandbox.stub(cacheService, 'cacheGameSession').resolves();
    sandbox.stub(cacheService, 'invalidateGameSession').resolves();
    sandbox.stub(User, 'findById').resolves(mockUser);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Обработка ответов', () => {
    it('должен правильно обработать верный ответ и обновить статистику', async () => {
      const answer = { isCorrect: true, answerTime: 1000 };
      
      const result = await processAnswer(mockUser._id, answer);
      
      expect(result.score).to.be.above(0, 'Счет должен увеличиться');
      expect(result.streak).to.equal(1, 'Серия должна начаться');
      expect(mockGameSession.answers).to.have.lengthOf(1, 'Ответ должен быть добавлен в сессию');
    });

    it('должен сбросить серию при неверном ответе', async () => {
      const answer = { isCorrect: false, answerTime: 1000 };
      
      const result = await processAnswer(mockUser._id, answer);
      
      expect(result.streak).to.equal(0, 'Серия должна сброситься');
    });

    it('должен начислять бонус за быстрый ответ', async () => {
      const answer = { isCorrect: true, answerTime: 500 };
      
      const result = await processAnswer(mockUser._id, answer);
      
      expect(result.score).to.be.above(100, 'Должен быть начислен временной бонус');
    });
  });

  describe('Завершение игры', () => {
    it('должен правильно рассчитать итоговую статистику', async () => {
      mockGameSession.answers = [
        { isCorrect: true, answerTime: 1000 },
        { isCorrect: true, answerTime: 800 }
      ];
      mockGameSession.score = 200;

      const result = await finishGame(mockUser._id);

      expect(result.totalScore).to.equal(200, 'Итоговый счет должен совпадать');
      expect(result.accuracy).to.equal(100, 'Точность должна быть 100%');
      expect(result.fastestAnswer).to.equal(800, 'Должен найти самый быстрый ответ');
      expect(mockUser.gamesPlayed).to.equal(11, 'Количество игр должно увеличиться');
    });

    it('должен обновить рекорды пользователя при необходимости', async () => {
      mockGameSession.score = 2000; // Больше текущего счета пользователя
      mockGameSession.answers = [{ isCorrect: true, answerTime: 500 }];

      const result = await finishGame(mockUser._id);

      expect(mockUser.score).to.equal(2000, 'Должен обновить рекорд пользователя');
    });
  });

  describe('Расчет ранга', () => {
    it('должен правильно рассчитывать ранг на основе счета', () => {
      const ranks = [
        { score: 0, rank: 'Новичок' },
        { score: 1000, rank: 'Опытный' },
        { score: 5000, rank: 'Мастер' },
        { score: 10000, rank: 'Легенда' }
      ];

      ranks.forEach(({ score, rank }) => {
        expect(calculateRank(score)).to.equal(rank, `Для счета ${score} ранг должен быть ${rank}`);
      });
    });
  });

  describe('Система достижений', () => {
    it('должен разблокировать достижение при выполнении условий', async () => {
      mockUser.score = 1000;
      mockUser.gamesPlayed = 10;

      const result = await checkAndProcessAchievements(mockUser, {
        score: 200,
        streak: 5,
        accuracy: 100
      });

      expect(result.newAchievements).to.have.length.above(0, 'Должно быть разблокировано хотя бы одно достижение');
    });

    it('должен обновлять прогресс достижений', async () => {
      const result = await checkAndProcessAchievements(mockUser, {
        score: 100,
        streak: 2,
        accuracy: 80
      });

      expect(mockUser.achievementProgress.size).to.be.above(0, 'Должен быть обновлен прогресс достижений');
    });

    it('не должен разблокировать уже полученные достижения', async () => {
      mockUser.achievements = [{ id: 'first_game', unlockedAt: new Date() }];
      
      const result = await checkAndProcessAchievements(mockUser, {
        gamesPlayed: 1
      });

      expect(result.newAchievements).to.have.lengthOf(0, 'Не должны повторно разблокироваться достижения');
    });
  });

  describe('Начало новой игры', () => {
    it('должен создать новую игровую сессию с правильными начальными значениями', async () => {
      const session = await startNewGame(mockUser._id);

      expect(session.status).to.equal('active', 'Статус должен быть активным');
      expect(session.score).to.equal(0, 'Начальный счет должен быть 0');
      expect(session.streak).to.equal(0, 'Начальная серия должна быть 0');
      expect(session.startTime).to.be.a('number', 'Должно быть установлено время начала');
      expect(session.answers).to.have.lengthOf(0, 'Список ответов должен быть пустым');
    });
  });
}); 