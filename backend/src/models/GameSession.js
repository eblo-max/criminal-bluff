/**
 * GameSession model for MongoDB
 * Represents an active game session for a user
 */
const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema({
  storyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Story',
    required: true
  },
  selectedOption: {
    type: Number,
    min: 0,
    max: 2
  },
  isCorrect: {
    type: Boolean,
    default: null
  },
  responseTime: {
    type: Number, // time in milliseconds
    default: null
  },
  pointsEarned: {
    type: Number,
    default: 0
  },
  answeredAt: {
    type: Date,
    default: null
  }
}, { _id: false });

const GameSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  telegramId: {
    type: Number,
    required: [true, 'Telegram ID is required']
  },
  stories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Story'
  }],
  answers: {
    type: [AnswerSchema],
    default: []
  },
  currentStory: {
    type: Number, // index of current story in the stories array
    default: 0
  },
  streak: {
    type: Number,
    default: 0
  },
  totalScore: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned'],
    default: 'active'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Game sessions expire after 1 hour by default
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 1);
      return expiry;
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
GameSessionSchema.index({ userId: 1, status: 1 });
GameSessionSchema.index({ telegramId: 1, status: 1 });
GameSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for automatic cleanup

module.exports = mongoose.model('GameSession', GameSessionSchema); 