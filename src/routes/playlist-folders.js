const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { validateFolderStructure } = require('../middleware/validation');
const PlaylistFolder = require('../models/PlaylistFolder');
const Playlist = require('../models/Playlist');
const User = require('../models/User');
const mongoose = require('mongoose');

// Get all playlist folders for the current user
router.get('/', auth, async (req, res) => {
  try {
    const folders = await PlaylistFolder.find({ owner: req.user.id })
      .populate({
        path: 'playlists',
        select: 'name color coverImage stats.totalDuration stats.followerCount'
      })
      .populate({
        path: 'parentFolder',
        select: 'name'
      });

    res.json(folders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific folder by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const folder = await PlaylistFolder.findById(req.params.id)
      .populate({
        path: 'playlists',
        select: 'name color coverImage stats.totalDuration stats.followerCount tracks',
        populate: {
          path: 'tracks.track',
          select: 'title artist duration',
          populate: {
            path: 'artist',
            select: 'name'
          }
        }
      })
      .populate({
        path: 'parentFolder',
        select: 'name'
      });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // Check if user is authorized to view this folder
    if (folder.owner.toString() !== req.user.id && !folder.isPublic) {
      return res.status(403).json({ message: 'Not authorized to view this folder' });
    }

    // Get child folders
    const childFolders = await PlaylistFolder.find({
      parentFolder: folder._id
    }).select('name playlists');

    res.json({
      folder,
      childFolders
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new playlist folder
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, parentFolder, isPublic } = req.body;

    // Validate input
    if (!name) {
      return res.status(400).json({ message: 'Folder name is required' });
    }

    // Check if parent folder exists and belongs to user
    if (parentFolder) {
      const parent = await PlaylistFolder.findById(parentFolder);
      if (!parent) {
        return res.status(404).json({ message: 'Parent folder not found' });
      }
      if (parent.owner.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to use this parent folder' });
      }
    }

    // Create the folder
    const newFolder = new PlaylistFolder({
      name,
      description,
      owner: req.user.id,
      parentFolder: parentFolder || null,
      isPublic: isPublic || false
    });

    await newFolder.save();

    // Add to user's folders list
    await User.findByIdAndUpdate(req.user.id, {
      $push: { 'playlists.folders': newFolder._id }
    });

    res.status(201).json(newFolder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a playlist folder
router.put('/:id', [auth, validateFolderStructure], async (req, res) => {
  try {
    const { name, description, parentFolder, isPublic } = req.body;
    const folderId = req.params.id;

    // Find the folder
    const folder = await PlaylistFolder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // Check if user is authorized to edit this folder
    if (folder.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to edit this folder' });
    }

    // Check for circular reference if changing parent folder
    if (parentFolder && parentFolder !== folder.parentFolder) {
      // Can't set a folder as its own parent
      if (parentFolder === folderId) {
        return res.status(400).json({ message: 'Cannot set folder as its own parent' });
      }

      // Check if new parent exists and belongs to user
      const parent = await PlaylistFolder.findById(parentFolder);
      if (!parent) {
        return res.status(404).json({ message: 'Parent folder not found' });
      }
      if (parent.owner.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to use this parent folder' });
      }

      // Check for deeper circular reference
      let currentParent = parent;
      while (currentParent.parentFolder) {
        if (currentParent.parentFolder.toString() === folderId) {
          return res.status(400).json({ message: 'Cannot create circular folder reference' });
        }
        currentParent = await PlaylistFolder.findById(currentParent.parentFolder);
      }
    }

    // Update the folder
    if (name) folder.name = name;
    if (description !== undefined) folder.description = description;
    if (parentFolder !== undefined) folder.parentFolder = parentFolder || null;
    if (isPublic !== undefined) folder.isPublic = isPublic;

    await folder.save();

    res.json(folder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a playlist folder
router.delete('/:id', auth, async (req, res) => {
  try {
    const folderId = req.params.id;

    // Find the folder
    const folder = await PlaylistFolder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // Check if user is authorized to delete this folder
    if (folder.owner.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this folder' });
    }

    // When deleting a folder, we need to handle playlists and child folders
    // Option 1: Move playlists to parent folder or root (default behavior)
    if (req.query.action !== 'delete_contents') {
      // Move playlists to parent folder or set to null
      await Playlist.updateMany(
        { folder: folderId },
        { folder: folder.parentFolder || null }
      );
    }
    // Option 2: Delete playlists in folder (if specified)
    else if (req.query.action === 'delete_contents') {
      // This would delete playlists, but we'll just unlink the folder
      await Playlist.updateMany(
        { folder: folderId },
        { folder: null }
      );
    }

    // Remove folder from user's folders list
    await User.findByIdAndUpdate(folder.owner, {
      $pull: { 'playlists.folders': folderId }
    });

    // Delete the folder
    await folder.remove();

    res.json({ message: 'Folder deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add playlists to a folder
router.post('/:id/playlists', auth, async (req, res) => {
  try {
    const { playlistIds } = req.body;
    const folderId = req.params.id;

    // Validate input
    if (!playlistIds || !Array.isArray(playlistIds) || playlistIds.length === 0) {
      return res.status(400).json({ message: 'Playlist IDs are required' });
    }

    // Find the folder
    const folder = await PlaylistFolder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // Check if user is authorized to edit this folder
    if (folder.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to edit this folder' });
    }

    // Verify the playlists exist and belong to the user
    const playlists = await Playlist.find({
      _id: { $in: playlistIds },
      owner: req.user.id
    });

    if (playlists.length !== playlistIds.length) {
      return res.status(400).json({ message: 'Some playlists not found or not owned by you' });
    }

    // Add playlists to the folder
    const updatedPlaylistIds = [...new Set([...folder.playlists, ...playlistIds])];
    folder.playlists = updatedPlaylistIds;
    await folder.save();

    // Update each playlist to reference this folder
    await Playlist.updateMany(
      { _id: { $in: playlistIds } },
      { folder: folderId }
    );

    res.json(folder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove playlists from a folder
router.delete('/:id/playlists', auth, async (req, res) => {
  try {
    const { playlistIds } = req.body;
    const folderId = req.params.id;

    // Validate input
    if (!playlistIds || !Array.isArray(playlistIds) || playlistIds.length === 0) {
      return res.status(400).json({ message: 'Playlist IDs are required' });
    }

    // Find the folder
    const folder = await PlaylistFolder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // Check if user is authorized to edit this folder
    if (folder.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to edit this folder' });
    }

    // Remove playlists from the folder
    folder.playlists = folder.playlists.filter(
      id => !playlistIds.includes(id.toString())
    );
    await folder.save();

    // Update each playlist to remove folder reference
    await Playlist.updateMany(
      { _id: { $in: playlistIds }, folder: folderId },
      { folder: null }
    );

    res.json(folder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get statistics for a specific folder
router.get('/:id/stats', auth, async (req, res) => {
  try {
    const folderId = req.params.id;

    // Find the folder
    const folder = await PlaylistFolder.findById(folderId);

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // Check authorization
    if (folder.owner.toString() !== req.user.id && !folder.isPublic) {
      return res.status(403).json({ message: 'Not authorized to view this folder' });
    }

    // Get all playlists in this folder
    const playlists = await Playlist.find({
      _id: { $in: folder.playlists }
    });

    // Calculate statistics
    let totalTracks = 0;
    let totalDuration = 0;
    let totalFollowers = 0;

    for (const playlist of playlists) {
      totalTracks += playlist.tracks.length || 0;
      totalDuration += playlist.stats?.totalDuration || 0;
      totalFollowers += playlist.stats?.followerCount || 0;
    }

    // Get child folders
    const childFolders = await PlaylistFolder.find({
      parentFolder: folderId
    });

    // Recursive stats calculation could be added here for child folders
    // but we'll keep it simple for now

    res.json({
      playlistCount: folder.playlists.length,
      childFolderCount: childFolders.length,
      trackCount: totalTracks,
      totalDuration: totalDuration,
      totalFollowers: totalFollowers,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Move playlists to a folder
router.post('/:id/add-playlists', auth, async (req, res) => {
  try {
    const { playlistIds } = req.body;
    const folderId = req.params.id;

    // Validate input
    if (!playlistIds || !Array.isArray(playlistIds) || playlistIds.length === 0) {
      return res.status(400).json({ message: 'Playlist IDs array is required' });
    }

    // Check if folder exists and user owns it
    const folder = await PlaylistFolder.findOne({
      _id: folderId,
      owner: req.user.id
    });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found or not owned by you' });
    }

    // Verify user owns all the playlists
    const playlists = await Playlist.find({
      _id: { $in: playlistIds },
      owner: req.user.id
    });

    if (playlists.length !== playlistIds.length) {
      return res.status(403).json({ message: 'You do not own all specified playlists' });
    }

    // Get current folders of these playlists to remove them
    const currentFolders = [...new Set(playlists.map(p => p.folder).filter(f => f))];

    // Remove playlists from their current folders
    for (const currentFolderId of currentFolders) {
      await PlaylistFolder.findByIdAndUpdate(currentFolderId, {
        $pull: { playlists: { $in: playlistIds } }
      });
    }

    // Add playlists to the new folder
    await PlaylistFolder.findByIdAndUpdate(folderId, {
      $addToSet: { playlists: { $each: playlistIds } }
    });

    // Update the folder reference in each playlist
    await Playlist.updateMany(
      { _id: { $in: playlistIds } },
      { $set: { folder: folderId } }
    );

    res.json({
      message: 'Playlists moved successfully',
      movedCount: playlistIds.length,
      targetFolder: folder.name
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove playlists from a folder
router.post('/:id/remove-playlists', auth, async (req, res) => {
  try {
    const { playlistIds } = req.body;
    const folderId = req.params.id;

    // Validate input
    if (!playlistIds || !Array.isArray(playlistIds) || playlistIds.length === 0) {
      return res.status(400).json({ message: 'Playlist IDs array is required' });
    }

    // Check if folder exists and user owns it
    const folder = await PlaylistFolder.findOne({
      _id: folderId,
      owner: req.user.id
    });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found or not owned by you' });
    }

    // Verify user owns all the playlists
    const playlists = await Playlist.find({
      _id: { $in: playlistIds },
      owner: req.user.id,
      folder: folderId
    });

    if (playlists.length === 0) {
      return res.status(404).json({ message: 'No matching playlists found in this folder' });
    }

    // Get actual playlist IDs that were found
    const validPlaylistIds = playlists.map(p => p._id);

    // Remove playlists from the folder
    await PlaylistFolder.findByIdAndUpdate(folderId, {
      $pull: { playlists: { $in: validPlaylistIds } }
    });

    // Update the folder reference in each playlist
    await Playlist.updateMany(
      { _id: { $in: validPlaylistIds } },
      { $set: { folder: null } }
    );

    res.json({
      message: 'Playlists removed from folder successfully',
      removedCount: validPlaylistIds.length,
      sourceFolder: folder.name
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search within a specific folder
router.get('/:id/search', auth, async (req, res) => {
  try {
    const folderId = req.params.id;
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Check if folder exists and user has access to it
    const folder = await PlaylistFolder.findOne({
      _id: folderId,
      $or: [
        { owner: req.user.id },
        { isPublic: true }
      ]
    });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found or access denied' });
    }

    // Search playlists in this folder
    const playlists = await Playlist.find({
      folder: folderId,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ],
      $and: [
        {
          $or: [
            { owner: req.user.id },
            { isPublic: true }
          ]
        }
      ]
    }).select('name description color coverImage owner isPublic stats');

    // Search child folders
    const childFolders = await PlaylistFolder.find({
      parentFolder: folderId,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ],
      $and: [
        {
          $or: [
            { owner: req.user.id },
            { isPublic: true }
          ]
        }
      ]
    }).select('name description owner isPublic');

    res.json({
      results: {
        playlists,
        childFolders
      },
      folder: {
        id: folder._id,
        name: folder.name
      },
      totalResults: playlists.length + childFolders.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;