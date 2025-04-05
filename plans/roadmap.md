# Pong WebRTC Game Development Plan

## Overview
A multiplayer Pong game using WebRTC for peer-to-peer connections and Firebase for matchmaking. The game follows classic Pong rules with a retro aesthetic and supports both desktop and mobile play.

## Tech Stack Update
- **Frontend:** React
- **State Management:** Redux Toolkit
- **Networking:** 
  - WebRTC with Google STUN server for peer connections
  - Simple Express + WebSocket server for signaling
- **Testing:** Jest, React Testing Library

## Development Phases

### Phase 1: Project Setup
- [ ] Create React frontend app
- [ ] Create simple signaling server
  - [ ] Set up Express server
  - [ ] Add WebSocket support
  - [ ] Implement basic room/connection matching
- [ ] Set up Redux Toolkit store

### Phase 2: Signaling Server
- [ ] Create basic Express server with WebSocket
```javascript
// Basic server structure
const express = require('express');
const WebSocket = require('ws');
const server = express();
const wss = new WebSocket.Server({ port: 8080 });

// Track available games/players
const waitingPlayers = new Map();

wss.on('connection', (ws) => {
  // Handle new connections
  // Match players
  // Relay WebRTC signaling data
});
```
- [ ] Implement connection handling:
  - [ ] Player joins
  - [ ] Match two players
  - [ ] Exchange WebRTC offers/answers
  - [ ] Cleanup disconnected players

### Phase 3: WebRTC Implementation
- [ ] Set up WebRTC peer connection with STUN
```javascript
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};
```
- [ ] Create connection establishment flow
- [ ] Implement data channel for game state
- [ ] Handle connection state changes
- [ ] Add reconnection logic

### Phase 4: User Interface and Experience
1. Implement retro styling
2. Add player name editing
3. Implement score display and win tracking
4. Create game controls (ready button, pause)
5. Add mobile device detection and orientation handling
6. Implement sound effects with toggle controls

### Phase 5: Testing and Refinement
1. Comprehensive unit testing
2. Integration testing for complete game flow
3. Performance optimization
4. Cross-browser compatibility testing
5. Mobile device testing
6. Bug fixing and polish

## Detailed Implementation Plan

### Game Logic

#### Ball Physics
```javascript
function updateBallPosition(ball, leftPaddle, rightPaddle, gameWidth, gameHeight) {
  // Update position
  ball.x += ball.vx;
  ball.y += ball.vy;
  
  // Wall collisions (top/bottom)
  if (ball.y <= 0 || ball.y >= gameHeight) {
    ball.vy = -ball.vy;
    playSound('wall-hit');
  }
  
  // Paddle collisions
  if (ball.vx < 0 && ball.x <= leftPaddle.width && 
      ball.y >= leftPaddle.y && ball.y <= leftPaddle.y + leftPaddle.height) {
    ball.vx = -ball.vx;
    playSound('paddle-hit');
  }
  
  if (ball.vx > 0 && ball.x >= gameWidth - rightPaddle.width && 
      ball.y >= rightPaddle.y && ball.y <= rightPaddle.y + rightPaddle.height) {
    ball.vx = -ball.vx;
    playSound('paddle-hit');
  }
  
  // Scoring
  if (ball.x <= 0) {
    scorePoint('right');
    resetBall(ball);
  }
  
  if (ball.x >= gameWidth) {
    scorePoint('left');
    resetBall(ball);
  }
  
  return ball;
}
```

#### Paddle Movement
```javascript
function updatePaddlePosition(paddle, targetY, gameHeight) {
  const paddleHeight = paddle.height;
  
  // Constrain target position to stay within game bounds
  const minY = 0;
  const maxY = gameHeight - paddleHeight;
  const constrainedTargetY = Math.max(minY, Math.min(maxY, targetY));
  
  // Apply linear transition
  const transitionSpeed = 0.2;
  const newY = paddle.y + (constrainedTargetY - paddle.y) * transitionSpeed;
  
  return newY;
}
```

### Redux State Management

