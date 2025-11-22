import React from "react";
import styles from "./Ball.module.css";
import { BALL_SIZE } from "@/constants/game";

interface BallProps {
  x: number;
  y: number;
}

const Ball: React.FC<BallProps> = ({ x, y }) => {
  const ballInlineStyle: React.CSSProperties = {
    left: `${x}%`,
    top: `${y}%`,
    width: `${BALL_SIZE}%`,
    height: `${BALL_SIZE}%`,
  };

  return (
    <div className={styles.ball} style={ballInlineStyle} data-testid="ball" />
  );
};

export default Ball;
