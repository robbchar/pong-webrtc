import React from "react";
import { useSelector } from "react-redux";
import styles from "./Paddle.module.css";
import { usePaddleMovement } from "@/hooks/usePaddleMovement";
import { BOARD_HEIGHT, PADDLE_HEIGHT, PADDLE_WIDTH } from "@/constants/game";
import { RootState } from "@/store/store";

interface PaddleProps {
  side: "left" | "right";
  position: number;
  disableTransition?: boolean;
}

const Paddle: React.FC<PaddleProps> = ({
  side,
  position,
  disableTransition = false,
}) => {
  const isHost = useSelector((state: RootState) => state.connection.isHost);
  const isLocalPlayer = side === "left" ? isHost === true : isHost === false;

  const { handleMouseDown, handleTouchStart } = usePaddleMovement({
    side,
    boardHeight: BOARD_HEIGHT,
    paddleHeight: PADDLE_HEIGHT,
    isLocalPlayer,
  });

  // Clamp position between 0 and 100
  const clampedPosition = Math.max(0, Math.min(100, position));

  const paddleInlineStyle: React.CSSProperties = {
    top: `${clampedPosition}%`,
    height: `${PADDLE_HEIGHT}%`,
    width: `${PADDLE_WIDTH}%`,
    left: side === "left" ? "0%" : undefined,
    right: side === "right" ? "0%" : undefined,
  };

  return (
    <div
      className={`${styles.paddle} ${styles[side]} ${isLocalPlayer || disableTransition ? styles.noTransition : ""}`}
      style={paddleInlineStyle}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      data-testid={`${side}-paddle`}
    />
  );
};

export default Paddle;
