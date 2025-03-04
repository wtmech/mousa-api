const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const ArtistEvent = require('../models/ArtistEvent');
const Artist = require('../models/Artist');
const UserSubscription = require('../models/UserSubscription');

// Middleware to check if user is artist member
const isArtistMember = async (req, res, next) => {
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

// Get all events for an artist (public ones for all, exclusive ones for subscribers)
router.get('/artist/:artistId', auth, async (req, res) => {
  try {
    const artistId = req.params.artistId;
    const userId = req.user.id;

    // Check if user has subscription to this artist
    const subscription = await UserSubscription.findOne({
      user: userId,
      artist: artistId,
      status: 'active'
    }).populate('tier');

    // Default query: non-exclusive events or past events
    let query = {
      artist: artistId,
      $or: [
        { isExclusiveToSupporters: false },
        { date: { $lt: new Date() } }
      ]
    };

    // If user is subscribed, they can see exclusive events too
    if (subscription && subscription.isActive()) {
      if (subscription.tier) {
        // User can see events for their tier or lower
        query = {
          artist: artistId,
          $or: [
            { isExclusiveToSupporters: false },
            {
              isExclusiveToSupporters: true,
              minimumTierRequired: { $exists: false }
            },
            {
              isExclusiveToSupporters: true,
              minimumTierRequired: subscription.tier._id
            }
          ]
        };
      } else {
        // User is subscribed but no tier info - show all events
        query = { artist: artistId };
      }
    }

    // Check if we should only return upcoming events
    const upcomingOnly = req.query.upcoming === 'true';
    if (upcomingOnly) {
      query.date = { $gte: new Date() };
    }

    // Get events
    const events = await ArtistEvent.find(query)
      .sort({ date: 1 })
      .populate('minimumTierRequired', 'name');

    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific event by ID
router.get('/:id', async (req, res) => {
  try {
    const event = await ArtistEvent.findById(req.params.id)
      .populate('artist', 'name')
      .populate('minimumTierRequired', 'name price');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // If event is exclusive to supporters, check if user is authenticated and subscribed
    if (event.isExclusiveToSupporters) {
      // If not authenticated, don't show exclusive events
      if (!req.user) {
        return res.status(403).json({ message: 'This event is exclusive to supporters' });
      }

      // Check if user is subscribed
      const subscription = await UserSubscription.findOne({
        user: req.user.id,
        artist: event.artist,
        status: 'active'
      });

      if (!subscription || !subscription.canAccessContent()) {
        return res.status(403).json({ message: 'This event is exclusive to supporters' });
      }

      // If event requires a specific tier, check user's tier
      if (event.minimumTierRequired &&
          subscription.tier.toString() !== event.minimumTierRequired.toString()) {
        return res.status(403).json({
          message: 'This event requires a higher subscription tier',
          requiredTier: event.minimumTierRequired
        });
      }
    }

    res.json(event);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new event for an artist
router.post('/', auth, isArtistMember, async (req, res) => {
  try {
    const {
      title,
      description,
      eventType,
      date,
      endDate,
      venue,
      location,
      ticketUrl,
      imageUrl,
      isVirtual,
      streamUrl,
      isExclusiveToSupporters,
      minimumTierRequired,
      artist
    } = req.body;

    // Validate required fields
    if (!title || !date || !artist) {
      return res.status(400).json({ message: 'Title, date, and artist are required' });
    }

    // Create new event
    const newEvent = new ArtistEvent({
      title,
      description,
      eventType: eventType || 'concert',
      date,
      endDate,
      venue,
      location,
      ticketUrl,
      imageUrl,
      isVirtual: isVirtual || false,
      streamUrl,
      isExclusiveToSupporters: isExclusiveToSupporters || false,
      minimumTierRequired,
      artist
    });

    await newEvent.save();

    res.status(201).json(newEvent);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update an event
router.put('/:id', auth, async (req, res) => {
  try {
    const eventId = req.params.id;

    // Find the event
    const event = await ArtistEvent.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user is authorized to update this event
    const artist = await Artist.findById(event.artist);
    const isMember = artist.members.some(
      member => member.userId.toString() === req.user.id
    );

    if (!isMember && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to update this event' });
    }

    // Update fields
    const updateFields = [
      'title', 'description', 'eventType', 'date', 'endDate',
      'venue', 'location', 'ticketUrl', 'imageUrl', 'isVirtual',
      'streamUrl', 'isExclusiveToSupporters', 'minimumTierRequired'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        event[field] = req.body[field];
      }
    });

    await event.save();

    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete an event
router.delete('/:id', auth, async (req, res) => {
  try {
    const eventId = req.params.id;

    // Find the event
    const event = await ArtistEvent.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user is authorized to delete this event
    const artist = await Artist.findById(event.artist);
    const isMember = artist.members.some(
      member => member.userId.toString() === req.user.id
    );

    if (!isMember && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this event' });
    }

    await event.remove();

    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all upcoming events (across all artists)
router.get('/', async (req, res) => {
  try {
    const now = new Date();

    // Get all upcoming public events
    const events = await ArtistEvent.find({
      date: { $gte: now },
      isExclusiveToSupporters: false
    })
    .sort({ date: 1 })
    .limit(20)
    .populate('artist', 'name profileImage');

    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;