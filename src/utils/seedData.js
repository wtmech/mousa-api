const axios = require('axios');
const mongoose = require('mongoose');
const { Artist } = require('../models/Artist');
const Album = require('../models/Album');
const Track = require('../models/Track');
const dotenv = require('dotenv');
dotenv.config();

const LASTFM_API_KEY = process.env.LASTFM_API_KEY.trim();
const LASTFM_BASE_URL = 'http://ws.audioscrobbler.com/2.0/';
const MONGODB_URI = process.env.MONGODB_URI;

async function connectDB() {
  try {
    console.log('Attempting to connect to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('Successfully connected to MongoDB Atlas');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function getAlbumInfo(artist, album) {
  try {
    const response = await axios.get(LASTFM_BASE_URL, {
      params: {
        method: 'album.getinfo',
        artist: artist,
        album: album,
        api_key: LASTFM_API_KEY,
        format: 'json'
      }
    });
    return response.data.album;
  } catch (error) {
    console.error(`Error fetching album info for ${album}:`, error.message);
    return null;
  }
}

async function getArtistInfo(artistName) {
  try {
    const response = await axios.get(LASTFM_BASE_URL, {
      params: {
        method: 'artist.getinfo',
        artist: artistName,
        api_key: LASTFM_API_KEY,
        format: 'json'
      }
    });
    return response.data.artist;
  } catch (error) {
    console.error(`Error fetching artist info for ${artistName}:`, error.message);
    return null;
  }
}

async function seedData() {
  try {
    await connectDB();
    console.log('Starting to fetch top albums from Last.fm (US)...');

    // Changed to get top tracks from US
    const response = await axios.get(LASTFM_BASE_URL, {
      params: {
        method: 'geo.gettoptracks',
        country: 'united states',
        api_key: LASTFM_API_KEY,
        format: 'json',
        limit: 10
      }
    });

    // Get the tracks first
    const tracks = response.data.tracks?.track || [];
    console.log(`Found ${tracks.length} top tracks from the US`);

    // Process each track's album
    for (const trackData of tracks) {
      try {
        console.log(`\nProcessing track: ${trackData.name} by ${trackData.artist.name}`);

        // Get album info for this track
        const albumInfo = await axios.get(LASTFM_BASE_URL, {
          params: {
            method: 'track.getInfo',
            artist: trackData.artist.name,
            track: trackData.name,
            api_key: LASTFM_API_KEY,
            format: 'json'
          }
        });

        const albumName = albumInfo.data.track?.album?.title;
        if (!albumName) {
          console.log(`No album found for track: ${trackData.name}`);
          continue;
        }

        // Get detailed album info
        const fullAlbumInfo = await getAlbumInfo(trackData.artist.name, albumName);
        if (!fullAlbumInfo) continue;

        // Get artist info and create/update artist
        const artistInfo = await getArtistInfo(trackData.artist.name);
        if (!artistInfo) continue;

        // Create or update artist
        let artist = await Artist.findOne({ name: trackData.artist.name });
        if (!artist) {
          artist = new Artist({
            name: trackData.artist.name,
            bio: artistInfo.bio?.summary || '',
            genres: artistInfo.tags?.tag?.map(tag => tag.name) || [],
            socialLinks: {
              website: artistInfo.url
            },
            monthlyListeners: parseInt(artistInfo.stats?.listeners) || 0,
            totalPlays: parseInt(artistInfo.stats?.playcount) || 0
          });
          await artist.save();
          console.log(`Created new artist: ${artist.name}`);
        }

        // Create or update album
        let album = await Album.findOne({
          title: albumName,
          'artist': artist._id
        });

        if (!album) {
          album = new Album({
            title: albumName,
            artist: artist._id,
            releaseDate: new Date(),
            coverArt: fullAlbumInfo.image?.[3]?.['#text'] || null,
            description: fullAlbumInfo.wiki?.summary || '',
            genre: artistInfo.tags?.tag?.[0]?.name || 'Unknown',
            type: 'album',
            distributor: {
              name: 'Last.fm',
              uploadDate: new Date()
            },
            totalTracks: parseInt(fullAlbumInfo.tracks?.track?.length) || 0,
            plays: parseInt(fullAlbumInfo.playcount) || 0
          });
          await album.save();
          console.log(`Created new album: ${album.title}`);
        }

        // Add tracks from the album
        if (fullAlbumInfo.tracks && fullAlbumInfo.tracks.track) {
          const albumTracks = Array.isArray(fullAlbumInfo.tracks.track)
            ? fullAlbumInfo.tracks.track
            : [fullAlbumInfo.tracks.track];

          for (const albumTrackData of albumTracks) {
            try {
              let track = await Track.findOne({
                title: albumTrackData.name,
                artist: artist._id,
                album: album._id
              });

              if (!track) {
                track = new Track({
                  title: albumTrackData.name,
                  artist: artist._id,
                  album: album._id,
                  trackNumber: albumTrackData['@attr']?.rank || 1,
                  duration: parseInt(albumTrackData.duration) || 0,
                  genre: album.genre,
                  distributor: {
                    name: 'Last.fm',
                    uploadDate: new Date()
                  },
                  fileUrl: '/music/tracks/placeholder.mp3',
                  coverArt: album.coverArt,
                  plays: parseInt(albumTrackData.playcount) || 0
                });

                await track.save();
                console.log(`Added track: ${track.title}`);
              }
            } catch (error) {
              console.error(`Error adding track ${albumTrackData.name}:`, error.message);
              continue;
            }
          }
        }

      } catch (error) {
        console.error(`Error processing track:`, error.message);
        continue;
      }
    }

    // Final verification
    const artistCount = await Artist.countDocuments();
    const albumCount = await Album.countDocuments();
    const trackCount = await Track.countDocuments();

    console.log('\nSeeding Results:');
    console.log(`Total artists in database: ${artistCount}`);
    console.log(`Total albums in database: ${albumCount}`);
    console.log(`Total tracks in database: ${trackCount}`);

    // List all albums with their track counts
    const allAlbums = await Album.find({}).populate('artist', 'name');
    console.log('\nCurrent albums in database:');
    for (const album of allAlbums) {
      const trackCount = await Track.countDocuments({ album: album._id });
      console.log(`- "${album.title}" by ${album.artist.name} (${trackCount} tracks)`);
    }

    console.log('\nSeeding complete!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the seeding
seedData();