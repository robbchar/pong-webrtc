import React from "react";
import GameBoard from "../components/GameBoard/GameBoard";
import styles from "./Game.module.css";

const Game: React.FC = () => {
  return (
    <div className={styles.game}>
      <GameBoard />
    </div>
  );
};

export default Game;
