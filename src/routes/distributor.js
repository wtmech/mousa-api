const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// Middleware to check if request is from a distributor
const isDistributor = (req, res, next) => {
  // For development, we'll use a simple API key check
  const apiKey = req.header('X-Distributor-Key');
  if (apiKey !== process.env.DISTRIBUTOR_KEY) {
    return res.status(401).json({ message: 'Unauthorized distributor' });
  }
  next();
};

// Route for distributor to verify an artist
router.post('/verify-artist', isDistributor, async (req, res) => {
  try {
    const { userId, distributorName } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user to artist status
    user.isArtist = true;
    user.artistProfile.verifiedBy = distributorName;
    user.artistProfile.verificationDate = new Date();

    await user.save();

    res.json({
      message: 'Artist verified successfully',
      user: {
        id: user._id,
        username: user.username,
        isArtist: user.isArtist,
        verifiedBy: user.artistProfile.verifiedBy
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying artist', error: error.message });
  }
});

module.exports = router;