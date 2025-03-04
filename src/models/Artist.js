const mongoose = require('mongoose');

const VALID_ROLES = [
  'band-member',    // For actual band members
  'management'      // For managers, producers, etc.
];

const artistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  bio: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  genres: [{
    type: String,
    trim: true
  }],
  socialLinks: {
    spotify: String,
    instagram: String,
    twitter: String,
    website: String
  },
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: VALID_ROLES,
      default: 'band-member'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      type: String
    }
  }],
  // Verification details
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: String,
    default: null
  },
  verificationDate: Date,

  // Cover art and profile images
  coverArt: String,
  profileImage: String,

  // Statistics
  monthlyListeners: {
    type: Number,
    default: 0
  },
  totalPlays: {
    type: Number,
    default: 0
  },
  followerCount: {
    type: Number,
    default: 0
  },

  // Subscription settings
  acceptsSubscriptions: {
    type: Boolean,
    default: false
  },
  hasCustomSubscriptionTiers: {
    type: Boolean,
    default: false
  },
  defaultSubscriptionAmount: {
    type: Number,
    default: 4.99
  },

  // Featured artist flag
  featured: {
    type: Boolean,
    default: false
  },

  // For artist notifications
  contactEmail: {
    type: String,
    trim: true
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

// Update timestamps when artist is modified
artistSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for subscription tiers
artistSchema.virtual('subscriptionTiers', {
  ref: 'SubscriptionTier',
  localField: '_id',
  foreignField: 'artist'
});

// Virtual for upcoming events
artistSchema.virtual('upcomingEvents', {
  ref: 'ArtistEvent',
  localField: '_id',
  foreignField: 'artist',
  options: {
    match: { date: { $gte: new Date() } },
    sort: { date: 1 }
  }
});

// Virtual for exclusive content
artistSchema.virtual('exclusiveContent', {
  ref: 'ExclusiveContent',
  localField: '_id',
  foreignField: 'artist'
});

module.exports = mongoose.model('Artist', artistSchema);