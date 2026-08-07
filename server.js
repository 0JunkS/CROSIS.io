// Node.js Express & Socket.io Real-time Gaming & Friend Server (Render Ready)
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 8080;

// Serve static frontend files
app.use(express.static(path.join(__dirname, './')));

// In-Memory Presence & Friends State
const connectedUsers = new Map(); // socketId -> { userId, nickname, status, room }
const friendMessages = []; // Array of chat messages
const rooms = new Map(); // roomId -> { players: [] }

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // User Join / Register Presence
  socket.on('user_join', (data) => {
    const userInfo = {
      socketId: socket.id,
      userId: data.userId || socket.id,
      nickname: data.nickname || '화살표 용사',
      status: 'ONLINE'
    };
    connectedUsers.set(socket.id, userInfo);
    broadcastUsersList();
  });

  // Direct Message (Private Chat)
  socket.on('send_message', (data) => {
    const msgData = {
      senderId: data.senderId,
      senderName: data.senderName,
      receiverId: data.receiverId,
      text: data.text,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    };
    friendMessages.push(msgData);
    io.emit('receive_message', msgData);
  });

  // Invite Friend to 1v1 PvP Match
  socket.on('invite_pvp', (data) => {
    const targetSocket = [...connectedUsers.values()].find(u => u.userId === data.targetUserId);
    if (targetSocket) {
      io.to(targetSocket.socketId).emit('pvp_invite_received', {
        hostId: data.hostId,
        hostName: data.hostName,
        roomCode: data.roomCode
      });
    }
  });

  // Join 1v1 PvP Room
  socket.on('join_pvp_room', (data) => {
    const { roomCode, nickname, userId } = data;
    socket.join(roomCode);

    if (!rooms.has(roomCode)) {
      rooms.set(roomCode, { players: [] });
    }
    const room = rooms.get(roomCode);
    if (room.players.length < 2) {
      room.players.push({ socketId: socket.id, userId, nickname, hp: 100, x: 0, y: 0 });
    }

    io.to(roomCode).emit('pvp_room_state', {
      players: room.players
    });
  });

  // 1v1 PvP Player Movement & Shooting Sync
  socket.on('pvp_player_update', (data) => {
    socket.to(data.roomCode).emit('pvp_opponent_update', data);
  });

  // Disconnect
  socket.on('disconnect', () => {
    connectedUsers.delete(socket.id);
    broadcastUsersList();
    console.log('Client disconnected:', socket.id);
  });

  function broadcastUsersList() {
    io.emit('online_users_list', Array.from(connectedUsers.values()));
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} - Ready for Render.com deployment!`);
});
