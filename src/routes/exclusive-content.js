const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const ExclusiveContent = require('../models/ExclusiveContent');
const Artist = require('../models/Artist');
const UserSubscription = require('../models/UserSubscription');
const { uploadMedia } = require('../utils/fileUpload');
const mongoose = require('mongoose');

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

// Middleware to check subscription access
const checkSubscriptionAccess = async (req, res, next) => {
  try {
    const contentId = req.params.id;

    // Find the content
    const content = await ExclusiveContent.findById(contentId)
      .populate('minimumTierRequired');

    if (!content) {
      return res.status(404).json({ message: 'Content not found' });
    }

    // If public content, allow access
    if (content.isPublic) {
      req.content = content;
      return next();
    }

    // At this point, content is exclusive - check subscription
    const subscription = await UserSubscription.findOne({
      user: req.user.id,
      artist: content.artist,
      status: 'active'
    }).populate('tier');

    // If no subscription, deny access
    if (!subscription || !subscription.canAccessContent()) {
      return res.status(403).json({
        message: 'This content requires an active subscription'
      });
    }

    // If content requires minimum tier, check tier level
    if (content.minimumTierRequired && subscription.tier) {
      // In a real app, compare tier levels with a more sophisticated method
      // Here we simply compare tier IDs
      if (content.minimumTierRequired.toString() !== subscription.tier._id.toString()) {
        return res.status(403).json({
          message: 'This content requires a higher subscription tier',
          requiredTier: content.minimumTierRequired.name
        });
      }
    }

    // User has access, continue
    req.content = content;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all exclusive content for an artist
router.get('/artist/:artistId', auth, async (req, res) => {
  try {
    const artistId = req.params.artistId;
    const userId = req.user.id;

    // First, check if user has subscription to this artist
    const subscription = await UserSubscription.findOne({
      user: userId,
      artist: artistId,
      status: 'active'
    }).populate('tier');

    // Base query: only public content or if content doesn't require tier
    let query = {
      artist: artistId,
      $or: [
        { isPublic: true },
        {
          isPublic: false,
          minimumTierRequired: { $exists: false }
        }
      ]
    };

    // If user is subscribed, filter based on tier
    if (subscription && subscription.canAccessContent()) {
      if (subscription.tier) {
        // Add content matching their tier
        query.$or.push({
          minimumTierRequired: subscription.tier._id
        });
      } else {
        // No tier restriction, show all content
        query = { artist: artistId };
      }
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filter by content type if specified
    if (req.query.type) {
      query.contentType = req.query.type;
    }

    // Get content
    const content = await ExclusiveContent.find(query)
      .sort({ releaseDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate('minimumTierRequired', 'name');

    const total = await ExclusiveContent.countDocuments(query);

    res.json({
      content,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalContent: total
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific content item by ID
router.get('/:id', auth, checkSubscriptionAccess, async (req, res) => {
  try {
    // Content is already verified and available in req.content
    // Increment view count
    req.content.viewCount += 1;
    await req.content.save();

    res.json(req.content);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new exclusive content for an artist
router.post('/', auth, isArtistMember, uploadMedia, async (req, res) => {
  try {
    const {
      title,
      description,
      contentType,
      releaseDate,
      minimumTierRequired,
      isPublic,
      expiresAt,
      tags,
      artist
    } = req.body;

    // Validate required fields
    if (!title || !contentType || !artist) {
      return res.status(400).json({ message: 'Title, content type, and artist are required' });
    }

    // Parse tags and file info
    const parsedTags = tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : [];

    // Create new content
    const newContent = new ExclusiveContent({
      title,
      description,
      contentType,
      artist,
      releaseDate: releaseDate || new Date(),
      minimumTierRequired: minimumTierRequired || null,
      isPublic: isPublic === 'true' || isPublic === true,
      expiresAt: expiresAt || null,
      tags: parsedTags
    });

    // Handle file uploads
    if (req.file) {
      newContent.contentUrl = `/uploads/content/${req.file.filename}`;

      // Add file metadata
      if (req.file.mimetype.startsWith('video/')) {
        newContent.duration = req.body.duration || 0;
      } else if (req.file.mimetype.startsWith('audio/')) {
        newContent.duration = req.body.duration || 0;
      }

      newContent.fileSize = req.file.size;
    } else if (req.body.contentUrl) {
      newContent.contentUrl = req.body.contentUrl;
    } else {
      return res.status(400).json({ message: 'Content file or URL is required' });
    }

    // Handle thumbnail
    if (req.body.thumbnailUrl) {
      newContent.thumbnailUrl = req.body.thumbnailUrl;
    }

    await newContent.save();

    res.status(201).json(newContent);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update exclusive content
router.put('/:id', auth, uploadMedia, async (req, res) => {
  try {
    const contentId = req.params.id;

    // Find the content
    const content = await ExclusiveContent.findById(contentId);
    if (!content) {
      return res.status(404).json({ message: 'Content not found' });
    }

    // Check if user is authorized to update
    const artist = await Artist.findById(content.artist);
    const isMember = artist.members.some(
      member => member.userId.toString() === req.user.id
    );

    if (!isMember && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to update this content' });
    }

    // Update fields if provided
    const updateFields = [
      'title', 'description', 'contentType', 'releaseDate',
      'minimumTierRequired', 'isPublic', 'expiresAt', 'tags'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        // Parse tags if needed
        if (field === 'tags') {
          content[field] = typeof req.body[field] === 'string'
            ? JSON.parse(req.body[field])
            : req.body[field];
        }
        // Parse boolean fields
        else if (field === 'isPublic') {
          content[field] = req.body[field] === 'true' || req.body[field] === true;
        }
        // Parse dates
        else if (field === 'releaseDate' || field === 'expiresAt') {
          content[field] = req.body[field] ? new Date(req.body[field]) : content[field];
        }
        // All other fields
        else {
          content[field] = req.body[field];
        }
      }
    });

    // Handle file uploads
    if (req.file) {
      content.contentUrl = `/uploads/content/${req.file.filename}`;
      content.fileSize = req.file.size;

      if (req.body.duration) {
        content.duration = req.body.duration;
      }
    } else if (req.body.contentUrl && req.body.contentUrl !== content.contentUrl) {
      content.contentUrl = req.body.contentUrl;
    }

    // Handle thumbnail
    if (req.body.thumbnailUrl && req.body.thumbnailUrl !== content.thumbnailUrl) {
      content.thumbnailUrl = req.body.thumbnailUrl;
    }

    await content.save();

    res.json(content);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete exclusive content
router.delete('/:id', auth, async (req, res) => {
  try {
    const contentId = req.params.id;

    // Find the content
    const content = await ExclusiveContent.findById(contentId);
    if (!content) {
      return res.status(404).json({ message: 'Content not found' });
    }

    // Check if user is authorized to delete
    const artist = await Artist.findById(content.artist);
    const isMember = artist.members.some(
      member => member.userId.toString() === req.user.id
    );

    if (!isMember && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this content' });
    }

    await content.remove();

    res.json({ message: 'Content deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Record a content download
router.post('/:id/download', auth, checkSubscriptionAccess, async (req, res) => {
  try {
    // Increment download count
    req.content.downloadCount += 1;
    await req.content.save();

    res.json({
      message: 'Download recorded',
      downloadUrl: req.content.contentUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;