const express = require('express');
const router = express.Router();
const Track = require('../models/Track');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const NodeID3 = require('node-id3');

// Configure multer for MP3 uploads
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
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Artist upload track endpoint
router.post('/upload', auth, upload.single('track'), async (req, res) => {
  try {
    if (!req.user.isArtist) {
      return res.status(403).json({ message: 'Only artists can upload tracks' });
    }

    const trackData = {
      title: req.body.title,
      artistName: req.user.artistName || req.user.username,
      uploadedBy: req.user._id,
      album: req.body.album,
      genre: req.body.genre,
      fileUrl: `/music/tracks/${req.file.filename}`,
      distributor: 'artist',
      isExclusive: req.body.isExclusive === 'false' ? false : true,
      allowDownload: req.body.allowDownload === 'true'
    };

    const track = new Track(trackData);
    await track.save();

    res.status(201).json(track);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete track endpoint (artist only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const track = await Track.findById(req.params.id);

    if (!track) {
      return res.status(404).json({ message: 'Track not found' });
    }

    if (!track.canBeDeletedBy(req.user._id)) {
      return res.status(403).json({
        message: 'You can only delete your own uploaded tracks'
      });
    }

    // Delete the file
    const filePath = path.join(__dirname, '../../public', track.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await track.deleteOne();
    res.json({ message: 'Track deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all tracks
router.get('/', async (req, res) => {
  try {
    const tracks = await Track.find()
      .populate('uploadedBy', 'username')
      .select({
        title: 1,
        artistName: 1,
        album: 1,
        duration: 1,
        fileUrl: 1,
        coverArt: 1,
        genre: 1,
        uploadedBy: 1,
        createdAt: 1
      });
    res.json(tracks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single track by ID
router.get('/:id', async (req, res) => {
  try {
    console.log('Fetching track with ID:', req.params.id);
    const track = await Track.findById(req.params.id)
      .populate('uploadedBy', 'username')
      .select({
        title: 1,
        artistName: 1,
        album: 1,
        duration: 1,
        fileUrl: 1,
        coverArt: 1,
        genre: 1,
        uploadedBy: 1,
        createdAt: 1
      });

    if (!track) {
      console.log('Track not found');
      return res.status(404).json({ message: 'Track not found' });
    }

    console.log('Track found:', track);
    res.json(track);
  } catch (error) {
    console.error('Error fetching track:', error);
    res.status(500).json({ message: error.message });
  }
});

// Stream track
router.get('/stream/:id', auth, async (req, res) => {
  try {
    const track = await Track.findById(req.params.id);
    if (!track) {
      return res.status(404).json({ message: 'Track not found' });
    }

    // Check access
    const hasAccess = await track.canBeAccessedBy(req.user._id);
    if (!hasAccess) {
      return res.status(403).json({
        message: 'Subscribe to this artist to access this track'
      });
    }

    const filePath = path.join(__dirname, '../../public', track.fileUrl.replace(/^\//, ''));
    console.log('Attempting to stream file:', filePath);

    if (!fs.existsSync(filePath)) {
      console.log('File not found at path:', filePath);
      return res.status(404).json({ message: 'Audio file not found' });
    }

    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, {start, end});
      const head = {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': stat.size,
        'Content-Type': 'audio/mpeg',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('Streaming error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add this new route for deleting all tracks
router.delete('/all', async (req, res) => {
  try {
    const result = await Track.deleteMany({});
    console.log(`Deleted ${result.deletedCount} tracks`);
    res.json({
      message: `Successfully deleted ${result.deletedCount} tracks`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting tracks:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;