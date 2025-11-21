import { Dispatch } from "@reduxjs/toolkit";
import {
  setSignalingStatus,
  setPeerConnected,
  setError,
  setGameId,
  setIsHost,
  setOpponentStartIntent,
  setSelfStartIntent,
} from "@/store/slices/connectionSlice";
import {
  addSystemMessage,
  chatMessageReceived,
  chatMessageSent,
  setRoomGameId,
  setSelfIdentity,
} from "@/store/slices/chatSlice";
import { SignalingStatus } from "@/types/signalingTypes";
import { webRTCService } from "./webRTCService"; // Import the new service
import { logger } from "@/utils/logger";

// Define the structure for messages (mirroring server)
interface SignalingMessage {
  type: string; // Specific types handled in handlers
  payload?: any;
  senderId?: string;
}

class SignalingService {
  private static instance: SignalingService;
  private ws: WebSocket | null = null;
  private dispatch: Dispatch<any> | null = null;
  private status: SignalingStatus = SignalingStatus.CLOSED;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY_MS = 3000;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private clientId: string;
  private isHost: boolean = false;
  private isConnecting: boolean = false;
  private opponentId: string | null = null;
  private selfStartIntent: boolean = false;
  private opponentStartIntent: boolean = false;
  private hasStartedWebRTCOnce: boolean = false;

  private constructor() {
    this.clientId = crypto.randomUUID();

    // Make the player ID accessible in the console
    if (typeof window !== "undefined") {
      (window as any).getPlayerId = () => {
        logger.info("[WebSocket] Your player ID:", { clientId: this.clientId });
        return this.clientId;
      };
      logger.info(
        "[WebSocket] Type getPlayerId() in the console to see your player ID",
      );
    }
  }

  public static getInstance(): SignalingService {
    if (!SignalingService.instance) {
      SignalingService.instance = new SignalingService();
    }
    return SignalingService.instance;
  }

  // Initialize with Redux dispatch
  public init(dispatch: Dispatch<any>): void {
    if (this.dispatch) {
      // If already initialized with the same dispatch, silently return
      if (this.dispatch === dispatch) {
        return;
      }
      // If initialized with a different dispatch, update it
      this.dispatch = dispatch;
      return;
    }
    logger.info("[WebSocket] Initializing SignalingService...");
    this.dispatch = dispatch;

    const generatedName = `Player-${this.clientId.slice(0, 4)}`;
    this.dispatch(
      setSelfIdentity({ clientId: this.clientId, name: generatedName }),
    );
  }

  // Get current connection status
  public getStatus(): SignalingStatus {
    return this.status;
  }

