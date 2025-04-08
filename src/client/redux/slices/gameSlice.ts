import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Paddle {
  y: number;
}

interface Scores {
  left: number;
  right: number;
}

interface GameState {
  status: 'lobby' | 'countdown' | 'playing' | 'paused' | 'gameOver';
  ball: Ball;
  leftPaddle: Paddle;
  rightPaddle: Paddle;
  scores: Scores;
  countdown: number;
  isReady: boolean;
}

const initialState: GameState = {
  status: 'lobby',
  ball: { x: 50, y: 50, vx: 5, vy: 5 },
  leftPaddle: { y: 50 },
  rightPaddle: { y: 50 },
  scores: { left: 0, right: 0 },
  countdown: 5,
  isReady: false,
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    updateBall: (state, action: PayloadAction<Ball>) => {
      state.ball = action.payload;
    },
    updatePaddle: (state, action: PayloadAction<{ player: 'left' | 'right'; position: number }>) => {
      const { player, position } = action.payload;
      if (player === 'left') {
        state.leftPaddle.y = position;
      } else {
        state.rightPaddle.y = position;
      }
    },
    scorePoint: (state, action: PayloadAction<'left' | 'right'>) => {
      const side = action.payload;
      state.scores[side]++;
      
      if (state.scores[side] >= 10) {
        state.status = 'gameOver';
      }
    },
    setGameStatus: (state, action: PayloadAction<GameState['status']>) => {
      state.status = action.payload;
    },
    setCountdown: (state, action: PayloadAction<number>) => {
      state.countdown = action.payload;
    },
    resetGame: (state) => {
      return { ...initialState, status: 'lobby' };
    },
    setReady: (state, action: PayloadAction<boolean>) => {
      state.isReady = action.payload;
    },
  },
});

export const {
  updateBall,
  updatePaddle,
  scorePoint,
  setGameStatus,
  setCountdown,
  resetGame,
  setReady,
} = gameSlice.actions;

export default gameSlice.reducer; 