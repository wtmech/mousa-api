const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');
const Album = require('../models/Album');
const Artist = require('../models/Artist');
const Track = require('../models/Track');
const { uploadImageToS3 } = require('../utils/fileUpload');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Get all albums with optional filters (genre, year)
router.get('/', auth, async (req, res) => {
  try {
    const { genre, year, sort, page, limit } = req.query;

    const queryLimit = parseInt(limit) || 20;
    const queryPage = parseInt(page) || 1;
    const skip = (queryPage - 1) * queryLimit;

    // Build filter query
    const query = {};

    if (genre) {
      query.genre = { $regex: genre, $options: 'i' };
    }

    if (year) {
      // If year is provided, match albums from that year
      const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
      const endDate = new Date(`${year}-12-31T23:59:59.999Z`);
      query.releaseDate = { $gte: startDate, $lte: endDate };
    }

    // Determine sort order
    let sortOption = { releaseDate: -1 }; // Default sort by newest

    if (sort === 'popular') {
      sortOption = { popularity: -1 };
    } else if (sort === 'alphabetical') {
      sortOption = { title: 1 };
    }

    // Execute query with pagination
    const albums = await Album.find(query)
      .populate('artist', 'name')
      .sort(sortOption)
      .skip(skip)
      .limit(queryLimit);

    const total = await Album.countDocuments(query);

    res.json({
      albums,
      total,
      currentPage: queryPage,
      totalPages: Math.ceil(total / queryLimit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get featured albums
router.get('/featured', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Get albums with highest popularity score
    const featuredAlbums = await Album.find()
      .populate('artist', 'name')
      .sort({ popularity: -1 })
      .limit(limit);

    res.json(featuredAlbums);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get new releases (albums released in the last 30 days)
router.get('/new-releases', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find albums released in the last 30 days
    const newReleases = await Album.find({
      releaseDate: { $gte: thirtyDaysAgo }
    })
      .populate('artist', 'name')
      .sort({ releaseDate: -1 })
      .limit(limit);

    res.json(newReleases);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific album by ID with tracks
router.get('/:id', auth, async (req, res) => {
  try {
    const albumId = req.params.id;

    // Find album and populate artist details
    const album = await Album.findById(albumId)
      .populate('artist', 'name profileImage');

    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    // Find all tracks for this album
    const tracks = await Track.find({ album: albumId })
      .populate('artist', 'name')
      .sort({ trackNumber: 1 });

    // Add tracks to the response
    const albumResponse = album.toObject();
    albumResponse.tracks = tracks;

    res.json(albumResponse);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Album not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new album (admin only)
router.post('/', [auth, isAdmin, upload.single('coverArt')], async (req, res) => {
  try {
    const { title, artist: artistId, releaseDate, genre, description } = req.body;

    if (!title || !artistId) {
      return res.status(400).json({ message: 'Title and artist are required' });
    }

    // Verify artist exists
    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    // Upload cover art if provided
    let coverArtUrl = null;
    if (req.file) {
      coverArtUrl = await uploadImageToS3(req.file, 'album-covers');
    }

    // Create new album
    const newAlbum = new Album({
      title,
      artist: artistId,
      releaseDate: releaseDate || Date.now(),
      genre: genre || 'Unknown',
      description: description || '',
      coverArt: coverArtUrl,
      popularity: 0
    });

    await newAlbum.save();

    res.status(201).json(newAlbum);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update an album (admin only)
router.patch('/:id', [auth, isAdmin, upload.single('coverArt')], async (req, res) => {
  try {
    const albumId = req.params.id;
    const { title, artist, releaseDate, genre, description } = req.body;

    // Find album
    const album = await Album.findById(albumId);
    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    // Update fields if provided
    if (title) album.title = title;
    if (artist) {
      // Verify artist exists
      const artistExists = await Artist.findById(artist);
      if (!artistExists) {
        return res.status(404).json({ message: 'Artist not found' });
      }
      album.artist = artist;
    }
    if (releaseDate) album.releaseDate = releaseDate;
    if (genre) album.genre = genre;
    if (description) album.description = description;

    // Upload new cover art if provided
    if (req.file) {
      album.coverArt = await uploadImageToS3(req.file, 'album-covers');
    }

    await album.save();

    res.json(album);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Album not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete an album (admin only)
router.delete('/:id', [auth, isAdmin], async (req, res) => {
  try {
    const albumId = req.params.id;

    // Find and delete album
    const album = await Album.findById(albumId);
    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    // Remove album reference from tracks
    await Track.updateMany(
      { album: albumId },
      { $unset: { album: 1 } }
    );

    await album.remove();

    res.json({ message: 'Album deleted successfully' });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Album not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all tracks for a specific album
router.get('/:id/tracks', auth, async (req, res) => {
  try {
    const albumId = req.params.id;

    // Verify album exists
    const album = await Album.findById(albumId);
    if (!album) {
      return res.status(404).json({ message: 'Album not found' });
    }

    // Find all tracks for this album
    const tracks = await Track.find({ album: albumId })
      .populate('artist', 'name')
      .sort({ trackNumber: 1 });

    res.json(tracks);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Album not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;