const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isDistributor: {
    type: Boolean,
    default: false
  },
  isArtist: {
    type: Boolean,
    default: false
  },
  playlists: {
    liked: {  // Reference to system "Liked Songs" playlist
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Playlist'
    },
    created: [{  // User-created playlists
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Playlist'
    }],
    folders: [{  // User-created playlist folders
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlaylistFolder'
    }]
  },
  following: {
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    artists: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artist'
    }]
  },
  followerCount: {
    type: Number,
    default: 0
  },
  // Payment and subscription details
  paymentMethods: [{
    provider: String, // e.g., 'stripe', 'paypal'
    token: String,    // Payment token or ID
    last4: String,    // Last 4 digits (for display)
    expiry: String,   // MM/YY format
    isDefault: Boolean,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // User preferences and settings
  preferences: {
    emailNotifications: {
      newReleases: {
        type: Boolean,
        default: true
      },
      artistUpdates: {
        type: Boolean,
        default: true
      },
      exclusiveContent: {
        type: Boolean,
        default: true
      },
      subscriptionRenewals: {
        type: Boolean,
        default: true
      }
    },
    appNotifications: {
      type: Boolean,
      default: true
    },
    darkMode: {
      type: Boolean,
      default: false
    }
  },
  recentlyPlayed: [{
    track: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Track'
    },
    playedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Password hashing middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.updatedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Virtual for user subscriptions
userSchema.virtual('subscriptions', {
  ref: 'UserSubscription',
  localField: '_id',
  foreignField: 'user'
});

module.exports = mongoose.model('User', userSchema);