#### Game Slice
```javascript
// gameSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  status: 'lobby', // lobby, countdown, playing, paused, gameOver
  ball: { x: 50, y: 50, vx: 5, vy: 5 },
  leftPaddle: { y: 50 },
  rightPaddle: { y: 50 },
  scores: { left: 0, right: 0 },
  wins: { left: 0, right: 0 }
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    updateBall: (state, action) => {
      state.ball = action.payload;
    },
    updatePaddle: (state, action) => {
      const { player, position } = action.payload;
      if (player === 'left') {
        state.leftPaddle.y = position;
      } else {
        state.rightPaddle.y = position;
      }
    },
    scorePoint: (state, action) => {
      const side = action.payload;
      state.scores[side]++;
      
      // Check for game end
      if (state.scores[side] >= 10) {
        state.status = 'gameOver';
        state.wins[side]++;
      }
    },
    setGameStatus: (state, action) => {
      state.status = action.payload;
    },
    resetGame: (state) => {
      state.status = 'lobby';
      state.scores = { left: 0, right: 0 };
      state.ball = { x: 50, y: 50, vx: 5, vy: 5 };
    }
  }
});

export const { updateBall, updatePaddle, scorePoint, setGameStatus, resetGame } = gameSlice.actions;
export default gameSlice.reducer;
```

### WebRTC Implementation

#### Connection Setup
```javascript
// webrtcService.js
export async function createPeerConnection(ws, isHost) {
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  };
  
  const peerConnection = new RTCPeerConnection(configuration);
  
  // Create data channel if host, otherwise wait for it
  const dataChannel = isHost 
    ? peerConnection.createDataChannel('gameData')
    : null;
    
  // Set up data channel for non-host when it's received
  if (!isHost) {
    peerConnection.ondatachannel = (event) => {
      const receivedDataChannel = event.channel;
      setupDataChannel(receivedDataChannel);
      return receivedDataChannel;
    };
  } else {
    setupDataChannel(dataChannel);
  }
  
  // ICE candidate handling
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      // Send candidate to peer via WebSocket
      ws.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate
      }));
    }
  };
  
  // Connection state monitoring
  peerConnection.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", peerConnection.iceConnectionState);
    switch(peerConnection.iceConnectionState) {
      case 'disconnected':
        handleDisconnect();
        break;
      case 'failed':
        handleConnectionFailure();
        break;
      case 'connected':
        handleConnectionSuccess();
        break;
    }
  };
  
  return { peerConnection, dataChannel };
}

function setupDataChannel(dataChannel) {
  dataChannel.onopen = () => {
    console.log("Data channel opened");
  };
  
  dataChannel.onclose = () => {
    console.log("Data channel closed");
  };
  
  dataChannel.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleGameMessage(message);
  };
}
```

### Signaling Service (Replacing Firebase Integration)

```javascript
// signalingService.js
export class SignalingService {
  constructor(serverUrl) {
    this.ws = new WebSocket(serverUrl);
    this.setupWebSocket();
  }
  
  setupWebSocket() {
    this.ws.onopen = () => {
      console.log('Connected to signaling server');
    };
    
    this.ws.onclose = () => {
      console.log('Disconnected from signaling server');
      // Implement reconnection logic if needed
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleSignalingMessage(message);
    };
  }
  
  async handleSignalingMessage(message) {
    switch(message.type) {
      case 'matched':
        // Players have been matched, start WebRTC process
        if (message.isHost) {
          await this.initiatePeerConnection();
        }
        break;
        
      case 'offer':
        await this.handleOffer(message.offer);
        break;
        
      case 'answer':
        await this.handleAnswer(message.answer);
        break;
        
      case 'ice-candidate':
        await this.handleNewICECandidate(message.candidate);
        break;
    }
  }
  
  async initiatePeerConnection() {
    const { peerConnection } = await createPeerConnection(this.ws, true);
    
    // Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    this.ws.send(JSON.stringify({
      type: 'offer',
      offer: offer
    }));
  }
  
  async handleOffer(offer) {
    const { peerConnection } = await createPeerConnection(this.ws, false);
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    this.ws.send(JSON.stringify({
      type: 'answer',
      answer: answer
    }));
  }
  
  async handleAnswer(answer) {
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(answer)
    );
  }
  
  async handleNewICECandidate(candidate) {
    try {
      await this.peerConnection.addIceCandidate(candidate);
    } catch (e) {
      console.error('Error adding ice candidate:', e);
    }
  }
}

// Usage in React component
function Game() {
  useEffect(() => {
    const signaling = new SignalingService('ws://localhost:8080');
    
    return () => {
      // Cleanup
      signaling.ws.close();
    };
  }, []);
  
  // Rest of game component
}
```

