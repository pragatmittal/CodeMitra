#!/usr/bin/env node

const io = require('socket.io-client');
const fetch = require('node-fetch').default;

console.log('🔄 Testing Real-time Code Synchronization...\n');

const USER1_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0MWE0Y2Q0Yy1iZDAwLTQyN2EtYmZmMC0xNWNjY2UzOGRkZTEiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE3NTkzOTA2NzAsImV4cCI6MTc1OTk5NTQ3MH0.aKA4lEc_MX4lAXKn37v_-MpDThq74-ehdv6mHVSujA4';

// Create second user
const createSecondUser = async () => {
  try {
    const response = await fetch('http://localhost:5001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Code Test User',
        email: 'codetest@example.com',
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

// Test code synchronization
const testCodeSynchronization = async () => {
  console.log('🔄 Testing Code Synchronization...');
  
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
      name: 'Code Sync Test Room',
      description: 'Testing code synchronization',
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
  
  let user1Code = '';
  let user2Code = '';
  let codeSyncSuccess = false;
  
  user1Socket.on('connect', () => {
    console.log('✅ User 1 connected');
    user1Socket.emit('room:join', { roomId });
  });
  
  user1Socket.on('room:state', (data) => {
    user1Code = data.code;
    console.log(`📊 User 1 received initial code (${data.code.length} chars)`);
  });
  
  user1Socket.on('code:updated', (data) => {
    user1Code = data.code;
    console.log(`📊 User 1 received code update from ${data.user.name}:`);
    console.log(`   Code: "${data.code}"`);
    codeSyncSuccess = true;
  });
  
  // User 2 joins room after 2 seconds
  setTimeout(async () => {
    // Add User 2 as participant
    try {
      const joinResponse = await fetch(`http://localhost:5001/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user2Token}`,
        }
      });
      
      const joinData = await joinResponse.json();
      if (!joinData.success) {
        console.log('❌ Failed to add User 2 as participant:', joinData.error);
        return;
      }
      console.log('✅ User 2 added as participant');
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
      user2Code = data.code;
      console.log(`📊 User 2 received initial code (${data.code.length} chars)`);
      
      // After 1 second, User 2 updates the code
      setTimeout(() => {
        const newCode = 'console.log("Code updated by User 2!");\nconsole.log("Real-time sync working!");';
        console.log(`🔄 User 2 sending code update: "${newCode}"`);
        user2Socket.emit('code:update', {
          roomId,
          code: newCode,
          language: 'javascript'
        });
        user2Code = newCode;
      }, 1000);
    });
    
    user2Socket.on('code:updated', (data) => {
      user2Code = data.code;
      console.log(`📊 User 2 received code update from ${data.user.name}:`);
      console.log(`   Code: "${data.code}"`);
    });
    
    // Test results after 5 seconds
    setTimeout(() => {
      console.log('\n📋 CODE SYNCHRONIZATION RESULTS:');
      console.log(`   User 1 final code: "${user1Code}"`);
      console.log(`   User 2 final code: "${user2Code}"`);
      console.log(`   Code sync success: ${codeSyncSuccess}`);
      
      if (codeSyncSuccess && user1Code === user2Code && user1Code.includes('User 2')) {
        console.log('✅ SUCCESS: Code synchronization working perfectly!');
        console.log('✅ Both users have the same code!');
        console.log('✅ Real-time updates working!');
      } else {
        console.log('❌ ISSUE: Code synchronization not working properly');
        if (!codeSyncSuccess) console.log('   - User 1 did not receive code update event');
        if (user1Code !== user2Code) console.log('   - Users have different code');
        if (!user1Code.includes('User 2')) console.log('   - User 1 code does not contain User 2 changes');
      }
      
      user1Socket.disconnect();
      user2Socket.disconnect();
      console.log('\n🎉 Code synchronization test completed!');
      process.exit(0);
    }, 5000);
    
  }, 2000);
};

// Run the test
testCodeSynchronization().catch(console.error);
