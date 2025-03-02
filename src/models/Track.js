const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema({
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
  album: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Album'
  },
  trackNumber: {
    type: Number,
    min: 1
  },
  discNumber: {
    type: Number,
    min: 1,
    default: 1
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
  duration: Number,
  genre: String,
  fileUrl: {
    type: String,
    required: true
  },
  coverArt: String,
  isExclusive: {
    type: Boolean,
    default: false
  },
  allowDownload: {
    type: Boolean,
    default: true
  },
  plays: {
    type: Number,
    default: 0
  },
  metadata: {
    bpm: Number,
    key: String,
    isrc: String,
    language: String,
    explicit: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Index for search
trackSchema.index({ title: 'text', genre: 'text' });

module.exports = mongoose.model('Track', trackSchema);