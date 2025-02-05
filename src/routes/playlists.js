const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Playlist = require('../models/Playlist');
const Track = require('../models/Track');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/images/playlists'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `playlist-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// Helper function to save base64 image
const saveBase64Image = async (base64Data, playlistId) => {
  // Remove header from base64 string if present
  const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Image, 'base64');

  // Create filename
  const filename = `playlist-${playlistId}-preview.png`;
  const filepath = path.join(__dirname, '../../public/images/playlists', filename);

  // Process and save image
  await sharp(buffer)
    .resize(300, 300, {
      fit: 'fill',
      withoutEnlargement: true
    })
    .png({ quality: 80 })
    .toFile(filepath);

  return `/images/playlists/${filename}`;
};

// Get all playlists for user
router.get('/', auth, async (req, res) => {
  try {
    const playlists = await Playlist.find({ owner: req.user._id })
      .select('name description color icon useIcon useOnlyColor previewImage tracks isSystem')
      .populate('tracks', 'title artist album duration plays')
      .populate({
        path: 'tracks',
        populate: [
          { path: 'artist', select: 'name' },
          { path: 'album', select: 'title coverArt' }
        ]
      })
      .lean();

    res.json(playlists);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new playlist
router.post('/', auth, async (req, res) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({ message: 'Playlist name is required' });
    }

    const playlist = new Playlist({
      name: req.body.name,
      description: req.body.description || '',
      owner: req.user._id,
      color: req.body.color || null,
      icon: req.body.icon || null,
      useIcon: req.body.useIcon === true,
      useOnlyColor: req.body.useOnlyColor === true
    });

    // Save playlist first to get ID
    const savedPlaylist = await playlist.save();

    // If preview image is provided, save it
    if (req.body.previewImage) {
      try {
        const imagePath = await saveBase64Image(req.body.previewImage, savedPlaylist._id);
        savedPlaylist.previewImage = imagePath;
        await savedPlaylist.save();
      } catch (imageError) {
        console.error('Failed to save preview image:', imageError);
        // Continue even if image save fails
      }
    }

    res.status(201).json(savedPlaylist);
  } catch (error) {
    res.status(400).json({
      message: 'Failed to create playlist',
      error: error.message
    });
  }
});

// Get specific playlist
router.get('/:id', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findOne({
      _id: req.params.id,
      owner: req.user._id
    }).populate('tracks');

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update playlist
router.patch('/:id', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { $set: req.body },
      { new: true }
    );

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }
    res.json(playlist);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete playlist
router.delete('/:id', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id
    });

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }
    res.json({ message: 'Playlist deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add track to playlist
router.post('/:playlistId/tracks/:trackId', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findOne({
      _id: req.params.playlistId,
      owner: req.user._id
    });

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    const track = await Track.findById(req.params.trackId);
    if (!track) {
      return res.status(404).json({ message: 'Track not found' });
    }

    if (playlist.tracks.includes(track._id)) {
      return res.status(400).json({ message: 'Track already in playlist' });
    }

    playlist.tracks.push(track._id);
    await playlist.save();

    res.json({ message: 'Track added to playlist' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove track from playlist
router.delete('/:playlistId/tracks/:trackId', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findOne({
      _id: req.params.playlistId,
      owner: req.user._id
    });

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    playlist.tracks = playlist.tracks.filter(
      id => id.toString() !== req.params.trackId
    );
    await playlist.save();

    res.json({ message: 'Track removed from playlist' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Like/Unlike a track (adds/removes from Liked Songs playlist)
router.post('/liked-songs/:trackId', auth, async (req, res) => {
  try {
    let user = await User.findById(req.user._id);
    let likedSongs;

    if (user.playlists.liked) {
      // Get existing Liked Songs playlist
      likedSongs = await Playlist.findById(user.playlists.liked);
    } else {
      // Create Liked Songs playlist
      likedSongs = new Playlist({
        name: 'Liked Songs',
        owner: req.user._id,
        isSystem: true,
        description: 'Your liked songs'
      });
      await likedSongs.save();

      // Update user with reference to Liked Songs playlist
      user.playlists.liked = likedSongs._id;
      await user.save();
    }

    const track = await Track.findById(req.params.trackId);
    if (!track) {
      return res.status(404).json({ message: 'Track not found' });
    }

    const isLiked = likedSongs.tracks.includes(track._id);
    if (isLiked) {
      // Unlike
      likedSongs.tracks = likedSongs.tracks.filter(
        id => id.toString() !== track._id.toString()
      );
      await likedSongs.save();
      res.json({ message: 'Track unliked', liked: false });
    } else {
      // Like
      likedSongs.tracks.push(track._id);
      await likedSongs.save();
      res.json({ message: 'Track liked', liked: true });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get public playlists from a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    // First check if user exists
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const playlists = await Playlist.find({
      owner: req.params.userId,
      isPrivate: false,
      isSystem: false  // Don't include system playlists like "Liked Songs"
    })
      .populate('owner', 'username')
      .populate('tracks', 'title artist album duration plays')
      .populate({
        path: 'tracks',
        populate: [
          { path: 'artist', select: 'name' },
          { path: 'album', select: 'title coverArt' }
        ]
      })
      .lean();

    res.json(playlists);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Get a specific playlist by ID (public access for public playlists)
router.get('/:playlistId', async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.playlistId)
      .populate('owner', 'username')
      .populate('tracks', 'title artist album duration plays')
      .populate({
        path: 'tracks',
        populate: [
          { path: 'artist', select: 'name' },
          { path: 'album', select: 'title coverArt' }
        ]
      })
      .lean();

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    // Check if playlist is private
    if (playlist.isPrivate) {
      // If no user is logged in, deny access
      if (!req.user) {
        return res.status(403).json({ message: 'This playlist is private' });
      }

      // If user is not the owner, deny access
      if (playlist.owner._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'This playlist is private' });
      }
    }

    res.json(playlist);
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid playlist ID format' });
    }
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;