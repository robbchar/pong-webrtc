import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { RootState } from "@/store/store";
import { signalingService } from "@/services/signalingService";
import { webRTCService } from "@/services/webRTCService";
import { markReturnedToLobby } from "@/store/slices/connectionSlice";
import { setDataChannelStatus } from "@/store/slices/connectionSlice";
import { resetGame } from "@/store/slices/gameSlice";
import GameBoard from "../components/GameBoard/GameBoard";
import styles from "./Game.module.css";

const Game: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { returnedToLobby } = useSelector(
    (state: RootState) => state.connection,
  );

  useEffect(() => {
    if (returnedToLobby) {
      navigate("/");
    }
  }, [returnedToLobby, navigate]);

  const handleBackToLobby = () => {
    signalingService.sendBackToLobby();
    webRTCService.cleanup();
    dispatch(setDataChannelStatus("closed"));
    dispatch(resetGame());
    dispatch(markReturnedToLobby());
  };

  return (
    <div className={styles.game}>
      <header className={styles.header}>
        <button
          className={styles.backButton}
          onClick={handleBackToLobby}
          type="button"
        >
          Back to lobby
        </button>
      </header>
      <GameBoard />
    </div>
  );
};

export default Game;
