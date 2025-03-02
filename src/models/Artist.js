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
  verifiedBy: {
    type: String,
    default: null
  },
  verificationDate: Date,
  exclusiveContent: [{
    title: String,
    description: String,
    fileUrl: String,
    coverArt: String,
    releaseDate: Date,
    isPublic: {
      type: Boolean,
      default: false
    }
  }],
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
  featured: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Artist', artistSchema);