const mongoose = require('mongoose');
const { Artist } = require('../models/Artist');
require('dotenv').config();

async function updateArtists() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully!');

    // Get current artists
    const beforeCount = await Artist.countDocuments();
    console.log(`Found ${beforeCount} artists`);

    // Update all artists to ensure they have subscriberCount
    const result = await Artist.updateMany(
      { subscriberCount: { $exists: false } },
      { $set: { subscriberCount: 0 } }
    );

    console.log('Update result:', {
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

    // Reset all subscriberCounts to 0
    const resetResult = await Artist.updateMany(
      {},
      { $set: { subscriberCount: 0 } }
    );

    console.log('Reset result:', {
      matched: resetResult.matchedCount,
      modified: resetResult.modifiedCount
    });

    console.log('Update completed successfully!');

    mongoose.connection.close();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Error during update:', error);
    mongoose.connection.close();
    console.log('Database connection closed due to error.');
  }
}

updateArtists();