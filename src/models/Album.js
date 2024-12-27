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
  coverArt: String,
  description: {
    type: String,
    trim: true
  },
  genre: String,
  type: {
    type: String,
    enum: ['album', 'ep', 'single'],
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
  totalTracks: {
    type: Number,
    default: 0
  },
  plays: {
    type: Number,
    default: 0
  },
  isExclusive: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Album', albumSchema);