const mongoose = require('mongoose');

// Define valid roles
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
  verifiedBy: {
    type: String,
    default: null
  },
  verificationDate: Date,
  subscriptionPrice: {
    type: Number,
    default: 0
  },
  monthlyListeners: {
    type: Number,
    default: 0
  },
  totalPlays: {
    type: Number,
    default: 0
  },
  subscriberCount: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  followerCount: {
    type: Number,
    default: 0
  }
});

const Artist = mongoose.model('Artist', artistSchema);
module.exports = { Artist, VALID_ROLES };