### Connection State Management (Redux)

```javascript
// connectionSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  status: 'disconnected', // disconnected, connecting, connected
  isHost: false,
  peerConnection: null,
  dataChannel: null,
  error: null
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    setConnectionStatus: (state, action) => {
      state.status = action.payload;
    },
    setIsHost: (state, action) => {
      state.isHost = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.status = 'disconnected';
    },
    resetConnection: (state) => {
      return initialState;
    }
  }
});

export const { 
  setConnectionStatus, 
  setIsHost, 
  setError, 
  resetConnection 
} = connectionSlice.actions;

export default connectionSlice.reducer;
```

### Component Structure

#### Game Board Component
```jsx
// GameBoard.jsx
import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateBall, updatePaddle } from '../redux/slices/gameSlice';
import Paddle from './Paddle';
import Ball from './Ball';
import ScoreBoard from './ScoreBoard';

const GameBoard = () => {
  const dispatch = useDispatch();
  const game = useSelector(state => state.game);
  const connection = useSelector(state => state.connection);
  const gameRef = useRef(null);
  const frameRef = useRef(null);
  
  // Set up game loop
  useEffect(() => {
    if (game.status === 'playing') {
      const gameLoop = (timestamp) => {
        // Update game state
        if (connection.isHost) {
          // Only host updates ball position
          const updatedBall = updateBallPosition(
            game.ball,
            game.leftPaddle,
            game.rightPaddle,
            gameRef.current.clientWidth,
            gameRef.current.clientHeight
          );
          
          dispatch(updateBall(updatedBall));
          
          // Send updates to peer
          if (connection.dataChannel && connection.dataChannel.readyState === 'open') {
            connection.dataChannel.send(JSON.stringify({
              type: 'gameState',
              ball: updatedBall,
              hostPaddle: game.leftPaddle
            }));
          }
        }
        
        frameRef.current = requestAnimationFrame(gameLoop);
      };
      
      frameRef.current = requestAnimationFrame(gameLoop);
    }
    
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [game.status, connection.isHost]);
  
  // Handle input
  const handleMouseMove = (e) => {
    if (game.status === 'playing') {
      const rect = gameRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      
      const paddleSide = connection.isHost ? 'left' : 'right';
      dispatch(updatePaddle({ player: paddleSide, position: y }));
      
      // Send paddle position to peer
      if (connection.dataChannel && connection.dataChannel.readyState === 'open') {
        connection.dataChannel.send(JSON.stringify({
          type: 'paddleMove',
          position: y
        }));
      }
    }
  };
  
  // Render game
  return (
    <div className="game-container">
      <ScoreBoard />
      
      <div 
        className="game-board" 
        ref={gameRef}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
      >
        <div className="center-line"></div>
        
        <Paddle 
          position="left" 
          y={game.leftPaddle.y} 
        />
        
        <Paddle 
          position="right" 
          y={game.rightPaddle.y} 
        />
        
        <Ball 
          x={game.ball.x} 
          y={game.ball.y} 
        />
        
        {game.status !== 'playing' && (
          <div className="game-overlay">
            {game.status === 'lobby' && (
              <button 
                className="ready-button"
                onClick={handleReady}
              >
                READY
              </button>
            )}
            
            {game.status === 'countdown' && (
              <div className="countdown">{game.countdown}</div>
            )}
            
            {game.status === 'gameOver' && (
              <div className="game-over">
                PLAYER {game.scores.left > game.scores.right ? '1' : '2'} WINS!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameBoard;
```

## Final Steps and Considerations

1. **Performance Optimization**
   - Use requestAnimationFrame for smooth animation
   - Implement FPS limiting if needed
   - Minimize state updates and re-renders

2. **Testing Strategy**
   - Unit tests for core game mechanics
   - Integration tests for full game flow
   - Mock Firebase and WebRTC for testing

3. **Deployment Considerations**
   - Secure Firebase configuration
   - HTTPS required for WebRTC
   - Consider PWA for mobile experience

4. **Future Enhancements**
   - Improved matchmaking with player queues
   - Custom themes
   - Persistent player stats
   - Power-ups and game variations