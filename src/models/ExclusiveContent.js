const mongoose = require('mongoose');

/**
 * Exclusive content model for premium content available to supporters
 * Includes videos, unreleased tracks, behind-the-scenes content, etc.
 */
const exclusiveContentSchema = new mongoose.Schema({
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
  contentType: {
    type: String,
    enum: ['audio', 'video', 'image', 'text', 'livestream', 'download'],
    required: true
  },
  contentUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String
  },
  duration: {
    type: Number, // In seconds
  },
  fileSize: {
    type: Number, // In bytes
  },
  releaseDate: {
    type: Date,
    default: Date.now
  },
  // Which tier of supporters can access this content
  minimumTierRequired: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionTier'
  },
  // For free preview content
  isPublic: {
    type: Boolean,
    default: false
  },
  // For limited-time access
  expiresAt: {
    type: Date
  },
  // Metadata for different content types
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  tags: [{
    type: String,
    trim: true
  }],
  viewCount: {
    type: Number,
    default: 0
  },
  downloadCount: {
    type: Number,
    default: 0
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
exclusiveContentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for quick queries
exclusiveContentSchema.index({ artist: 1, releaseDate: -1 });
exclusiveContentSchema.index({ artist: 1, contentType: 1 });
exclusiveContentSchema.index({ minimumTierRequired: 1 });

module.exports = mongoose.model('ExclusiveContent', exclusiveContentSchema);