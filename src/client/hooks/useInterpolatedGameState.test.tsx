import { describe, it, expect } from "vitest";
import { interpolateSnapshots } from "./useInterpolatedGameState";

describe("interpolateSnapshots", () => {
  it("returns latest snapshot when no previous exists", () => {
    const latest = {
      timestampMs: 100,
      ball: { x: 10, y: 20, velocityX: 1, velocityY: 2 },
      leftPaddleY: 30,
      rightPaddleY: 40,
    };

    const interpolated = interpolateSnapshots(null, latest, 150);

    expect(interpolated.ball).toEqual(latest.ball);
    expect(interpolated.leftPaddleY).toBe(30);
    expect(interpolated.rightPaddleY).toBe(40);
  });

  it("linearly interpolates between two snapshots", () => {
    const previous = {
      timestampMs: 0,
      ball: { x: 0, y: 0, velocityX: 0, velocityY: 0 },
      leftPaddleY: 0,
      rightPaddleY: 100,
    };
    const latest = {
      timestampMs: 100,
      ball: { x: 100, y: 50, velocityX: 2, velocityY: -2 },
      leftPaddleY: 50,
      rightPaddleY: 0,
    };

    const interpolated = interpolateSnapshots(previous, latest, 50);

    expect(interpolated.ball.x).toBeCloseTo(50);
    expect(interpolated.ball.y).toBeCloseTo(25);
    expect(interpolated.ball.velocityX).toBeCloseTo(1);
    expect(interpolated.ball.velocityY).toBeCloseTo(-1);
    expect(interpolated.leftPaddleY).toBeCloseTo(25);
    expect(interpolated.rightPaddleY).toBeCloseTo(50);
  });

  it("clamps interpolation factor to 0..1", () => {
    const previous = {
      timestampMs: 0,
      ball: { x: 0, y: 0, velocityX: 0, velocityY: 0 },
      leftPaddleY: 0,
      rightPaddleY: 0,
    };
    const latest = {
      timestampMs: 100,
      ball: { x: 10, y: 20, velocityX: 1, velocityY: 2 },
      leftPaddleY: 30,
      rightPaddleY: 40,
    };

    const before = interpolateSnapshots(previous, latest, -100);
    expect(before.ball).toEqual(previous.ball);

    const after = interpolateSnapshots(previous, latest, 1000);
    expect(after.ball).toEqual(latest.ball);
  });
});
