const axios = require('axios');

// API base URL
const API_URL = 'http://localhost:3001/api';
let token = null;

// Login as admin to get token
async function loginAsUser() {
  try {
    console.log('Logging in as a user...');
    
    const loginData = {
      email: 'test@example.com',
      password: 'Password123!'
    };
    
    const response = await axios.post(`${API_URL}/auth/login`, loginData);
    
    console.log('Login successful!');
    token = response.data.token;
    console.log('Token:', token);
    
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

// Apply to become an artist
async function applyToBeArtist() {
  try {
    console.log('\nApplying to become an artist...');
    
    const artistData = {
      artistName: 'Test Artist',
      genre: 'Pop, Electronic, Indie',
      bio: 'This is a test artist account for an amazing musician who creates beautiful soundscapes.'
    };
    
    const response = await axios.post(
      `${API_URL}/exclusive-content/apply`, 
      artistData,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('Artist application submitted successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Artist application failed:');
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

// Get user profile to see artist reference
async function getUserProfile() {
  try {
    console.log('\nGetting user profile to check artist status...');
    
    const response = await axios.get(
      `${API_URL}/users/profile`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('Profile retrieved successfully!');
    console.log('User Profile:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Profile retrieval failed:');
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

// Search for artists
async function searchArtists() {
  try {
    console.log('\nSearching for artists...');
    
    const response = await axios.get(
      `${API_URL}/search/artists?q=Test`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('Artist search successful!');
    console.log('Found Artists:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Artist search failed:');
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
    await loginAsUser();
    
    if (token) {
      // Apply to become an artist
      await applyToBeArtist();
      
      // Get user profile to see artist status
      await getUserProfile();
      
      // Search for artists
      await searchArtists();
    }
    
    console.log('\nArtist API tests completed!');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

runTests(); 