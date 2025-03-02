const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  tracks: [{
    track: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Track',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  coverImage: {
    type: String,
    default: null
  },
  type: {
    type: String,
    enum: ['user', 'system', 'artist'],
    default: 'user'
  },
  stats: {
    totalDuration: {
      type: Number,
      default: 0
    },
    followerCount: {
      type: Number,
      default: 0
    },
    playCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Index for search
playlistSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Playlist', playlistSchema);