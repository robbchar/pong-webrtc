import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createServer, IncomingMessage } from "http";
import { v4 as uuidv4 } from "uuid";
import { Buffer } from "buffer";
import os from "os"; // Import the os module
import { URL } from "url";

// Define the structure for signaling messages
interface SignalingMessage {
  type:
    | "ping"
    | "offer"
    | "answer"
    | "candidate"
    | "paired"
    | "opponentLeft"
    | "error"
    | "join"
    | "ice-candidate"
    | "ready_for_offer"
    | "chatMessage"
    | "start_intent"
    | "back_to_lobby";
  payload?: any;
  senderId?: string;
  message?: string;
}

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;

// Track clients and games
const clients = new Map<string, WebSocket>(); // Use base WebSocket type
const gamesToClients = new Map<string, Array<string>>(); // Map<gameId, Array<clientId>> (first is host, second is opponent)
const clientsToGames = new Map<string, string>(); // Map<clientId, gameId>
const waitingQueue: string[] = []; // FIFO queue of clients waiting for an opponent (each has a gameId already)

function removeFromWaitingQueue(clientId: string): void {
  const idx = waitingQueue.indexOf(clientId);
  if (idx >= 0) waitingQueue.splice(idx, 1);
}

function pairHostWithGuest(hostId: string, guestId: string): void {
  const hostWs = clients.get(hostId);
  const guestWs = clients.get(guestId);
  if (!hostWs || !guestWs) return;
  if (
    hostWs.readyState !== WebSocket.OPEN ||
    guestWs.readyState !== WebSocket.OPEN
  ) {
    return;
  }

  let hostGameId = clientsToGames.get(hostId);
  if (!hostGameId) {
    hostGameId = uuidv4();
    clientsToGames.set(hostId, hostGameId);
    gamesToClients.set(hostGameId, [hostId]);
    hostWs.send(
      JSON.stringify({
        type: "host_assigned",
        payload: { gameId: hostGameId },
      }),
    );
  }

  const guestOldGameId = clientsToGames.get(guestId);
  if (guestOldGameId && guestOldGameId !== hostGameId) {
    gamesToClients.delete(guestOldGameId);
  }

  gamesToClients.set(hostGameId, [hostId, guestId]);
  clientsToGames.set(guestId, hostGameId);

  guestWs.send(
    JSON.stringify({
      type: "paired",
      payload: { opponentId: hostId, isHost: false },
    }),
  );
  hostWs.send(
    JSON.stringify({
      type: "paired",
      payload: { opponentId: guestId, isHost: true },
    }),
  );
}

// Helper function to get local network IP
function getLocalNetworkIp(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaceDetails = interfaces[name];
    if (!ifaceDetails) continue;
    for (const iface of ifaceDetails) {
      // Skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null; // Return null if no suitable IP found
}

console.log("Signaling server starting...");

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  console.log(`on connection.`);
  // Assign a unique ID to the connection (dynamically attaching)
  const clientId =
    new URL(req.url ?? "", `http://${req.headers.host}`).searchParams.get(
      "clientId",
    ) ?? uuidv4();

  // check if this is a client connecting that is already in a game
  if (clientsToGames.has(clientId)) {
    console.log(
      `Client ${clientId} reconnecting, updating WebSocket reference`,
    );
    // Update the WebSocket reference but maintain game state
    clients.set(clientId, ws);
    (ws as any).id = clientId;

    // Re-attach all event handlers
    setupWebSocketHandlers(ws, clientId);
    return;
  }

  (ws as any).id = clientId;
  clients.set(clientId, ws);
  console.log(`Client connected: ${clientId}, IP: ${req.socket.remoteAddress}`);

  // If client was already waiting (e.g., refreshed tab), just re-send host assignment.
  if (waitingQueue.includes(clientId)) {
    console.log(`Client ${clientId} is already waiting for an opponent.`);
    const gameId = clientsToGames.get(clientId);
    if (gameId) {
      ws.send(JSON.stringify({ type: "host_assigned", payload: { gameId } }));
      outputServerStatus();
      return;
    }
    // If we somehow lost the gameId, drop them from queue and proceed normally.
    removeFromWaitingQueue(clientId);
  }

  if (waitingQueue.length > 0) {
    const hostId = waitingQueue.shift()!;
    console.log(`Found waiting client ${hostId}, pairing opponents.`);
    pairHostWithGuest(hostId, clientId);
  } else {
    console.log(`Client ${clientId} is waiting for an opponent.`);
    const gameId = uuidv4();
    ws.send(JSON.stringify({ type: "host_assigned", payload: { gameId } }));
    gamesToClients.set(gameId, [clientId]);
    clientsToGames.set(clientId, gameId);
    waitingQueue.push(clientId);
  }

  outputServerStatus();
});

