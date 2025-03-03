const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');
const Artist = require('../models/Artist');
const User = require('../models/User');
const Track = require('../models/Track');
const Album = require('../models/Album');
const { uploadCover } = require('../utils/fileUpload');
const { getArtistInfo } = require('../utils/lastfm');

// Get all artists (paginated)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const artists = await Artist.find()
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Artist.countDocuments();

    res.json({
      artists,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalArtists: total
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get featured artists
router.get('/featured', async (req, res) => {
  try {
    const artists = await Artist.find({ featured: true })
      .sort({ monthlyListeners: -1 })
      .limit(10);

    res.json(artists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get artist by ID
router.get('/:id', async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);

    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    // Get artist tracks
    const tracks = await Track.find({ artist: artist._id })
      .populate('album', 'title coverArt')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get artist albums
    const albums = await Album.find({ artist: artist._id })
      .sort({ releaseDate: -1 });

    res.json({
      artist,
      tracks,
      albums
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all tracks for an artist
router.get('/:id/tracks', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const tracks = await Track.find({ artist: req.params.id })
      .populate('album', 'title coverArt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Track.countDocuments({ artist: req.params.id });

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

// Get all albums for an artist
router.get('/:id/albums', async (req, res) => {
  try {
    const albums = await Album.find({ artist: req.params.id })
      .sort({ releaseDate: -1 });

    res.json(albums);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get artist's exclusive content
router.get('/:id/exclusive', auth, async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);

    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    if (!artist.exclusiveContent || artist.exclusiveContent.length === 0) {
      return res.json({ exclusiveContent: [] });
    }

    // Filter for public content or check if user is a member/has access
    const accessibleContent = artist.exclusiveContent.filter(
      content => content.isPublic || false // Add member check logic here
    );

    res.json({ exclusiveContent: accessibleContent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Create a new artist
router.post('/', auth, isAdmin, uploadCover, async (req, res) => {
  try {
    const {
      name,
      bio,
      genres,
      socialLinks,
    } = req.body;

    // Parse JSON strings if needed
    const parsedGenres = typeof genres === 'string' ? JSON.parse(genres) : genres;
    const parsedSocialLinks = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks;

    // Check if artist already exists
    const existingArtist = await Artist.findOne({ name });
    if (existingArtist) {
      return res.status(400).json({ message: 'Artist already exists' });
    }

    const newArtist = new Artist({
      name,
      bio,
      genres: parsedGenres,
      socialLinks: parsedSocialLinks,
      verifiedBy: req.user.id,
      verificationDate: Date.now()
    });

    // Add cover image if uploaded
    if (req.file) {
      newArtist.coverArt = `/uploads/covers/${req.file.filename}`;
    }

    // Try to fetch additional info from Last.fm
    try {
      const artistInfo = await getArtistInfo(name);
      if (artistInfo) {
        if (!newArtist.bio && artistInfo.bio) {
          newArtist.bio = artistInfo.bio;
        }
        if (!newArtist.genres || newArtist.genres.length === 0) {
          newArtist.genres = artistInfo.tags.slice(0, 5);
        }
      }
    } catch (error) {
      console.log('Could not fetch Last.fm data:', error.message);
      // Continue without Last.fm data
    }

    await newArtist.save();
    res.status(201).json(newArtist);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Update artist
router.patch('/:id', auth, isAdmin, uploadCover, async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);

    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const {
      name,
      bio,
      genres,
      socialLinks,
      featured
    } = req.body;

    // Update fields if provided
    if (name) artist.name = name;
    if (bio) artist.bio = bio;

    if (genres) {
      const parsedGenres = typeof genres === 'string' ? JSON.parse(genres) : genres;
      artist.genres = parsedGenres;
    }

    if (socialLinks) {
      const parsedSocialLinks = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks;
      artist.socialLinks = parsedSocialLinks;
    }

    if (featured !== undefined) {
      artist.featured = featured;
    }

    // Add cover image if uploaded
    if (req.file) {
      artist.coverArt = `/uploads/covers/${req.file.filename}`;
    }

    await artist.save();
    res.json(artist);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;