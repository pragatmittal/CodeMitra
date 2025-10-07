#!/usr/bin/env node

const io = require('socket.io-client');
const fetch = require('node-fetch').default;

console.log('🧪 Testing Real-time Features with User Registration...\n');

// Step 1: Register a test user
console.log('1. Registering test user...');
const registerUser = async () => {
  try {
    const response = await fetch('http://localhost:5001/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('✅ User registered successfully');
      return data.data.token;
    } else {
      console.log('❌ Registration failed:', data.error);
      return null;
    }
  } catch (error) {
    console.log('❌ Registration error:', error.message);
    return null;
  }
};

// Step 2: Test Socket Connection
const testSocketConnection = async (token) => {
  return new Promise((resolve) => {
    console.log('\n2. Testing Socket Connection...');
    const socket = io('http://localhost:5001', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected successfully');
      console.log('   Socket ID:', socket.id);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      console.log('❌ Socket connection failed:', err.message);
      resolve(null);
    });

    socket.on('error', (error) => {
      console.log('❌ Socket error:', error.message);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!socket.connected) {
        console.log('❌ Socket connection timeout');
        resolve(null);
      }
    }, 5000);
  });
};

// Step 3: Test Room Operations
const testRoomOperations = async (socket) => {
  if (!socket) return;

  console.log('\n3. Testing Room Operations...');
  
  // Test room join (will fail because room doesn't exist, but tests the flow)
  socket.emit('room:join', { roomId: 'test-room-123' });
  
  socket.on('error', (error) => {
    if (error.message.includes('Not authorized')) {
      console.log('✅ Room join authentication check working (expected failure)');
    }
  });

  // Test code update
  setTimeout(() => {
    socket.emit('code:update', { 
      roomId: 'test-room-123', 
      code: 'console.log("Hello World!");',
      language: 'javascript'
    });
    console.log('✅ Code update event sent');
  }, 1000);

  // Test cursor update
  setTimeout(() => {
    socket.emit('cursor:update', { 
      roomId: 'test-room-123', 
      line: 1, 
      column: 10
    });
    console.log('✅ Cursor update event sent');
  }, 2000);

  // Test disconnect
  setTimeout(() => {
    socket.disconnect();
    console.log('✅ Socket disconnected successfully');
  }, 3000);
};

// Main test flow
const runTests = async () => {
  try {
    const token = await registerUser();
    if (!token) {
      console.log('\n❌ Cannot proceed without valid token');
      return;
    }

    const socket = await testSocketConnection(token);
    if (socket) {
      await testRoomOperations(socket);
    }

    console.log('\n🎉 All real-time tests completed!');
  } catch (error) {
    console.log('\n❌ Test error:', error.message);
  }
};

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test interrupted');
  process.exit(0);
});

// Run tests
runTests();
