const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Artist = require('../models/Artist');
const Track = require('../models/Track');
const Album = require('../models/Album');
const { uploadToS3, uploadImageToS3 } = require('../utils/fileUpload');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Middleware to check if user has artist rights
const artistAuth = async (req, res, next) => {
  try {
    // Find the user with populated artist data
    const user = await User.findById(req.user.id).populate('artist');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has an artist profile
    if (!user.artist) {
      return res.status(403).json({ message: 'Artist profile required' });
    }

    // Add the artist data to the request for use in route handlers
    req.artist = user.artist;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get artist exclusive content dashboard
router.get('/dashboard', [auth, artistAuth], async (req, res) => {
  try {
    const artistId = req.artist._id;

    // Get exclusive content stats
    const exclusiveTracks = await Track.find({
      artist: artistId,
      isExclusive: true
    });

    // Count total exclusive plays
    const totalExclusivePlays = exclusiveTracks.reduce((sum, track) => sum + track.plays, 0);

    // Count total supporter-only content
    const exclusiveTrackCount = exclusiveTracks.length;

    // Get recent supporters (this would ideally connect to a subscription/support system)
    // For now, just providing a mock response structure

    res.json({
      exclusiveContent: {
        totalTracks: exclusiveTrackCount,
        totalPlays: totalExclusivePlays,
      },
      supporterStats: {
        totalSupporters: req.artist.supporterCount || 0,
        recentSupporters: []
      },
      recentActivity: {
        lastUpload: exclusiveTracks.length > 0 ?
          exclusiveTracks.sort((a, b) => b.createdAt - a.createdAt)[0].createdAt :
          null
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload a new exclusive track
router.post('/tracks', [
  auth,
  artistAuth,
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'coverArt', maxCount: 1 }
  ])
], async (req, res) => {
  try {
    const {
      title,
      genre,
      isExclusive,
      minimumTier,
      description,
      releaseDate,
      trackNumber,
      lyrics
    } = req.body;

    // Validate required fields
    if (!title || !req.files.audio) {
      return res.status(400).json({ message: 'Title and audio file are required' });
    }

    // Upload audio file to S3
    const audioFile = req.files.audio[0];
    const audioUrl = await uploadToS3(audioFile, 'exclusive-tracks');

    // Upload cover art if provided
    let coverArtUrl = null;
    if (req.files.coverArt) {
      coverArtUrl = await uploadImageToS3(req.files.coverArt[0], 'track-covers');
    }

    // Create new track
    const newTrack = new Track({
      title,
      artist: req.artist._id,
      audioUrl,
      genre: genre || 'Unknown',
      coverArt: coverArtUrl,
      isExclusive: true, // Always true for exclusive content
      minimumSupportTier: minimumTier || 1,
      description: description || '',
      releaseDate: releaseDate || Date.now(),
      trackNumber: trackNumber || 1,
      lyrics: lyrics || '',
      plays: 0
    });

    await newTrack.save();

    // Update artist's track count
    await Artist.findByIdAndUpdate(
      req.artist._id,
      { $inc: { exclusiveTrackCount: 1 } }
    );

    res.status(201).json(newTrack);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all exclusive tracks for the authenticated artist
router.get('/tracks', [auth, artistAuth], async (req, res) => {
  try {
    const { page, limit } = req.query;

    const queryLimit = parseInt(limit) || 20;
    const queryPage = parseInt(page) || 1;
    const skip = (queryPage - 1) * queryLimit;

    // Find all exclusive tracks for this artist
    const tracks = await Track.find({
      artist: req.artist._id,
      isExclusive: true
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(queryLimit);

    const total = await Track.countDocuments({
      artist: req.artist._id,
      isExclusive: true
    });

    res.json({
      tracks,
      total,
      currentPage: queryPage,
      totalPages: Math.ceil(total / queryLimit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload exclusive content (non-audio, like images, PDFs, etc.)
router.post('/media', [
  auth,
  artistAuth,
  upload.single('media')
], async (req, res) => {
  try {
    const { title, description, contentType, minimumTier } = req.body;

    if (!title || !req.file) {
      return res.status(400).json({ message: 'Title and media file are required' });
    }

    // Upload media file to S3
    // This is a simplified example - in a real application, you'd have more robust handling
    // for different content types, validation, etc.
    const mediaUrl = await uploadToS3(req.file, 'exclusive-media');

    // Create a record of the exclusive content
    // In a real application, you'd have a separate model for non-audio content
    // This is simplified to demonstrate the concept
    const exclusiveContent = {
      title,
      description: description || '',
      artistId: req.artist._id,
      mediaUrl,
      contentType: contentType || 'other',
      minimumSupportTier: minimumTier || 1,
      createdAt: new Date(),
      isExclusive: true
    };

    // Normally you'd save this to a database
    // For this example, we're just returning the object

    res.status(201).json({
      message: 'Exclusive content uploaded successfully',
      content: exclusiveContent
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update an exclusive track
router.patch('/tracks/:id', [
  auth,
  artistAuth,
  upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'coverArt', maxCount: 1 }
  ])
], async (req, res) => {
  try {
    const trackId = req.params.id;
    const {
      title,
      genre,
      minimumTier,
      description,
      releaseDate,
      trackNumber,
      lyrics
    } = req.body;

    // Find track and verify ownership
    const track = await Track.findOne({
      _id: trackId,
      artist: req.artist._id,
      isExclusive: true
    });

    if (!track) {
      return res.status(404).json({ message: 'Exclusive track not found or not owned by you' });
    }

    // Update fields if provided
    if (title) track.title = title;
    if (genre) track.genre = genre;
    if (minimumTier) track.minimumSupportTier = minimumTier;
    if (description) track.description = description;
    if (releaseDate) track.releaseDate = releaseDate;
    if (trackNumber) track.trackNumber = trackNumber;
    if (lyrics) track.lyrics = lyrics;

    // Upload new audio file if provided
    if (req.files.audio) {
      track.audioUrl = await uploadToS3(req.files.audio[0], 'exclusive-tracks');
    }

    // Upload new cover art if provided
    if (req.files.coverArt) {
      track.coverArt = await uploadImageToS3(req.files.coverArt[0], 'track-covers');
    }

    await track.save();

    res.json(track);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Track not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete an exclusive track
router.delete('/tracks/:id', [auth, artistAuth], async (req, res) => {
  try {
    const trackId = req.params.id;

    // Find track and verify ownership
    const track = await Track.findOne({
      _id: trackId,
      artist: req.artist._id,
      isExclusive: true
    });

    if (!track) {
      return res.status(404).json({ message: 'Exclusive track not found or not owned by you' });
    }

    await track.remove();

    // Update artist's exclusive track count
    await Artist.findByIdAndUpdate(
      req.artist._id,
      { $inc: { exclusiveTrackCount: -1 } }
    );

    res.json({ message: 'Exclusive track deleted successfully' });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Track not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Apply to become a verified artist
router.post('/apply', auth, async (req, res) => {
  try {
    const { artistName, genre, bio } = req.body;

    if (!artistName) {
      return res.status(400).json({ message: 'Artist name is required' });
    }

    // Check if user already has an artist profile
    const user = await User.findById(req.user.id);

    if (user.artist) {
      // Update existing artist profile with verification application
      await Artist.findByIdAndUpdate(user.artist, {
        $set: {
          verificationStatus: 'pending',
          name: artistName,
          genres: genre ? genre.split(',').map(g => g.trim()) : [],
          bio: bio || ''
        }
      });

      return res.json({ message: 'Artist verification application submitted successfully' });
    }

    // Create new artist profile with pending verification status
    const newArtist = new Artist({
      name: artistName,
      user: req.user.id,
      genres: genre ? genre.split(',').map(g => g.trim()) : [],
      bio: bio || '',
      isVerified: false,
      trackCount: 0,
      exclusiveTrackCount: 0,
      followerCount: 0,
      supporterCount: 0,
      verificationStatus: 'pending'
    });

    await newArtist.save();

    // Update user with artist reference
    user.artist = newArtist._id;
    await user.save();

    res.status(201).json({
      message: 'Artist profile created and verification application submitted successfully',
      artist: newArtist
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;