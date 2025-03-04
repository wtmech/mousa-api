require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Artist = require('../models/Artist');
const Album = require('../models/Album');
const Track = require('../models/Track');

// Last.fm API credentials - using the one in your .env file
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

/**
 * Fetch top tracks from Last.fm
 */
async function fetchTopTracks(limit = 50) {
  try {
    const response = await axios.get(LASTFM_API_URL, {
      params: {
        method: 'chart.getTopTracks',
        api_key: LASTFM_API_KEY,
        limit: limit,
        format: 'json'
      }
    });

    return response.data.tracks.track;
  } catch (error) {
    console.error('Error fetching top tracks from Last.fm:', error.message);
    return [];
  }
}

/**
 * Fetch album info for a track
 */
async function fetchAlbumInfo(artist, track) {
  try {
    const response = await axios.get(LASTFM_API_URL, {
      params: {
        method: 'track.getInfo',
        api_key: LASTFM_API_KEY,
        artist: artist,
        track: track,
        format: 'json'
      }
    });

    if (response.data.track && response.data.track.album) {
      return response.data.track.album;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching album info for ${track} by ${artist}:`, error.message);
    return null;
  }
}

/**
 * Fetch artist info
 */
async function fetchArtistInfo(artistName) {
  try {
    const response = await axios.get(LASTFM_API_URL, {
      params: {
        method: 'artist.getInfo',
        api_key: LASTFM_API_KEY,
        artist: artistName,
        format: 'json'
      }
    });

    if (response.data.artist) {
      return response.data.artist;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching artist info for ${artistName}:`, error.message);
    return null;
  }
}

/**
 * Process track data and save to database
 */
async function processAndSaveTrack(trackData) {
  try {
    // Check if we already have this artist
    let artist = await Artist.findOne({ name: trackData.artist.name });

    if (!artist) {
      // Fetch more detailed artist info
      const artistInfo = await fetchArtistInfo(trackData.artist.name);

      // Create new artist
      artist = new Artist({
        name: trackData.artist.name,
        biography: artistInfo ? artistInfo.bio?.summary?.split('<a href')[0] : '',
        imageUrl: artistInfo?.image?.find(img => img.size === 'extralarge')?.['#text'] || '',
        genres: artistInfo?.tags?.tag?.map(tag => tag.name) || [],
        popularity: Math.floor(Math.random() * 100), // Simulate popularity score
        socialLinks: {},
        verified: Math.random() > 0.7 // Some artists are randomly verified
      });

      await artist.save();
      console.log(`Created artist: ${artist.name}`);
    }

    // Get album info
    const albumInfo = await fetchAlbumInfo(trackData.artist.name, trackData.name);
    let album;

    if (albumInfo) {
      // Check if we already have this album
      album = await Album.findOne({
        title: albumInfo.title,
        artist: artist._id
      });

      if (!album) {
        // Get cover art from album info or use a placeholder
        const coverImageUrl = albumInfo.image?.find(img => img.size === 'extralarge')?.['#text'] || '';

        // Create new album with required fields
        album = new Album({
          title: albumInfo.title,
          artist: artist._id,
          releaseDate: new Date(Date.now() - Math.random() * 5 * 365 * 24 * 60 * 60 * 1000), // Random date within past 5 years
          coverArt: coverImageUrl || 'https://placehold.co/400x400?text=No+Cover', // Set a placeholder if no image
          type: Math.random() > 0.7 ? 'album' : 'single', // lowercase to match enum values
          genres: artist.genres,
          tracks: [], // Will add track ID after saving the track
          distributor: {
            name: 'Last.fm Seed Data' // Add required distributor name
          }
        });

        await album.save();
        console.log(`Created album: ${album.title} by ${artist.name}`);
      }
    }

    // Check if we already have this track
    let track = await Track.findOne({
      title: trackData.name,
      artist: artist._id
    });

    if (!track) {
      // Create new track with required fields
      track = new Track({
        title: trackData.name,
        artist: artist._id,
        album: album ? album._id : null,
        duration: Math.floor(180 + Math.random() * 180), // Random duration between 3-6 minutes (in seconds)
        releaseDate: album ? album.releaseDate : new Date(Date.now() - Math.random() * 5 * 365 * 24 * 60 * 60 * 1000),
        genres: artist.genres,
        fileUrl: '/placeholder.mp3', // Required placeholder
        coverArt: album?.coverArt || 'https://placehold.co/400x400?text=No+Cover',
        streamCount: Math.floor(1000 + Math.random() * 1000000), // Random stream count
        isExplicit: Math.random() > 0.8, // Some tracks are randomly marked explicit
        language: 'English',
        distributor: {
          name: 'Last.fm Seed Data' // Add required distributor name
        }
      });

      await track.save();
      console.log(`Created track: ${track.title} by ${artist.name}`);

      // Update album with track if needed
      if (album) {
        album.tracks.push(track._id);
        await album.save();
      }
    }

    return true;
  } catch (error) {
    console.error(`Error processing track ${trackData.name}:`, error);
    return false;
  }
}

/**
 * Main function to seed database with Last.fm data
 */
async function seedLastFmData() {
  try {
    console.log('Starting to seed database with Last.fm data...');

    // Fetch top tracks
    const topTracks = await fetchTopTracks(50);
    console.log(`Fetched ${topTracks.length} tracks from Last.fm`);

    // Process each track
    let successCount = 0;

    for (let i = 0; i < topTracks.length; i++) {
      console.log(`Processing track ${i+1}/${topTracks.length}: ${topTracks[i].name}`);
      const success = await processAndSaveTrack(topTracks[i]);
      if (success) successCount++;

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Database seeding complete. Successfully added ${successCount} tracks.`);
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    // Close the database connection
    mongoose.connection.close();
  }
}

// Run the seeding function
seedLastFmData();