import type { GameState } from "@/store/slices/gameSlice";

export type DataChannelMessage =
  | DcReadyMessage
  | ReadyStatusMessage
  | PaddleMoveMessage
  | HostGameStateMessage;

export interface DcReadyMessage {
  type: "dc_ready";
}

export interface ReadyStatusMessage {
  type: "readyStatus";
  payload: {
    isReady: boolean;
  };
}

export interface PaddleMoveMessage {
  type: "paddleMove";
  payload: {
    y: number;
  };
}

export type HostGameStatePayload = Pick<
  GameState,
  | "ball"
  | "leftPaddle"
  | "rightPaddle"
  | "score"
  | "status"
  | "countdown"
  | "isReady"
  | "opponentReady"
>;

export interface HostGameStateMessage {
  type: "gameState";
  payload: HostGameStatePayload;
  timestamp: number;
}
