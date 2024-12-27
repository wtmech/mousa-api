const express = require('express');
const router = express.Router();
const { Artist } = require('../models/Artist');
const Track = require('../models/Track');

// Get all artists
router.get('/', async (req, res) => {
  try {
    const artists = await Artist.find({})
      .select('name bio genres socialLinks monthlyListeners totalPlays subscriberCount featured')
      .lean();

    // Get track count for each artist
    const artistsWithTracks = await Promise.all(artists.map(async (artist) => {
      const trackCount = await Track.countDocuments({ artist: artist._id });
      return {
        ...artist,
        trackCount
      };
    }));

    res.json(artistsWithTracks);
  } catch (error) {
    console.error('Artist fetch error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get specific artist
router.get('/:id', async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id)
      .populate('members.userId', 'firstName lastName username email')
      .lean();

    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    // Get tracks for this artist
    const tracks = await Track.find({ artist: artist._id })
      .select('title duration plays fileUrl coverArt')
      .lean();

    res.json({
      ...artist,
      tracks
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;