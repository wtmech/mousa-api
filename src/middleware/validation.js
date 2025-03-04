/**
 * Validation middleware for request data
 */

/**
 * Validates that a color is in proper hex format
 * Accepts #RGB or #RRGGBB format
 */
const validateColor = (req, res, next) => {
  const { color } = req.body;

  if (color) {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(color)) {
      return res.status(400).json({
        message: 'Invalid color format. Use hex format (e.g., #FF5733)'
      });
    }
  }

  next();
};

/**
 * Validates folder structure to prevent circular references
 */
const validateFolderStructure = async (req, res, next) => {
  const { parentFolder } = req.body;
  const folderId = req.params.id;

  // Only do validation if we're updating a folder and changing its parent
  if (parentFolder && folderId) {
    try {
      const PlaylistFolder = require('../models/PlaylistFolder');

      // Can't set a folder as its own parent
      if (parentFolder === folderId) {
        return res.status(400).json({ message: 'Cannot set folder as its own parent' });
      }

      // Check if new parent exists
      const parent = await PlaylistFolder.findById(parentFolder);
      if (!parent) {
        return res.status(404).json({ message: 'Parent folder not found' });
      }

      // Check for ownership
      if (parent.owner.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to use this parent folder' });
      }

      // Check for circular reference
      let currentParent = parent;
      const visitedIds = new Set();

      while (currentParent.parentFolder) {
        // Avoid infinite loop if data is corrupt
        if (visitedIds.has(currentParent.parentFolder.toString())) {
          return res.status(400).json({
            message: 'Circular reference detected in existing folders'
          });
        }

        visitedIds.add(currentParent.parentFolder.toString());

        // If this would create a circular reference
        if (currentParent.parentFolder.toString() === folderId) {
          return res.status(400).json({
            message: 'Cannot create circular folder reference'
          });
        }

        currentParent = await PlaylistFolder.findById(currentParent.parentFolder);
        if (!currentParent) break;
      }
    } catch (err) {
      return res.status(500).json({ message: 'Error validating folder structure' });
    }
  }

  next();
};

module.exports = {
  validateColor,
  validateFolderStructure
};