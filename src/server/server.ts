import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer';
import os from 'os'; // Import the os module

// Define the structure for signaling messages
interface SignalingMessage {
  type: 'offer' | 'answer' | 'candidate' | 'paired' | 'opponentLeft' | 'error' | 'join'; 
  payload?: any; 
  senderId?: string; // Added senderId for context on relayed messages
}

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;

// Track connected clients and their pairings
const clients = new Map<string, WebSocket>(); // Use base WebSocket type
const pairings = new Map<string, string>(); // Map<clientId, opponentId>
let waitingClientId: string | null = null; // Track the ID of a client waiting for a pair

// Helper function to get local network IP
function getLocalNetworkIp(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaceDetails = interfaces[name];
    if (!ifaceDetails) continue;
    for (const iface of ifaceDetails) {
      // Skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null; // Return null if no suitable IP found
}

console.log('Signaling server starting...');

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  // Assign a unique ID to the connection (dynamically attaching)
  const clientId = uuidv4();
  (ws as any).id = clientId; 
  clients.set(clientId, ws);
  console.log(`Client connected: ${clientId}, IP: ${req.socket.remoteAddress}`);

  // Handle pairing
  if (waitingClientId) {
    const opponentId = waitingClientId;
    const opponentWs = clients.get(opponentId);

    if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
      pairings.set(clientId, opponentId);
      pairings.set(opponentId, clientId);
      waitingClientId = null; // Clear the waiting spot

      console.log(`Pairing clients: ${clientId} and ${opponentId}`);

      // Notify both clients they are paired
      ws.send(JSON.stringify({ type: 'paired', payload: { opponentId, isHost: false } }));
      opponentWs.send(JSON.stringify({ type: 'paired', payload: { opponentId: clientId, isHost: true } }));
    } else {
      console.log(`Waiting client ${opponentId} disconnected before pairing could complete.`);
      waitingClientId = clientId; // This new client waits
      if (opponentId) {
        clients.delete(opponentId); // Clean up disconnected client
        pairings.delete(opponentId); // Clean up any stale pairing involving opponent
      }
      console.log(`Client ${clientId} is now waiting.`);
    }
  } else {
    waitingClientId = clientId;
    console.log(`Client ${clientId} is waiting for an opponent.`);
  }

  ws.on('message', (messageBuffer: Buffer) => {
    let messageData: SignalingMessage;
    const senderId = (ws as any).id;
    if (!senderId) return; // Should have an ID

    try {
      messageData = JSON.parse(messageBuffer.toString());
      console.log(`Received from ${senderId}:`, messageData.type);
      handleMessage(ws, messageData);
    } catch (error) {
      console.error(`Failed to parse message from ${senderId} or handle it:`, error);
      ws.send(JSON.stringify({ type: 'error', payload: 'Invalid message format' }));
    }
  });

  ws.on('close', (code: number, reason: Buffer) => {
    const closedClientId = (ws as any).id ?? 'unknown';
    console.log(`Client disconnected: ${closedClientId}, Code: ${code}, Reason: ${reason.toString()}`);
    handleDisconnect(ws);
  });

  ws.on('error', (error: Error) => {
    const errorClientId = (ws as any).id ?? 'unknown';
    console.error(`WebSocket error for client ${errorClientId}:`, error);
    handleDisconnect(ws); // Treat errors as disconnects for cleanup
  });
});

function handleMessage(senderWs: WebSocket, data: SignalingMessage) {
  const senderId = (senderWs as any).id;
  if (!senderId) return; 

  const opponentId = pairings.get(senderId);

  switch (data.type) {
    case 'offer':
    case 'answer':
    case 'candidate':
      if (opponentId) {
        const opponentWs = clients.get(opponentId);
        if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
          console.log(`Relaying ${data.type} from ${senderId} to ${opponentId}`);
          // Forward the message, adding senderId for context on the client
          opponentWs.send(JSON.stringify({ ...data, senderId })); 
        } else {
          console.warn(`Cannot relay ${data.type}: Opponent ${opponentId} not found or not open.`);
          senderWs.send(JSON.stringify({ type: 'error', payload: 'Opponent unavailable' }));
        }
      } else {
        console.warn(`Cannot relay ${data.type}: Sender ${senderId} is not paired.`);
        senderWs.send(JSON.stringify({ type: 'error', payload: 'You are not paired with anyone' }));
      }
      break;
    
    // case 'join': // No longer needed as pairing is automatic on connect
    //   break;

    default:
      console.warn(`Unknown message type from ${senderId}: ${data.type}`);
      senderWs.send(JSON.stringify({ type: 'error', payload: `Unknown message type: ${data.type}` }));
  }
}

function handleDisconnect(ws: WebSocket) {
  const disconnectedClientId = (ws as any).id;
  if (!disconnectedClientId || !clients.has(disconnectedClientId)) {
      console.log("Disconnect handler called for already removed or unknown client.");
      return; // Already handled or invalid state
  }

  console.log(`Handling disconnect for ${disconnectedClientId}`);
  clients.delete(disconnectedClientId);

  if (waitingClientId === disconnectedClientId) {
    waitingClientId = null;
    console.log(`Client ${disconnectedClientId} was waiting, cleared waiting spot.`);
  }

  const opponentId = pairings.get(disconnectedClientId);
  if (opponentId) {
    console.log(`Client ${disconnectedClientId} was paired with ${opponentId}.`);
    pairings.delete(disconnectedClientId); // Remove pairing for disconnected client

    const opponentWs = clients.get(opponentId);
    if (opponentWs) { // Check if opponent still exists
        pairings.delete(opponentId); // Remove opponent's pairing entry as well
        if (opponentWs.readyState === WebSocket.OPEN) {
            console.log(`Notifying opponent ${opponentId} about disconnect.`);
            opponentWs.send(JSON.stringify({ type: 'opponentLeft' }));
            // Make opponent wait again
            if (!waitingClientId) {
                waitingClientId = opponentId;
                console.log(`Opponent ${opponentId} is now waiting.`);
            } else {
                console.log(`Another client ${waitingClientId} is already waiting. Opponent ${opponentId} needs to reconnect.`);
            }
        } else {
            console.log(`Opponent ${opponentId} was found but not in OPEN state. Cleaning up.`);
            // If opponent wasn't open, they might disconnect soon anyway, ensure cleanup
            clients.delete(opponentId);
        }
    } else {
        console.log(`Opponent ${opponentId} not found in clients map (already disconnected?).`);
        // Ensure opponent pairing is removed if they disconnected first
         pairings.delete(opponentId); 
    }
     console.log(`Cleaned up pairing involving ${disconnectedClientId}.`);
  } else {
      console.log(`Client ${disconnectedClientId} was not paired.`);
  }

  console.log(`Current clients: ${clients.size}, Paired: ${pairings.size / 2}, Waiting: ${waitingClientId ? 1 : 0}`);
}

server.listen(PORT, () => {
  const localIp = getLocalNetworkIp();
  console.log(`Signaling server running on:`);
  console.log(`  - http://localhost:${PORT}`);
  if (localIp) {
    console.log(`  - http://${localIp}:${PORT} (for local network)`);
  }
}); 