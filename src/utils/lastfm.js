const axios = require('axios');

const LASTFM_API_URL = 'http://ws.audioscrobbler.com/2.0/';
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;

const getTopTracks = async (limit = 10) => {
  try {
    const response = await axios.get(LASTFM_API_URL, {
      params: {
        method: 'chart.gettoptracks',
        api_key: LASTFM_API_KEY,
        format: 'json',
        limit
      }
    });

    return response.data.tracks.track.map(track => ({
      title: track.name,
      artist: track.artist.name,
      playcount: parseInt(track.playcount),
      listeners: parseInt(track.listeners),
      url: track.url
    }));
  } catch (error) {
    console.error('Error fetching top tracks from Last.fm:', error);
    throw new Error('Failed to fetch top tracks');
  }
};

const searchTracks = async (query, limit = 10) => {
  try {
    const response = await axios.get(LASTFM_API_URL, {
      params: {
        method: 'track.search',
        track: query,
        api_key: LASTFM_API_KEY,
        format: 'json',
        limit
      }
    });

    return response.data.results.trackmatches.track.map(track => ({
      title: track.name,
      artist: track.artist,
      listeners: parseInt(track.listeners),
      url: track.url
    }));
  } catch (error) {
    console.error('Error searching tracks on Last.fm:', error);
    throw new Error('Failed to search tracks');
  }
};

const getArtistInfo = async (artistName) => {
  try {
    const response = await axios.get(LASTFM_API_URL, {
      params: {
        method: 'artist.getinfo',
        artist: artistName,
        api_key: LASTFM_API_KEY,
        format: 'json'
      }
    });

    const artist = response.data.artist;
    return {
      name: artist.name,
      bio: artist.bio.content,
      tags: artist.tags.tag.map(tag => tag.name),
      similar: artist.similar.artist.map(similar => similar.name),
      stats: {
        listeners: parseInt(artist.stats.listeners),
        playcount: parseInt(artist.stats.playcount)
      }
    };
  } catch (error) {
    console.error('Error fetching artist info from Last.fm:', error);
    throw new Error('Failed to fetch artist info');
  }
};

module.exports = {
  getTopTracks,
  searchTracks,
  getArtistInfo
};