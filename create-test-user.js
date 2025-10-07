#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Create a test user
const testUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  name: 'Test User',
  password: 'password123'
};

// Hash password
const hashedPassword = bcrypt.hashSync(testUser.password, 10);

console.log('🔐 Test User Credentials:');
console.log('Email:', testUser.email);
console.log('Password:', testUser.password);
console.log('Hashed Password:', hashedPassword);

// Create JWT token
const token = jwt.sign(
  { userId: testUser.id, email: testUser.email },
  'your-super-secret-jwt-key-change-this-in-production',
  { expiresIn: '24h' }
);

console.log('\n🎫 JWT Token:');
console.log(token);

console.log('\n📝 Add this user to your database manually or use the registration API');
console.log('Then use the JWT token above to test real-time features');

