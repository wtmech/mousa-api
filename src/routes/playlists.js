const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Playlist = require('../models/Playlist');
const User = require('../models/User');
const Track = require('../models/Track');
const { uploadCover } = require('../utils/fileUpload');
const mongoose = require('mongoose');

// Get all public playlists (paginated)
router.get('/public', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const playlists = await Playlist.find({ isPublic: true })
      .populate('owner', 'username')
      .sort({ 'stats.followerCount': -1 })
      .skip(skip)
      .limit(limit);

    const total = await Playlist.countDocuments({ isPublic: true });

    res.json({
      playlists,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalPlaylists: total
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's playlists
router.get('/me', auth, async (req, res) => {
  try {
    // Get user's created playlists
    const playlists = await Playlist.find({ owner: req.user.id })
      .populate('owner', 'username');

    // Get user's liked playlists
    const user = await User.findById(req.user.id)
      .populate({
        path: 'playlists.liked',
        populate: {
          path: 'owner',
          select: 'username'
        }
      });

    // Get playlists the user follows
    const followedPlaylists = await Playlist.find({
      followers: req.user.id,
      owner: { $ne: req.user.id } // Exclude playlists the user owns
    }).populate('owner', 'username');

    res.json({
      created: playlists,
      liked: user.playlists.liked || null,
      followed: followedPlaylists
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get playlist by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate('owner', 'username')
      .populate({
        path: 'tracks.track',
        populate: [
          {
            path: 'artist',
            select: 'name'
          },
          {
            path: 'album',
            select: 'title coverArt'
          }
        ]
      });

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check access for private playlists
    if (!playlist.isPublic && playlist.owner._id.toString() !== req.user.id && !playlist.followers.includes(req.user.id)) {
      return res.status(403).json({ message: 'Access denied to private playlist' });
    }

    res.json(playlist);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new playlist
router.post('/', auth, uploadCover, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Playlist name is required' });
    }

    const newPlaylist = new Playlist({
      name,
      description: description || '',
      owner: req.user.id,
      isPublic: isPublic === 'false' ? false : true,
      type: 'user'
    });

    // Add cover image if uploaded
    if (req.file) {
      newPlaylist.coverImage = `/uploads/covers/${req.file.filename}`;
    }

    await newPlaylist.save();

    // Add to user's created playlists
    await User.findByIdAndUpdate(
      req.user.id,
      { $push: { 'playlists.created': newPlaylist._id } }
    );

    res.status(201).json(newPlaylist);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add track to playlist
router.post('/:id/tracks', auth, async (req, res) => {
  try {
    const { trackId } = req.body;

    // Check if playlist exists
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check if user owns playlist
    if (playlist.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: You do not own this playlist' });
    }

    // Check if track exists
    const track = await Track.findById(trackId);
    if (!track) {
      return res.status(404).json({ message: 'Track not found' });
    }

    // Check if track is already in playlist
    const trackExists = playlist.tracks.some(t => t.track.toString() === trackId);
    if (trackExists) {
      return res.status(400).json({ message: 'Track already in playlist' });
    }

    // Add track to playlist
    playlist.tracks.push({
      track: trackId,
      addedAt: Date.now()
    });

    // Update playlist duration
    playlist.stats.totalDuration += track.duration || 0;

    await playlist.save();

    res.json({ message: 'Track added to playlist', playlist });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove track from playlist
router.delete('/:id/tracks/:trackId', auth, async (req, res) => {
  try {
    // Check if playlist exists
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check if user owns playlist
    if (playlist.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: You do not own this playlist' });
    }

    // Check if track is in playlist
    const trackItem = playlist.tracks.find(t => t.track.toString() === req.params.trackId);
    if (!trackItem) {
      return res.status(404).json({ message: 'Track not found in playlist' });
    }

    // Get track duration to subtract from total
    const track = await Track.findById(req.params.trackId);
    if (track) {
      playlist.stats.totalDuration -= track.duration || 0;
    }

    // Remove track from playlist
    playlist.tracks = playlist.tracks.filter(t => t.track.toString() !== req.params.trackId);

    await playlist.save();

    res.json({ message: 'Track removed from playlist', playlist });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update playlist details
router.patch('/:id', auth, uploadCover, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check if user owns playlist
    if (playlist.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: You do not own this playlist' });
    }

    const { name, description, isPublic } = req.body;

    // Update fields if provided
    if (name) playlist.name = name;
    if (description !== undefined) playlist.description = description;
    if (isPublic !== undefined) playlist.isPublic = isPublic === 'false' ? false : true;

    // Add cover image if uploaded
    if (req.file) {
      playlist.coverImage = `/uploads/covers/${req.file.filename}`;
    }

    await playlist.save();
    res.json(playlist);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete playlist
router.delete('/:id', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check if user owns playlist and it's not a system playlist
    if (playlist.owner.toString() !== req.user.id || playlist.type === 'system') {
      return res.status(403).json({
        message: playlist.type === 'system'
          ? 'System playlists cannot be deleted'
          : 'Access denied: You do not own this playlist'
      });
    }

    // Remove playlist from user's created playlists
    await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { 'playlists.created': playlist._id } }
    );

    // Delete the playlist
    await Playlist.findByIdAndDelete(req.params.id);

    res.json({ message: 'Playlist deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Follow / unfollow playlist
router.post('/:id/follow', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check if playlist is public or user owns it
    if (!playlist.isPublic && playlist.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'This playlist is private' });
    }

    const isFollowing = playlist.followers.includes(req.user.id);

    if (isFollowing) {
      // Unfollow
      playlist.followers = playlist.followers.filter(id => id.toString() !== req.user.id);
      playlist.stats.followerCount = Math.max(0, playlist.stats.followerCount - 1);
    } else {
      // Follow
      playlist.followers.push(req.user.id);
      playlist.stats.followerCount += 1;
    }

    await playlist.save();

    res.json({
      following: !isFollowing,
      message: isFollowing ? 'Playlist unfollowed' : 'Playlist followed',
      followerCount: playlist.stats.followerCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;