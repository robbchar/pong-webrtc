import React from "react";
import styles from "./Ball.module.css";

interface BallProps {
  x: number;
  y: number;
}

const Ball: React.FC<BallProps> = ({ x, y }) => {
  return (
    <div
      className={styles.ball}
      style={{
        left: `${x}%`,
        top: `${y}%`,
      }}
      data-testid="ball"
    />
  );
};

export default Ball;
