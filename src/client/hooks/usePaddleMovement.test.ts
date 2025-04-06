import { describe, it, expect } from 'vitest';
import { calculatePaddlePosition } from './usePaddleMovement';

describe('calculatePaddlePosition', () => {
  it('calculates correct position within bounds', () => {
    const position = calculatePaddlePosition(300, {
      top: 100,
      height: 600,
    } as DOMRect, 600, 100);

    // 300 - 100 = 200 (relative to top)
    // 200 / 600 = 0.333...
    // 0.333... * 100 = 33.33...%
    expect(position).toBeCloseTo(33.33, 1);
  });

  it('handles position above bounds', () => {
    const position = calculatePaddlePosition(50, {
      top: 100,
      height: 600,
    } as DOMRect, 600, 100);

    expect(position).toBe(0);
  });

  it('handles position below bounds', () => {
    const position = calculatePaddlePosition(650, {
      top: 100,
      height: 600,
    } as DOMRect, 600, 100);

    // 100 - (100/600 * 100) = 83.33...
    expect(position).toBeCloseTo(83.33, 1);
  });

  it('handles edge cases', () => {
    // Test at the very top
    const topPosition = calculatePaddlePosition(100, {
      top: 100,
      height: 600,
    } as DOMRect, 600, 100);
    expect(topPosition).toBe(0);

    // Test at the very bottom (accounting for paddle height)
    const bottomPosition = calculatePaddlePosition(700, {
      top: 100,
      height: 600,
    } as DOMRect, 600, 100);
    expect(bottomPosition).toBeCloseTo(83.33, 1);
  });
}); 