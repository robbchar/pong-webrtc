import { Dispatch } from '@reduxjs/toolkit';
import { 
  setSignalingStatus, 
  setPeerConnected, 
  setPeerDisconnected, 
  setError 
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

  private constructor() {}

  public static getInstance(): SignalingService {
    if (!SignalingService.instance) {
      SignalingService.instance = new SignalingService();
    }
    return SignalingService.instance;
  }

  // Initialize with Redux dispatch
  public init(dispatch: Dispatch<any>): void {
    if (this.dispatch) {
      console.warn('SignalingService already initialized.');
      return;
    }
    console.log('Initializing SignalingService...');
    this.dispatch = dispatch;
  }

  // Get current connection status
  public getStatus(): SignalingStatus {
    return this.status;
  }

  // Connect to the signaling server
  public connect(url: string): void {
    if (!this.dispatch) {
      console.error('SignalingService not initialized. Call init(dispatch) first.');
      return;
    }
    if (this.ws && this.status !== SignalingStatus.CLOSED && this.status !== SignalingStatus.CLOSING) {
      console.warn('WebSocket connection already exists or is connecting.');
      return;
    }

    console.log(`Attempting to connect to signaling server at ${url}...`);
    this.status = SignalingStatus.CONNECTING;
    this.dispatch?.(setSignalingStatus(SignalingStatus.CONNECTING)); // Dispatch connecting

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connection established.');
      this.status = SignalingStatus.OPEN;
      this.reconnectAttempts = 0; 
      this.dispatch?.(setSignalingStatus(SignalingStatus.OPEN)); // Dispatch open
      // Optional: Send a join message if required by server (currently not needed)
      // this.sendMessage('join'); 
    };

    this.ws.onmessage = (event) => {
      try {
        const message: SignalingMessage = JSON.parse(event.data);
        console.log('Received message:', message.type);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message or invalid message format:', event.data, error);
      }
    };

    this.ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      this.dispatch?.(setError('WebSocket connection error.')); // Dispatch error
    };

    this.ws.onclose = (event) => {
      console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
      // Only update status if not already closing manually
      if (this.status !== SignalingStatus.CLOSING) { 
          this.status = SignalingStatus.CLOSED;
          this.dispatch?.(setSignalingStatus(SignalingStatus.CLOSED)); // Dispatch closed
          this.ws = null;
          
          // Reconnect logic
          if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
            setTimeout(() => this.connect(url), this.RECONNECT_DELAY_MS * this.reconnectAttempts);
          } else {
            console.error('Max reconnection attempts reached.');
            this.dispatch?.(setError('Failed to connect to signaling server.'));
          }
      } else {
          // If manually closing, just update final state
          this.status = SignalingStatus.CLOSED;
          this.dispatch?.(setSignalingStatus(SignalingStatus.CLOSED)); 
          this.ws = null;
      }
    };
  }

  // Disconnect from the server
  public disconnect(): void {
    if (this.ws) {
      console.log('Disconnecting WebSocket...');
      this.reconnectAttempts = this.MAX_RECONNECT_ATTEMPTS; // Prevent reconnect on manual disconnect
      this.status = SignalingStatus.CLOSING;
      this.dispatch?.(setSignalingStatus(SignalingStatus.CLOSING));
      this.ws.close();
      // onclose will set final state to CLOSED
    }
  }

  // Send a message to the server
  public sendMessage(type: string, payload?: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket is not connected or not open.');
      return;
    }
    const message: SignalingMessage = { type, payload };
    console.log('Sending message:', type);
    this.ws.send(JSON.stringify(message));
  }

  // Handle incoming messages
  private handleMessage(message: SignalingMessage): void {
    if (!this.dispatch) return;

    switch (message.type) {
      case 'paired':
        console.log('Paired with opponent:', message.payload.opponentId, 'Is Host:', message.payload.isHost);
        const peerPayload = { 
          peerId: message.payload.opponentId, 
          isHost: message.payload.isHost 
        };
        this.dispatch(setPeerConnected(peerPayload));
        // Initialize WebRTC connection now that we have a peer, passing dispatch
        if (this.dispatch) {
          webRTCService.initialize(peerPayload.isHost, peerPayload.peerId, this.dispatch);
        } else {
            console.error("Signaling service dispatch not available for WebRTC initialization");
        }
        break;
      case 'opponentLeft':
        console.log('Opponent disconnected.');
        this.dispatch(setPeerDisconnected());
        // Clean up the WebRTC connection
        webRTCService.closeConnection(); 
        break;
      case 'offer':
        if (message.payload?.sdp) {
          console.log(`Received offer from ${message.senderId}`);
          webRTCService.handleRemoteOffer(message.payload); // Pass the whole payload {sdp: ...}
        } else {
          console.warn('Received invalid offer message:', message.payload);
        }
        break;
      case 'answer':
        if (message.payload?.sdp) {
          console.log(`Received answer from ${message.senderId}`);
          webRTCService.handleRemoteAnswer(message.payload); // Pass the whole payload {sdp: ...}
        } else {
          console.warn('Received invalid answer message:', message.payload);
        }
        break;
      case 'error':
        console.error('Received error from server:', message.payload);
        this.dispatch(setError(message.payload || 'Unknown server error'));
        break;
      case 'candidate':
        if (message.payload?.candidate) {
          console.log(`Received remote candidate from ${message.senderId}`);
          webRTCService.handleRemoteCandidate(message.payload.candidate);
        } else {
          console.warn('Received invalid candidate message:', message.payload);
        }
        break;
      default:
        console.warn('Received unknown message type:', message.type);
    }
  }
}

// Export a singleton instance
export const signalingService = SignalingService.getInstance(); 