const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Track = require('../models/Track');
const Artist = require('../models/Artist');
const Album = require('../models/Album');
const Playlist = require('../models/Playlist');
const User = require('../models/User');
const { searchTracks } = require('../utils/lastfm');

// Global search across all entities
router.get('/', auth, async (req, res) => {
  try {
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 5;

    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Create text search condition
    const searchCondition = { $text: { $search: query } };

    // If not using text index, use regex search
    const regexSearch = { $regex: query, $options: 'i' };
    const regexCondition = {
      $or: [
        { name: regexSearch },
        { title: regexSearch }
      ]
    };

    // Use $text if available, otherwise fallback to regex
    const finalCondition = await Track.collection.indexExists('title_text')
      ? searchCondition
      : regexCondition;

    // Search tracks
    const tracks = await Track.find({
      $or: [
        { title: regexSearch },
        { genre: regexSearch }
      ]
    })
      .populate('artist', 'name')
      .populate('album', 'title coverArt')
      .limit(limit);

    // Search artists
    const artists = await Artist.find({ name: regexSearch }).limit(limit);

    // Search albums
    const albums = await Album.find({
      $or: [
        { title: regexSearch },
        { genre: regexSearch }
      ]
    })
      .populate('artist', 'name')
      .limit(limit);

    // Search playlists (only public ones)
    const playlists = await Playlist.find({
      name: regexSearch,
      isPublic: true
    })
      .populate('owner', 'username')
      .limit(limit);

    // Search users
    const users = await User.find({
      $or: [
        { username: regexSearch },
        { firstName: regexSearch },
        { lastName: regexSearch }
      ]
    })
      .select('username firstName lastName')
      .limit(limit);

    // Get total counts for each type
    const trackCount = await Track.countDocuments({
      $or: [
        { title: regexSearch },
        { genre: regexSearch }
      ]
    });

    const artistCount = await Artist.countDocuments({ name: regexSearch });

    const albumCount = await Album.countDocuments({
      $or: [
        { title: regexSearch },
        { genre: regexSearch }
      ]
    });

    const playlistCount = await Playlist.countDocuments({
      name: regexSearch,
      isPublic: true
    });

    const userCount = await User.countDocuments({
      $or: [
        { username: regexSearch },
        { firstName: regexSearch },
        { lastName: regexSearch }
      ]
    });

    res.json({
      tracks: {
        items: tracks,
        total: trackCount
      },
      artists: {
        items: artists,
        total: artistCount
      },
      albums: {
        items: albums,
        total: albumCount
      },
      playlists: {
        items: playlists,
        total: playlistCount
      },
      users: {
        items: users,
        total: userCount
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search tracks
router.get('/tracks', auth, async (req, res) => {
  try {
    const { q, genre, artist, limit, page } = req.query;

    const searchLimit = parseInt(limit) || 20;
    const searchPage = parseInt(page) || 1;
    const skip = (searchPage - 1) * searchLimit;

    if (!q && !genre && !artist) {
      return res.status(400).json({ message: 'At least one search parameter is required' });
    }

    // Build search query
    const searchQuery = {};

    if (q) {
      searchQuery.title = { $regex: q, $options: 'i' };
    }

    if (genre) {
      searchQuery.genre = { $regex: genre, $options: 'i' };
    }

    if (artist) {
      // Find artist by name first
      const artistDoc = await Artist.findOne({ name: { $regex: artist, $options: 'i' } });
      if (artistDoc) {
        searchQuery.artist = artistDoc._id;
      } else {
        // If no artist found, search will return no results
        searchQuery.artist = null;
      }
    }

    // Execute search
    const tracks = await Track.find(searchQuery)
      .populate('artist', 'name')
      .populate('album', 'title coverArt')
      .sort({ plays: -1 })
      .skip(skip)
      .limit(searchLimit);

    const total = await Track.countDocuments(searchQuery);

    // If local search returned few results, try Last.fm
    if (tracks.length < 5 && q) {
      try {
        const lastfmTracks = await searchTracks(q);

        // Return both local and Last.fm results
        res.json({
          localTracks: {
            items: tracks,
            total,
            currentPage: searchPage,
            totalPages: Math.ceil(total / searchLimit)
          },
          externalTracks: lastfmTracks
        });
        return;
      } catch (error) {
        console.log('Last.fm search error:', error.message);
        // Continue without Last.fm data
      }
    }

    // Return only local results
    res.json({
      tracks: tracks,
      total,
      currentPage: searchPage,
      totalPages: Math.ceil(total / searchLimit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search artists
router.get('/artists', auth, async (req, res) => {
  try {
    const { q, genre, limit, page } = req.query;

    const searchLimit = parseInt(limit) || 20;
    const searchPage = parseInt(page) || 1;
    const skip = (searchPage - 1) * searchLimit;

    if (!q && !genre) {
      return res.status(400).json({ message: 'At least one search parameter is required' });
    }

    // Build search query
    const searchQuery = {};

    if (q) {
      searchQuery.name = { $regex: q, $options: 'i' };
    }

    if (genre) {
      searchQuery.genres = { $regex: genre, $options: 'i' };
    }

    // Execute search
    const artists = await Artist.find(searchQuery)
      .sort({ followerCount: -1 })
      .skip(skip)
      .limit(searchLimit);

    const total = await Artist.countDocuments(searchQuery);

    res.json({
      artists,
      total,
      currentPage: searchPage,
      totalPages: Math.ceil(total / searchLimit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search albums
router.get('/albums', auth, async (req, res) => {
  try {
    const { q, genre, artist, limit, page } = req.query;

    const searchLimit = parseInt(limit) || 20;
    const searchPage = parseInt(page) || 1;
    const skip = (searchPage - 1) * searchLimit;

    if (!q && !genre && !artist) {
      return res.status(400).json({ message: 'At least one search parameter is required' });
    }

    // Build search query
    const searchQuery = {};

    if (q) {
      searchQuery.title = { $regex: q, $options: 'i' };
    }

    if (genre) {
      searchQuery.genre = { $regex: genre, $options: 'i' };
    }

    if (artist) {
      // Find artist by name first
      const artistDoc = await Artist.findOne({ name: { $regex: artist, $options: 'i' } });
      if (artistDoc) {
        searchQuery.artist = artistDoc._id;
      } else {
        // If no artist found, search will return no results
        searchQuery.artist = null;
      }
    }

    // Execute search
    const albums = await Album.find(searchQuery)
      .populate('artist', 'name')
      .sort({ releaseDate: -1 })
      .skip(skip)
      .limit(searchLimit);

    const total = await Album.countDocuments(searchQuery);

    res.json({
      albums,
      total,
      currentPage: searchPage,
      totalPages: Math.ceil(total / searchLimit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search playlists
router.get('/playlists', auth, async (req, res) => {
  try {
    const { q, limit, page } = req.query;

    const searchLimit = parseInt(limit) || 20;
    const searchPage = parseInt(page) || 1;
    const skip = (searchPage - 1) * searchLimit;

    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Build search query for public playlists
    const searchQuery = {
      name: { $regex: q, $options: 'i' },
      isPublic: true
    };

    // Execute search
    const playlists = await Playlist.find(searchQuery)
      .populate('owner', 'username')
      .sort({ 'stats.followerCount': -1 })
      .skip(skip)
      .limit(searchLimit);

    const total = await Playlist.countDocuments(searchQuery);

    res.json({
      playlists,
      total,
      currentPage: searchPage,
      totalPages: Math.ceil(total / searchLimit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;