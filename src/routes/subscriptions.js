const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const UserSubscription = require('../models/UserSubscription');
const SubscriptionTier = require('../models/SubscriptionTier');
const Artist = require('../models/Artist');
const User = require('../models/User');

// Get all subscriptions for the current user
router.get('/my', auth, async (req, res) => {
  try {
    // Find all user's active subscriptions
    const subscriptions = await UserSubscription.find({
      user: req.user.id
    })
    .populate('artist', 'name profileImage')
    .populate('tier', 'name price features');

    res.json(subscriptions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific subscription by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const subscription = await UserSubscription.findById(req.params.id)
      .populate('artist', 'name profileImage coverArt')
      .populate('tier', 'name price features');

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // Verify the subscription belongs to the user
    if (subscription.user.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to view this subscription' });
    }

    res.json(subscription);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if user is subscribed to an artist
router.get('/check/:artistId', auth, async (req, res) => {
  try {
    const artistId = req.params.artistId;

    // Check if subscription exists
    const subscription = await UserSubscription.findOne({
      user: req.user.id,
      artist: artistId,
      status: 'active'
    }).populate('tier', 'name price');

    if (!subscription) {
      return res.json({
        isSubscribed: false,
        subscription: null
      });
    }

    res.json({
      isSubscribed: true,
      subscription
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new subscription
router.post('/', auth, async (req, res) => {
  try {
    const {
      artistId,
      tierId,
      paymentMethod
    } = req.body;

    // Validate required fields
    if (!artistId || !tierId) {
      return res.status(400).json({ message: 'Artist and tier are required' });
    }

    // Check if artist exists and accepts subscriptions
    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    if (!artist.acceptsSubscriptions) {
      return res.status(400).json({ message: 'This artist does not accept subscriptions' });
    }

    // Check if tier exists and belongs to the artist
    const tier = await SubscriptionTier.findOne({
      _id: tierId,
      artist: artistId,
      active: true
    });

    if (!tier) {
      return res.status(404).json({ message: 'Subscription tier not found' });
    }

    // Check if user already has an active subscription to this artist
    const existingSubscription = await UserSubscription.findOne({
      user: req.user.id,
      artist: artistId,
      status: { $in: ['active', 'paused'] }
    });

    if (existingSubscription) {
      return res.status(400).json({
        message: 'You already have an active subscription to this artist',
        subscription: existingSubscription
      });
    }

    // Create subscription (in real implementation, payment processing would happen here)
    // This is a simplified version without actual payment processing
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // One month subscription period

    const newSubscription = new UserSubscription({
      user: req.user.id,
      artist: artistId,
      tier: tierId,
      status: 'active',
      paymentMethod: paymentMethod || 'default',
      startDate: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: endDate
    });

    await newSubscription.save();

    // Return the subscription with populated fields
    const populatedSubscription = await UserSubscription.findById(newSubscription._id)
      .populate('artist', 'name profileImage')
      .populate('tier', 'name price features');

    res.status(201).json(populatedSubscription);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel a subscription
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const { cancelReason } = req.body;

    // Find the subscription
    const subscription = await UserSubscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // Verify subscription belongs to user
    if (subscription.user.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to cancel this subscription' });
    }

    // Update subscription status
    subscription.status = 'canceled';
    subscription.canceledAt = new Date();
    subscription.cancelReason = cancelReason || 'User requested cancellation';
    subscription.autoRenew = false;

    await subscription.save();

    res.json({
      message: 'Subscription canceled successfully',
      subscription
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change subscription tier
router.put('/:id/change-tier', auth, async (req, res) => {
  try {
    const { newTierId } = req.body;

    if (!newTierId) {
      return res.status(400).json({ message: 'New tier ID is required' });
    }

    // Find the subscription
    const subscription = await UserSubscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // Verify subscription belongs to user
    if (subscription.user.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to modify this subscription' });
    }

    // Verify the new tier exists and belongs to the same artist
    const newTier = await SubscriptionTier.findOne({
      _id: newTierId,
      artist: subscription.artist,
      active: true
    });

    if (!newTier) {
      return res.status(404).json({ message: 'New subscription tier not found or not available' });
    }

    // Update subscription tier
    // In real implementation, payment changes would happen here
    subscription.tier = newTierId;

    await subscription.save();

    // Return the updated subscription with populated fields
    const updatedSubscription = await UserSubscription.findById(subscription._id)
      .populate('artist', 'name profileImage')
      .populate('tier', 'name price features');

    res.json({
      message: 'Subscription tier changed successfully',
      subscription: updatedSubscription
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get subscriptions for a specific artist (admin or artist member only)
router.get('/artist/:artistId', auth, async (req, res) => {
  try {
    const artistId = req.params.artistId;

    // Verify the user has permission to view this data
    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const isMember = artist.members.some(
      member => member.userId.toString() === req.user.id
    );

    if (!isMember && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to view these subscriptions' });
    }

    // Get all active subscriptions for this artist
    const subscriptions = await UserSubscription.find({
      artist: artistId,
      status: 'active'
    })
    .populate('user', 'firstName lastName username email')
    .populate('tier', 'name price');

    // Group by tier for stats
    const tierStats = {};
    subscriptions.forEach(sub => {
      const tierName = sub.tier.name;
      if (!tierStats[tierName]) {
        tierStats[tierName] = {
          count: 0,
          revenue: 0
        };
      }
      tierStats[tierName].count++;
      tierStats[tierName].revenue += sub.tier.price;
    });

    res.json({
      totalSubscribers: subscriptions.length,
      tierStats,
      subscriptions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;