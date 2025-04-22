/**
 * User model for MongoDB
 * Represents a Telegram user playing the Criminal Bluff game
 */
const mongoose = require('mongoose');

const AchievementSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  unlockedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const UserSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: [true, 'Telegram ID is required'],
    unique: true
  },
  username: {
    type: String,
    trim: true
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  photoUrl: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: 'ru'
  },
  score: {
    type: Number,
    default: 0
  },
  gamesPlayed: {
    type: Number,
    default: 0
  },
  correctAnswers: {
    type: Number,
    default: 0
  },
  bestStreak: {
    type: Number,
    default: 0
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  lastPlayed: {
    type: Date,
    default: null
  },
  achievements: {
    type: [AchievementSchema],
    default: []
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  registeredAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
// UserSchema.index({ telegramId: 1 });
UserSchema.index({ score: -1 }); // For leaderboard queries

module.exports = mongoose.model('User', UserSchema); 