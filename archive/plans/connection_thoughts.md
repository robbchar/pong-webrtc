# WebRTC Game Connection Flow

## Connection Flow Diagram (doesnt work in renedered md)

Peer A (Host) Server Peer B (Joiner)
| | |
|----WebSocket connect---->| |
|<--You're host for #123--| |
| |<---WebSocket connect-----|
| |---Join game #123-------->|
|<--"Peer B wants to join"-| |
| | |
NOW create RTCPeerConnection | |
creates offer | |
| | |
|----send offer----------->| |
| |----forward offer-------->|
| | NOW create RTCPeerConnection
| | creates answer
| | |

## Code Implementation

### SignalingService (WebSocket Handler)

```typescript
class SignalingService {
  private ws: WebSocket | null = null;
  private gameId: string | null = null;

  connect() {
    console.log("[WebSocket] Initiating connection to signaling server...");
    this.ws = new WebSocket("ws://localhost:8080");

    this.ws.onopen = () => {
      console.log("[WebSocket] Connection established with signaling server");
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("[WebSocket] Received message:", message.type);

      switch (message.type) {
        case "host_assigned":
          console.log("[WebSocket] Assigned as host for game:", message.gameId);
          this.gameId = message.gameId;
          this.emit("hostAssigned", message.gameId);
          break;
        case "join_game":
          console.log("[WebSocket] Joining existing game:", message.gameId);
          this.gameId = message.gameId;
          this.emit("joinGame", message.gameId);
          break;
        case "peer_ready":
          console.log("[WebSocket] Peer ready to establish RTCPeerConnection");
          this.emit("peerReady", message.peerId);
          break;
      }
    };

    this.ws.onclose = () => {
      console.log("[WebSocket] Connection closed with signaling server");
    };
  }
}
```

### WebRTCService (Peer Connection Handler)

```typescript
class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;

  async setupConnection(isHost: boolean, peerId: string) {
    if (this.peerConnection) {
      console.log("[RTCPeerConnection] Connection already exists");
      return;
    }

    console.log(
      "[RTCPeerConnection] Creating new connection as",
      isHost ? "host" : "joiner",
    );
    this.peerConnection = new RTCPeerConnection(config);

    this.peerConnection.onconnectionstatechange = () => {
      console.log(
        "[RTCPeerConnection] State changed:",
        this.peerConnection?.connectionState,
      );
    };

    if (isHost) {
      console.log("[RTCDataChannel] Host creating data channel");
      this.dataChannel = this.peerConnection.createDataChannel("gameData");
      this.setupDataChannelListeners();
      await this.createAndSendOffer();
    } else {
      console.log("[RTCPeerConnection] Joiner waiting for data channel");
      this.peerConnection.ondatachannel = (event) => {
        console.log("[RTCDataChannel] Received data channel from host");
        this.dataChannel = event.channel;
        this.setupDataChannelListeners();
      };
    }
  }

  private setupDataChannelListeners() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log("[RTCDataChannel] Channel opened");
    };

    this.dataChannel.onclose = () => {
      console.log("[RTCDataChannel] Channel closed");
    };

    this.dataChannel.onmessage = (event) => {
      console.log("[RTCDataChannel] Received message:", event.data);
    };
  }
}
```

### GameBoard Component

```typescript
const GameBoard: React.FC = () => {
  useEffect(() => {
    console.log('[WebSocket] Initial connection setup');
    signalingService.connect();

    return () => {
      console.log('[WebSocket] Cleaning up connection');
      signalingService.disconnect();
    };
  }, []);

  useEffect(() => {
    const onPeerReady = async (peerId: string) => {
      console.log('[RTCPeerConnection] Peer ready, setting up connection');
      await webRTCService.setupConnection(isHost, peerId);
    };

    signalingService.on('peerReady', onPeerReady);
    return () => signalingService.off('peerReady', onPeerReady);
  }, [isHost]);

  const connectionMessage = useMemo(() => {
    if (!signalingService.isConnected()) return 'Connecting to server...';
    if (isHost) return 'Waiting for opponent...';
    return 'Connecting to opponent...';
  }, [isHost, signalingService.isConnected()]);

  return (
    <div className={styles.gameBoard}>
      <div className={styles.connectionStatus}>
        {connectionMessage}
      </div>
      {/* Rest of game board UI */}
    </div>
  );
};
```
