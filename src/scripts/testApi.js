const axios = require('axios');

// API base URL
const API_URL = 'http://localhost:3001/api';

// Test user registration
async function testUserRegistration() {
  try {
    console.log('Testing user registration...');

    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User'
    };

    const response = await axios.post(`${API_URL}/auth/register`, userData);

    console.log('Registration successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('Registration failed:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error:', error.message);
    }
  }
}

// Test user login
async function testUserLogin(email, password) {
  try {
    console.log('\nTesting user login...');

    const loginData = {
      email: email || 'test@example.com',
      password: password || 'Password123!'
    };

    const response = await axios.post(`${API_URL}/auth/login`, loginData);

    console.log('Login successful!');
    console.log('Token:', response.data.token);

    return response.data.token;
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

// Test get user profile
async function testGetProfile(token) {
  try {
    console.log('\nTesting get user profile...');

    const response = await axios.get(`${API_URL}/users/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

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

// Run the tests
async function runTests() {
  try {
    // Try to register (may fail if user already exists)
    await testUserRegistration();

    // Login should work regardless
    const token = await testUserLogin();

    if (token) {
      await testGetProfile(token);
    }

    console.log('\nTests completed!');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

runTests();