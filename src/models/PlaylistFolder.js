const mongoose = require('mongoose');

/**
 * PlaylistFolder model for organizing playlists
 * Allows users to group playlists into folders
 */
const playlistFolderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  playlists: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Playlist'
  }],
  parentFolder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlaylistFolder',
    default: null
  },
  isPublic: {
    type: Boolean,
    default: false
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

// Update timestamp when modified
playlistFolderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Remove reference from playlists when folder is deleted
playlistFolderSchema.pre('remove', async function(next) {
  try {
    // Update playlists to remove folder reference
    if (this.playlists && this.playlists.length > 0) {
      const Playlist = mongoose.model('Playlist');
      await Playlist.updateMany(
        { _id: { $in: this.playlists } },
        { $set: { folder: null } }
      );
    }

    // Update child folders to remove parent reference
    const PlaylistFolder = mongoose.model('PlaylistFolder');
    await PlaylistFolder.updateMany(
      { parentFolder: this._id },
      { $set: { parentFolder: null } }
    );

    next();
  } catch (err) {
    next(err);
  }
});

// Add search indexes
playlistFolderSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('PlaylistFolder', playlistFolderSchema);