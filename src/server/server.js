import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;

// Track available players
const waitingPlayers = new Map();

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // Clean up any waiting players
    for (const [id, player] of waitingPlayers.entries()) {
      if (player.ws === ws) {
        waitingPlayers.delete(id);
        break;
      }
    }
  });
});

function handleMessage(ws, data) {
  switch (data.type) {
    case 'join':
      // Handle new player joining
      const playerId = Math.random().toString(36).substring(7);
      waitingPlayers.set(playerId, { ws, timestamp: Date.now() });
      matchPlayers();
      break;

    case 'offer':
    case 'answer':
    case 'ice-candidate':
      // Relay WebRTC signaling messages
      if (data.target && waitingPlayers.has(data.target)) {
        const targetWs = waitingPlayers.get(data.target).ws;
        targetWs.send(JSON.stringify(data));
      }
      break;

    default:
      console.warn('Unknown message type:', data.type);
  }
}

function matchPlayers() {
  if (waitingPlayers.size >= 2) {
    const players = Array.from(waitingPlayers.entries());
    const [player1Id, player1] = players[0];
    const [player2Id, player2] = players[1];

    // Remove matched players from waiting list
    waitingPlayers.delete(player1Id);
    waitingPlayers.delete(player2Id);

    // Notify players of match
    player1.ws.send(JSON.stringify({
      type: 'matched',
      isHost: true,
      peerId: player2Id
    }));

    player2.ws.send(JSON.stringify({
      type: 'matched',
      isHost: false,
      peerId: player1Id
    }));
  }
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 