  // Connect to the signaling server
  public connect(url: string): void {
    if (!this.dispatch) {
      logger.error(
        "[WebSocket] SignalingService not initialized. Call init(dispatch) first.",
      );
      return;
    }

    // If we're already connecting or connected, don't try to connect again
    if (
      this.isConnecting ||
      (this.ws &&
        (this.status === SignalingStatus.CONNECTING ||
          this.status === SignalingStatus.OPEN))
    ) {
      logger.warn("[WebSocket] Connection already exists or is connecting.");
      return;
    }

    // If we're in a closing state, wait for it to complete
    if (this.status === SignalingStatus.CLOSING) {
      logger.warn("[WebSocket] Connection is currently closing.");
      return;
    }

    logger.debug(`[WebSocket] Connecting to signaling server at ${url}...`);
    this.status = SignalingStatus.CONNECTING;
    this.isConnecting = true;
    this.dispatch?.(setSignalingStatus(SignalingStatus.CONNECTING));

    try {
      this.ws = new WebSocket(url + "?clientId=" + this.clientId);

      this.ws.onopen = () => {
        logger.debug("[WebSocket] Connection established.");
        this.status = SignalingStatus.OPEN;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.dispatch?.(setSignalingStatus(SignalingStatus.OPEN));
        this.startKeepAlive();
      };

      this.ws.onmessage = (event) => {
        logger.debug("[WebSocket] Raw message received:", {
          event: event.data,
        });
        try {
          const message: SignalingMessage = JSON.parse(event.data);
          logger.debug("[WebSocket] Received message:", { type: message.type });
          this.handleMessage(message);
        } catch (error) {
          logger.error("[WebSocket] Failed to parse message:", error as Error, {
            eventData: event.data,
          });
        }
      };

      this.ws.onerror = (event) => {
        logger.error("[WebSocket] Error:", {} as Error, { event });
        this.dispatch?.(setError("WebSocket connection error."));
        this.isConnecting = false;
        // Don't close the connection on error, let the onclose handler handle it
      };

      this.ws.onclose = (event) => {
        logger.info(
          `[WebSocket] Connection closed. Code: ${event.code}, Reason: ${event.reason}`,
        );
        this.stopKeepAlive();
        this.isConnecting = false;

        // Only attempt to reconnect if we're not manually closing
        if (this.status !== SignalingStatus.CLOSING) {
          this.status = SignalingStatus.CLOSED;
          this.dispatch?.(setSignalingStatus(SignalingStatus.CLOSED));
          this.ws = null;

          if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            const delay = this.RECONNECT_DELAY_MS * this.reconnectAttempts;
            logger.debug(
              `[WebSocket] Reconnecting (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`,
            );
            setTimeout(() => this.connect(url), delay);
          } else {
            logger.error("[WebSocket] Max reconnection attempts reached.");
            this.dispatch?.(setError("Failed to connect to signaling server."));
          }
        } else {
          // If manually closing, just update final state
          this.status = SignalingStatus.CLOSED;
          this.dispatch?.(setSignalingStatus(SignalingStatus.CLOSED));
          this.ws = null;
        }
      };
    } catch (error) {
      logger.error("[WebSocket] Error creating connection:", error as Error);
      this.status = SignalingStatus.CLOSED;
      this.isConnecting = false;
      this.dispatch?.(setSignalingStatus(SignalingStatus.CLOSED));
      this.ws = null;
    }
  }

  // Disconnect from the server
  public disconnect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.info("[WebSocket] Disconnecting...");
      this.stopKeepAlive();
      this.status = SignalingStatus.CLOSING;
      this.dispatch?.(setSignalingStatus(SignalingStatus.CLOSING));
      this.ws.close();
    } else {
      logger.info("[WebSocket] Already closed or closing.");
      this.status = SignalingStatus.CLOSED;
      this.dispatch?.(setSignalingStatus(SignalingStatus.CLOSED));
      this.ws = null;
    }
    this.isConnecting = false; // Always reset this!
  }

  // Send a message to the server
  public sendMessage(type: string, payload?: any): void {
    if (!this.ws || !this.dispatch) {
      logger.error(
        "[WebSocket] No WebSocket connection exists or dispatch not initialized",
      );
      return;
    }

    logger.debug("[WebSocket] Pre-send state check:", {
      type,
      wsReadyState: this.ws.readyState,
      status: this.status,
      isConnecting: this.isConnecting,
    });

    if (this.ws.readyState !== WebSocket.OPEN) {
      logger.error(
        "[WebSocket] Cannot send message, connection not open. State:",
        {} as Error,
        {
          wsReadyState: this.ws.readyState,
          status: this.status,
          isConnecting: this.isConnecting,
        },
      );
      return;
    }

    try {
      const message: SignalingMessage = { type, payload };
      logger.debug("[WebSocket] Attempting to send:", {
        type,
        payload,
        wsReadyState: this.ws.readyState,
      });
      this.ws.send(JSON.stringify(message));
      logger.info("[WebSocket] Message sent successfully");
    } catch (error) {
      logger.error("[WebSocket] Error sending message:", error as Error);
      if (this.dispatch) {
        this.dispatch(setError("Failed to send message."));
      }
    }
  }

  public sendChatMessage(text: string): void {
    if (!this.dispatch) return;
    const timestamp = Date.now();
    this.dispatch(chatMessageSent({ text, timestamp }));
    this.sendMessage("chatMessage", { text, timestamp });
  }

  public sendStartIntent(): void {
    if (!this.dispatch || !this.opponentId) return;
    if (this.selfStartIntent) return;

    this.selfStartIntent = true;
    this.dispatch(setSelfStartIntent(true));
    this.dispatch(
      addSystemMessage({
        text: `You clicked to start game, waiting for Player-${this.opponentId.slice(0, 4)}...`,
        timestamp: Date.now(),
      }),
    );
    this.sendMessage("start_intent", { to: this.opponentId });
    this.maybeStartWebRTC();
  }

  // Handle incoming messages
  private handleMessage(message: SignalingMessage): void {
    if (!this.dispatch) return;

    logger.debug("[WebSocket] Handling message:", {
      type: message.type,
      payload: message.payload,
      senderId: message.senderId,
    });

    switch (message.type) {
      case "paired":
        logger.debug("[WebSocket] Paired with opponent:", {
          opponentId: message.payload.opponentId,
          wsReadyState: this.ws?.readyState,
          status: this.status,
          isConnecting: this.isConnecting,
        });

        this.dispatch(
          addSystemMessage({
            text: `Paired with opponent Player-${message.payload.opponentId.slice(0, 4)}`,
            timestamp: Date.now(),
          }),
        );

        this.opponentId = message.payload.opponentId;
        this.selfStartIntent = false;
        this.opponentStartIntent = false;
        this.hasStartedWebRTCOnce = false;
        this.dispatch(setSelfStartIntent(false));
        this.dispatch(setOpponentStartIntent(false));

        // Only proceed with WebRTC setup after both players opt in
        this.dispatch(
          setPeerConnected({
            peerId: message.payload.opponentId,
            isHost: message.payload.isHost,
          }),
        );
        break;

      case "host_assigned":
        logger.debug(
          "[WebSocket] Assigned as host for game:",
          message.payload.gameId,
        );
        this.dispatch(setGameId(message.payload.gameId));
        this.isHost = true;
        this.dispatch(setIsHost(true));
        this.dispatch(setRoomGameId(message.payload.gameId));
        this.dispatch(
          addSystemMessage({
            text: `Hosting room Room-${message.payload.gameId.slice(0, 4)}. Waiting for opponent...`,
            timestamp: Date.now(),
          }),
        );
        break;

      case "join_game":
        logger.debug("[WebSocket] Joining game:", message.payload.gameId);
        this.dispatch(setGameId(message.payload.gameId));
        this.isHost = false;
        this.dispatch(setIsHost(false));
        this.dispatch(setRoomGameId(message.payload.gameId));
        this.dispatch(
          addSystemMessage({
            text: `Joined room Room-${message.payload.gameId.slice(0, 4)}`,
            timestamp: Date.now(),
          }),
        );
        break;

      case "ready_for_offer":
        logger.debug("[WebSocket] Peer ready for offer:", {
          message: message.senderId,
        });
        webRTCService.handleReadyForOffer(message.senderId || "");
        break;

      case "peer_ready":
        logger.debug(
          "[WebSocket] Peer ready to connect:",
          message.payload.peerId,
        );
        this.dispatch(
          setPeerConnected({
            peerId: message.payload.peerId,
            isHost: this.isHost,
          }),
        );
        break;

      case "ping":
        // Handle ping message from server
        logger.debug("[WebSocket] Received ping, sending pong");
        this.sendMessage("pong");
        break;

      case "pong":
        // Handle pong response from server
        logger.debug("[WebSocket] Received pong");
        break;

      case "offer":
        if (message.payload?.sdp) {
          logger.debug(`[WebSocket] Received offer from ${message.senderId}`);
          webRTCService.handleRemoteOffer(message.payload.sdp);
        } else {
          logger.warn("Received invalid offer message:", message.payload);
        }
        break;

      case "answer":
        if (message.payload?.sdp) {
          logger.debug(`[WebSocket] Received answer from ${message.senderId}`);
          webRTCService.handleRemoteAnswer(message.payload.sdp);
        } else {
          logger.warn("Received invalid answer message:", message.payload);
        }
        break;

      case "ice-candidate":
        if (message.payload?.candidate) {
          logger.debug(
            `[WebSocket] Received ICE candidate from ${message.senderId}`,
          );
          webRTCService.handleRemoteCandidate(message.payload.candidate);
        } else {
          logger.warn("Received invalid candidate message:", message.payload);
        }
        break;

      case "chatMessage":
        if (message.payload?.text) {
          this.dispatch(
            chatMessageReceived({
              fromId: message.senderId || message.payload.fromId || "unknown",
              text: message.payload.text,
              timestamp: message.payload.timestamp ?? Date.now(),
            }),
          );
        }
        break;

      case "start_intent":
        if (!message.senderId) break;
        this.opponentStartIntent = true;
        this.dispatch(setOpponentStartIntent(true));
        this.dispatch(
          addSystemMessage({
            text: `Player-${message.senderId.slice(0, 4)} clicked to start game.`,
            timestamp: Date.now(),
          }),
        );
        this.maybeStartWebRTC();
        break;

      case "error":
        logger.error("[WebSocket] Server error:", {} as Error, {
          message: message.payload,
        });
        if (this.dispatch) {
          this.dispatch(setError(message.payload || "Unknown server error"));
        }
        break;

      default:
        logger.warn("[WebSocket] Default handler: Unknown message type:", {
          type: message.type,
        });
    }
  }

  private maybeStartWebRTC(): void {
    if (this.hasStartedWebRTCOnce) return;
    if (!this.selfStartIntent || !this.opponentStartIntent) return;
    if (!this.opponentId) return;

    logger.info("[WebSocket] Both players ready to start, initializing WebRTC");
    this.hasStartedWebRTCOnce = true;
    webRTCService.setupConnection(this.isHost, this.opponentId);
  }

  private startKeepAlive(): void {
    this.stopKeepAlive(); // Clear any existing interval
    this.keepAliveInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendMessage("ping", { clientId: this.clientId });
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}

// Export a singleton instance
export const signalingService = SignalingService.getInstance();
