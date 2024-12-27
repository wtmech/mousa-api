const express = require('express');
const router = express.Router();
const Track = require('../models/Track');
const Artist = require('../models/Artist');
const multer = require('multer');
const NodeID3 = require('node-id3');
const path = require('path');
const fs = require('fs');
const Album = require('../models/Album');

// Configure multer for distributor uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../public/music/tracks');
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'audio/mpeg') {
      return cb(new Error('Only MP3 files are allowed'));
    }
    cb(null, true);
  }
});

// Helper function to create safe filenames
const createSafeFilename = (text) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric chars with hyphens
    .replace(/-+/g, '-')        // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '');     // Remove leading/trailing hyphens
};

// Distributor upload endpoint
router.post('/upload', upload.single('track'), async (req, res) => {
  try {
    // Verify distributor key
    const apiKey = req.header('X-Distributor-Key');
    if (apiKey !== process.env.DISTRIBUTOR_KEY) {
      return res.status(401).json({ message: 'Invalid distributor key' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Read metadata from the uploaded file
    const tags = NodeID3.read(req.file.path);
    console.log('File metadata:', tags);

    // Get artist name from metadata or request body
    const artistName = req.body.artistName || tags.artist;
    if (!artistName) {
      return res.status(400).json({ message: 'Artist name is required in metadata or request body' });
    }

    // Find or create artist
    let artist = await Artist.findOne({ name: artistName });

    if (!artist) {
      // Create new artist from metadata
      artist = new Artist({
        name: artistName,
        genres: tags.genre ? [tags.genre] : [],
        verifiedBy: req.body.distributorName || 'official',
        verificationDate: new Date()
      });

      await artist.save();
      console.log('Created new artist:', artist.name);
    }

    // Find or create album if album info exists
    let album;
    if (tags.album) {
      album = await Album.findOne({
        title: tags.album,
        artist: artist._id
      });

      if (!album) {
        // Create safe filename for cover art
        const safeArtistName = createSafeFilename(artist.name);
        const safeAlbumName = createSafeFilename(tags.album);
        const coverFilename = `${safeArtistName}-${safeAlbumName}-cover.jpg`;

        album = new Album({
          title: tags.album,
          artist: artist._id,
          releaseDate: tags.year ? new Date(tags.year) : new Date(),
          coverArt: tags.image ? `/music/covers/${coverFilename}` : 'default-cover.jpg',
          genre: tags.genre,
          type: tags.trackTotal === 1 ? 'single' : 'album',
          distributor: {
            name: req.body.distributorName || 'official',
            uploadDate: new Date()
          }
        });
        await album.save();

        // Save cover art with new filename if it exists
        if (tags.image) {
          const coverPath = path.join(__dirname, '../../public/music/covers', coverFilename);
          fs.writeFileSync(coverPath, tags.image.imageBuffer);
        }
      }

      // Update album track count
      album.totalTracks = await Track.countDocuments({ album: album._id }) + 1;
      await album.save();
    }

    // Calculate duration
    const stats = fs.statSync(req.file.path);
    const fileSizeInBytes = stats.size;
    const durationInSeconds = Math.floor(fileSizeInBytes / (128 * 1024 / 8));

    // Create track with album reference
    const trackData = {
      title: req.body.title || tags.title || path.parse(req.file.originalname).name,
      artist: artist._id,
      album: album ? album._id : undefined,
      trackNumber: tags.trackNumber,
      discNumber: tags.partOfSet,
      distributor: {
        name: req.body.distributorName || 'official',
        uploadDate: new Date()
      },
      duration: durationInSeconds,
      genre: req.body.genre || tags.genre,
      fileUrl: `/music/tracks/${req.file.filename}`,
      coverArt: album ? album.coverArt : (tags.image ? `/music/covers/${createSafeFilename(artist.name)}-${createSafeFilename(trackData.title)}-cover.jpg` : 'default-cover.jpg'),
      isExclusive: false,
      allowDownload: true
    };

    // Save single track cover art if no album
    if (!album && tags.image) {
      const singleCoverFilename = `${createSafeFilename(artist.name)}-${createSafeFilename(trackData.title)}-cover.jpg`;
      const coverPath = path.join(__dirname, '../../public/music/covers', singleCoverFilename);
      fs.writeFileSync(coverPath, tags.image.imageBuffer);
    }

    const track = new Track(trackData);
    await track.save();

    // Update artist's genre list if new genre
    if (track.genre && !artist.genres.includes(track.genre)) {
      artist.genres.push(track.genre);
      await artist.save();
    }

    res.status(201).json({
      message: 'Track uploaded successfully',
      track: await Track.findById(track._id).populate('artist album'),
      artistCreated: !artist,
      albumCreated: album && album.totalTracks === 1
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all artists
router.get('/artists', async (req, res) => {
  try {
    const apiKey = req.header('X-Distributor-Key');
    if (apiKey !== process.env.DISTRIBUTOR_KEY) {
      return res.status(401).json({ message: 'Invalid distributor key' });
    }

    const artists = await Artist.find({})
      .select('name genres members verifiedBy')
      .lean();

    res.json(artists);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;