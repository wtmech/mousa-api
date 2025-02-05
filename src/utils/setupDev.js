const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Playlist = require('../models/Playlist');

const setupDevEnvironment = async () => {
  try {
    // Create music directories if they don't exist
    const musicPath = path.join(__dirname, '../../public/music/tracks');
    const coversPath = path.join(__dirname, '../../public/music/covers');

    if (!fs.existsSync(musicPath)) {
      fs.mkdirSync(musicPath, { recursive: true });
      console.log('Created tracks directory:', musicPath);
    }

    if (!fs.existsSync(coversPath)) {
      fs.mkdirSync(coversPath, { recursive: true });
      console.log('Created covers directory:', coversPath);
    }

    // Create dev user if doesn't exist
    const devUser = await User.findOne({ email: 'dev@example.com' });

    if (!devUser) {
      const user = new User({
        firstName: 'Dev',
        lastName: 'User',
        username: 'devuser',
        email: 'dev@example.com',
        password: 'development123',
        isAdmin: true  // Only setting admin privileges
      });

      await user.save();
      console.log('Development user created with ID:', user._id);

      // Create or update .env file with DEV_USER_ID
      const envPath = path.join(__dirname, '../../.env');
      const envContent = fs.readFileSync(envPath, 'utf8');
      const updatedContent = envContent.includes('DEV_USER_ID')
        ? envContent.replace(/DEV_USER_ID=.*/g, `DEV_USER_ID=${user._id}`)
        : envContent + `\nDEV_USER_ID=${user._id}`;

      fs.writeFileSync(envPath, updatedContent);

      // Create Liked Songs playlist
      const likedSongsPlaylist = new Playlist({
        name: 'Liked Songs',
        owner: user._id,
        isSystem: true,
        color: '#0D5EAF'
      });

      await likedSongsPlaylist.save();
      console.log('Liked Songs playlist created with ID:', likedSongsPlaylist._id);
    } else {
      console.log('Development user already exists with ID:', devUser._id);
    }

    console.log('Development environment setup complete');
  } catch (error) {
    console.error('Setup error:', error);
  }
};

module.exports = setupDevEnvironment;
