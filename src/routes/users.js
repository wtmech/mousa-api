const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'User with this email or username already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = new User({
      username,
      email,
      password: hashedPassword
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        isArtist: user.isArtist,
        artistName: user.artistName
      },
      token
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Logged in successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        isArtist: user.isArtist,
        artistName: user.artistName
      },
      token
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Promote to artist
router.patch('/promote-to-artist', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isArtist = true;
    user.artistName = req.body.artistName || user.username;
    await user.save();

    res.json({
      message: 'Successfully promoted to artist',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        isArtist: user.isArtist,
        artistName: user.artistName
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Subscribe to an artist
router.post('/subscribe/:artistId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const artist = await User.findById(req.params.artistId);

    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    if (!artist.isArtist) {
      return res.status(400).json({ message: 'User is not an artist' });
    }

    if (user.subscriptions.includes(artist._id)) {
      return res.status(400).json({ message: 'Already subscribed to this artist' });
    }

    user.subscriptions.push(artist._id);
    await user.save();

    res.json({
      message: `Successfully subscribed to ${artist.artistName || artist.username}`,
      subscriptions: user.subscriptions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Unsubscribe from an artist
router.post('/unsubscribe/:artistId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const artist = await User.findById(req.params.artistId);

    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    if (!user.subscriptions.includes(artist._id)) {
      return res.status(400).json({ message: 'Not subscribed to this artist' });
    }

    user.subscriptions = user.subscriptions.filter(
      sub => sub.toString() !== artist._id.toString()
    );
    await user.save();

    res.json({
      message: `Successfully unsubscribed from ${artist.artistName || artist.username}`,
      subscriptions: user.subscriptions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's subscriptions
router.get('/subscriptions', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('subscriptions', 'username artistName');

    res.json(user.subscriptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;