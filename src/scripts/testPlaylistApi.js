const axios = require('axios');

// API base URL
const API_URL = 'http://localhost:3001/api';
let token = null;

// Login to get token
async function login() {
  try {
    console.log('Logging in...');

    const loginData = {
      email: 'test@example.com',
      password: 'Password123!'
    };

    const response = await axios.post(`${API_URL}/auth/login`, loginData);

    console.log('Login successful!');
    token = response.data.token;
    console.log('Token:', token.substring(0, 20) + '...');

    return token;
  } catch (error) {
    console.error('Login failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Create a playlist
async function createPlaylist() {
  try {
    console.log('\nCreating a playlist...');

    const playlistData = {
      name: 'My Test Playlist',
      description: 'A collection of my favorite songs for testing',
      isPublic: true
    };

    const response = await axios.post(
      `${API_URL}/playlists`,
      playlistData,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('Playlist created successfully!');
    console.log('Playlist:', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('Playlist creation failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Get user's playlists
async function getUserPlaylists() {
  try {
    console.log('\nGetting user playlists...');

    const response = await axios.get(
      `${API_URL}/playlists/me`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('User playlists retrieved successfully!');
    console.log('Playlists:', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('Getting playlists failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Get public playlists
async function getPublicPlaylists() {
  try {
    console.log('\nGetting public playlists...');

    const response = await axios.get(
      `${API_URL}/playlists/public`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('Public playlists retrieved successfully!');
    console.log('Playlists:', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('Getting public playlists failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Search for playlists
async function searchPlaylists() {
  try {
    console.log('\nSearching for playlists...');

    const response = await axios.get(
      `${API_URL}/search/playlists?q=Test`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('Playlist search successful!');
    console.log('Found Playlists:', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('Playlist search failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the tests
async function runTests() {
  try {
    // Login to get token
    await login();

    if (token) {
      // Create a playlist
      const playlist = await createPlaylist();

      // Get user's playlists
      await getUserPlaylists();

      // Get public playlists
      await getPublicPlaylists();

      // Search for playlists
      await searchPlaylists();
    }

    console.log('\nPlaylist API tests completed!');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

runTests();