const mongoose = require('mongoose');

/**
 * User subscription model to track subscriptions to artist tiers
 * Manages subscription status, billing, and renewal information
 */
const userSubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true
  },
  tier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionTier',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'canceled', 'paused', 'past_due'],
    default: 'active'
  },
  paymentMethod: {
    type: String
  },
  paymentId: {
    type: String
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  currentPeriodStart: {
    type: Date,
    default: Date.now
  },
  currentPeriodEnd: {
    type: Date,
    required: true
  },
  canceledAt: {
    type: Date
  },
  cancelReason: {
    type: String
  },
  // If auto-renew is enabled
  autoRenew: {
    type: Boolean,
    default: true
  },
  // Renewal attempts if payment fails
  renewalAttempts: {
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

// Index for quick lookup of user-artist combination
userSubscriptionSchema.index({ user: 1, artist: 1 }, { unique: true });

// Update timestamps when subscription is modified
userSubscriptionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if subscription is active
userSubscriptionSchema.methods.isActive = function() {
  return this.status === 'active' && new Date() <= this.currentPeriodEnd;
};

// Method to check if subscription can access content
userSubscriptionSchema.methods.canAccessContent = function() {
  // Even canceled subscriptions can access content until the end of the period
  return (this.status === 'active' || this.status === 'canceled') &&
         new Date() <= this.currentPeriodEnd;
};

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);