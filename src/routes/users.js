const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Register a new user
router.post('/register', async (req, res) => {
  try {
    console.log('Received registration request body:', req.body);
    const { firstName, lastName, username, email, password } = req.body;

    // Log extracted values
    console.log('Extracted values:', { firstName, lastName, username, email, password: '***' });

    // Validate all required fields
    if (!firstName || !lastName || !username || !email || !password) {
      console.log('Missing required fields:', {
        firstName: !firstName,
        lastName: !lastName,
        username: !username,
        email: !email,
        password: !password
      });

      return res.status(400).json({
        message: 'All fields are required',
        requiredFields: {
          firstName: !firstName ? 'First name is required' : null,
          lastName: !lastName ? 'Last name is required' : null,
          username: !username ? 'Username is required' : null,
          email: !email ? 'Email is required' : null,
          password: !password ? 'Password is required' : null
        }
      });
    }

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

    // Create new user with all required fields
    const user = new User({
      firstName,
      lastName,
      username,
      email,
      password: hashedPassword
    });

    console.log('Attempting to save user:', {
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email
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
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        isArtist: user.isArtist,
        artistProfiles: user.artistProfiles
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({
      message: 'Error creating user',
      error: error.message,
      requestBody: req.body  // Add this to see what was received
    });
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
      message: 'Login successful',
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        isArtist: user.isArtist,
        artistProfiles: user.artistProfiles,
        activeProfile: user.activeProfile,
        isAdmin: user.isAdmin
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