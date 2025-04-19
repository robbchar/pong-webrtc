import { Dispatch } from "redux";
import {
  updateOpponentPaddle,
  setOpponentReady,
} from "@/store/slices/gameSlice";
import { SignalingStatus } from "@/types/signalingTypes";
import { signalingService } from "./signalingService";
import {
  setDataChannelStatus,
  setPeerConnecting,
  setPeerFailed,
  setPeerDisconnected,
  setPeerConnected,
} from "@/store/slices/connectionSlice";

// Configuration for STUN servers (Google's public servers)
const peerConnectionConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export class WebRTCService {
  private static instance: WebRTCService;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private isHost: boolean = false;
  private opponentId: string | null = null;
  private dispatch: Dispatch | null = null;
  private configuration: RTCConfiguration;
  private offerRetryCount: number = 0;
  private readonly MAX_OFFER_RETRIES = 3;
  private _queuedReadyState: boolean | null = null;

  constructor(configuration: RTCConfiguration) {
    this.configuration = configuration;
  }

  public static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService(peerConnectionConfig);
    }
    return WebRTCService.instance;
  }

  public setDispatch(dispatch: Dispatch): void {
    this.dispatch = dispatch;
  }

  public async setupConnection(
    isHost: boolean,
    opponentId: string,
  ): Promise<void> {
    console.log("[RTCPeerConnection] Setting up connection:", {
      isHost,
      opponentId,
    });

    if (!this.dispatch) {
      console.error("[RTCPeerConnection] Dispatch not initialized");
      return;
    }

    if (this.peerConnection) {
      console.log(
        "[RTCPeerConnection] Connection already exists, cleaning up...",
      );
      this.cleanup();
    }

    // Wait for signaling connection to be ready
    if (signalingService.getStatus() !== SignalingStatus.OPEN) {
      console.log("[RTCPeerConnection] Waiting for signaling connection...");
      await new Promise<void>((resolve) => {
        const checkConnection = () => {
          if (signalingService.getStatus() === SignalingStatus.OPEN) {
            // Add a small delay after connection is confirmed open
            setTimeout(resolve, 500);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    } else {
      // Even if already open, add a small delay
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    this.isHost = isHost;
    this.opponentId = opponentId;

    this.setupPeerConnection();

    if (isHost) {
      console.log("[RTCDataChannel] Creating data channel as host...");
      if (!this.peerConnection) {
        console.error("[RTCPeerConnection] Peer connection not initialized");
        return;
      }
      this.dataChannel = this.peerConnection.createDataChannel("gameData", {
        ordered: true,
      });
      this.setupDataChannelListeners();
      await this.createAndSendOffer();
    } else {
      console.log("[RTCPeerConnection] Waiting for data channel from host...");
      if (!this.peerConnection) {
        console.error("[RTCPeerConnection] Peer connection not initialized");
        return;
      }
      this.peerConnection.ondatachannel = (event) => {
        console.log("[RTCDataChannel] Received data channel from host");
        this.dataChannel = event.channel;
        this.setupDataChannelListeners();
      };
      // Signal to host that we're ready for the offer
      signalingService.sendMessage("ready_for_offer", {
        to: this.opponentId,
      });
    }
  }

  private setupPeerConnection(): void {
    if (!this.dispatch) {
      console.warn("[RTCPeerConnection] Dispatch not set");
      return;
    }

    console.log("[RTCPeerConnection] Creating new connection...");
    this.peerConnection = new RTCPeerConnection(this.configuration);
    this.dispatch(setPeerConnecting());

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.opponentId) {
        try {
          console.log("[RTCPeerConnection] Sending ICE candidate...");
          signalingService.sendMessage("ice-candidate", {
            candidate: event.candidate,
            to: this.opponentId,
          });
        } catch (error) {
          console.error(
            "[RTCPeerConnection] Failed to send ICE candidate:",
            error,
          );
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection || !this.dispatch) return;

      console.log(
        "[RTCPeerConnection] State changed:",
        this.peerConnection.connectionState,
      );

      switch (this.peerConnection.connectionState) {
        case "connected":
          console.log("[RTCPeerConnection] Connection established!");
          this.dispatch(
            setPeerConnected({
              peerId: this.opponentId || "",
              isHost: this.isHost,
            }),
          );
          break;
        case "disconnected":
        case "failed":
          console.log("[RTCPeerConnection] Connection failed or disconnected");
          this.dispatch(setPeerDisconnected());
          this.dispatch(setDataChannelStatus("closed"));
          break;
        case "closed":
          console.log("[RTCPeerConnection] Connection closed");
          this.dispatch(setPeerDisconnected());
          this.dispatch(setDataChannelStatus("closed"));
          this.cleanup();
          break;
      }
    };
  }

  public handleReadyForOffer(fromId: string): void {
    if (!this.isHost || fromId !== this.opponentId || !this.peerConnection) {
      console.warn("[RTCDataChannel] Cannot handle ready for offer:", {
        isHost: this.isHost,
        fromId,
        opponentId: this.opponentId,
        hasPeerConnection: !!this.peerConnection,
      });
      return;
    }

    console.log(
      "[RTCDataChannel] Peer ready, creating data channel as host...",
    );
    this.dataChannel = this.peerConnection.createDataChannel("gameData", {
      ordered: true,
    });
    this.setupDataChannelListeners();
    this.createAndSendOffer();
  }

  private setupDataChannelListeners(): void {
    if (!this.dataChannel || !this.dispatch) {
      console.warn("[RTCDataChannel] Cannot setup listeners:", {
        hasDataChannel: !!this.dataChannel,
        hasDispatch: !!this.dispatch,
      });
      return;
    }

    const dispatch = this.dispatch;

    this.dataChannel.onopen = () => {
      console.log("[RTCDataChannel] Channel opened");
      dispatch(setDataChannelStatus("open"));
      if (this._queuedReadyState !== null) {
        this.sendReadyState(this._queuedReadyState);
        this._queuedReadyState = null;
      }
    };

    this.dataChannel.onclose = () => {
      console.log("[RTCDataChannel] Channel closed");
      dispatch(setDataChannelStatus("closed"));
    };

    this.dataChannel.onerror = (error) => {
      console.error("[RTCDataChannel] Error:", error);
      dispatch(setDataChannelStatus("error"));
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("[RTCDataChannel] Received message:", message.type);

        switch (message.type) {
          case "paddle":
            dispatch(updateOpponentPaddle(message.data));
            break;
          case "ready":
            dispatch(setOpponentReady(message.data));
            break;
          default:
            console.warn(
              "[RTCDataChannel] Unknown message type:",
              message.type,
            );
        }
      } catch (error) {
        console.error("[RTCDataChannel] Failed to parse message:", error);
      }
    };
  }

  private async createAndSendOffer(): Promise<void> {
    if (!this.peerConnection || !this.dispatch || !this.opponentId) {
      console.warn("[RTCPeerConnection] Cannot create offer:", {
        hasPeerConnection: !!this.peerConnection,
        hasDispatch: !!this.dispatch,
        hasOpponentId: !!this.opponentId,
      });
      return;
    }

    try {
      console.log("[RTCPeerConnection] Creating offer...");
      const offer = await this.peerConnection.createOffer();

      if (!offer.sdp) {
        throw new Error("Offer SDP is missing");
      }

      await this.peerConnection.setLocalDescription(offer);
      console.log("[RTCPeerConnection] Local description set");

      signalingService.sendMessage("offer", {
        sdp: this.peerConnection.localDescription,
        to: this.opponentId,
      });
    } catch (error) {
      console.error("[RTCPeerConnection] Error creating offer:", error);
      if (this.offerRetryCount < this.MAX_OFFER_RETRIES) {
        this.offerRetryCount++;
        console.log(
          `[RTCPeerConnection] Retrying offer (${this.offerRetryCount}/${this.MAX_OFFER_RETRIES})...`,
        );
        setTimeout(() => this.createAndSendOffer(), 1000);
      } else {
        this.dispatch(setPeerFailed());
      }
    }
  }

  public async handleRemoteOffer(
    offer: RTCSessionDescriptionInit,
  ): Promise<void> {
    if (!this.peerConnection || !this.dispatch || !this.opponentId) {
      console.warn("[RTCPeerConnection] Cannot handle remote offer:", {
        hasPeerConnection: !!this.peerConnection,
        hasDispatch: !!this.dispatch,
        hasOpponentId: !!this.opponentId,
      });
      return;
    }

    try {
      console.log("[RTCPeerConnection] Handling remote offer...");
      await this.peerConnection.setRemoteDescription(offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      signalingService.sendMessage("answer", {
        sdp: this.peerConnection.localDescription,
        to: this.opponentId,
      });
    } catch (error) {
      console.error("[RTCPeerConnection] Error handling remote offer:", error);
      this.dispatch(setPeerFailed());
    }
  }

  public async handleRemoteAnswer(
    answer: RTCSessionDescriptionInit,
  ): Promise<void> {
    if (!this.peerConnection || !this.dispatch) {
      console.warn("[RTCPeerConnection] Cannot handle remote answer:", {
        hasPeerConnection: !!this.peerConnection,
        hasDispatch: !!this.dispatch,
      });
      return;
    }

    try {
      console.log("[RTCPeerConnection] Handling remote answer...");
      await this.peerConnection.setRemoteDescription(answer);
    } catch (error) {
      console.error("[RTCPeerConnection] Error handling remote answer:", error);
      this.dispatch(setPeerFailed());
    }
  }

  public async handleRemoteCandidate(
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    if (!this.peerConnection || !this.dispatch) {
      console.warn("[RTCPeerConnection] Cannot handle remote candidate:", {
        hasPeerConnection: !!this.peerConnection,
        hasDispatch: !!this.dispatch,
      });
      return;
    }

    try {
      console.log("[RTCPeerConnection] Adding remote ICE candidate...");
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.error(
        "[RTCPeerConnection] Error adding remote ICE candidate:",
        error,
      );
      this.dispatch(setPeerFailed());
    }
  }

  public sendReadyState(isReady: boolean): void {
    if (!this.dataChannel) {
      console.log("[RTCDataChannel] Channel not ready, queueing ready state");
      this._queuedReadyState = isReady;
      return;
    }

    if (this.dataChannel.readyState !== "open") {
      console.log("[RTCDataChannel] Channel not open, queueing ready state");
      this._queuedReadyState = isReady;
      return;
    }

    try {
      const message = JSON.stringify({
        type: "ready",
        data: isReady,
      });
      this.dataChannel.send(message);
      console.log("[RTCDataChannel] Sent ready state:", isReady);
    } catch (error) {
      console.error("[RTCDataChannel] Failed to send ready state:", error);
      throw error;
    }
  }

  public cleanup(): void {
    console.log("[RTCPeerConnection] Cleaning up...");
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.offerRetryCount = 0;
    this._queuedReadyState = null;
  }
}

// Export a singleton instance
export const webRTCService = WebRTCService.getInstance();
