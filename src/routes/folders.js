const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Folder = require('../models/Folder');
const Playlist = require('../models/Playlist');
const mongoose = require('mongoose');

// Create a new folder
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, parentFolder, color, isPrivate } = req.body;

    // Create folder object without parentFolder first
    const folderData = {
      name,
      description,
      color,
      isPrivate,
      owner: req.user._id,
      playlists: []
    };

    // Only add parentFolder if it's a valid MongoDB ObjectId
    if (parentFolder && mongoose.Types.ObjectId.isValid(parentFolder)) {
      const parent = await Folder.findOne({
        _id: parentFolder,
        owner: req.user._id
      });
      if (!parent) {
        return res.status(404).json({ message: 'Parent folder not found' });
      }
      folderData.parentFolder = parentFolder;
    }

    const folder = new Folder(folderData);
    await folder.save();
    res.status(201).json(folder);
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all root folders for user
router.get('/', auth, async (req, res) => {
  try {
    const folders = await Folder.find({
      owner: req.user._id,
      parentFolder: null
    })
      .populate('playlists', 'name')
      .lean();

    res.json(folders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get specific folder and its contents
router.get('/:folderId', auth, async (req, res) => {
  try {
    const folder = await Folder.findOne({
      _id: req.params.folderId,
      owner: req.user._id
    })
      .populate('playlists', 'name')
      .populate('parentFolder', 'name')
      .lean();

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // Get subfolders
    const subfolders = await Folder.find({
      parentFolder: folder._id
    }).select('name').lean();

    res.json({
      ...folder,
      subfolders
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add playlist to folder
router.post('/:folderId/playlists/:playlistId', auth, async (req, res) => {
  try {
    const folder = await Folder.findOne({
      _id: req.params.folderId,
      owner: req.user._id
    });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const playlist = await Playlist.findOne({
      _id: req.params.playlistId,
      owner: req.user._id
    });

    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    if (folder.playlists.includes(playlist._id)) {
      return res.status(400).json({ message: 'Playlist already in folder' });
    }

    folder.playlists.push(playlist._id);
    await folder.save();

    res.json({ message: 'Playlist added to folder' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove playlist from folder
router.delete('/:folderId/playlists/:playlistId', auth, async (req, res) => {
  try {
    const folder = await Folder.findOne({
      _id: req.params.folderId,
      owner: req.user._id
    });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    folder.playlists = folder.playlists.filter(
      id => id.toString() !== req.params.playlistId
    );
    await folder.save();

    res.json({ message: 'Playlist removed from folder' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update folder
router.patch('/:folderId', auth, async (req, res) => {
  try {
    const allowedUpdates = ['name', 'description', 'color', 'isPrivate'];
    const updates = Object.keys(req.body);
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      return res.status(400).json({ message: 'Invalid updates' });
    }

    const folder = await Folder.findOneAndUpdate(
      {
        _id: req.params.folderId,
        owner: req.user._id
      },
      { $set: req.body },
      { new: true }  // Return the updated document
    );

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    res.json(folder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete folder
router.delete('/:folderId', auth, async (req, res) => {
  try {
    const folder = await Folder.findOne({
      _id: req.params.folderId,
      owner: req.user._id
    });

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // Move any subfolders to root level
    await Folder.updateMany(
      { parentFolder: folder._id },
      { $set: { parentFolder: null } }
    );

    // Delete the folder
    await Folder.deleteOne({ _id: folder._id });

    res.json({ message: 'Folder deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;