const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Playlist = require('../models/Playlist');
const User = require('../models/User');
const Track = require('../models/Track');
const { uploadCover } = require('../utils/fileUpload');
const mongoose = require('mongoose');
const PlaylistFolder = require('../models/PlaylistFolder');
const { validateColor } = require('../middleware/validation');

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
router.post('/', [auth, validateColor], uploadCover, async (req, res) => {
  try {
    const { name, description, isPublic, color, folder } = req.body;

    // Validate input
    if (!name) {
      return res.status(400).json({ message: 'Playlist name is required' });
    }

    // Check if folder exists and belongs to user if provided
    if (folder) {
      const playlistFolder = await PlaylistFolder.findById(folder);
      if (!playlistFolder) {
        return res.status(404).json({ message: 'Folder not found' });
      }
      if (playlistFolder.owner.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to use this folder' });
      }
    }

    // Create new playlist
    const newPlaylist = new Playlist({
      name,
      description,
      owner: req.user.id,
      isPublic: isPublic === 'true' || isPublic === true,
      color: color || '#1DB954', // Use provided color or default
      folder: folder || null
    });

    // Add cover image if uploaded
    if (req.file) {
      newPlaylist.coverImage = `/uploads/covers/${req.file.filename}`;
    }

    await newPlaylist.save();

    // Add to user's playlists
    await User.findByIdAndUpdate(req.user.id, {
      $push: { 'playlists.created': newPlaylist._id }
    });

    // Add to folder if specified
    if (folder) {
      await PlaylistFolder.findByIdAndUpdate(folder, {
        $push: { playlists: newPlaylist._id }
      });
    }

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
router.put('/:id', [auth, validateColor], uploadCover, async (req, res) => {
  try {
    const playlistId = req.params.id;
    const { name, description, isPublic, color, folder } = req.body;

    // Find the playlist
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Verify ownership
    if (playlist.owner.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check if new folder exists and belongs to user if provided
    if (folder && folder !== playlist.folder) {
      const playlistFolder = await PlaylistFolder.findById(folder);
      if (!playlistFolder) {
        return res.status(404).json({ message: 'Folder not found' });
      }
      if (playlistFolder.owner.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to use this folder' });
      }

      // Remove from old folder if exists
      if (playlist.folder) {
        await PlaylistFolder.findByIdAndUpdate(playlist.folder, {
          $pull: { playlists: playlistId }
        });
      }

      // Add to new folder
      await PlaylistFolder.findByIdAndUpdate(folder, {
        $push: { playlists: playlistId }
      });
    } else if (folder === null && playlist.folder) {
      // Remove from current folder if folder is explicitly set to null
      await PlaylistFolder.findByIdAndUpdate(playlist.folder, {
        $pull: { playlists: playlistId }
      });
    }

    // Update fields
    if (name) playlist.name = name;
    if (description !== undefined) playlist.description = description;
    if (isPublic !== undefined) {
      playlist.isPublic = isPublic === 'true' || isPublic === true;
    }
    if (color) playlist.color = color;
    if (folder !== undefined) playlist.folder = folder || null;

    // Update cover image if uploaded
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

// Batch update playlists
router.post('/batch-update', [auth, validateColor], async (req, res) => {
  try {
    const { playlistIds, updates } = req.body;

    // Validate inputs
    if (!playlistIds || !Array.isArray(playlistIds) || playlistIds.length === 0) {
      return res.status(400).json({ message: 'Playlist IDs are required' });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Updates are required' });
    }

    // Verify user owns all the playlists
    const playlists = await Playlist.find({
      _id: { $in: playlistIds },
      owner: req.user.id
    });

    if (playlists.length !== playlistIds.length) {
      return res.status(403).json({ message: 'You do not own all specified playlists' });
    }

    // Validate color if it's being updated
    if (updates.color) {
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!hexColorRegex.test(updates.color)) {
        return res.status(400).json({ message: 'Invalid color format' });
      }
    }

    // If folder is being updated, verify it exists and user owns it
    if (updates.folder) {
      if (updates.folder !== null) {
        const folder = await PlaylistFolder.findOne({
          _id: updates.folder,
          owner: req.user.id
        });

        if (!folder) {
          return res.status(404).json({ message: 'Folder not found or not owned by you' });
        }

        // Add playlists to folder
        await PlaylistFolder.findByIdAndUpdate(updates.folder, {
          $addToSet: { playlists: { $each: playlistIds } }
        });
      }

      // Remove playlists from their current folders
      const currentFolders = [...new Set(playlists.map(p => p.folder).filter(f => f))];
      for (const folderId of currentFolders) {
        await PlaylistFolder.findByIdAndUpdate(folderId, {
          $pull: { playlists: { $in: playlistIds } }
        });
      }
    }

    // Set up allowed update fields
    const allowedUpdates = {};
    if (updates.color) allowedUpdates.color = updates.color;
    if (updates.isPublic !== undefined) allowedUpdates.isPublic = updates.isPublic;
    if (updates.folder !== undefined) allowedUpdates.folder = updates.folder;

    // Apply updates
    await Playlist.updateMany(
      { _id: { $in: playlistIds } },
      { $set: allowedUpdates }
    );

    res.json({
      message: 'Playlists updated successfully',
      updatedCount: playlistIds.length,
      updates: allowedUpdates
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's recently modified playlists
router.get('/recent', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Get user's recently modified playlists
    const recentPlaylists = await Playlist.find({
      owner: req.user.id
    })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .populate('folder', 'name')
    .select('name color coverImage updatedAt tracks.length stats');

    res.json(recentPlaylists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Filter playlists by various criteria
router.get('/filter', auth, async (req, res) => {
  try {
    const {
      color,
      folder,
      hasImage,
      createdAfter,
      createdBefore,
      updatedAfter,
      updatedBefore,
      minTracks,
      maxTracks,
      sortBy,
      sortOrder
    } = req.query;

    const query = { owner: req.user.id };

    // Apply filters
    if (color) {
      query.color = color;
    }

    if (folder === 'none') {
      query.folder = null;
    } else if (folder) {
      query.folder = folder;
    }

    if (hasImage === 'true') {
      query.coverImage = { $ne: null };
    } else if (hasImage === 'false') {
      query.coverImage = null;
    }

    // Date range filters
    const dateQuery = {};
    if (createdAfter) {
      dateQuery.$gte = new Date(createdAfter);
    }
    if (createdBefore) {
      dateQuery.$lte = new Date(createdBefore);
    }
    if (Object.keys(dateQuery).length > 0) {
      query.createdAt = dateQuery;
    }

    // Updated date range
    const updatedDateQuery = {};
    if (updatedAfter) {
      updatedDateQuery.$gte = new Date(updatedAfter);
    }
    if (updatedBefore) {
      updatedDateQuery.$lte = new Date(updatedBefore);
    }
    if (Object.keys(updatedDateQuery).length > 0) {
      query.updatedAt = updatedDateQuery;
    }

    // Track count filters
    if (minTracks) {
      query.$expr = { $gte: [{ $size: "$tracks" }, parseInt(minTracks)] };
    }
    if (maxTracks) {
      if (query.$expr) {
        // If we already have an $expr for minTracks, we need to use $and
        query.$expr = {
          $and: [
            query.$expr,
            { $lte: [{ $size: "$tracks" }, parseInt(maxTracks)] }
          ]
        };
      } else {
        query.$expr = { $lte: [{ $size: "$tracks" }, parseInt(maxTracks)] };
      }
    }

    // Determine sort options
    let sortOptions = { createdAt: -1 }; // Default sort
    if (sortBy) {
      const order = sortOrder === 'asc' ? 1 : -1;

      switch(sortBy) {
        case 'name':
          sortOptions = { name: order };
          break;
        case 'created':
          sortOptions = { createdAt: order };
          break;
        case 'updated':
          sortOptions = { updatedAt: order };
          break;
        case 'tracks':
          // For track count sorting, we'll handle it in JS memory
          // as it's more complex in MongoDB without a direct field
          sortOptions = { createdAt: -1 }; // Default, will sort in memory
          break;
        default:
          sortOptions = { createdAt: -1 };
      }
    }

    // Execute query
    let playlists = await Playlist.find(query)
      .sort(sortOptions)
      .populate('folder', 'name');

    // If sorting by track count, do it in memory
    if (sortBy === 'tracks') {
      playlists = playlists.sort((a, b) => {
        const aCount = a.tracks ? a.tracks.length : 0;
        const bCount = b.tracks ? b.tracks.length : 0;
        return sortOrder === 'asc' ? aCount - bCount : bCount - aCount;
      });
    }

    res.json({
      playlists,
      count: playlists.length,
      filters: {
        color,
        folder,
        hasImage,
        createdDateRange: createdAfter || createdBefore ? { from: createdAfter, to: createdBefore } : null,
        updatedDateRange: updatedAfter || updatedBefore ? { from: updatedAfter, to: updatedBefore } : null,
        trackCount: minTracks || maxTracks ? { min: minTracks, max: maxTracks } : null,
        sort: { by: sortBy, order: sortOrder }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Duplicate a playlist
router.post('/:id/duplicate', auth, async (req, res) => {
  try {
    const sourcePlaylistId = req.params.id;
    const { name, description, folder } = req.body;

    // Find the source playlist and verify access
    const sourcePlaylist = await Playlist.findOne({
      _id: sourcePlaylistId,
      $or: [
        { owner: req.user.id },
        { isPublic: true }
      ]
    }).populate('tracks.track');

    if (!sourcePlaylist) {
      return res.status(404).json({ message: 'Playlist not found or access denied' });
    }

    // Validate folder if provided
    if (folder) {
      const folderExists = await PlaylistFolder.findOne({
        _id: folder,
        owner: req.user.id
      });

      if (!folderExists) {
        return res.status(404).json({ message: 'Target folder not found or not owned by you' });
      }
    }

    // Create new playlist
    const newPlaylist = new Playlist({
      name: name || `${sourcePlaylist.name} (copy)`,
      description: description || sourcePlaylist.description,
      owner: req.user.id,
      isPublic: false, // Default to private for copied playlists
      color: sourcePlaylist.color,
      tracks: sourcePlaylist.tracks.map(track => ({
        track: track.track._id,
        addedAt: new Date()
      })),
      folder: folder || null,
      stats: {
        totalDuration: sourcePlaylist.stats.totalDuration,
        followerCount: 0
      }
    });

    // Save the new playlist
    await newPlaylist.save();

    // If folder is specified, add playlist to folder
    if (folder) {
      await PlaylistFolder.findByIdAndUpdate(folder, {
        $addToSet: { playlists: newPlaylist._id }
      });
    }

    // Update user's created playlists
    await User.findByIdAndUpdate(req.user.id, {
      $push: { 'playlists.created': newPlaylist._id }
    });

    res.status(201).json({
      message: 'Playlist duplicated successfully',
      playlist: {
        id: newPlaylist._id,
        name: newPlaylist.name,
        trackCount: newPlaylist.tracks.length
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle a track in the user's Liked Music playlist
router.post('/liked/toggle/:trackId', auth, async (req, res) => {
  try {
    const trackId = req.params.trackId;

    // Validate trackId
    if (!mongoose.Types.ObjectId.isValid(trackId)) {
      return res.status(400).json({ message: 'Invalid track ID' });
    }

    // Make sure track exists
    const track = await Track.findById(trackId);
    if (!track) {
      return res.status(404).json({ message: 'Track not found' });
    }

    // Get user's liked playlist ID
    const user = await User.findById(req.user.id);
    if (!user || !user.playlists || !user.playlists.liked) {
      return res.status(404).json({ message: 'Liked playlist not found' });
    }

    const likedPlaylistId = user.playlists.liked;

    // Get the liked playlist
    const likedPlaylist = await Playlist.findById(likedPlaylistId);
    if (!likedPlaylist) {
      return res.status(404).json({ message: 'Liked playlist not found' });
    }

    // Check if track is already in the playlist
    const trackIndex = likedPlaylist.tracks.findIndex(
      item => item.track.toString() === trackId
    );

    let message = '';
    let isLiked = false;

    if (trackIndex === -1) {
      // Add track to playlist
      likedPlaylist.tracks.push({
        track: trackId,
        addedAt: new Date()
      });
      message = 'Track added to Liked Music';
      isLiked = true;
    } else {
      // Remove track from playlist
      likedPlaylist.tracks.splice(trackIndex, 1);
      message = 'Track removed from Liked Music';
      isLiked = false;
    }

    // Update duration stats
    const trackDuration = track.duration || 0;
    likedPlaylist.stats.totalDuration = likedPlaylist.tracks.reduce(
      (total, item) => total + (item.track.duration || 0),
      0
    );

    await likedPlaylist.save();

    res.json({
      message,
      isLiked,
      playlistId: likedPlaylist._id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if a track is in the user's Liked Music playlist
router.get('/liked/check/:trackId', auth, async (req, res) => {
  try {
    const trackId = req.params.trackId;

    // Validate trackId
    if (!mongoose.Types.ObjectId.isValid(trackId)) {
      return res.status(400).json({ message: 'Invalid track ID' });
    }

    // Get user's liked playlist ID
    const user = await User.findById(req.user.id);
    if (!user || !user.playlists || !user.playlists.liked) {
      return res.status(404).json({ message: 'Liked playlist not found' });
    }

    const likedPlaylistId = user.playlists.liked;

    // Check if track is in the playlist
    const playlist = await Playlist.findById(likedPlaylistId);
    const isLiked = playlist.tracks.some(
      item => item.track.toString() === trackId
    );

    res.json({ isLiked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;