const mongoose = require('mongoose');

/**
 * Artist event model for concerts, releases, live streams, etc.
 * Used to display upcoming events on artist pages
 */
const artistEventSchema = new mongoose.Schema({
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  eventType: {
    type: String,
    enum: ['concert', 'release', 'livestream', 'signing', 'interview', 'other'],
    default: 'concert'
  },
  date: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  venue: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  ticketUrl: {
    type: String,
    trim: true
  },
  imageUrl: {
    type: String
  },
  isVirtual: {
    type: Boolean,
    default: false
  },
  streamUrl: {
    type: String
  },
  isExclusiveToSupporters: {
    type: Boolean,
    default: false
  },
  minimumTierRequired: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionTier'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
artistEventSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for quick queries
artistEventSchema.index({ artist: 1, date: 1 });
artistEventSchema.index({ date: 1 }); // For upcoming events across all artists

module.exports = mongoose.model('ArtistEvent', artistEventSchema);