require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../utils/dbConnect');

async function testConnection() {
  try {
    // Show environment variable for debugging
    console.log('MONGODB_URI:', process.env.MONGODB_URI);

    // Connect to MongoDB
    await connectDB();
    console.log('Successfully connected to MongoDB');

    // Test a simple operation
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nDatabase collections:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });

    // Get counts
    console.log('\nCollection stats:');
    for (const collection of collections) {
      const count = await mongoose.connection.db.collection(collection.name).countDocuments();
      console.log(`- ${collection.name}: ${count} documents`);
    }

    console.log('\nDatabase connection test completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Database connection test failed:', error);
    process.exit(1);
  }
}

// Run the test
testConnection();