// And define the handler setup function
function setupWebSocketHandlers(ws: WebSocket, clientId: string) {
  ws.on("message", (messageBuffer: Buffer) => {
    const rawMessage = messageBuffer.toString();
    // console.log('Raw WebSocket message received:', {
    //   rawMessage,
    //   clientId,
    //   wsState: ws.readyState
    // });

    let messageData: SignalingMessage;
    const senderId = (ws as any).id;
    if (!senderId) {
      console.warn("Message received from client with no ID");
      return;
    }

    try {
      messageData = JSON.parse(rawMessage);
      // console.log('Parsed message:', {
      //   type: messageData.type,
      //   senderId,
      //   payload: messageData.payload
      // });
      handleMessage(ws, messageData);
    } catch (error) {
      // console.error('Failed to parse or handle message:', {
      //   error,
      //   rawMessage,
      //   senderId
      // });
      ws.send(
        JSON.stringify({ type: "error", payload: "Invalid message format" }),
      );
    }
  });

  ws.on("close", (code: number, reason: Buffer) => {
    console.log(
      `Client disconnected: ${clientId}, Code: ${code}, Reason: ${reason.toString()}`,
    );
    handleDisconnect(ws);
  });

  ws.on("error", (error: Error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
    handleDisconnect(ws);
  });
}

function getPlayersFromGameId(clientId: string): Array<string> | undefined {
  const gameId = clientsToGames.get(clientId);
  if (!gameId) {
    console.warn(`Game ID not found for client ${clientId}`);
    return;
  }
  const players = gamesToClients.get(gameId);
  return players;
}

function handleMessage(senderWs: WebSocket, data: SignalingMessage) {
  console.log(`Received message:`, data.type);
  const senderId = (senderWs as any).id;
  if (!senderId) {
    console.warn(`Sender ID not found for client ${senderWs}`);
    return;
  }

  const players = getPlayersFromGameId(senderId);
  const opponentId = players?.find((player) => player !== senderId);

  switch (data.type) {
    case "offer":
    case "answer":
    case "candidate":
    case "ice-candidate":
      if (opponentId) {
        const opponentWs = clients.get(opponentId);
        if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
          console.log(
            `Relaying ${data.type} from ${senderId} to ${opponentId}`,
          );
          // Forward the message, adding senderId for context on the client
          opponentWs.send(JSON.stringify({ ...data, senderId }));
        } else {
          console.warn(
            `Cannot relay ${data.type}: Opponent ${opponentId} not found or not open.`,
          );
          senderWs.send(
            JSON.stringify({ type: "error", payload: "Opponent unavailable" }),
          );
        }
      } else {
        console.warn(
          `Cannot relay ${data.type}: Sender ${senderId} is not paired.`,
        );
        senderWs.send(
          JSON.stringify({
            type: "error",
            payload: "You are not paired with anyone",
          }),
        );
      }
      break;
    case "chatMessage": {
      if (!players || players.length === 0) {
        console.warn(
          `Cannot relay chatMessage: Sender ${senderId} is not in a game.`,
        );
        break;
      }

      const payload = {
        text: data.payload?.text,
        timestamp: data.payload?.timestamp,
      };

      players.forEach((playerId) => {
        if (playerId === senderId) return;
        const playerWs = clients.get(playerId);
        if (playerWs && playerWs.readyState === WebSocket.OPEN) {
          playerWs.send(
            JSON.stringify({
              type: "chatMessage",
              payload,
              senderId,
            }),
          );
        }
      });
      break;
    }
    case "ready_for_offer":
      if (opponentId) {
        const opponentWs = clients.get(opponentId);
        if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
          console.log(
            `Relaying ready_for_offer from ${senderId} to ${opponentId}`,
          );
          opponentWs.send(JSON.stringify({ ...data, senderId }));
        } else {
          console.warn(
            `Cannot relay ready_for_offer: Opponent ${opponentId} not found or not open.`,
          );
          senderWs.send(
            JSON.stringify({ type: "error", payload: "Opponent unavailable" }),
          );
        }
      } else {
        console.warn(
          `Cannot relay ready_for_offer: Sender ${senderId} is not paired.`,
        );
        senderWs.send(
          JSON.stringify({
            type: "error",
            payload: "You are not paired with anyone",
          }),
        );
      }
      break;
    case "start_intent":
      if (opponentId) {
        const opponentWs = clients.get(opponentId);
        if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
          console.log(
            `Relaying start_intent from ${senderId} to ${opponentId}`,
          );
          opponentWs.send(JSON.stringify({ ...data, senderId }));
        } else {
          senderWs.send(
            JSON.stringify({ type: "error", payload: "Opponent unavailable" }),
          );
        }
      } else {
        senderWs.send(
          JSON.stringify({
            type: "error",
            payload: "You are not paired with anyone",
          }),
        );
      }
      break;

    case "back_to_lobby":
      if (opponentId) {
        const opponentWs = clients.get(opponentId);
        if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
          console.log(
            `Relaying back_to_lobby from ${senderId} to ${opponentId}`,
          );
          opponentWs.send(JSON.stringify({ ...data, senderId }));
        } else {
          senderWs.send(
            JSON.stringify({ type: "error", payload: "Opponent unavailable" }),
          );
        }
      } else {
        senderWs.send(
          JSON.stringify({
            type: "error",
            payload: "You are not paired with anyone",
          }),
        );
      }
      break;

    case "ping":
      console.log(JSON.stringify(data));
      senderWs.send(JSON.stringify({ type: "pong" }));
      break;

    default:
      console.warn(`Unknown message type from ${senderId}: ${data.type}`);
      senderWs.send(
        JSON.stringify({
          type: "error",
          payload: `Unknown message type: ${data.type}`,
        }),
      );
  }
  outputServerStatus();
}

