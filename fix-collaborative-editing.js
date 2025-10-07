/**
 * Complete Fix for Collaborative Editing Issues
 * 
 * This script will:
 * 1. Create separate test users 
 * 2. Create a test room
 * 3. Add both users to the room
 * 4. Test collaborative editing
 * 5. Provide solutions for the main issues
 */

const io = require('socket.io-client');
const axios = require('axios');

const BACKEND_URL = 'http://localhost:5001';

async function createTestUser(name, email, password) {
  try {
    // Try to register
    const registerResponse = await axios.post(`${BACKEND_URL}/api/auth/register`, {
      name,
      email,
      password
    });
    console.log(`✅ ${name} registered successfully`);
    return {
      name,
      email,
      token: registerResponse.data.token,
      userData: registerResponse.data.user
    };
  } catch (registerError) {
    // If registration fails, try login
    try {
      const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        email,
        password
      });
      console.log(`✅ ${name} logged in successfully`);
      return {
        name,
        email,
        token: loginResponse.data.token,
        userData: loginResponse.data.user
      };
    } catch (loginError) {
      console.error(`❌ Failed to authenticate ${name}:`, loginError.response?.data || loginError.message);
      return null;
    }
  }
}

async function createTestRoom(ownerToken) {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/rooms`, {
      name: 'Collaborative Test Room',
      description: 'Test room for debugging collaborative editing',
      isPublic: true,
      language: 'javascript'
    }, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    console.log(`✅ Test room created: ${response.data.room.id}`);
    return response.data.room;
  } catch (error) {
    console.error('❌ Failed to create room:', error.response?.data || error.message);
    return null;
  }
}

async function joinRoom(roomId, userToken) {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/rooms/${roomId}/join`, {}, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    console.log(`✅ User joined room successfully`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to join room:`, error.response?.data || error.message);
    return null;
  }
}

async function testCollaborativeEditingComplete() {
  console.log('🧪 Starting complete collaborative editing test...\n');
  
  // Create two different test users
  const userA = await createTestUser(
    'Alice Collaborative',
    'alice.collab@test.com',
    'password123'
  );
  
  const userB = await createTestUser(
    'Bob Collaborative', 
    'bob.collab@test.com',
    'password123'
  );
  
  if (!userA || !userB) {
    console.error('❌ Failed to create test users');
    return;
  }
  
  console.log('\n🔍 USER VERIFICATION:');
  console.log(`User A: ${userA.userData.name} (ID: ${userA.userData.id})`);
  console.log(`User B: ${userB.userData.name} (ID: ${userB.userData.id})`);
  
  if (userA.userData.id === userB.userData.id) {
    console.log('🚨 CRITICAL: Users have same ID!');
    return;
  }
  
  // Create a test room
  const room = await createTestRoom(userA.token);
  if (!room) {
    console.error('❌ Failed to create test room');
    return;
  }
  
  // Join room with both users
  console.log('\n🏠 JOINING ROOM...');
  const joinA = await joinRoom(room.id, userA.token);
  const joinB = await joinRoom(room.id, userB.token);
  
  if (!joinA || !joinB) {
    console.error('❌ Failed to join room');
    return;
  }
  
  // Connect via Socket.IO
  console.log('\n🔌 CONNECTING TO SOCKET.IO...');
  
  const socketA = io(BACKEND_URL, {
    auth: { token: userA.token },
    timeout: 5000
  });
  
  const socketB = io(BACKEND_URL, {
    auth: { token: userB.token },
    timeout: 5000
  });
  
  // Setup event handlers
  socketA.on('connect', () => {
    console.log(`✅ ${userA.userData.name} connected`);
  });
  
  socketB.on('connect', () => {
    console.log(`✅ ${userB.userData.name} connected`);
  });
  
  // Code update handlers
  socketA.on('code:updated', (data) => {
    console.log(`📝 ${userA.userData.name} received code update from ${data.userName}`);
  });
  
  socketB.on('code:updated', (data) => {
    console.log(`📝 ${userB.userData.name} received code update from ${data.userName}`);
  });
  
  // Room event handlers
  socketA.on('room:joined', (data) => {
    console.log(`🏠 ${userA.userData.name} joined room via socket`);
  });
  
  socketB.on('room:joined', (data) => {
    console.log(`🏠 ${userB.userData.name} joined room via socket`);
  });
  
  socketA.on('room:user-joined', (data) => {
    console.log(`👤 ${userA.userData.name} saw user join: ${data.user.name}`);
  });
  
  socketB.on('room:user-joined', (data) => {
    console.log(`👤 ${userB.userData.name} saw user join: ${data.user.name}`);
  });
  
  // Wait for connections
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Join socket rooms
  console.log('\n🔌 JOINING SOCKET ROOMS...');
  socketA.emit('room:join', {
    roomId: room.id,
    userId: userA.userData.id,
    userName: userA.userData.name
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  socketB.emit('room:join', {
    roomId: room.id,
    userId: userB.userData.id,
    userName: userB.userData.name
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test code updates
  console.log('\n📝 TESTING CODE UPDATES...');
  
  console.log(`🔄 ${userA.userData.name} sending code update...`);
  socketA.emit('code:update', {
    roomId: room.id,
    code: 'console.log("Hello from Alice!");',
    language: 'javascript'
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log(`🔄 ${userB.userData.name} sending code update...`);
  socketB.emit('code:update', {
    roomId: room.id,
    code: 'console.log("Hello from Bob!");',
    language: 'javascript'
  });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('\n🧪 Test completed!');
  
  // Cleanup
  socketA.close();
  socketB.close();
  
  // Print solutions
  console.log('\n' + '='.repeat(60));
  console.log('🔧 SOLUTIONS FOR YOUR COLLABORATIVE EDITING ISSUES:');
  console.log('='.repeat(60));
  
  console.log('\n1. 🚨 USER IDENTITY ISSUE:');
  console.log('   Both your users show username "adfa;fnwvouuv"');
  console.log('   SOLUTION: Make sure users are using:');
  console.log('   - Different browser windows/incognito tabs');
  console.log('   - Different user accounts'); 
  console.log('   - Clear browser cookies between tests');
  
  console.log('\n2. 🔄 CODE SYNC ISSUE:');
  console.log('   Users must join room via REST API before Socket.IO');
  console.log('   SOLUTION: Ensure frontend calls:');
  console.log('   - POST /api/rooms/{roomId}/join (via HTTP)');
  console.log('   - THEN socket.emit("room:join", ...)');
  
  console.log('\n3. 🎯 DEBUGGING TIPS:');
  console.log('   - Check browser dev tools for different user IDs');
  console.log('   - Monitor backend logs for room join events');
  console.log('   - Verify authentication tokens are different');
  
  console.log('\n✅ Run this script to verify your fixes work!');
}

// Run the test
if (require.main === module) {
  testCollaborativeEditingComplete().catch(console.error);
}

module.exports = { testCollaborativeEditingComplete };

