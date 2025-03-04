const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { auth, isAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Playlist = require('../models/Playlist');
const { uploadAvatar } = require('../utils/fileUpload');

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('playlists.liked')
      .populate('playlists.created');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's recently played tracks
router.get('/recently-played', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({
        path: 'recentlyPlayed.track',
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
      })
      .select('recentlyPlayed');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.recentlyPlayed || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.patch('/profile', auth, uploadAvatar, async (req, res) => {
  try {
    const { firstName, lastName, username, email } = req.body;

    // Build user object
    const userFields = {};
    if (firstName) userFields.firstName = firstName;
    if (lastName) userFields.lastName = lastName;
    if (username) {
      // Check if username is already taken by another user
      const existingUser = await User.findOne({
        username,
        _id: { $ne: req.user.id }
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Username is already taken' });
      }

      userFields.username = username;
    }

    if (email) {
      // Check if email is already taken by another user
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.user.id }
      });

      if (existingUser) {
        return res.status(400).json({ message: 'Email is already taken' });
      }

      userFields.email = email;
    }

    // Add avatar if uploaded
    if (req.file) {
      userFields.avatar = `/uploads/avatars/${req.file.filename}`;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: userFields },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both current password and new password are required' });
    }

    // Get user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Validate new password
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create default "Liked Songs" playlist for a user
const createLikedSongsPlaylist = async (userId) => {
  try {
    const likedPlaylist = new Playlist({
      name: 'Liked Songs',
      description: 'Tracks you have liked',
      owner: userId,
      isPublic: false,
      type: 'system'
    });

    await likedPlaylist.save();

    // Link to user
    await User.findByIdAndUpdate(
      userId,
      { 'playlists.liked': likedPlaylist._id }
    );

    return likedPlaylist;
  } catch (error) {
    console.error('Error creating liked songs playlist:', error);
    throw error;
  }
};

// Admin: Get all users
router.get('/', auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get public user profile by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('firstName lastName username followerCount playlists.created')
      .populate({
        path: 'playlists.created',
        match: { isPublic: true }
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Update user (with role changes)
router.patch('/:id', auth, isAdmin, async (req, res) => {
  try {
    const { firstName, lastName, username, email, isAdmin, isDistributor, isArtist } = req.body;

    // Build user object
    const userFields = {};
    if (firstName) userFields.firstName = firstName;
    if (lastName) userFields.lastName = lastName;
    if (username) userFields.username = username;
    if (email) userFields.email = email;
    if (isAdmin !== undefined) userFields.isAdmin = isAdmin;
    if (isDistributor !== undefined) userFields.isDistributor = isDistributor;
    if (isArtist !== undefined) userFields.isArtist = isArtist;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: userFields },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add like to a track
router.post('/like/:trackId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure user has a Liked Songs playlist
    let likedPlaylist;
    if (!user.playlists.liked) {
      likedPlaylist = await createLikedSongsPlaylist(user._id);
    } else {
      likedPlaylist = await Playlist.findById(user.playlists.liked);

      if (!likedPlaylist) {
        likedPlaylist = await createLikedSongsPlaylist(user._id);
      }
    }

    // Check if track is already in liked playlist
    const trackExists = likedPlaylist.tracks.some(t => t.track.toString() === req.params.trackId);

    if (trackExists) {
      // Unlike track - remove from playlist
      likedPlaylist.tracks = likedPlaylist.tracks.filter(t => t.track.toString() !== req.params.trackId);
      await likedPlaylist.save();

      res.json({ liked: false, message: 'Track removed from liked songs' });
    } else {
      // Like track - add to playlist
      likedPlaylist.tracks.push({
        track: req.params.trackId,
        addedAt: Date.now()
      });
      await likedPlaylist.save();

      res.json({ liked: true, message: 'Track added to liked songs' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's library (playlists and folders in a hierarchical structure)
router.get('/me/library', auth, async (req, res) => {
  try {
    // Get user with populated fields
    const user = await User.findById(req.user.id)
      .populate({
        path: 'playlists.created',
        select: 'name color coverImage tracks folder stats.totalDuration stats.followerCount createdAt updatedAt'
      })
      .populate({
        path: 'playlists.folders',
        select: 'name description playlists parentFolder isPublic createdAt updatedAt',
        populate: {
          path: 'playlists',
          select: 'name color coverImage stats.totalDuration'
        }
      })
      .populate({
        path: 'playlists.liked',
        select: 'name coverImage tracks stats.totalDuration'
      });

    // Get user's ownership of playlists
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Organize data into a hierarchical structure
    const rootFolders = user.playlists.folders.filter(
      folder => !folder.parentFolder
    );

    // Find playlists not in any folder
    const unfolderedPlaylists = user.playlists.created.filter(
      playlist => !playlist.folder
    );

    // Get all child folders for each root folder
    const folderHierarchy = await buildFolderHierarchy(rootFolders, user.playlists.folders);

    res.json({
      rootFolders: folderHierarchy,
      unfolderedPlaylists: unfolderedPlaylists,
      likedPlaylist: user.playlists.liked,
      totalPlaylists: user.playlists.created.length,
      totalFolders: user.playlists.folders.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to build folder hierarchy
async function buildFolderHierarchy(folders, allFolders) {
  const result = [];

  for (const folder of folders) {
    const childFolders = allFolders.filter(
      f => f.parentFolder && f.parentFolder.toString() === folder._id.toString()
    );

    const folderWithChildren = {
      ...folder.toObject(),
      childFolders: await buildFolderHierarchy(childFolders, allFolders)
    };

    result.push(folderWithChildren);
  }

  return result;
}

module.exports = router;