const User = require('../models/User');
const path = require('path');
const fs = require('fs');

const setupDevEnvironment = async () => {
  try {
    // Create music directories if they don't exist
    const musicPath = path.join(__dirname, '../../public/music/tracks');
    const coversPath = path.join(__dirname, '../../public/music/covers');

    if (!fs.existsSync(musicPath)) {
      fs.mkdirSync(musicPath, { recursive: true });
    }
    if (!fs.existsSync(coversPath)) {
      fs.mkdirSync(coversPath, { recursive: true });
    }

    // Create dev user if doesn't exist
    const devUser = await User.findOne({ email: 'dev@example.com' });

    if (!devUser) {
      const user = new User({
        username: 'devartist',
        email: 'dev@example.com',
        password: 'development123',
        isArtist: true,
        artistProfile: {
          verifiedBy: 'Local Development',
          verificationDate: new Date()
        }
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
    } else {
      console.log('Development user already exists with ID:', devUser._id);
    }

  } catch (error) {
    console.error('Setup error:', error);
  }
};

module.exports = setupDevEnvironment;