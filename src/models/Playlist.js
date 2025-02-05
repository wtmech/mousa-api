const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const playlistSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 30  // Add maxlength validation
  },
  description: {
    type: String,
    trim: true
  },
  color: String,  // Just a simple color field
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tracks: [{
    type: Schema.Types.ObjectId,
    ref: 'Track'
  }],
  folder: {
    type: Schema.Types.ObjectId,
    ref: 'Folder'
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  isSystem: {
    type: Boolean,
    default: false  // For system playlists like "Liked Songs"
  },
  previewImage: String,  // Add this field for the preview image
  coverArt: String,
  plays: {
    type: Number,
    default: 0
  },
  icon: String,
  useIcon: {
    type: Boolean,
    default: false
  },
  useOnlyColor: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Playlist', playlistSchema);