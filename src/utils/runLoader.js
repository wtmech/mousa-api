require('dotenv').config();
const mongoose = require('mongoose');
const loadLocalMusic = require('./loadMusic');

const runLoader = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Load the music
    console.log('Starting music load...');
    await loadLocalMusic();

    // Log results
    const Track = require('../models/Track');
    const trackCount = await Track.countDocuments();
    console.log(`Music loading complete. Total tracks: ${trackCount}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

runLoader();