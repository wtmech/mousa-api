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

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

app.use('/music', express.static(path.join(__dirname, '../public/music')));

// Test routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/distributor', distributorRoutes);
app.use('/api/tracks', trackRoutes);
app.use('/api/users', userRoutes);

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