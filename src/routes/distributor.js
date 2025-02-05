const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const NodeID3 = require('node-id3');
const { Artist } = require('../models/Artist');
const Album = require('../models/Album');
const Track = require('../models/Track');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../public/music/tracks'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'));
    }
  }
});

router.post('/upload', upload.single('track'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file uploaded' });
    }

    const { distributorName } = req.body;

    // Read metadata from the uploaded file
    const tags = NodeID3.read(req.file.path);
    console.log('File metadata:', tags);

    if (!tags) {
      return res.status(400).json({ message: 'No metadata found in file' });
    }

    const title = tags.title;
    const artistName = tags.artist;
    const albumTitle = tags.album;
    const genre = tags.genre;
    const trackNumber = tags.trackNumber;
    const year = tags.year;

    if (!title || !artistName) {
      return res.status(400).json({
        message: 'File must contain at least title and artist metadata'
      });
    }

    // Find or create artist
    let artist = await Artist.findOne({ name: artistName });

    if (!artist) {
      artist = new Artist({
        name: artistName,
        genres: genre ? [genre] : [],
        socialLinks: {},
        monthlyListeners: 0,
        totalPlays: 0
      });
      await artist.save();
    }

    // Find or create album
    let album = await Album.findOne({
      title: albumTitle,
      artist: artist._id
    });

    if (!album) {
      album = new Album({
        title: albumTitle || 'Single',
        artist: artist._id,
        releaseDate: year ? new Date(year) : new Date(),
        genre: genre,
        type: albumTitle ? 'album' : 'single',
        distributor: {
          name: distributorName || 'User Upload',
          uploadDate: new Date()
        }
      });
      await album.save();
    }

    // Create track
    const track = new Track({
      title,
      artist: artist._id,
      album: album._id,
      trackNumber: trackNumber ? parseInt(trackNumber.split('/')[0]) : 1,
      genre,
      fileUrl: `/music/tracks/${req.file.filename}`,
      distributor: {
        name: distributorName || 'User Upload',
        uploadDate: new Date()
      }
    });

    await track.save();

    // Get full track info with populated fields
    const populatedTrack = await Track.findById(track._id)
      .populate('artist', 'name')
      .populate('album', 'title');

    res.status(201).json({
      message: 'Track uploaded successfully',
      metadata: tags,
      track: populatedTrack
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;