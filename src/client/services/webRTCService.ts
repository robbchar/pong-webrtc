import { signalingService } from './signalingService';
import { 
    setDataChannelStatus, 
    setPeerConnecting, 
    setPeerFailed, 
    setPeerDisconnected // Assuming setError is already imported if needed
} from '@/store/slices/connectionSlice';
import { Dispatch } from 'redux';
import { updateOpponentPaddle } from '@/store/slices/gameSlice'; // Import the action

// Configuration for STUN servers (Google's public servers)
const peerConnectionConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // You can add more STUN/TURN servers here if needed
  ],
};

class WebRTCService {
  private static instance: WebRTCService;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private isHost: boolean = false;
  private opponentId: string | null = null;
  private dispatch: Dispatch<any> | null = null;

  private constructor() {}

  public static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
    }
    return WebRTCService.instance;
  }

  // Initialize and create the peer connection
  public async initialize(isHost: boolean, opponentId: string, dispatch: Dispatch<any>): Promise<void> {
    if (this.peerConnection) {
      console.warn('WebRTCService already initialized.');
      return;
    }
    this.dispatch = dispatch;
    console.log(`Initializing WebRTCService. Is host: ${isHost}, Opponent: ${opponentId}`);
    this.isHost = isHost;
    this.opponentId = opponentId;

    try {
      this.dispatch(setPeerConnecting());
      this.peerConnection = new RTCPeerConnection(peerConnectionConfig);
      this.setupPeerConnectionListeners();
      
      // HOST: Create the data channel *before* creating the offer
      if (this.isHost) {
        console.log('Creating data channel...');
        // Label can be anything, options can specify reliability etc.
        this.dataChannel = this.peerConnection.createDataChannel("gameData", { ordered: true });
        this.setupDataChannelListeners(); // Setup listeners immediately for the host
        await this.createOffer(); // Now create offer
      } 
      // NON-HOST: Listens for the channel via ondatachannel event setup in setupPeerConnectionListeners

    } catch (error) {
      console.error('Error initializing RTCPeerConnection or DataChannel:', error);
      this.dispatch?.(setPeerFailed());
    }
  }

  // Setup listeners for the peer connection events
  private setupPeerConnectionListeners(): void {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Generated ICE candidate:', event.candidate.candidate.substring(0, 30) + '...');
        // Send the candidate to the opponent via the signaling server
        signalingService.sendMessage('candidate', { 
          candidate: event.candidate 
          // Add targetId: this.opponentId if server requires it 
        });
      } else {
        console.log('All ICE candidates have been sent.');
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (!this.peerConnection) return;
      const state = this.peerConnection.iceConnectionState;
      console.log(`ICE Connection State: ${state}`);
      switch (state) {
        case 'connected':
          // Connection established, but data channel might not be open yet
          // Handled by data channel 'open' event mostly
          break;
        case 'disconnected':
          // Often recoverable, maybe update UI temporarily?
          this.dispatch?.(setPeerDisconnected());
          break;
        case 'failed':
          // Connection failed, likely needs cleanup/reset
          this.dispatch?.(setPeerFailed());
          this.closeConnection(); // Clean up
          break;
        case 'closed':
          // Connection closed
          this.dispatch?.(setPeerDisconnected());
          break;
        default:
          break;
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      console.log('Data channel received!');
      this.dataChannel = event.channel;
      this.setupDataChannelListeners();
    };

    // Other listeners like ontrack (for video/audio), onnegotiationneeded can be added here
  }
  
  // Handle incoming ICE candidates from the signaling server
  public async handleRemoteCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      console.warn('PeerConnection not initialized. Cannot handle remote candidate.');
      return;
    }
    try {
        const iceCandidate = new RTCIceCandidate(candidate);
        await this.peerConnection.addIceCandidate(iceCandidate);
        console.log('Successfully added remote ICE candidate.');
    } catch (error) {
        console.error('Error adding remote ICE candidate:', error);
    }
  }

  // Create and send offer (called by host)
  private async createOffer(): Promise<void> {
    if (!this.peerConnection) return;
    console.log('Creating WebRTC Offer...');
    try {
      // Data channel created in initialize for host
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      console.log('Offer created and set as local description.');
      signalingService.sendMessage('offer', { sdp: offer });
    } catch (error) {
      console.error('Error creating or sending offer:', error);
      // TODO: Handle offer error
    }
  }

  // Handle incoming offer (called by non-host)
  public async handleRemoteOffer(offerData: { sdp: RTCSessionDescriptionInit }): Promise<void> {
    if (!this.peerConnection || this.isHost) {
      console.warn('Cannot handle remote offer: Connection not ready or client is host.');
      return;
    }
    console.log('Received remote offer.');
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerData.sdp));
      console.log('Remote offer set successfully.');
      await this.createAnswer();
    } catch (error) {
      console.error('Error handling remote offer:', error);
      // TODO: Handle offer error
    }
  }

  // Create and send answer (called by non-host after receiving offer)
  private async createAnswer(): Promise<void> {
    if (!this.peerConnection) return;
    console.log('Creating WebRTC Answer...');
    try {
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('Answer created and set as local description.');
      signalingService.sendMessage('answer', { sdp: answer });
    } catch (error) {
      console.error('Error creating or sending answer:', error);
      // TODO: Handle answer error
    }
  }

  // Handle incoming answer (called by host)
  public async handleRemoteAnswer(answerData: { sdp: RTCSessionDescriptionInit }): Promise<void> {
    if (!this.peerConnection || !this.isHost) {
      console.warn('Cannot handle remote answer: Connection not ready or client is not host.');
      return;
    }
    console.log('Received remote answer.');
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerData.sdp));
      console.log('Remote answer set successfully. WebRTC connection should be establishing.');
    } catch (error) {
      console.error('Error handling remote answer:', error);
      // TODO: Handle answer error
    }
  }

  // Setup listeners for the data channel
  private setupDataChannelListeners(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('Data channel OPENED!');
      this.dispatch?.(setDataChannelStatus('open'));
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel CLOSED.');
      this.dispatch?.(setDataChannelStatus('closed'));
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Data channel message received:', message.type);
        
        // Handle different message types
        switch (message.type) {
          case 'paddleMove':
            if (typeof message.payload?.y === 'number') {
              this.dispatch?.(updateOpponentPaddle({ y: message.payload.y }));
            } else {
              console.warn('Invalid paddleMove payload:', message.payload);
            }
            break;
          // Add other cases like 'gameState', 'scoreUpdate' later
          default:
            console.warn('Unknown data channel message type:', message.type);
        }

      } catch (error) {
        console.error('Error parsing data channel message:', error);
      }
    };

    this.dataChannel.onerror = (event) => {
      console.error('Data channel error occurred.');
      // Consider dispatching a general error or specific data channel error
      // this.dispatch?.(setError('Data channel error'));
    };
  }
  
  // Send game-related data via the Data Channel
  public sendGameData(data: any): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
          const message = JSON.stringify(data);
          this.dataChannel.send(message);
          // console.log('Sent game data:', data.type); // Optional logging
      } catch (error) {
          console.error("Error sending game data:", error);
      }
    } else {
      console.warn('Cannot send game data: Data channel not open.', this.dataChannel?.readyState);
    }
  }

  // Cleanup resources
  public closeConnection(): void {
    console.log('Closing WebRTC connection...');
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
      this.dispatch?.(setDataChannelStatus('closed'));
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.isHost = false;
    this.opponentId = null;
    this.dispatch = null;
  }
}

// Export a singleton instance
export const webRTCService = WebRTCService.getInstance(); 