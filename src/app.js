const express = require("express");
const cors = require("cors");
const path = require('path');
require("dotenv").config();
const connectDB = require("./config/database");
const authRoutes = require('./routes/auth');
const distributorRoutes = require('./routes/distributor');
const setupDevEnvironment = require('./utils/setupDev');
const trackRoutes = require('./routes/tracks');
const userRoutes = require('./routes/users');
const artistRoutes = require('./routes/artist');
const adminRoutes = require('./routes/admin');
const albumRoutes = require('./routes/albums');
const playlistRoutes = require('./routes/playlists');
const searchRoutes = require('./routes/search');
const followRoutes = require('./routes/follows');
const folderRoutes = require('./routes/folders');

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/music', express.static(path.join(__dirname, '../public/music')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// Test routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
console.log('Registering routes...');
app.use('/api/auth', authRoutes);
app.use('/api/distributor', distributorRoutes);
app.use('/api/tracks', trackRoutes);
app.use('/api/users', userRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/folders', folderRoutes);
console.log('Routes registered');

// Only run setup in development
if (process.env.NODE_ENV !== 'production') {
  setupDevEnvironment()
    .then(() => {
      console.log('Development environment setup complete');
    })
    .catch(console.error);
}

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
})

module.exports = app;