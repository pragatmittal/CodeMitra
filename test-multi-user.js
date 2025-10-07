#!/usr/bin/env node

const io = require('socket.io-client');
const fetch = require('node-fetch').default;

console.log('🧪 Testing Multi-User Real-time Features...\n');

// Test with two users
const USER1_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0MWE0Y2Q0Yy1iZDAwLTQyN2EtYmZmMC0xNWNjY2UzOGRkZTEiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE3NTkzOTA2NzAsImV4cCI6MTc1OTk5NTQ3MH0.aKA4lEc_MX4lAXKn37v_-MpDThq74-ehdv6mHVSujA4';

// Create second user
const createSecondUser = async () => {
  try {
    const response = await fetch('http://localhost:5001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User 2',
        email: 'testuser4@example.com',
        password: 'password123'
      })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('✅ Second user created');
      return data.token;
    } else {
      console.log('❌ Second user creation failed:', data.error);
      return null;
    }
  } catch (error) {
    console.log('❌ Second user creation error:', error.message);
    return null;
  }
};

// Test user count updates
const testUserCountUpdates = async () => {
  console.log('\n🔄 Testing User Count Updates...');
  
  // Create second user
  const user2Token = await createSecondUser();
  if (!user2Token) return;
  
  // Create room with user 1
  const roomResponse = await fetch('http://localhost:5001/api/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${USER1_TOKEN}`,
    },
    body: JSON.stringify({
      name: 'Multi-User Test Room',
      description: 'Testing user count updates',
      language: 'javascript',
      isPublic: true,
      maxUsers: 5
    })
  });
  
  const roomData = await roomResponse.json();
  if (!roomData.success) {
    console.log('❌ Room creation failed:', roomData.error);
    return;
  }
  
  const roomId = roomData.data.id;
  console.log('✅ Room created:', roomId);
  
  // User 1 joins room
  const user1Socket = io('http://localhost:5001', {
    auth: { token: USER1_TOKEN },
    transports: ['websocket', 'polling']
  });
  
  let user1ParticipantCount = 0;
  let user2ParticipantCount = 0;
  
  user1Socket.on('connect', () => {
    console.log('✅ User 1 connected');
    user1Socket.emit('room:join', { roomId });
  });
  
  user1Socket.on('room:state', (data) => {
    user1ParticipantCount = data.participants?.length || 0;
    console.log(`📊 User 1 sees ${user1ParticipantCount} participants in room:state`);
  });
  
  user1Socket.on('user:joined', (data) => {
    user1ParticipantCount = data.count;
    console.log(`📊 User 1 sees user joined, count now: ${user1ParticipantCount}`);
  });
  
  user1Socket.on('room:users', (data) => {
    user1ParticipantCount = data.users?.length || 0;
    console.log(`📊 User 1 sees room:users, count now: ${user1ParticipantCount}`);
  });
  
  // User 2 joins room after 2 seconds
  setTimeout(async () => {
    // First, add User 2 as a participant to the room
    console.log('🔄 Adding User 2 as participant...');
    try {
      const joinResponse = await fetch(`http://localhost:5001/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user2Token}`,
        }
      });
      
      const joinData = await joinResponse.json();
      if (joinData.success) {
        console.log('✅ User 2 added as participant');
      } else {
        console.log('❌ Failed to add User 2 as participant:', joinData.error);
        return;
      }
    } catch (error) {
      console.log('❌ Error adding User 2 as participant:', error.message);
      return;
    }
    
    const user2Socket = io('http://localhost:5001', {
      auth: { token: user2Token },
      transports: ['websocket', 'polling']
    });
    
    user2Socket.on('connect', () => {
      console.log('✅ User 2 connected');
      user2Socket.emit('room:join', { roomId });
    });
    
    user2Socket.on('room:state', (data) => {
      user2ParticipantCount = data.participants?.length || 0;
      console.log(`📊 User 2 sees ${user2ParticipantCount} participants in room:state`);
    });
    
    user2Socket.on('user:joined', (data) => {
      user2ParticipantCount = data.count;
      console.log(`📊 User 2 sees user joined, count now: ${user2ParticipantCount}`);
    });
    
    user2Socket.on('room:users', (data) => {
      user2ParticipantCount = data.users?.length || 0;
      console.log(`📊 User 2 sees room:users, count now: ${user2ParticipantCount}`);
    });
    
    // Test code synchronization
    setTimeout(() => {
      console.log('\n🔄 Testing Code Synchronization...');
      const testCode = 'console.log("Code from User 2!");';
      user2Socket.emit('code:update', {
        roomId,
        code: testCode,
        language: 'javascript'
      });
      console.log('✅ User 2 sent code update');
    }, 2000);
    
    // Cleanup after 5 seconds
    setTimeout(() => {
      console.log('\n📋 FINAL RESULTS:');
      console.log(`   User 1 participant count: ${user1ParticipantCount}`);
      console.log(`   User 2 participant count: ${user2ParticipantCount}`);
      
      if (user1ParticipantCount === 2 && user2ParticipantCount === 2) {
        console.log('✅ SUCCESS: Both users see correct participant count!');
      } else {
        console.log('❌ ISSUE: Participant count not synchronized properly');
      }
      
      user1Socket.disconnect();
      user2Socket.disconnect();
      console.log('\n🎉 Multi-user test completed!');
      process.exit(0);
    }, 5000);
    
  }, 2000);
};

// Run the test
testUserCountUpdates().catch(console.error);
