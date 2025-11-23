import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store/store";
import { setReady, setGameStatus, resetGame } from "@/store/slices/gameSlice";
import Paddle from "../Paddle/Paddle";
import Ball from "../Ball/Ball";
import { useBallPhysics } from "@/hooks/useBallPhysics";
import { useCountdown } from "@/hooks/useCountdown";
import { useHostGameStateBroadcast } from "@/hooks/useHostGameStateBroadcast";
import { useInterpolatedGameState } from "@/hooks/useInterpolatedGameState";
import { useDebugToggle } from "@/hooks/useDebugToggle";
import useDeviceOrientation from "@/hooks/useDeviceOrientation";
import { webRTCService } from "@/services/webRTCService";
import DebugOverlay from "../DebugOverlay/DebugOverlay";
import type {
  PauseRequestMessage,
  ReadyStatusMessage,
} from "@/types/dataChannelTypes";
import styles from "./GameBoard.module.css";
import { logger } from "@/utils/logger";

const GameBoard: React.FC = () => {
  const dispatch = useDispatch();
  const { status, isReady, score, wins, countdown } = useSelector(
    (state: RootState) => state.game,
  );
  const {
    signalingStatus,
    peerStatus,
    dataChannelStatus,
    isHost,
    gameId,
    error,
  } = useSelector((state: RootState) => state.connection);
  const { ball, leftPaddle, rightPaddle } = useSelector(
    (state: RootState) => state.game,
  );
  const interpolatedGameState = useInterpolatedGameState(isHost ?? false);
  const debugOverlayEnabled = useDebugToggle();
  const { isPortrait } = useDeviceOrientation();

  // Host-only ball physics; guest renders interpolated snapshots.
  useBallPhysics();
  useCountdown({ isHost: isHost ?? false });
  useHostGameStateBroadcast(isHost ?? false);

  const sendPauseRequest = (requestedStatus: "paused" | "playing") => {
    if (dataChannelStatus !== "open") return;
    webRTCService.sendDataChannelMessage({
      type: "pauseRequest",
      payload: { requestedStatus },
    } satisfies PauseRequestMessage);
  };

  const handleReadyClick = () => {
    logger.debug("[GameBoard] Ready button clicked. States:", {
      peerStatus,
      dataChannelStatus,
      isReady,
      isHost,
      gameId,
    });

    try {
      const newReadyState = !isReady;
      dispatch(setReady(newReadyState));
      if (!(isHost ?? false) && dataChannelStatus === "open") {
        webRTCService.sendDataChannelMessage({
          type: "readyStatus",
          payload: { isReady: newReadyState },
        } satisfies ReadyStatusMessage);
      }
    } catch (error) {
      logger.error("[GameBoard] Failed to update ready state:", {} as Error, {
        error,
      });
      dispatch(setReady(isReady));
    }
  };

  const getConnectionMessage = () => {
    if (error) {
      return error;
    }

    if (signalingStatus !== "open") {
      return "Connecting to server...";
    }

    if (peerStatus === "connecting") {
      return "Establishing connection...";
    }

    if (peerStatus === "connected" && dataChannelStatus === "open") {
      return isReady ? "Waiting for opponent..." : "Click Ready to start";
    }

    return "Connecting...";
  };

  const renderOverlay = () => {
    if (status === "playing") {
      return null;
    }

    if (status === "gameOver") {
      return (
        <div className={styles.overlay} data-testid="game-over">
          <div className={styles.message}>GAME OVER</div>
          <div className={styles.winner}>
            {score.left > score.right
              ? "Left Player Wins!"
              : "Right Player Wins!"}
          </div>
          {isHost && (
            <button
              className={styles.playAgainButton}
              onClick={() => dispatch(resetGame())}
            >
              PLAY AGAIN
            </button>
          )}
        </div>
      );
    }

    if (status === "paused") {
      return (
        <div className={styles.overlay}>
          <div className={styles.message}>PAUSED</div>
          <button
            className={styles.resumeButton}
            onClick={() => {
              if (isHost) {
                dispatch(setGameStatus("playing"));
              } else {
                sendPauseRequest("playing");
              }
            }}
          >
            RESUME
          </button>
        </div>
      );
    }

    if (status === "countdown") {
      return (
        <div className={styles.overlay}>
          <div className={styles.message} data-testid="countdown">
            {countdown}
          </div>
          {isReady && (
            <button className={styles.readyButton} onClick={handleReadyClick}>
              Cancel ready
            </button>
          )}
        </div>
      );
    }

    const message = getConnectionMessage();
    return (
      <div className={styles.overlay}>
        <div className={styles.message}>{message}</div>
        {peerStatus === "connected" &&
          dataChannelStatus === "open" &&
          (!isReady ? (
            <button className={styles.readyButton} onClick={handleReadyClick}>
              Ready
            </button>
          ) : (
            <button className={styles.readyButton} onClick={handleReadyClick}>
              Cancel ready
            </button>
          ))}
      </div>
    );
  };

  return (
    <div
      className={`${styles.gameBoard} ${isPortrait ? styles.portrait : styles.landscape}`}
      data-testid="game-board"
      id="game-board"
    >
      <div className={styles.centerLine} data-testid="center-line" />
      <Paddle
        side="left"
        disableTransition={!(isHost ?? false)}
        position={
          (isHost ?? false) ? leftPaddle.y : interpolatedGameState.leftPaddleY
        }
      />
      <Paddle
        side="right"
        disableTransition={!(isHost ?? false)}
        position={(isHost ?? false) ? rightPaddle.y : rightPaddle.y}
      />
      <Ball
        x={(isHost ?? false) ? ball.x : interpolatedGameState.ball.x}
        y={(isHost ?? false) ? ball.y : interpolatedGameState.ball.y}
      />

      {/* Score Display */}
      <div className={styles.scoreContainer}>
        <div className={styles.score}>
          <div className={styles.wins}>
            {Array(wins.left)
              .fill(0)
              .map((_, i) => (
                <span key={i} className={styles.tick}>
                  ✓
                </span>
              ))}
          </div>
          <div className={styles.points}>{score.left}</div>
        </div>
        <div className={styles.score}>
          <div className={styles.wins}>
            {Array(wins.right)
              .fill(0)
              .map((_, i) => (
                <span key={i} className={styles.tick}>
                  ✓
                </span>
              ))}
          </div>
          <div className={styles.points}>{score.right}</div>
        </div>
      </div>

      {/* Game controls */}
      {status === "playing" && (
        <button
          className={styles.pauseButton}
          onClick={() => {
            if (isHost) {
              dispatch(setGameStatus("paused"));
            } else {
              sendPauseRequest("paused");
            }
          }}
        >
          ⏸
        </button>
      )}

      {/* Game overlays */}
      {renderOverlay()}

      {debugOverlayEnabled && <DebugOverlay />}

      {debugOverlayEnabled && (
        <div className={styles.roleBadge} data-testid="role-badge">
          {isHost === true ? "Host" : isHost === false ? "Guest" : "Unknown"}
        </div>
      )}
    </div>
  );
};

export default GameBoard;