function handleDisconnect(ws: WebSocket) {
  const disconnectedClientId = (ws as any).id;
  if (!disconnectedClientId || !clients.has(disconnectedClientId)) {
    console.log(
      "Disconnect handler called for already removed or unknown client.",
    );
    return; // Already handled or invalid state
  }

  if (waitingQueue.includes(disconnectedClientId)) {
    removeFromWaitingQueue(disconnectedClientId);
    console.log(
      `Client ${disconnectedClientId} was waiting, removed from waiting queue.`,
    );
  }

  // remove disconnected client from gamesToClients
  const gameId = clientsToGames.get(disconnectedClientId);
  if (gameId) {
    const players = gamesToClients.get(gameId);
    if (players) {
      if (players.length === 1) {
        gamesToClients.delete(gameId); // remove the game the host left
      } else {
        const remainingId = players.find(
          (player) => player !== disconnectedClientId,
        );
        if (!remainingId) {
          gamesToClients.delete(gameId);
        } else {
          gamesToClients.set(gameId, [remainingId]);
          const remainingWs = clients.get(remainingId);
          if (remainingWs && remainingWs.readyState === WebSocket.OPEN) {
            console.log(
              `Notifying opponent ${remainingId} about disconnect and returning to waiting.`,
            );
            remainingWs.send(JSON.stringify({ type: "opponentLeft" }));
            remainingWs.send(
              JSON.stringify({ type: "host_assigned", payload: { gameId } }),
            );
          }

          // remaining becomes waiting host; if someone else is already waiting, pair immediately.
          if (waitingQueue.length > 0) {
            const waitingHostId = waitingQueue.shift()!;
            // Pair the remaining host with the waiting host as guest (reuse remaining's game).
            pairHostWithGuest(remainingId, waitingHostId);
          } else {
            waitingQueue.push(remainingId);
            console.log(`Opponent ${remainingId} is now waiting.`);
          }
        }
      }
    }
  }
  // remove disconnected clientId/gameId from clientsToGames
  clientsToGames.delete(disconnectedClientId);

  // remove disconnected clientId from clients
  console.log(`Handling disconnect for ${disconnectedClientId}`);
  clients.delete(disconnectedClientId);

  outputServerStatus();
}

const outputServerStatus = () => {
  console.log(
    `Current clients: ${clients.size}, Current number of games: ${gamesToClients.size}, Waiting: ${waitingQueue.length}`,
  );
};

server.listen(PORT, () => {
  const localIp = getLocalNetworkIp();
  console.log(`Signaling server running on:`);
  console.log(`  - http://localhost:${PORT}`);
  if (localIp) {
    console.log(`  - http://${localIp}:${PORT} (for local network)`);
  }
});
