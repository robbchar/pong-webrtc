import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { signalingService } from "@/services/signalingService";
import styles from "./LobbyChat.module.css";

const LobbyChat: React.FC = () => {
  const { signalingStatus, error } = useSelector(
    (state: RootState) => state.connection,
  );
  const { self, room, messages } = useSelector(
    (state: RootState) => state.chat,
  );

  const [draftMessage, setDraftMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const scrollTarget = messagesEndRef.current;
    if (scrollTarget && typeof scrollTarget.scrollIntoView === "function") {
      scrollTarget.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const isSendDisabled =
    signalingStatus !== "open" || draftMessage.trim() === "";

  const connectionLabel = useMemo(() => {
    if (error) return `Error: ${error}`;
    switch (signalingStatus) {
      case "connecting":
        return "Connecting to server...";
      case "open":
        return "Connected";
      case "closing":
        return "Disconnecting...";
      case "closed":
      default:
        return "Disconnected";
    }
  }, [signalingStatus, error]);

  const handleSend = () => {
    const text = draftMessage.trim();
    if (!text) return;
    signalingService.sendChatMessage(text);
    setDraftMessage("");
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (
    event,
  ) => {
    if (event.key === "Enter" && !isSendDisabled) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.identity}>
          You are: <strong>{self?.name ?? "Unknown"}</strong>{" "}
          <span className={styles.muted}>({self?.clientId ?? "no-id"})</span>
        </div>
        <div className={styles.status}>
          Status: <strong>{connectionLabel}</strong>
          {room.gameId && (
            <span className={styles.room}>
              Room: Room-{room.gameId.slice(0, 4)}
            </span>
          )}
        </div>
      </header>

      <main className={styles.chatWindow} aria-label="Chat conversation">
        {messages.length === 0 && (
          <div className={styles.empty}>No messages yet.</div>
        )}
        {messages.map((message) => {
          const isSelf = self && message.fromId === self.clientId;
          const senderLabel = message.isSystem
            ? null
            : isSelf
              ? "You"
              : `Player-${message.fromId.slice(0, 4)}`;
          const rowClass = message.isSystem
            ? styles.systemMessage
            : isSelf
              ? styles.selfMessage
              : styles.otherMessage;
          return (
            <div
              key={message.id}
              className={`${styles.messageRow} ${rowClass}`}
            >
              {!message.isSystem && (
                <div className={styles.messageMeta}>{senderLabel}</div>
              )}
              <div className={styles.messageText}>{message.text}</div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      <footer className={styles.inputBar}>
        <input
          className={styles.input}
          type="text"
          placeholder={
            signalingStatus === "open"
              ? "Type a message…"
              : "Waiting for connection…"
          }
          value={draftMessage}
          onChange={(event) => setDraftMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={signalingStatus !== "open"}
          aria-label="Message input"
        />
        <button
          className={styles.sendButton}
          onClick={handleSend}
          disabled={isSendDisabled}
        >
          Send
        </button>
      </footer>
    </div>
  );
};

export default LobbyChat;
