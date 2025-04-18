import { Dispatch } from '@reduxjs/toolkit';
import { 
  setSignalingStatus, 
  setPeerConnected, 
  setPeerDisconnected, 
  setError,
  setGameId,
  setIsHost
} from '@/store/slices/connectionSlice';
import { SignalingStatus } from '@/types/signalingTypes';
import { webRTCService } from './webRTCService'; // Import the new service

// Define the structure for messages (mirroring server)
interface SignalingMessage {
  type: string; // Keep generic for now, specific types handled in handlers
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
  private myId: string | null = null;
  private isHost: boolean = false;
  private isConnecting: boolean = false;
  private clientId: string;
  private gameId: string = '';

  private constructor() {
    this.clientId = crypto.randomUUID();

    // Make the ID accessible in the console
    if (typeof window !== 'undefined') {
      (window as any).getPlayerId = () => {
        console.log('[WebSocket] Your player ID:', this.clientId);
        return this.clientId;
      };
      console.log('[WebSocket] Type getPlayerId() in the console to see your player ID');
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
    console.log('[WebSocket] Initializing SignalingService...');
    this.dispatch = dispatch;
  }

  // Get current connection status
  public getStatus(): SignalingStatus {
    return this.status;
  }

  // Connect to the signaling server
  public connect(url: string): void {
    if (!this.dispatch) {
      console.error('[WebSocket] SignalingService not initialized. Call init(dispatch) first.');
      return;
    }

    // If we're already connecting or connected, don't try to connect again
    if (this.isConnecting || (this.ws && (this.status === SignalingStatus.CONNECTING || this.status === SignalingStatus.OPEN))) {
      console.warn('[WebSocket] Connection already exists or is connecting.');
      return;
    }

    // If we're in a closing state, wait for it to complete
    if (this.status === SignalingStatus.CLOSING) {
      console.warn('[WebSocket] Connection is currently closing.');
      return;
    }

    console.log(`[WebSocket] Connecting to signaling server at ${url}...`);
    this.status = SignalingStatus.CONNECTING;
    this.isConnecting = true;
    this.dispatch?.(setSignalingStatus(SignalingStatus.CONNECTING));

    try {
      this.ws = new WebSocket(url + '?clientId=' + this.clientId);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connection established.');
        this.status = SignalingStatus.OPEN;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.dispatch?.(setSignalingStatus(SignalingStatus.OPEN));
        this.startKeepAlive();
      };

      this.ws.onmessage = (event) => {
        // console.log('[WebSocket] Raw message received:', event.data);  // Add this line
        try {
          const message: SignalingMessage = JSON.parse(event.data);
          console.log('[WebSocket] Received message:', message.type);
          this.handleMessage(message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', event.data, error);
        }
      };

      this.ws.onerror = (event) => {
        console.error('[WebSocket] Error:', event);
        this.dispatch?.(setError('WebSocket connection error.'));
        this.isConnecting = false;
        // Don't close the connection on error, let the onclose handler handle it
      };

      this.ws.onclose = (event) => {
        console.log(`[WebSocket] Connection closed. Code: ${event.code}, Reason: ${event.reason}`);
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
            console.log(`[WebSocket] Reconnecting (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`);
            setTimeout(() => this.connect(url), delay);
          } else {
            console.error('[WebSocket] Max reconnection attempts reached.');
            this.dispatch?.(setError('Failed to connect to signaling server.'));
          }
        } else {
          // If manually closing, just update final state
          this.status = SignalingStatus.CLOSED;
          this.dispatch?.(setSignalingStatus(SignalingStatus.CLOSED));
          this.ws = null;
        }
      };
    } catch (error) {
      console.error('[WebSocket] Error creating connection:', error);
      this.status = SignalingStatus.CLOSED;
      this.isConnecting = false;
      this.dispatch?.(setSignalingStatus(SignalingStatus.CLOSED));
      this.ws = null;
    }
  }

  // Disconnect from the server
  public disconnect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Disconnecting...');
      this.stopKeepAlive();
      this.status = SignalingStatus.CLOSING;
      this.dispatch?.(setSignalingStatus(SignalingStatus.CLOSING));
      this.ws.close();
    } else {
      console.log('[WebSocket] Already closed or closing.');
      this.status = SignalingStatus.CLOSED;
      this.dispatch?.(setSignalingStatus(SignalingStatus.CLOSED));
      this.ws = null;
    }
    this.isConnecting = false; // Always reset this!
  }

  // Send a message to the server
  public sendMessage(type: string, payload?: any): void {
    if (!this.ws || !this.dispatch) {
        console.error('[WebSocket] No WebSocket connection exists or dispatch not initialized');
        return;
    }
    
    console.log('[WebSocket] Pre-send state check:', {
        type,
        wsReadyState: this.ws.readyState,
        status: this.status,
        isConnecting: this.isConnecting
    });

    if (this.ws.readyState !== WebSocket.OPEN) {
        console.error('[WebSocket] Cannot send message, connection not open. State:', {
            wsReadyState: this.ws.readyState,
            status: this.status,
            isConnecting: this.isConnecting
        });
        return;
    }

    try {
        const message: SignalingMessage = { type, payload };
        console.log('[WebSocket] Attempting to send:', {
            type,
            payload,
            wsReadyState: this.ws.readyState
        });
        this.ws.send(JSON.stringify(message));
        console.log('[WebSocket] Message sent successfully');
    } catch (error) {
        console.error('[WebSocket] Error sending message:', error);
        if (this.dispatch) {
            this.dispatch(setError('Failed to send message.'));
        }
    }
  }

  // Handle incoming messages
  private handleMessage(message: SignalingMessage): void {
    if (!this.dispatch) return;

    console.log('[WebSocket] Handling message:', {
      type: message.type,
      payload: message.payload,
      senderId: message.senderId
    });

    switch (message.type) {
      case 'paired':
        console.log('[WebSocket] Paired with opponent:', {
            opponentId: message.payload.opponentId,
            wsReadyState: this.ws?.readyState,
            status: this.status,
            isConnecting: this.isConnecting
        });

        // Only proceed with WebRTC setup if we have a stable connection
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.dispatch(setPeerConnected({ 
                peerId: message.payload.opponentId, 
                isHost: message.payload.isHost 
            }));
            webRTCService.setupConnection(message.payload.isHost, message.payload.opponentId);
        } else {
            console.log('[WebSocket] Delaying WebRTC setup until connection is stable');
            // Wait for connection to stabilize
            const checkAndSetup = () => {
                if (this.ws?.readyState === WebSocket.OPEN && this.dispatch) {
                    this.dispatch(setPeerConnected({ 
                        peerId: message.payload.opponentId, 
                        isHost: message.payload.isHost 
                    }));
                    webRTCService.setupConnection(message.payload.isHost, message.payload.opponentId);
                } else {
                    setTimeout(checkAndSetup, 100);
                }
            };
            checkAndSetup();
        }
        break;

      case 'host_assigned':
        console.log('[WebSocket] Assigned as host for game:', message.payload.gameId);
        this.gameId = message.payload.gameId;
        this.isHost = true;
        this.dispatch(setGameId(message.payload.gameId));
        this.dispatch(setIsHost(true));
        break;

      case 'join_game':
        console.log('[WebSocket] Joining game:', message.payload.gameId);
        this.gameId = message.payload.gameId;
        this.isHost = false;
        this.dispatch(setGameId(message.payload.gameId));
        this.dispatch(setIsHost(false));
        break;

      case 'ready_for_offer':
        console.log('[WebSocket] Peer ready for offer:', message.senderId);
        webRTCService.handleReadyForOffer(message.senderId || '');
        break;

      case 'peer_ready':
        console.log('[WebSocket] Peer ready to connect:', message.payload.peerId);
        this.dispatch(setPeerConnected({ 
          peerId: message.payload.peerId, 
          isHost: this.isHost 
        }));
        break;

      case 'ping':
        // Handle ping message from server
        console.log('[WebSocket] Received ping, sending pong');
        this.sendMessage('pong');
        break;

      case 'pong':
        // Handle pong response from server
        console.log('[WebSocket] Received pong');
        break;

      case 'offer':
        if (message.payload?.sdp) {
          console.log(`[WebSocket] Received offer from ${message.senderId}`);
          webRTCService.handleRemoteOffer(message.payload.sdp);
        } else {
          console.warn('Received invalid offer message:', message.payload);
        }
        break;

      case 'answer':
        if (message.payload?.sdp) {
          console.log(`[WebSocket] Received answer from ${message.senderId}`);
          webRTCService.handleRemoteAnswer(message.payload.sdp);
        } else {
          console.warn('Received invalid answer message:', message.payload);
        }
        break;

      case 'ice-candidate':
        if (message.payload?.candidate) {
          console.log(`[WebSocket] Received ICE candidate from ${message.senderId}`);
          webRTCService.handleRemoteCandidate(message.payload.candidate);
        } else {
          console.warn('Received invalid candidate message:', message.payload);
        }
        break;

      case 'error':
        console.error('[WebSocket] Server error:', message.payload);
        if (this.dispatch) {
          this.dispatch(setError(message.payload || 'Unknown server error'));
        }
        break;

      default:
        console.warn('[WebSocket] Default handler: Unknown message type:', message.type);
    }
  }

  private startKeepAlive(): void {
    this.stopKeepAlive(); // Clear any existing interval
    this.keepAliveInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendMessage('ping', { clientId: this.clientId });
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