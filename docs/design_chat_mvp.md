# Pong‑WebRTC Reset: Chat/Lobby MVP Design Doc

## Problem Statement

We want a reliable, free‑to‑run multiplayer foundation for a Pong game.  
To avoid previous regressions caused by coupling game mechanics with networking, we will first ship a minimal lobby/chat MVP that validates connection, identity, and message flow. Only after chat+transport stability is proven do we re‑introduce game synchronization.

Success is: multiple browser tabs can join, see their own name/ID, send chat messages, and see them appear in a shared conversation with correct ordering and reconnection behavior.

## Scope

### In‑scope (Chat MVP)

- **Lobby page** where a user:
  - sees their generated player name + player ID
  - sees connection status (WS)
  - can type a message and send it
  - sees conversation history for the current session
- **WebSocket signaling server** supports:
  - pairing/rooms (existing gameId model)
  - broadcasting chat messages to all clients in a room
  - reconnection to the same room using `clientId`
- **State cleanup**:
  - single source of truth for game/chat state
  - remove unused duplicate slices/modules after verifying no imports

### Out of scope (later phases)

- WebRTC datachannel chat
- Pong gameplay networking / physics authority model
- TURN servers / production hardening
- User accounts / persistence

## Current Constraints / Assumptions

- Project should remain **free** to run; local WS server is acceptable.
- WebRTC may stay flaky on some networks until TURN is added; we defer that.
- We keep project structure for now; no workspaces reorg until payoff is clear.
- Single developer testing via multiple tabs must be first‑class.

## Architecture Overview

### Transport Layer

**Phase 1 transport = WebSocket only.**

- Client connects to signaling WS and joins/hosts a room as today.
- Chat messages flow over WS.
- WebRTC is not started for chat MVP.

Later:

- Option A: keep chat on WS, game on WebRTC datachannel.
- Option B: move chat to datachannel after WebRTC stabilizes.

### Client Layers

1. **UI components** (React): `Lobby`, `ChatWindow`, `MessageInput`, `ConnectionStatus`.
2. **State** (Redux Toolkit):
   - `connectionSlice` (existing) continues to track signaling/peer status.
   - new `chatSlice` for messages + local identity.
3. **Services**:
   - `signalingService` handles WS connect/reconnect and message dispatch.
   - `webRTCService` stays unused until later milestones.

### Server Layers

- Existing `server.ts` remains, with added message cases:
  - `"chatMessage"`: broadcast to room
  - `"join"` or current host/pairing messages remain unchanged

## Message Protocol (WS)

### Client → Server

- `{"type":"chatMessage","payload":{"text":string,"timestamp":number}}`
- existing messages stay as is (`offer`, `answer`, `ice-candidate`, `ready_for_offer`, etc.) but unused for MVP.

### Server → Client

- `{"type":"chatMessage","payload":{"fromId":string,"text":string,"timestamp":number}}`
- existing pairing lifecycle messages (`host_assigned`, `paired`, `opponentLeft`, `error`)

Notes:

- For MVP, ordering is by `timestamp` then receive order.
- Names can be synthetic on client first (e.g., `Player-1234`).

## State Model

### `chatSlice`

interface ChatMessage {
id: string; // uuid
fromId: string;
text: string;
timestamp: number; // performance.now() or Date.now()
}

interface ChatState {
self: { clientId: string; name: string };
room: { gameId: string | null };
messages: ChatMessage[];
}### Connection state
Keep existing `connectionSlice`. For MVP:

- we display `signalingStatus`
- ignore WebRTC peer status/UI except maybe hidden logging

## UI/UX

### Lobby/Chat Page

- Top bar:
  - “You are: {name} ({clientId})”
  - Connection indicator:
    - `connecting` / `open` / `closed` / `error`
  - Room/gameId if assigned
- Chat window:
  - scrollable list of messages
  - self messages right‑aligned (optional)
- Input:
  - text field + Send button
  - Enter sends
  - disabled if WS not open

### Error behaviors

- If WS closed: input disabled + banner “Disconnected, retrying…”
- If opponent leaves: show system message “Opponent left” but keep room.

## Implementation Plan (phased, small commits)

### Phase 0: Reset / Cleanup

- Revert current unstaged edits (see commands below).
- Identify and remove unused duplicate slice folder `src/client/redux/` after confirming nothing imports it.

### Phase 1: Chat over WS

1. Add `chatSlice` with actions:
   - `chatMessageReceived`
   - `chatMessageSent`
   - `setSelfIdentity`
   - `setRoom`
2. Update `signalingService`:
   - on WS open: dispatch `setSelfIdentity`
   - on `host_assigned` / `paired`: dispatch `setRoom`
   - on `chatMessage`: dispatch `chatMessageReceived`
   - expose `sendChatMessage(text)`
3. Add `LobbyChatPage` and route to it (likely replacing current `Game` entry point temporarily).

### Phase 2: Tests

- `chatSlice` reducer tests.
- `LobbyChatPage` tests:
  - renders self identity
  - sends message and displays it
  - disables input when disconnected
- Mock WS in tests (simple stub around `signalingService`).

### Phase 3: Connection stabilization

- With chat stable, re‑introduce WebRTC setup only after an explicit “Start game” action.
- Both players must opt in before WebRTC is established:
  - Each player clicks a **Start game** button in the lobby.
  - When a player clicks, we send a WS `start_intent` to the opponent and show a system message like “Player‑XXXX clicked to start game, waiting…”.
  - When both intents are true, the host creates the WebRTC offer and the joiner responds as usual.
- Chat remains on WS during this phase to keep transport debugging simple.
- Phase 3 success criteria:
  - Two tabs pair, both click Start game, and a datachannel opens.
  - We surface clear lobby status for: waiting for opponent, waiting for both intents, and WebRTC connected.

## Acceptance Criteria

- Two or more tabs on same machine:
  - both connect to WS
  - pairing assigns same room
  - sending a message from any tab shows on all tabs within that room
- Refreshing a tab with same `clientId` rejoins room and can continue chat.
- No game physics or WebRTC required for MVP compliance.

## Risks / Mitigations

- **WS sleep on free hosting**: ok for hobby; local dev first.
- **No TURN**: acceptable for MVP; document limitation.
- **State duplication regressions**: remove unused slices early and keep protocol types centralized.

## Follow‑ups (after MVP)

- Decide WS vs datachannel for chat.
- Host‑authority Pong sync.
- Optional workspaces separation.
