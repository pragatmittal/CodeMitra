#!/usr/bin/env node

const io = require('socket.io-client');

console.log('🔍 Debug Socket Events...\n');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0MWE0Y2Q0Yy1iZDAwLTQyN2EtYmZmMC0xNWNjY2UzOGRkZTEiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE3NTkzOTA2NzAsImV4cCI6MTc1OTk5NTQ3MH0.aKA4lEc_MX4lAXKn37v_-MpDThq74-ehdv6mHVSujA4';

const socket = io('http://localhost:5001', {
  auth: { token },
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
  
  // Listen to ALL events
  socket.onAny((eventName, ...args) => {
    console.log(`📡 Event received: ${eventName}`, args);
  });
  
  // Join a room
  socket.emit('room:join', { roomId: '8b7dbf5d-95ba-415e-bff0-ae2fbf74a096' });
});

socket.on('connect_error', (err) => {
  console.log('❌ Connection error:', err.message);
});

socket.on('error', (error) => {
  console.log('❌ Socket error:', error);
});

// Keep running for 10 seconds
setTimeout(() => {
  console.log('\n🔍 Debug completed');
  socket.disconnect();
  process.exit(0);
}, 10000);
