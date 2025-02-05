const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const { Artist } = require('../models/Artist');
const mongoose = require('mongoose');

// Follow a user
router.post('/users/:userId', auth, async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.userId) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const userToFollow = await User.findById(req.params.userId);
    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = await User.findById(req.user._id);

    // Check if already following
    if (user.following.users.includes(userToFollow._id)) {
      return res.status(400).json({ message: 'Already following this user' });
    }

    // Add to following list
    user.following.users.push(userToFollow._id);
    await user.save();

    // Increment follower count
    await User.findByIdAndUpdate(userToFollow._id, {
      $inc: { followerCount: 1 }
    });

    res.json({ message: 'Successfully followed user' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Unfollow a user
router.delete('/users/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const wasFollowing = user.following.users.includes(req.params.userId);

    if (wasFollowing) {
      // Remove from following list
      user.following.users = user.following.users.filter(
        id => id.toString() !== req.params.userId
      );
      await user.save();

      // Decrement follower count
      await User.findByIdAndUpdate(req.params.userId, {
        $inc: { followerCount: -1 }
      });
    }

    res.json({ message: 'Successfully unfollowed user' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Follow an artist
router.post('/artists/:artistId', auth, async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.artistId);
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const user = await User.findById(req.user._id);

    // Check if already following
    if (user.following.artists.includes(artist._id)) {
      return res.status(400).json({ message: 'Already following this artist' });
    }

    // Add to following list
    user.following.artists.push(artist._id);
    await user.save();

    // Increment follower count
    await Artist.findByIdAndUpdate(artist._id, {
      $inc: { followerCount: 1 }
    });

    res.json({ message: 'Successfully followed artist' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Unfollow an artist
router.delete('/artists/:artistId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const wasFollowing = user.following.artists.includes(req.params.artistId);

    if (wasFollowing) {
      // Remove from following list
      user.following.artists = user.following.artists.filter(
        id => id.toString() !== req.params.artistId
      );
      await user.save();

      // Decrement follower count
      await Artist.findByIdAndUpdate(req.params.artistId, {
        $inc: { followerCount: -1 }
      });
    }

    res.json({ message: 'Successfully unfollowed artist' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Subscribe to an artist
router.post('/subscribe/artists/:artistId', auth, async (req, res) => {
  try {
    // First check if artist exists
    const artist = await Artist.findById(req.params.artistId);
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const user = await User.findById(req.user._id);

    // Check if already subscribed
    const existingSubscription = user.subscriptions.find(
      sub => sub.artist.toString() === artist._id.toString() && sub.status === 'active'
    );

    if (existingSubscription) {
      return res.status(400).json({ message: 'Already subscribed to this artist' });
    }

    // Add subscription
    user.subscriptions.push({
      artist: artist._id,
      price: req.body.price || artist.subscriptionPrice || 4.99,
      status: 'active'
    });

    // Use a session to ensure both operations succeed or fail together
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await user.save({ session });

      const updatedArtist = await Artist.findByIdAndUpdate(
        artist._id,
        { $inc: { subscriberCount: 1 } },
        { new: true, session }
      );

      await session.commitTransaction();

      res.json({
        message: 'Successfully subscribed to artist',
        subscriberCount: updatedArtist.subscriberCount
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Cancel artist subscription
router.post('/subscribe/artists/:artistId/cancel', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const subscription = user.subscriptions.find(
      sub => sub.artist.toString() === req.params.artistId && sub.status === 'active'
    );

    if (!subscription) {
      return res.status(404).json({ message: 'No active subscription found' });
    }

    subscription.status = 'cancelled';
    await user.save();

    // Decrement subscriber count
    await Artist.findByIdAndUpdate(req.params.artistId, {
      $inc: { subscriberCount: -1 }
    });

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get following/subscription status (active only)
router.get('/status/:userId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('following.users', 'username')
      .populate('following.artists', 'name')
      .populate('subscriptions.artist', 'name')
      .lean();

    res.json({
      following: {
        users: user.following.users,
        artists: user.following.artists
      },
      subscriptions: user.subscriptions.filter(sub => sub.status === 'active')  // Only active subscriptions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get subscription history
router.get('/subscriptions/history', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('subscriptions.artist', 'name')
      .lean();

    // Group subscriptions by status
    const history = {
      active: [],
      cancelled: [],
      expired: []
    };

    user.subscriptions.forEach(sub => {
      history[sub.status].push(sub);
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get follower counts
router.get('/counts/:id', async (req, res) => {
  try {
    // Check if it's a user or artist
    const user = await User.findById(req.params.id);
    if (user) {
      return res.json({
        type: 'user',
        followerCount: user.followerCount
      });
    }

    const artist = await Artist.findById(req.params.id);
    if (artist) {
      return res.json({
        type: 'artist',
        followerCount: artist.followerCount,
        subscriberCount: artist.subscriberCount
      });
    }

    res.status(404).json({ message: 'User or artist not found' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;