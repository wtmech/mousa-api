const express = require('express');
const router = express.Router();
const { auth, isDistributor } = require('../middleware/auth');
const Track = require('../models/Track');
const Artist = require('../models/Artist');
const User = require('../models/User');
const { uploadTrackWithCover } = require('../utils/fileUpload');
const NodeID3 = require('node-id3');
const path = require('path');

// Get all tracks (paginated)
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const tracks = await Track.find()
      .populate('artist', 'name')
      .populate('album', 'title coverArt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Track.countDocuments();

    res.json({
      tracks,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalTracks: total
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single track by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const track = await Track.findById(req.query.id)
      .populate('artist', 'name')
      .populate('album', 'title coverArt type releaseDate');

    if (!track) {
      return res.status(404).json({ message: 'Track not found' });
    }

    res.json(track);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Play track and increment play count
router.post('/:id/play', auth, async (req, res) => {
  try {
    const track = await Track.findById(req.params.id);
    if (!track) {
      return res.status(404).json({ message: 'Track not found' });
    }

    // Increment play count
    track.plays += 1;
    await track.save();

    // Update artist's total plays
    await Artist.findByIdAndUpdate(track.artist, {
      $inc: { totalPlays: 1 }
    });

    // Add to user's recently played
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        recentlyPlayed: {
          $each: [{ track: track._id }],
          $position: 0,
          $slice: 50 // Keep only last 50 tracks
        }
      }
    });

    res.json({ message: 'Play recorded successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get track audio file
router.get('/:id/stream', auth, async (req, res) => {
  try {
    const track = await Track.findById(req.params.id);
    if (!track) {
      return res.status(404).json({ message: 'Track not found' });
    }

    // Check if track is exclusive and user has access
    if (track.isExclusive) {
      // Add your exclusive content access check logic here
      // For now, we'll just allow it
    }

    const filePath = path.join(__dirname, '../../uploads/tracks', track.fileUrl);
    res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;