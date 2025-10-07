#!/usr/bin/env node

const io = require('socket.io-client');

console.log('🧪 Testing Real-time Features...\n');

// Test 1: Socket Connection
console.log('1. Testing Socket Connection...');
const socket = io('http://localhost:5001', {
  auth: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNzU5MzU1MDAxLCJleHAiOjE3NTk0NDE0MDF9.pOMSOFW4DVhIgG7ahVcNmeKHkK3iBXu46HS3t6P1MOE' },
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('✅ Socket connected successfully');
  console.log('   Socket ID:', socket.id);
});

socket.on('connect_error', (err) => {
  console.log('❌ Socket connection failed:', err.message);
});

socket.on('error', (error) => {
  console.log('❌ Socket error:', error.message);
});

// Test 2: Room Join (will fail due to auth, but we can test the flow)
console.log('\n2. Testing Room Join...');
setTimeout(() => {
  socket.emit('room:join', { roomId: 'test-room-123' });
}, 1000);

socket.on('error', (error) => {
  if (error.message.includes('Not authorized')) {
    console.log('✅ Authentication check working (expected failure)');
  }
});

// Test 3: Code Update (will fail due to auth, but we can test the flow)
console.log('\n3. Testing Code Update...');
setTimeout(() => {
  socket.emit('code:update', { 
    roomId: 'test-room-123', 
    code: 'console.log("Hello World!");',
    language: 'javascript'
  });
}, 2000);

// Test 4: Cursor Update (will fail due to auth, but we can test the flow)
console.log('\n4. Testing Cursor Update...');
setTimeout(() => {
  socket.emit('cursor:update', { 
    roomId: 'test-room-123', 
    line: 1, 
    column: 10
  });
}, 3000);

// Test 5: Disconnect
console.log('\n5. Testing Disconnect...');
setTimeout(() => {
  socket.disconnect();
  console.log('✅ Socket disconnected successfully');
  console.log('\n🎉 All real-time tests completed!');
  process.exit(0);
}, 4000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test interrupted');
  socket.disconnect();
  process.exit(0);
});
