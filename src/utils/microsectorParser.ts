/**
 * F1 Live Timing Microsector (Mini-sectors) Parser & Status Bitmask Decoder
 *
 * Implements deterministic decoding of F1 SignalR TimingData:
 * - 0 / undefined: Pending / Untraversed (#2A2E39)
 * - 2048: Regular sector / Yellow-400 (#FACC15)
 * - 2049: Personal Best / Green-500 (#22C55E)
 * - 2052 / 2064: Overall Session Best / Purple-500 (#A855F7)
 */

export type SegmentStatusType = 'pending' | 'yellow' | 'green' | 'purple';

export const MICROSECTOR_COLORS: Record<SegmentStatusType, string> = {
  pending: '#2A2E39', // Neutral gray background
  yellow: '#FACC15',  // Yellow-400
  green: '#22C55E',   // Green-500
  purple: '#A855F7',  // Purple-500
};

/**
 * Decodes the official F1 status bitmask into a standardized visual state.
 */
export function parseSegmentStatus(status?: number | null): SegmentStatusType {
  if (status === undefined || status === null || status === 0) {
    return 'pending';
  }

  // Bit 2 (4) or Bit 4 (16) or literals 2052/2064: Session fastest (Purple)
  if (status === 2052 || status === 2064 || (status & 4) !== 0 || (status & 16) !== 0) {
    return 'purple';
  }

  // Bit 0 (1) or literal 2049: Personal best (Green)
  if (status === 2049 || (status & 1) !== 0) {
    return 'green';
  }

  // 2048: Normal / Slower than personal best (Yellow)
  if (status === 2048) {
    return 'yellow';
  }

  // Fallback for positive non-zero status
  return 'yellow';
}

/**
 * Returns the exact hex color string according to the user specification.
 */
export function getSegmentColor(status?: number | null): string {
  const type = parseSegmentStatus(status);
  return MICROSECTOR_COLORS[type];
}

/**
 * Decodes a sparse F1 dictionary or array of segments into a fixed-length array of SegmentStatusType.
 * F1 SignalR payload: Lines[driverNumber].Sectors[sectorIndex].Segments[segmentIndex]
 * 
 * @param rawSegments Either an object with numeric string keys: { "0": { Status: 2048 }, "1": ... }
 *                    or an array of objects: [ { Status: 2048 }, ... ]
 * @param targetCount Number of microsectors for this sector (usually 8 for S1, 8 for S2, 9 for S3)
 */
export function decodeSectorSegments(
  rawSegments: Record<string, { Status?: number }> | Array<{ Status?: number } | number> | undefined | null,
  targetCount: number = 8
): SegmentStatusType[] {
  const result: SegmentStatusType[] = Array(targetCount).fill('pending');

  if (!rawSegments) {
    return result;
  }

  if (Array.isArray(rawSegments)) {
    rawSegments.forEach((item, idx) => {
      if (idx < targetCount) {
        const rawStatus = typeof item === 'number' ? item : item?.Status;
        result[idx] = parseSegmentStatus(rawStatus);
      }
    });
  } else if (typeof rawSegments === 'object') {
    Object.entries(rawSegments).forEach(([key, val]) => {
      const idx = parseInt(key, 10);
      if (!isNaN(idx) && idx >= 0 && idx < targetCount) {
        const rawStatus = typeof val === 'number' ? val : val?.Status;
        result[idx] = parseSegmentStatus(rawStatus);
      }
    });
  }

  return result;
}

/**
 * Merges an incoming SignalR delta into the existing sector segments state without mutating.
 */
export function mergeSectorDelta(
  current: SegmentStatusType[],
  deltaSegments: Record<string, { Status?: number }> | Array<{ Status?: number }>,
  targetCount: number = 8
): SegmentStatusType[] {
  const next = [...current];
  while (next.length < targetCount) {
    next.push('pending');
  }

  if (Array.isArray(deltaSegments)) {
    deltaSegments.forEach((item, idx) => {
      if (idx < targetCount) {
        next[idx] = parseSegmentStatus(item?.Status);
      }
    });
  } else if (typeof deltaSegments === 'object') {
    Object.entries(deltaSegments).forEach(([key, val]) => {
      const idx = parseInt(key, 10);
      if (!isNaN(idx) && idx >= 0 && idx < targetCount) {
        next[idx] = parseSegmentStatus(val?.Status);
      }
    });
  }

  return next;
}
