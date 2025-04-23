const { expect } = require('chai');
const sinon = require('sinon');
const { startGame, submitAnswer, finishGame, getCurrentGame } = require('../../src/controllers/gameController');
const { Story, GameSession, User } = require('../../src/models');
const mongoose = require('mongoose');

describe('Game Controller', () => {
  let req, res;
  let sandbox;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Создаем заглушки для req и res
    req = {
      user: {
        _id: new mongoose.Types.ObjectId(),
        telegramId: 12345,
        username: 'testuser'
      },
      body: {}
    };
    
    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub(),
      created: sandbox.stub(),
      success: sandbox.stub()
    };
  });
  
  afterEach(() => {
    sandbox.restore();
  });
  
  describe('startGame', () => {
    it('should create a new game session', async () => {
      const mockStories = [
        { _id: new mongoose.Types.ObjectId(), text: 'Story 1' },
        { _id: new mongoose.Types.ObjectId(), text: 'Story 2' },
        { _id: new mongoose.Types.ObjectId(), text: 'Story 3' },
        { _id: new mongoose.Types.ObjectId(), text: 'Story 4' },
        { _id: new mongoose.Types.ObjectId(), text: 'Story 5' }
      ];
      
      sandbox.stub(Story, 'aggregate').resolves(mockStories);
      sandbox.stub(GameSession, 'findOne').resolves(null);
      sandbox.stub(GameSession, 'create').resolves({
        _id: new mongoose.Types.ObjectId(),
        stories: mockStories.map(s => s._id),
        currentStory: 0
      });
      
      await startGame(req, res);
      
      expect(res.status.calledWith(201)).to.be.true;
      expect(res.json.called).to.be.true;
    });
    
    it('should return error if active session exists', async () => {
      sandbox.stub(GameSession, 'findOne').resolves({ _id: new mongoose.Types.ObjectId() });
      
      await startGame(req, res);
      
      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWith({
        success: false,
        message: 'У вас уже есть активная игровая сессия'
      })).to.be.true;
    });
  });
  
  describe('submitAnswer', () => {
    it('should process correct answer', async () => {
      const mockStory = {
        _id: new mongoose.Types.ObjectId(),
        correctAnswer: 1,
        explanation: 'Test explanation'
      };
      
      const mockSession = {
        _id: new mongoose.Types.ObjectId(),
        userId: req.user._id,
        stories: [mockStory],
        currentStory: 0,
        answers: [],
        streak: 0,
        save: sandbox.stub().resolves()
      };
      
      req.body = {
        storyId: mockStory._id.toString(),
        selectedAnswer: 1,
        timeSpent: 5000
      };
      
      sandbox.stub(GameSession, 'findOne').returns({
        populate: sandbox.stub().resolves(mockSession)
      });
      
      await submitAnswer(req, res);
      
      expect(res.json.called).to.be.true;
      expect(mockSession.save.called).to.be.true;
      const response = res.json.firstCall.args[0];
      expect(response.success).to.be.true;
      expect(response.result.isCorrect).to.be.true;
    });
  });
  
  describe('finishGame', () => {
    it('should finish active game session', async () => {
      const mockSession = {
        _id: new mongoose.Types.ObjectId(),
        userId: req.user._id,
        status: 'active',
        totalScore: 500,
        streak: 3,
        answers: [
          { isCorrect: true, timeSpent: 5000 },
          { isCorrect: true, timeSpent: 4000 }
        ],
        save: sandbox.stub().resolves()
      };
      
      const mockUser = {
        _id: req.user._id,
        gamesPlayed: 5,
        totalScore: 1000,
        bestStreak: 2,
        save: sandbox.stub().resolves()
      };
      
      sandbox.stub(GameSession, 'findOne').resolves(mockSession);
      sandbox.stub(User, 'findById').resolves(mockUser);
      
      await finishGame(req, res);
      
      expect(mockSession.save.called).to.be.true;
      expect(mockUser.save.called).to.be.true;
      expect(res.json.called).to.be.true;
      
      const response = res.json.firstCall.args[0];
      expect(response.success).to.be.true;
      expect(response.stats.totalScore).to.equal(500);
    });
  });
  
  describe('getCurrentGame', () => {
    it('should return active game session', async () => {
      const mockSession = {
        _id: new mongoose.Types.ObjectId(),
        userId: req.user._id,
        status: 'active',
        currentStory: 1,
        stories: [
          { _id: new mongoose.Types.ObjectId(), text: 'Story 1', correctAnswer: 1 },
          { _id: new mongoose.Types.ObjectId(), text: 'Story 2', correctAnswer: 2 }
        ],
        toObject: () => ({
          _id: mockSession._id,
          status: 'active',
          currentStory: 1,
          stories: mockSession.stories
        })
      };
      
      sandbox.stub(GameSession, 'findOne').returns({
        populate: sandbox.stub().resolves(mockSession)
      });
      
      await getCurrentGame(req, res);
      
      expect(res.json.called).to.be.true;
      const response = res.json.firstCall.args[0];
      expect(response.success).to.be.true;
      expect(response.gameSession).to.exist;
    });
  });
}); 