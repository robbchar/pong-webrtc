## Gameplay Next Phase – Problem Statement

**Goal:** Polish and complete real-time Pong gameplay with host authority, responsive inputs, stable synchronization, and a clean match loop.

**User experience target:**

- Both players ready → countdown → ball serves → match plays smoothly.
- Each player controls their paddle reliably.
- Pause/resume works from either peer (host authoritative).
- Scores and wins stay consistent, no UI drift.
- “Play again” resets a match cleanly for both peers.

## Current State (as of branch `fix/countdown-start`)

- Host authoritative for physics and status.
- Guest sends right‑paddle `paddleMove` at ~30Hz.
- Host broadcasts `gameState` at 20Hz including ball, paddles, score, wins, status, countdown, readiness.
- Countdown completion now sets `playing` and serves ball on host.
- Guest uses `setScores`/`setWins` to avoid double win increments.
- Role badge shows Host/Guest.

## Open Issues / Observations

- Guest rendering may look jittery (no interpolation yet).
- Play‑again/reset is still local‑only (host click resets host state but guest relies on broadcast; may need explicit ceremony).
- Paddle collision / angles feel basic; might need tuning.
- Opponent paddle update still TODO for side authority in reducer (currently assumes network paddle is right).

## Proposed Design (to discuss in next chat)

### 1) Match Loop / Play‑Again Ceremony

**Desired behavior:**

- After gameOver, host can click “Play Again”.
- Host resets full game state (ball, paddles, score, countdown, status, readiness) and broadcasts immediately.
- Guest mirrors reset without side effects.

**Implementation sketch:**

- Add `resetRequest` message (guest→host) and/or `resetGameState` event (host→guest).
- Alternatively, reuse `gameState` broadcast by ensuring host resets and guest mirrors via setters (no `updateScore`).
- Ensure readiness clears on reset and returns to `waiting`.

### 2) Paddle Ownership Cleanup

**Desired behavior:**

- Host owns left paddle input; guest owns right.
- `updateOpponentPaddle` should update the correct paddle based on role/side, not hardcoded right.

**Implementation sketch:**

- Add `playerSide` in connection state (derived from host/guest).
- Replace `updateOpponentPaddle` with `setOpponentPaddleY(side, y)` or similar.
- Host applies incoming `paddleMove` to the guest side.

### 3) Interpolation / Smoothing on Guest (optional but likely needed)

**Desired behavior:**

- Guest sees ball/paddles move smoothly even with 20Hz snapshots.

**Implementation sketch:**

- Store last two `gameState` snapshots + timestamps in a small ref (guest only).
- Render interpolated positions between snapshots (linear interpolation).
- Keep Redux state as authoritative snapshot; interpolation in render layer/hook (`useInterpolatedGameState`).

### 4) Physics / Gameplay Tuning

**Potential improvements:**

- Increase bounce angle range or speed scaling after paddle hits.
- Clamp paddle positions using paddle height in % space (currently uses raw y as percent).
- Add slight random vertical velocity on serve.
- Ensure wall/paddle collision uses center/size consistently.

### 5) Networking Metrics / Debugging Aid (nice-to-have)

- The debug overlay (toggle with `?`) now shows live connection metrics:
  - **Role**: Host or Guest.
  - **Snapshots / Avg interval / Snapshot age**:
    - Host: outbound `gameState` broadcast rate and staleness.
    - Guest: inbound `gameState` snapshot rate and staleness.
  - **Inputs / Input age** (Guest only): right‑paddle send rate and time since last send.
  - **Quality**: "Good" / "OK" / "Poor" based on snapshot staleness and average interval; "Unknown" when not connected or before enough samples exist.
    - Good if age <120ms and avg interval <80ms.
    - OK if age <250ms or avg interval <140ms.
    - Poor otherwise.
- Future: add ping/RTT and packet‑loss estimates.

## Implementation Plan (phased commits on a new branch)

1. **Play‑again ceremony**
2. **Paddle ownership reducer cleanup**
3. **Guest interpolation hook**
4. **Physics tuning + serves**
5. **Polish/debug UI**

Each phase: small commit(s) + tests. PR at the end for review/merge.
