const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Artist = require('../models/Artist');

// Follow an artist
router.post('/artist/:id', auth, async (req, res) => {
  try {
    const artistId = req.params.id;
    const userId = req.user.id;

    // Check if artist exists
    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    // Check if user already follows this artist
    const user = await User.findById(userId);
    if (user.followingArtists.includes(artistId)) {
      return res.status(400).json({ message: 'Already following this artist' });
    }

    // Add artist to user's following list
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { followingArtists: artistId } }
    );

    // Increment artist's follower count
    await Artist.findByIdAndUpdate(
      artistId,
      { $inc: { followerCount: 1 } }
    );

    res.json({ message: 'Now following artist' });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Artist not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Unfollow an artist
router.delete('/artist/:id', auth, async (req, res) => {
  try {
    const artistId = req.params.id;
    const userId = req.user.id;

    // Check if artist exists
    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    // Check if user follows this artist
    const user = await User.findById(userId);
    if (!user.followingArtists.includes(artistId)) {
      return res.status(400).json({ message: 'Not following this artist' });
    }

    // Remove artist from user's following list
    await User.findByIdAndUpdate(
      userId,
      { $pull: { followingArtists: artistId } }
    );

    // Decrement artist's follower count
    await Artist.findByIdAndUpdate(
      artistId,
      { $inc: { followerCount: -1 } }
    );

    res.json({ message: 'Unfollowed artist' });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Artist not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Follow another user
router.post('/user/:id', auth, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const userId = req.user.id;

    // Prevent following yourself
    if (targetUserId === userId) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already following
    const user = await User.findById(userId);
    if (user.followingUsers.includes(targetUserId)) {
      return res.status(400).json({ message: 'Already following this user' });
    }

    // Add target user to following list
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { followingUsers: targetUserId } }
    );

    // Add current user to target's followers list
    await User.findByIdAndUpdate(
      targetUserId,
      { $addToSet: { followers: userId } }
    );

    res.json({ message: 'Now following user' });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Unfollow another user
router.delete('/user/:id', auth, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const userId = req.user.id;

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if actually following
    const user = await User.findById(userId);
    if (!user.followingUsers.includes(targetUserId)) {
      return res.status(400).json({ message: 'Not following this user' });
    }

    // Remove target user from following list
    await User.findByIdAndUpdate(
      userId,
      { $pull: { followingUsers: targetUserId } }
    );

    // Remove current user from target's followers list
    await User.findByIdAndUpdate(
      targetUserId,
      { $pull: { followers: userId } }
    );

    res.json({ message: 'Unfollowed user' });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Get artists a user is following
router.get('/artists', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'followingArtists',
      select: 'name profileImage bio followerCount isVerified'
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.followingArtists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get users a user is following
router.get('/users', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'followingUsers',
      select: 'username firstName lastName avatar'
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.followingUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a user's followers
router.get('/followers', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'followers',
      select: 'username firstName lastName avatar'
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.followers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if currently following an artist
router.get('/check/artist/:id', auth, async (req, res) => {
  try {
    const artistId = req.params.id;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isFollowing = user.followingArtists.includes(artistId);

    res.json({ isFollowing });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Artist not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if currently following a user
router.get('/check/user/:id', auth, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isFollowing = user.followingUsers.includes(targetUserId);

    res.json({ isFollowing });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;