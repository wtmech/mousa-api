const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/admin');
const User = require('../models/User');
const Track = require('../models/Track');
const fs = require('fs');
const path = require('path');
const { Artist, VALID_ROLES } = require('../models/Artist');

// Add a test route
router.get('/test', (req, res) => {
  res.json({ message: 'Admin routes are working' });
});

// ... existing admin routes ...

// Delete all tracks (admin only)
router.delete('/tracks/all', [auth, isAdmin], async (req, res) => {
  try {
    // Get all tracks
    const tracks = await Track.find({});

    // Delete physical files
    for (const track of tracks) {
      const filePath = path.join(__dirname, '../../public', track.fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete cover art if it exists and isn't the default
      if (track.coverArt && track.coverArt !== 'default-cover.jpg') {
        const coverPath = path.join(__dirname, '../../public', track.coverArt);
        if (fs.existsSync(coverPath)) {
          fs.unlinkSync(coverPath);
        }
      }
    }

    // Delete all tracks from database
    await Track.deleteMany({});

    res.json({
      message: `Successfully deleted ${tracks.length} tracks`,
      deletedCount: tracks.length
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete tracks by artist (admin only)
router.delete('/tracks/artist/:artistId', [auth, isAdmin], async (req, res) => {
  try {
    const tracks = await Track.find({ uploadedBy: req.params.artistId });

    // Delete physical files
    for (const track of tracks) {
      const filePath = path.join(__dirname, '../../public', track.fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      if (track.coverArt && track.coverArt !== 'default-cover.jpg') {
        const coverPath = path.join(__dirname, '../../public', track.coverArt);
        if (fs.existsSync(coverPath)) {
          fs.unlinkSync(coverPath);
        }
      }
    }

    // Delete tracks from database
    await Track.deleteMany({ uploadedBy: req.params.artistId });

    res.json({
      message: `Successfully deleted ${tracks.length} tracks from artist`,
      deletedCount: tracks.length
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete specific tracks (admin only)
router.delete('/tracks', [auth, isAdmin], async (req, res) => {
  try {
    const { trackIds } = req.body;

    if (!Array.isArray(trackIds)) {
      return res.status(400).json({ message: 'trackIds must be an array' });
    }

    const tracks = await Track.find({ _id: { $in: trackIds } });

    // Delete physical files
    for (const track of tracks) {
      const filePath = path.join(__dirname, '../../public', track.fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      if (track.coverArt && track.coverArt !== 'default-cover.jpg') {
        const coverPath = path.join(__dirname, '../../public', track.coverArt);
        if (fs.existsSync(coverPath)) {
          fs.unlinkSync(coverPath);
        }
      }
    }

    // Delete tracks from database
    await Track.deleteMany({ _id: { $in: trackIds } });

    res.json({
      message: `Successfully deleted ${tracks.length} tracks`,
      deletedCount: tracks.length
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Link user to artist with simplified role validation
router.post('/link-user-artist', [auth, isAdmin], async (req, res) => {
  try {
    const { userId, artistId, role = 'band-member' } = req.body;

    // Validate inputs
    if (!userId || !artistId) {
      return res.status(400).json({
        message: 'User ID and Artist ID are required'
      });
    }

    // Validate role
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Must be either 'band-member' or 'management'`
      });
    }

    // Find user and artist
    const user = await User.findById(userId);
    const artist = await Artist.findById(artistId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    // Check if user is already linked to this artist
    const existingMember = artist.members.find(
      member => member.userId.toString() === userId
    );

    if (existingMember) {
      return res.status(400).json({
        message: 'User is already linked to this artist'
      });
    }

    // Add user to artist's members with validated role
    artist.members.push({
      userId: user._id,
      role,
      addedAt: new Date(),
      addedBy: req.user.username
    });

    await artist.save();

    res.json({
      message: 'User successfully linked to artist',
      artist: {
        _id: artist._id,
        name: artist.name,
        members: artist.members
      }
    });
  } catch (error) {
    console.error('Link error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Remove user from artist
router.delete('/unlink-user-artist', [auth, isAdmin], async (req, res) => {
  try {
    const { userId, artistId } = req.body;

    // Validate inputs
    if (!userId || !artistId) {
      return res.status(400).json({
        message: 'User ID and Artist ID are required'
      });
    }

    // Find artist
    const artist = await Artist.findById(artistId);

    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    // Remove user from members
    artist.members = artist.members.filter(
      member => member.userId.toString() !== userId
    );

    await artist.save();

    res.json({
      message: 'User successfully unlinked from artist',
      artist: {
        _id: artist._id,
        name: artist.name,
        members: artist.members
      }
    });
  } catch (error) {
    console.error('Unlink error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all users linked to an artist
router.get('/artist-members/:artistId', [auth, isAdmin], async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.artistId)
      .populate('members.userId', 'firstName lastName username email');

    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    res.json(artist.members);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;