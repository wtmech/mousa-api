const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const SubscriptionTier = require('../models/SubscriptionTier');
const Artist = require('../models/Artist');

// Middleware to verify artist ownership
const verifyArtistOwnership = async (req, res, next) => {
  try {
    const artistId = req.params.artistId || req.body.artist;

    // Find the artist
    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    // Check if user is member of the artist
    const isMember = artist.members.some(
      member => member.userId.toString() === req.user.id
    );

    if (!isMember && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to manage this artist' });
    }

    // Add artist to request for later use
    req.artist = artist;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all subscription tiers for an artist
router.get('/artist/:artistId', async (req, res) => {
  try {
    const artistId = req.params.artistId;

    // Find all active tiers for this artist
    const tiers = await SubscriptionTier.find({
      artist: artistId,
      active: true
    }).sort({ order: 1 });

    res.json(tiers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific subscription tier
router.get('/:id', async (req, res) => {
  try {
    const tier = await SubscriptionTier.findById(req.params.id);

    if (!tier) {
      return res.status(404).json({ message: 'Subscription tier not found' });
    }

    res.json(tier);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Subscription tier not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new subscription tier for an artist
router.post('/', auth, verifyArtistOwnership, async (req, res) => {
  try {
    const {
      name,
      price,
      features,
      description,
      isRecommended,
      order,
      artist
    } = req.body;

    // Validate price range
    if (price < 0.99 || price > 99.99) {
      return res.status(400).json({
        message: 'Price must be between $0.99 and $99.99'
      });
    }

    // Check if artist already has 3 tiers
    const existingTierCount = await SubscriptionTier.countDocuments({
      artist,
      active: true
    });

    if (existingTierCount >= 3) {
      return res.status(400).json({
        message: 'Artist already has the maximum number of tiers (3)'
      });
    }

    // Create new tier
    const newTier = new SubscriptionTier({
      artist,
      name,
      price,
      features: features || [],
      description,
      isRecommended: isRecommended || false,
      order: order || (existingTierCount + 1),
      active: true
    });

    await newTier.save();

    // Update artist subscription settings
    await Artist.findByIdAndUpdate(artist, {
      acceptsSubscriptions: true,
      hasCustomSubscriptionTiers: true
    });

    res.status(201).json(newTier);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a subscription tier
router.put('/:id', auth, async (req, res) => {
  try {
    const tierId = req.params.id;

    // Find the tier
    const tier = await SubscriptionTier.findById(tierId);
    if (!tier) {
      return res.status(404).json({ message: 'Subscription tier not found' });
    }

    // Verify artist ownership
    const artist = await Artist.findById(tier.artist);
    const isMember = artist.members.some(
      member => member.userId.toString() === req.user.id
    );

    if (!isMember && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to update this tier' });
    }

    const {
      name,
      price,
      features,
      description,
      isRecommended,
      order
    } = req.body;

    // Validate price range
    if (price !== undefined && (price < 0.99 || price > 99.99)) {
      return res.status(400).json({
        message: 'Price must be between $0.99 and $99.99'
      });
    }

    // Update fields
    if (name) tier.name = name;
    if (price !== undefined) tier.price = price;
    if (features) tier.features = features;
    if (description !== undefined) tier.description = description;
    if (isRecommended !== undefined) tier.isRecommended = isRecommended;
    if (order) tier.order = order;

    await tier.save();
    res.json(tier);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a subscription tier (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const tierId = req.params.id;

    // Find the tier
    const tier = await SubscriptionTier.findById(tierId);
    if (!tier) {
      return res.status(404).json({ message: 'Subscription tier not found' });
    }

    // Verify artist ownership
    const artist = await Artist.findById(tier.artist);
    const isMember = artist.members.some(
      member => member.userId.toString() === req.user.id
    );

    if (!isMember && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this tier' });
    }

    // Soft delete by setting active to false
    tier.active = false;
    await tier.save();

    // Check if artist has any remaining tiers
    const activeTiers = await SubscriptionTier.countDocuments({
      artist: tier.artist,
      active: true
    });

    // If no tiers left, update artist settings
    if (activeTiers === 0) {
      await Artist.findByIdAndUpdate(tier.artist, {
        hasCustomSubscriptionTiers: false
      });
    }

    res.json({ message: 'Subscription tier deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;