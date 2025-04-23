const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['gameplay', 'accuracy', 'streak', 'social', 'meta'],
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  rarity: {
    type: String,
    enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
    required: true
  },
  points: {
    type: Number,
    required: true,
    min: 0
  },
  requirement: {
    type: {
      type: String,
      enum: ['single', 'progress', 'multi'],
      required: true
    },
    target: {
      type: Number,
      required: true
    },
    conditions: [{
      field: String,
      operator: String,
      value: mongoose.Schema.Types.Mixed
    }]
  },
  rewards: {
    score: Number,
    title: String,
    badge: String
  },
  secret: {
    type: Boolean,
    default: false
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Предопределенные достижения
const ACHIEVEMENTS = {
  // Игровые достижения
  FIRST_GAME: {
    id: 'first_game',
    name: 'Первое дело',
    description: 'Завершите свою первую игру',
    category: 'gameplay',
    icon: '🎮',
    rarity: 'common',
    points: 50,
    requirement: {
      type: 'single',
      target: 1,
      conditions: [{
        field: 'gamesPlayed',
        operator: '>=',
        value: 1
      }]
    }
  },
  PERFECT_GAME: {
    id: 'perfect_game',
    name: 'Безупречное расследование',
    description: 'Получите все правильные ответы в одной игре',
    category: 'accuracy',
    icon: '💯',
    rarity: 'rare',
    points: 200,
    requirement: {
      type: 'single',
      target: 1,
      conditions: [{
        field: 'isPerfect',
        operator: '==',
        value: true
      }]
    }
  },
  SPEED_DEMON: {
    id: 'speed_demon',
    name: 'Молниеносная дедукция',
    description: 'Завершите игру со средним временем ответа менее 3 секунд',
    category: 'speed',
    icon: '⚡',
    rarity: 'epic',
    points: 150,
    requirement: {
      type: 'single',
      target: 1,
      conditions: [{
        field: 'averageTime',
        operator: '<',
        value: 3000
      }]
    }
  },
  STREAK_MASTER: {
    id: 'streak_master',
    name: 'Мастер серий',
    description: 'Достигните серии из 10 правильных ответов',
    category: 'streak',
    icon: '🔥',
    rarity: 'rare',
    points: 100,
    requirement: {
      type: 'single',
      target: 10,
      conditions: [{
        field: 'streak',
        operator: '>=',
        value: 10
      }]
    }
  },
  VETERAN: {
    id: 'veteran',
    name: 'Ветеран',
    description: 'Сыграйте 100 игр',
    category: 'meta',
    icon: '🏅',
    rarity: 'epic',
    points: 300,
    requirement: {
      type: 'progress',
      target: 100,
      conditions: [{
        field: 'gamesPlayed',
        operator: '>=',
        value: 100
      }]
    }
  },
  ACCURACY_KING: {
    id: 'accuracy_king',
    name: 'Король точности',
    description: 'Достигните 95% точности после 50 игр',
    category: 'accuracy',
    icon: '👑',
    rarity: 'legendary',
    points: 500,
    requirement: {
      type: 'multi',
      target: 1,
      conditions: [
        {
          field: 'accuracy',
          operator: '>=',
          value: 95
        },
        {
          field: 'gamesPlayed',
          operator: '>=',
          value: 50
        }
      ]
    }
  },
  DAILY_DETECTIVE: {
    id: 'daily_detective',
    name: 'Ежедневный детектив',
    description: 'Играйте 7 дней подряд',
    category: 'meta',
    icon: '📅',
    rarity: 'uncommon',
    points: 150,
    requirement: {
      type: 'progress',
      target: 7,
      conditions: [{
        field: 'dailyStreak',
        operator: '>=',
        value: 7
      }]
    }
  },
  SOCIAL_BUTTERFLY: {
    id: 'social_butterfly',
    name: 'Социальная бабочка',
    description: 'Пригласите 5 друзей в игру',
    category: 'social',
    icon: '🦋',
    rarity: 'rare',
    points: 200,
    requirement: {
      type: 'progress',
      target: 5,
      conditions: [{
        field: 'invitedFriends',
        operator: '>=',
        value: 5
      }]
    }
  },
  NIGHT_OWL: {
    id: 'night_owl',
    name: 'Ночная сова',
    description: 'Сыграйте 10 игр между 00:00 и 04:00',
    category: 'meta',
    icon: '🦉',
    rarity: 'uncommon',
    points: 100,
    requirement: {
      type: 'progress',
      target: 10,
      conditions: [{
        field: 'nightGames',
        operator: '>=',
        value: 10
      }]
    },
    secret: true
  }
};

// Индексы для оптимизации
achievementSchema.index({ id: 1 }, { unique: true });
achievementSchema.index({ category: 1 });
achievementSchema.index({ rarity: 1 });
achievementSchema.index({ active: 1 });

const Achievement = mongoose.model('Achievement', achievementSchema);

module.exports = {
  Achievement,
  ACHIEVEMENTS
}; 