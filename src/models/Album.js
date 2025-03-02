const mongoose = require('mongoose');

const albumSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true
  },
  releaseDate: {
    type: Date,
    required: true
  },
  coverArt: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['album', 'single', 'ep'],
    default: 'album'
  },
  distributor: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    uploadDate: {
      type: Date,
      default: Date.now
    }
  },
  tracks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Track'
  }],
  genre: String,
  description: String,
  totalDuration: {
    type: Number,
    default: 0
  },
  isExclusive: {
    type: Boolean,
    default: false
  },
  metadata: {
    label: String,
    upc: String,
    copyright: String,
    language: String
  },
  stats: {
    totalPlays: {
      type: Number,
      default: 0
    },
    monthlyPlays: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Index for search
albumSchema.index({ title: 'text', genre: 'text' });

module.exports = mongoose.model('Album', albumSchema);