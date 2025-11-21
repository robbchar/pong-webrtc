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
    | "chatMessage";
  payload?: any;
  senderId?: string;
  message?: string;
}

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;

// setInterval(() => {
//     console.log('Active connections status:');
//     clients.forEach((ws, id) => {
//         console.log(`Client ${id}: readyState=${ws.readyState}`);
//     });
// }, 5000);

// Track clients and games
const clients = new Map<string, WebSocket>(); // Use base WebSocket type
const gamesToClients = new Map<string, Array<string>>(); // Map<gameId, Array<clientId>> (the array should be the clients in the game, first is the host possible second is the opponent)
const clientsToGames = new Map<string, string>(); // Map<clientId, gameId>
let waitingClientId: string | null = null; // Track the ID of a client waiting for a pair

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

  if (waitingClientId && waitingClientId === clientId) {
    console.log(`Client ${clientId} is already waiting for an opponent.`);
    const gameId = clientsToGames.get(clientId);
    if (!gameId) {
      console.error(`Game ID not found for client ${clientId}`);
      ws.send(
        JSON.stringify({
          type: "error",
          payload: { message: "Game ID not found" },
        }),
      );
      return;
    }

    ws.send(JSON.stringify({ type: "host_assigned", payload: { gameId } }));
    return;
  }

  // Handle pairing
  if (waitingClientId) {
    console.log(`Found waiting client, pairing opponents.`);
    const opponentId = waitingClientId;
    const opponentWs = clients.get(opponentId);

    // check if the opponent is connected to start the pairing process
    if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
      const gameId = clientsToGames.get(opponentId);
      if (!gameId) {
        ws.send(
          JSON.stringify({
            type: "error",
            payload: { message: "Game ID not found" },
          }),
        );
        opponentWs.send(
          JSON.stringify({
            type: "error",
            payload: { message: "Game ID not found" },
          }),
        );
        console.error(`Game ID not found for opponent ${opponentId}`);
        return;
      }
      console.log(`Pairing clients: ${clientId} and ${opponentId}`);
      gamesToClients.set(gameId, [opponentId, clientId]);
      clientsToGames.set(clientId, gameId);

      waitingClientId = null; // Clear the waiting spot so the next user would start a new game

      // Before sending paired messages
      // console.log('About to send paired messages. Connection states:', {
      //   newClient: { id: clientId, readyState: ws.readyState },
      //   opponent: { id: opponentId, readyState: opponentWs.readyState }
      // });

      // Notify both clients they are paired
      ws.send(
        JSON.stringify({
          type: "paired",
          payload: { opponentId, isHost: false },
        }),
      );
      opponentWs.send(
        JSON.stringify({
          type: "paired",
          payload: { opponentId: clientId, isHost: true },
        }),
      );
      // console.log('Paired messages sent. Connection states:', {
      //   newClient: { id: clientId, readyState: ws.readyState },
      //   opponent: { id: opponentId, readyState: opponentWs.readyState }
      // });
    } else {
      // this could cause problems...
      console.log(
        `Waiting client ${opponentId} disconnected before pairing could complete.`,
      );
      waitingClientId = clientId; // This new client waits
      if (opponentId) {
        clients.delete(opponentId); // Clean up disconnected client
      }
      console.log(`Client ${clientId} is now waiting.`);
    }
  } else {
    waitingClientId = clientId;
    console.log(`Client ${clientId} is waiting for an opponent.`);

    // create a game and let the host wait
    // Send host assignment messages
    const gameId = uuidv4(); // Generate a unique game ID
    ws.send(JSON.stringify({ type: "host_assigned", payload: { gameId } }));
    gamesToClients.set(gameId, [clientId]);
    clientsToGames.set(clientId, gameId);
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

  if (waitingClientId === disconnectedClientId) {
    waitingClientId = null;
    console.log(
      `Client ${disconnectedClientId} was waiting, cleared waiting spot.`,
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
        gamesToClients.set(
          gameId,
          players.filter((player) => player !== disconnectedClientId),
        ); // remove the disconnected client from the game
        const opponentId = players[0];
        if (opponentId) {
          const opponentWs = clients.get(opponentId);
          if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
            console.log(`Notifying opponent ${opponentId} about disconnect.`);
            opponentWs.send(JSON.stringify({ type: "opponentLeft" }));
            // Make opponent wait again, make sure they know they are the host
            if (!waitingClientId) {
              opponentWs.send(
                JSON.stringify({ type: "host_assigned", payload: { gameId } }),
              );

              waitingClientId = opponentId;
              console.log(`Opponent ${opponentId} is now waiting.`);
            } else {
              // need to do logic to re-pair with current waiting client, but reconnectingdoes the same thing... not as clean though
              console.log(
                `Another client ${waitingClientId} is already waiting. Opponent ${opponentId} needs to reconnect.`,
              );
            }
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
    `Current clients: ${clients.size}, Current number of games: ${gamesToClients.size}, Waiting: ${waitingClientId ? 1 : 0}`,
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
