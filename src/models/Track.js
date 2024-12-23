const mongoose = require('mongoose');
const User = require('./User');

const trackSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  artistName: {
    type: String,
    required: true,
    trim: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  album: {
    type: String,
    trim: true
  },
  duration: {
    type: Number,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  coverArt: {
    type: String,
    default: 'default-cover.jpg'
  },
  genre: {
    type: String,
    trim: true
  },
  distributor: {
    type: String,
    required: true,
    enum: ['local', 'official', 'artist']
  },
  isExclusive: {
    type: Boolean,
    default: true
  },
  allowDownload: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Method to check if a track can be deleted by a user
trackSchema.methods.canBeDeletedBy = function(userId) {
  return this.distributor === 'artist' &&
        this.uploadedBy.toString() === userId.toString();
};

// Method to check if a user can access this track
trackSchema.methods.canBeAccessedBy = async function(userId) {
  if (!this.isExclusive) return true;

  if (this.uploadedBy.toString() === userId.toString()) return true;

  // Check if user subscribes to the artist
  const user = await User.findById(userId);
  return user && user.subscriptions &&
        user.subscriptions.includes(this.uploadedBy);
};

module.exports = mongoose.model('Track', trackSchema);