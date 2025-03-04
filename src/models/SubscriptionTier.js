const mongoose = require('mongoose');

/**
 * Subscription tier model for artist support
 * Each artist can define up to 3 tiers with custom pricing and features
 */
const subscriptionTierSchema = new mongoose.Schema({
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artist',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0.99,
    max: 99.99
  },
  features: [{
    type: String,
    trim: true
  }],
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  isRecommended: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    min: 1,
    max: 3, // Maximum 3 tiers allowed
    required: true
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

// Ensure an artist can have maximum 3 tiers
subscriptionTierSchema.statics.countArtistTiers = async function(artistId) {
  return this.countDocuments({ artist: artistId, active: true });
};

// Pre-save hook to verify max 3 tiers per artist
subscriptionTierSchema.pre('save', async function(next) {
  if (this.isNew) {
    const tierCount = await this.constructor.countArtistTiers(this.artist);
    if (tierCount >= 3) {
      const error = new Error('Artist already has maximum number of tiers (3)');
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model('SubscriptionTier', subscriptionTierSchema);