const express = require('express');
const router = express.Router();
const Track = require('../models/Track');
const Album = require('../models/Album');
const { Artist } = require('../models/Artist');
const Playlist = require('../models/Playlist');

// Basic search route
router.get('/basic', async (req, res) => {
  try {
    const { query, type } = req.query;

    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    console.log('Search query:', query, 'Type:', type);

    const searchRegex = new RegExp(query, 'i');
    const results = {};

    // If type is specified, only search that type
    // Otherwise, search everything
    if (!type || type === 'tracks') {
      results.tracks = await Track.find({ title: searchRegex })
        .populate('artist', 'name')
        .populate('album', 'title coverArt')
        .limit(20)
        .lean();
    }

    if (!type || type === 'albums') {
      results.albums = await Album.find({ title: searchRegex })
        .populate('artist', 'name')
        .limit(20)
        .lean();
    }

    if (!type || type === 'artists') {
      results.artists = await Artist.find({
        $or: [
          { name: searchRegex },
          { genres: searchRegex }
        ]
      })
        .select('name bio genres monthlyListeners')
        .limit(20)
        .lean();
    }

    if (!type || type === 'playlists') {
      results.playlists = await Playlist.find({
        name: searchRegex,
        isPrivate: false  // Only search public playlists
      })
        .populate('owner', 'username')
        .limit(20)
        .lean();
    }

    // Add result counts
    const counts = {
      tracks: results.tracks?.length || 0,
      albums: results.albums?.length || 0,
      artists: results.artists?.length || 0,
      playlists: results.playlists?.length || 0,
      total: 0
    };
    counts.total = counts.tracks + counts.albums + counts.artists + counts.playlists;

    res.json({
      query,
      counts,
      results
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Advanced search with filters
router.get('/advanced', async (req, res) => {
  try {
    const {
      query,
      type,
      genre,
      sortBy = 'relevance',
      limit = 20,
      page = 1
    } = req.query;

    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchRegex = new RegExp(query, 'i');
    const skip = (page - 1) * limit;
    let results = {};

    switch (type) {
      case 'tracks':
        const trackQuery = { title: searchRegex };
        if (genre) trackQuery.genre = new RegExp(genre, 'i');

        results = await Track.find(trackQuery)
          .populate('artist', 'name')
          .populate('album', 'title coverArt')
          .sort(getSortOptions(sortBy))
          .skip(skip)
          .limit(parseInt(limit))
          .lean();
        break;

      case 'albums':
        const albumQuery = { title: searchRegex };
        if (genre) albumQuery.genre = new RegExp(genre, 'i');

        results = await Album.find(albumQuery)
          .populate('artist', 'name')
          .sort(getSortOptions(sortBy))
          .skip(skip)
          .limit(parseInt(limit))
          .lean();
        break;

      case 'artists':
        results = await Artist.find({
          $or: [
            { name: searchRegex },
            { genres: genre ? new RegExp(genre, 'i') : searchRegex }
          ]
        })
          .select('name bio genres monthlyListeners')
          .sort(getSortOptions(sortBy))
          .skip(skip)
          .limit(parseInt(limit))
          .lean();
        break;

      default:
        return res.status(400).json({ message: 'Invalid search type' });
    }

    res.json({
      query,
      type,
      genre,
      sortBy,
      page: parseInt(page),
      limit: parseInt(limit),
      total: results.length,
      results
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper function for sorting
function getSortOptions(sortBy) {
  switch (sortBy) {
    case 'plays':
      return { plays: -1 };
    case 'name':
      return { title: 1 };
    case 'date':
      return { createdAt: -1 };
    default:
      return {}; // relevance - default MongoDB text search scoring
  }
}

module.exports = router;