const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const createUploadDirs = () => {
  const dirs = ['tracks', 'covers', 'avatars', 'content'];
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, `../../uploads/${dir}`);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
};

createUploadDirs();

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = '../../uploads/';

    if (file.fieldname === 'track') {
      uploadPath += 'tracks';
    } else if (file.fieldname === 'cover') {
      uploadPath += 'covers';
    } else if (file.fieldname === 'avatar') {
      uploadPath += 'avatars';
    } else if (file.fieldname === 'media') {
      uploadPath += 'content';
    }

    cb(null, path.join(__dirname, uploadPath));
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'track') {
    // Allow only mp3 files for tracks
    if (file.mimetype === 'audio/mpeg') {
      cb(null, true);
    } else {
      cb(new Error('Only MP3 files are allowed!'), false);
    }
  } else if (file.fieldname === 'cover' || file.fieldname === 'avatar') {
    // Allow images for covers and avatars
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  } else if (file.fieldname === 'media') {
    // Allow various media types for exclusive content
    const allowedMimeTypes = [
      // Audio
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/aac', 'audio/ogg',
      // Video
      'video/mp4', 'video/webm', 'video/ogg',
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      // Documents
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Archives
      'application/zip', 'application/x-rar-compressed'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type!'), false);
    }
  } else {
    cb(new Error('Invalid field name!'), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: function(req, file) {
      if (file.fieldname === 'track') {
        return 50 * 1024 * 1024; // 50MB for tracks
      } else if (file.fieldname === 'media') {
        if (file.mimetype.startsWith('video/')) {
          return 500 * 1024 * 1024; // 500MB for videos
        } else if (file.mimetype.startsWith('audio/')) {
          return 50 * 1024 * 1024; // 50MB for audio
        } else if (file.mimetype.startsWith('application/')) {
          return 100 * 1024 * 1024; // 100MB for documents and archives
        }
      }
      return 5 * 1024 * 1024; // 5MB for images and other files
    }
  }
});

// Export configured multer instances for different upload types
module.exports = {
  uploadTrack: upload.single('track'),
  uploadCover: upload.single('cover'),
  uploadAvatar: upload.single('avatar'),
  uploadMedia: upload.single('media'),
  uploadTrackWithCover: upload.fields([
    { name: 'track', maxCount: 1 },
    { name: 'cover', maxCount: 1 }
  ])
};