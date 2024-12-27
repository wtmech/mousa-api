const express = require('express');
const router = express.Router();
const Album = require('../models/Album');
const Track = require('../models/Track');

// Get all albums
router.get('/', async (req, res) => {
  try {
    const albums = await Album.find({})
      .populate('artist', 'name')  // Include artist name
      .select('title artist coverArt releaseDate type totalTracks genre')
      .sort('-releaseDate')
      .lean();

    // Get track details for each album
    const albumsWithTracks = await Promise.all(albums.map(async (album) => {
      const tracks = await Track.find({ album: album._id })
        .select('title duration trackNumber discNumber plays')
        .sort('discNumber trackNumber')
        .lean();

      return {
        ...album,
        tracks
      };
    }));

    res.json(albumsWithTracks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get specific album
router.get('/:id', async (req, res) => {
  try {
    const album = await Album.findById(req.params.id)
      .populate('artist', 'name bio genres socialLinks')  // Include more artist details
      .lean();

    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    // Get tracks for this album
    const tracks = await Track.find({ album: album._id })
      .select('title duration trackNumber discNumber plays fileUrl')
      .sort('discNumber trackNumber')
      .lean();

    res.json({
      ...album,
      tracks
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;