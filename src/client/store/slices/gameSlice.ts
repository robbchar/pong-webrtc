import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type GameStatus =
  | "waiting"
  | "countdown"
  | "playing"
  | "paused"
  | "gameOver";

export interface GameState {
  status: GameStatus;
  ball: {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
  };
  leftPaddle: {
    y: number;
  };
  rightPaddle: {
    y: number;
  };
  score: {
    left: number;
    right: number;
  };
  wins: {
    left: number;
    right: number;
  };
  countdown: number;
  isReady: boolean;
  opponentReady: boolean;
}

const initialState: GameState = {
  status: "waiting",
  ball: {
    x: 50,
    y: 50,
    velocityX: 0,
    velocityY: 0,
  },
  leftPaddle: {
    y: 50,
  },
  rightPaddle: {
    y: 50,
  },
  score: {
    left: 0,
    right: 0,
  },
  wins: {
    left: 0,
    right: 0,
  },
  countdown: 5,
  isReady: false,
  opponentReady: false,
};

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    setGameStatus: (state, action: PayloadAction<GameStatus>) => {
      state.status = action.payload;
    },
    updateBall: (state, action: PayloadAction<GameState["ball"]>) => {
      state.ball = action.payload;
    },
    updateLeftPaddle: (state, action: PayloadAction<number>) => {
      state.leftPaddle.y = action.payload;
    },
    updateRightPaddle: (state, action: PayloadAction<number>) => {
      state.rightPaddle.y = action.payload;
    },
    updateOpponentPaddle: (state, action: PayloadAction<{ y: number }>) => {
      // TODO: determine whether to update left or right paddle based on player side/host authority.
      state.rightPaddle.y = action.payload.y;
    },
    updateScore: (
      state,
      action: PayloadAction<{ player: "left" | "right"; points: number }>,
    ) => {
      const { player, points } = action.payload;
      state.score[player] = points;

      // Check if game is over (10 points)
      if (points >= 10) {
        state.wins[player] = state.wins[player] + 1;
        state.status = "gameOver";
      }
    },
    resetGame: (state) => {
      return {
        ...state,
        status: "waiting",
        ball: { ...initialState.ball },
        score: { ...initialState.score },
        countdown: initialState.countdown,
        isReady: false,
        opponentReady: false,
      };
    },
    setCountdown: (state, action: PayloadAction<number>) => {
      state.countdown = action.payload;
    },
    setReady: (state, action: PayloadAction<boolean>) => {
      state.isReady = action.payload;
      // If both players are ready, start the countdown
      if (state.isReady && state.opponentReady) {
        state.status = "countdown";
      } else if (state.status === "countdown" && !state.isReady) {
        // If a player becomes not ready during countdown, go back to waiting
        state.status = "waiting";
      }
    },
    setOpponentReady: (state, action: PayloadAction<boolean>) => {
      state.opponentReady = action.payload;
      // If both players are ready, start the countdown
      if (state.isReady && state.opponentReady) {
        state.status = "countdown";
      } else if (state.status === "countdown" && !state.opponentReady) {
        // If a player becomes not ready during countdown, go back to waiting
        state.status = "waiting";
      }
    },
  },
});

export const {
  setGameStatus,
  updateBall,
  updateLeftPaddle,
  updateRightPaddle,
  updateOpponentPaddle,
  updateScore,
  resetGame,
  setCountdown,
  setReady,
  setOpponentReady,
} = gameSlice.actions;

export default gameSlice.reducer;
