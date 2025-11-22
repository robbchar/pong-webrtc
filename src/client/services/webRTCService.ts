import { Dispatch } from "redux";
import {
  updateBall,
  updateLeftPaddle,
  updateRightPaddle,
  updateOpponentPaddle,
  updateScore,
  setCountdown,
  setGameStatus,
  setOpponentReady,
} from "@/store/slices/gameSlice";
import { addSystemMessage } from "@/store/slices/chatSlice";
import { SignalingStatus } from "@/types/signalingTypes";
import { signalingService } from "./signalingService";
import {
  setDataChannelStatus,
  setPeerConnecting,
  setPeerFailed,
  setPeerDisconnected,
  setPeerConnected,
} from "@/store/slices/connectionSlice";
import { logger } from "@/utils/logger";
import type {
  DataChannelMessage,
  DcReadyMessage,
  HostGameStateMessage,
  PaddleMoveMessage,
  ReadyStatusMessage,
} from "@/types/dataChannelTypes";

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
    logger.info("[RTCPeerConnection] Setting up connection:", {
      isHost,
      opponentId,
    });

    if (!this.dispatch) {
      logger.error("[RTCPeerConnection] Dispatch not initialized");
      return;
    }

    if (this.peerConnection) {
      logger.info(
        "[RTCPeerConnection] Connection already exists, cleaning up...",
      );
      this.cleanup();
    }

    // Wait for signaling connection to be ready
    if (signalingService.getStatus() !== SignalingStatus.OPEN) {
      logger.info("[RTCPeerConnection] Waiting for signaling connection...");
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
      logger.info("[RTCDataChannel] Creating data channel as host...");
      if (!this.peerConnection) {
        logger.error("[RTCPeerConnection] Peer connection not initialized");
        return;
      }
      this.dataChannel = this.peerConnection.createDataChannel("gameData", {
        ordered: true,
      });
      this.setupDataChannelListeners();
      await this.createAndSendOffer();
    } else {
      logger.info("[RTCPeerConnection] Waiting for data channel from host...");
      if (!this.peerConnection) {
        logger.error("[RTCPeerConnection] Peer connection not initialized");
        return;
      }
      this.peerConnection.ondatachannel = (event) => {
        logger.info("[RTCDataChannel] Received data channel from host");
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
      logger.warn("[RTCPeerConnection] Dispatch not set");
      return;
    }

    logger.info("[RTCPeerConnection] Creating new connection...");
    this.peerConnection = new RTCPeerConnection(this.configuration);
    this.dispatch(setPeerConnecting());

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.opponentId) {
        try {
          logger.info("[RTCPeerConnection] Sending ICE candidate...");
          signalingService.sendMessage("ice-candidate", {
            candidate: event.candidate,
            to: this.opponentId,
          });
        } catch (error) {
          logger.error(
            "[RTCPeerConnection] Failed to send ICE candidate:",
            {} as Error,
            { error },
          );
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection || !this.dispatch) return;

      logger.info("[RTCPeerConnection] State changed:", {
        peerConnectionConnectionState: this.peerConnection.connectionState,
      });

      switch (this.peerConnection.connectionState) {
        case "connected":
          logger.info("[RTCPeerConnection] Connection established!");
          this.dispatch(
            setPeerConnected({
              peerId: this.opponentId || "",
              isHost: this.isHost,
            }),
          );
          break;
        case "disconnected":
        case "failed":
          logger.info("[RTCPeerConnection] Connection failed or disconnected");
          this.dispatch(setPeerDisconnected());
          this.dispatch(setDataChannelStatus("closed"));
          break;
        case "closed":
          logger.info("[RTCPeerConnection] Connection closed");
          this.dispatch(setPeerDisconnected());
          this.dispatch(setDataChannelStatus("closed"));
          this.cleanup();
          break;
      }
    };
  }

  public handleReadyForOffer(fromId: string): void {
    if (!this.isHost || fromId !== this.opponentId || !this.peerConnection) {
      logger.warn("[RTCDataChannel] Cannot handle ready for offer:", {
        isHost: this.isHost,
        fromId,
        opponentId: this.opponentId,
        hasPeerConnection: !!this.peerConnection,
      });
      return;
    }

    logger.info(
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
      logger.warn("[RTCDataChannel] Cannot setup listeners:", {
        hasDataChannel: !!this.dataChannel,
        hasDispatch: !!this.dispatch,
      });
      return;
    }

    const dispatch = this.dispatch;

    this.dataChannel.onopen = () => {
      logger.info("[RTCDataChannel] Channel opened");
      dispatch(setDataChannelStatus("open"));
      this.sendDataChannelMessage({
        type: "dc_ready",
      } satisfies DcReadyMessage);
    };

    this.dataChannel.onclose = () => {
      logger.info("[RTCDataChannel] Channel closed");
      dispatch(setDataChannelStatus("closed"));
    };

    this.dataChannel.onerror = (error) => {
      logger.error("[RTCDataChannel] Error:", {} as Error, { error });
      dispatch(setDataChannelStatus("error"));
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as DataChannelMessage;
        logger.info("[RTCDataChannel] Received message:", {
          messageType: message.type,
        });

        switch (message.type) {
          case "dc_ready": {
            dispatch(
              addSystemMessage({
                text: "Datachannel handshake complete.",
                timestamp: Date.now(),
              }),
            );
            break;
          }
          case "paddleMove": {
            if (!this.isHost) break;
            const paddleMoveMessage = message as PaddleMoveMessage;
            dispatch(updateOpponentPaddle(paddleMoveMessage.payload));
            break;
          }
          case "readyStatus": {
            if (!this.isHost) break;
            const readyStatusMessage = message as ReadyStatusMessage;
            dispatch(setOpponentReady(readyStatusMessage.payload.isReady));
            break;
          }
          case "gameState": {
            if (this.isHost) break;
            const gameStateMessage = message as HostGameStateMessage;
            const { payload } = gameStateMessage;
            dispatch(updateBall(payload.ball));
            dispatch(updateLeftPaddle(payload.leftPaddle.y));
            dispatch(updateRightPaddle(payload.rightPaddle.y));
            dispatch(
              updateScore({ player: "left", points: payload.score.left }),
            );
            dispatch(
              updateScore({ player: "right", points: payload.score.right }),
            );
            dispatch(setGameStatus(payload.status));
            dispatch(setCountdown(payload.countdown));
            dispatch(setReady(payload.opponentReady));
            dispatch(setOpponentReady(payload.isReady));
            break;
          }
          default:
            logger.warn("[RTCDataChannel] Unknown message type:", {
              messageType: (message as any).type,
            });
        }
      } catch (error) {
        logger.error("[RTCDataChannel] Failed to parse message:", {} as Error, {
          error,
        });
      }
    };
  }

  public sendDataChannelMessage(message: DataChannelMessage): void {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      logger.debug("[RTCDataChannel] Channel not open, dropping message", {
        messageType: message.type,
      });
      return;
    }

    try {
      this.dataChannel.send(JSON.stringify(message));
    } catch (error) {
      logger.error("[RTCDataChannel] Failed to send message:", {} as Error, {
        error,
        messageType: message.type,
      });
    }
  }

  private async createAndSendOffer(): Promise<void> {
    if (!this.peerConnection || !this.dispatch || !this.opponentId) {
      logger.warn("[RTCPeerConnection] Cannot create offer:", {
        hasPeerConnection: !!this.peerConnection,
        hasDispatch: !!this.dispatch,
        hasOpponentId: !!this.opponentId,
      });
      return;
    }

    try {
      logger.info("[RTCPeerConnection] Creating offer...");
      const offer = await this.peerConnection.createOffer();

      if (!offer.sdp) {
        throw new Error("Offer SDP is missing");
      }

      await this.peerConnection.setLocalDescription(offer);
      logger.info("[RTCPeerConnection] Local description set");

      signalingService.sendMessage("offer", {
        sdp: this.peerConnection.localDescription,
        to: this.opponentId,
      });
    } catch (error) {
      logger.error("[RTCPeerConnection] Error creating offer:", {} as Error, {
        error,
      });
      if (this.offerRetryCount < this.MAX_OFFER_RETRIES) {
        this.offerRetryCount++;
        logger.info(
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
      logger.warn("[RTCPeerConnection] Cannot handle remote offer:", {
        hasPeerConnection: !!this.peerConnection,
        hasDispatch: !!this.dispatch,
        hasOpponentId: !!this.opponentId,
      });
      return;
    }

    try {
      logger.info("[RTCPeerConnection] Handling remote offer...");
      await this.peerConnection.setRemoteDescription(offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      signalingService.sendMessage("answer", {
        sdp: this.peerConnection.localDescription,
        to: this.opponentId,
      });
    } catch (error) {
      logger.error(
        "[RTCPeerConnection] Error handling remote offer:",
        {} as Error,
        { error },
      );
      this.dispatch(setPeerFailed());
    }
  }

  public async handleRemoteAnswer(
    answer: RTCSessionDescriptionInit,
  ): Promise<void> {
    if (!this.peerConnection || !this.dispatch) {
      logger.warn("[RTCPeerConnection] Cannot handle remote answer:", {
        hasPeerConnection: !!this.peerConnection,
        hasDispatch: !!this.dispatch,
      });
      return;
    }

    try {
      logger.info("[RTCPeerConnection] Handling remote answer...");
      await this.peerConnection.setRemoteDescription(answer);
    } catch (error) {
      logger.error(
        "[RTCPeerConnection] Error handling remote answer:",
        {} as Error,
        { error },
      );
      this.dispatch(setPeerFailed());
    }
  }

  public async handleRemoteCandidate(
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    if (!this.peerConnection || !this.dispatch) {
      logger.warn("[RTCPeerConnection] Cannot handle remote candidate:", {
        hasPeerConnection: !!this.peerConnection,
        hasDispatch: !!this.dispatch,
      });
      return;
    }

    try {
      logger.info("[RTCPeerConnection] Adding remote ICE candidate...");
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      logger.error(
        "[RTCPeerConnection] Error adding remote ICE candidate:",
        {} as Error,
        { error },
      );
      this.dispatch(setPeerFailed());
    }
  }

  public cleanup(): void {
    logger.info("[RTCPeerConnection] Cleaning up...");
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.offerRetryCount = 0;
  }
}

// Export a singleton instance
export const webRTCService = WebRTCService.getInstance();
