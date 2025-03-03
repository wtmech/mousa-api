const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

// API base URL
const API_URL = 'http://localhost:3001/api';
let token = null;
let trackId = null;
let playlistId = null;

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

// Create a sample audio file (we'll simulate this by creating a text file)
async function createSampleAudioFile() {
  try {
    console.log('\nCreating a sample audio file...');

    const filePath = path.join(__dirname, 'sample_track.txt');
    fs.writeFileSync(filePath, 'This is a simulated audio file for testing purposes.');

    console.log('Sample file created at:', filePath);
    return filePath;
  } catch (error) {
    console.error('Error creating sample file:', error);
  }
}

// Upload a track
async function uploadTrack(filePath) {
  try {
    console.log('\nUploading a track...');

    const form = new FormData();
    form.append('title', 'Sample Test Track');
    form.append('artist', '67c4fb4e9b2b1701c1107251'); // Artist ID from previous test
    form.append('genre', 'Pop');
    // Add required fields based on the Track model
    form.append('distributor[name]', 'Test Distributor');
    form.append('audioFile', fs.createReadStream(filePath));

    const response = await axios.post(
      `${API_URL}/tracks`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('Track uploaded successfully!');
    console.log('Track:', JSON.stringify(response.data, null, 2));

    trackId = response.data._id;
    return response.data;
  } catch (error) {
    console.error('Track upload failed:');
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
    console.log('\nGetting user playlists to find an existing playlist...');

    const response = await axios.get(
      `${API_URL}/playlists/me`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('User playlists retrieved successfully!');

    if (response.data.created && response.data.created.length > 0) {
      playlistId = response.data.created[0]._id;
      console.log(`Selected playlist ID: ${playlistId}`);
      return playlistId;
    } else {
      console.log('No existing playlists found. Creating a new one...');
      return await createPlaylist();
    }
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

// Create a playlist if needed
async function createPlaylist() {
  try {
    console.log('\nCreating a new playlist...');

    const playlistData = {
      name: 'My Track Test Playlist',
      description: 'A playlist for testing track uploads',
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
    playlistId = response.data._id;
    console.log(`New playlist ID: ${playlistId}`);

    return playlistId;
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

// Add track to playlist
async function addTrackToPlaylist() {
  if (!trackId || !playlistId) {
    console.error('Missing track ID or playlist ID. Cannot add track to playlist.');
    return;
  }

  try {
    console.log(`\nAdding track ${trackId} to playlist ${playlistId}...`);

    const response = await axios.post(
      `${API_URL}/playlists/${playlistId}/tracks`,
      { trackId },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('Track added to playlist successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('Adding track to playlist failed:');
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

// Get playlist details to verify track was added
async function getPlaylistDetails() {
  if (!playlistId) {
    console.error('Missing playlist ID. Cannot get playlist details.');
    return;
  }

  try {
    console.log(`\nGetting details for playlist ${playlistId}...`);

    const response = await axios.get(
      `${API_URL}/playlists/${playlistId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('Playlist details retrieved successfully!');
    console.log('Playlist with tracks:', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('Getting playlist details failed:');
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

// Clean up the sample file
async function cleanUp(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('\nCleaned up sample audio file.');
    }
  } catch (error) {
    console.error('Error cleaning up sample file:', error);
  }
}

// Run the tests
async function runTests() {
  let sampleFilePath = null;

  try {
    // Login to get token
    await login();

    if (token) {
      // Create a sample audio file
      sampleFilePath = await createSampleAudioFile();

      if (sampleFilePath) {
        // Upload the track
        await uploadTrack(sampleFilePath);

        if (trackId) {
          // Get or create a playlist
          await getUserPlaylists();

          if (playlistId) {
            // Add track to playlist
            await addTrackToPlaylist();

            // Verify track was added to playlist
            await getPlaylistDetails();
          }
        }

        // Clean up
        await cleanUp(sampleFilePath);
      }
    }

    console.log('\nTrack upload and playlist management tests completed!');
  } catch (error) {
    console.error('Error running tests:', error);
    // Attempt cleanup even if test fails
    if (sampleFilePath) {
      await cleanUp(sampleFilePath);
    }
  }
}

runTests();