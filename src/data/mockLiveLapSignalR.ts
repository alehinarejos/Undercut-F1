/**
 * Mock F1 SignalR TimingData Payloads for Frontend Testing & Verification
 *
 * Simulates a realistic live hot lap (Charles Leclerc, Ferrari #16):
 * - Sector 1 (8 segments): All PURPLE (Overall Session Best, Status 2052)
 * - Sector 2 (8 segments): All GREEN (Personal Best, Status 2049)
 * - Sector 3 (9 segments): Progressive real-time filling from Seg 0 to Seg 8!
 */

import { type SegmentStatusType } from '../utils/microsectorParser';

export interface MockLiveLapFrame {
  frameIndex: number;
  description: string;
  driverNumber: string;
  driverName: string;
  team: string;
  teamColor: string;
  s1Segments: SegmentStatusType[];
  s2Segments: SegmentStatusType[];
  s3Segments: SegmentStatusType[];
  s1Time: string;
  s2Time: string;
  s3Time: string;
  s1Status: 'purple' | 'green' | 'yellow' | 'none';
  s2Status: 'purple' | 'green' | 'yellow' | 'none';
  s3Status: 'purple' | 'green' | 'yellow' | 'none';
  currentLapTime: string;
  trackProgress: number; // 0.0 to 1.0
  rawSignalRPayload: any;
}

// S1: 8 segments in PURPLE (Session Fastest)
const S1_PURPLE_8: SegmentStatusType[] = Array(8).fill('purple');

// S2: 8 segments in GREEN (Personal Best)
const S2_GREEN_8: SegmentStatusType[] = Array(8).fill('green');

/**
 * Array of sequential frames representing a hot lap arriving through SignalR TimingData
 */
export const MOCK_LIVE_HOT_LAP_FRAMES: MockLiveLapFrame[] = [
  {
    frameIndex: 0,
    description: 'Entering Sector 3 (S1 purple, S2 green, S3 pending)',
    driverNumber: '16',
    driverName: 'Charles Leclerc',
    team: 'Ferrari',
    teamColor: '#E8002D',
    s1Segments: [...S1_PURPLE_8],
    s2Segments: [...S2_GREEN_8],
    s3Segments: ['pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending'],
    s1Time: '24.840',
    s2Time: '32.080',
    s3Time: '—',
    s1Status: 'purple',
    s2Status: 'green',
    s3Status: 'none',
    currentLapTime: 'PUSH',
    trackProgress: 0.69,
    rawSignalRPayload: {
      Lines: {
        '16': {
          Sectors: {
            '0': { Value: '24.840', OverallFastest: true },
            '1': { Value: '32.080', PersonalFastest: true },
          },
        },
      },
    },
  },
  {
    frameIndex: 1,
    description: 'S3 Seg 0 lit purple (Turn 13)',
    driverNumber: '16',
    driverName: 'Charles Leclerc',
    team: 'Ferrari',
    teamColor: '#E8002D',
    s1Segments: [...S1_PURPLE_8],
    s2Segments: [...S2_GREEN_8],
    s3Segments: ['purple', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending'],
    s1Time: '24.840',
    s2Time: '32.080',
    s3Time: '—',
    s1Status: 'purple',
    s2Status: 'green',
    s3Status: 'none',
    currentLapTime: 'PUSH',
    trackProgress: 0.72,
    rawSignalRPayload: {
      Lines: {
        '16': {
          Sectors: {
            '2': {
              Segments: {
                '0': { Status: 2052 },
              },
            },
          },
        },
      },
    },
  },
  {
    frameIndex: 2,
    description: 'S3 Seg 1 lit purple (Turn 14 hairpin entry)',
    driverNumber: '16',
    driverName: 'Charles Leclerc',
    team: 'Ferrari',
    teamColor: '#E8002D',
    s1Segments: [...S1_PURPLE_8],
    s2Segments: [...S2_GREEN_8],
    s3Segments: ['purple', 'purple', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending'],
    s1Time: '24.840',
    s2Time: '32.080',
    s3Time: '—',
    s1Status: 'purple',
    s2Status: 'green',
    s3Status: 'none',
    currentLapTime: 'PUSH',
    trackProgress: 0.76,
    rawSignalRPayload: {
      Lines: {
        '16': {
          Sectors: {
            '2': {
              Segments: {
                '1': { Status: 2052 },
              },
            },
          },
        },
      },
    },
  },
  {
    frameIndex: 3,
    description: 'S3 Seg 2 lit purple (Hairpin apex)',
    driverNumber: '16',
    driverName: 'Charles Leclerc',
    team: 'Ferrari',
    teamColor: '#E8002D',
    s1Segments: [...S1_PURPLE_8],
    s2Segments: [...S2_GREEN_8],
    s3Segments: ['purple', 'purple', 'purple', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending'],
    s1Time: '24.840',
    s2Time: '32.080',
    s3Time: '—',
    s1Status: 'purple',
    s2Status: 'green',
    s3Status: 'none',
    currentLapTime: 'PUSH',
    trackProgress: 0.80,
    rawSignalRPayload: {
      Lines: {
        '16': {
          Sectors: {
            '2': {
              Segments: {
                '2': { Status: 2052 },
              },
            },
          },
        },
      },
    },
  },
  {
    frameIndex: 4,
    description: 'S3 Seg 3 lit green (Back straight acceleration)',
    driverNumber: '16',
    driverName: 'Charles Leclerc',
    team: 'Ferrari',
    teamColor: '#E8002D',
    s1Segments: [...S1_PURPLE_8],
    s2Segments: [...S2_GREEN_8],
    s3Segments: ['purple', 'purple', 'purple', 'green', 'pending', 'pending', 'pending', 'pending', 'pending'],
    s1Time: '24.840',
    s2Time: '32.080',
    s3Time: '—',
    s1Status: 'purple',
    s2Status: 'green',
    s3Status: 'none',
    currentLapTime: 'PUSH',
    trackProgress: 0.84,
    rawSignalRPayload: {
      Lines: {
        '16': {
          Sectors: {
            '2': {
              Segments: {
                '3': { Status: 2049 },
              },
            },
          },
        },
      },
    },
  },
  {
    frameIndex: 5,
    description: 'S3 Seg 4 lit green (DRS Zone 2 activation)',
    driverNumber: '16',
    driverName: 'Charles Leclerc',
    team: 'Ferrari',
    teamColor: '#E8002D',
    s1Segments: [...S1_PURPLE_8],
    s2Segments: [...S2_GREEN_8],
    s3Segments: ['purple', 'purple', 'purple', 'green', 'green', 'pending', 'pending', 'pending', 'pending'],
    s1Time: '24.840',
    s2Time: '32.080',
    s3Time: '—',
    s1Status: 'purple',
    s2Status: 'green',
    s3Status: 'none',
    currentLapTime: 'PUSH',
    trackProgress: 0.88,
    rawSignalRPayload: {
      Lines: {
        '16': {
          Sectors: {
            '2': {
              Segments: {
                '4': { Status: 2049 },
              },
            },
          },
        },
      },
    },
  },
  {
    frameIndex: 6,
    description: 'S3 Seg 5 lit green (Heavy braking into Turn 15)',
    driverNumber: '16',
    driverName: 'Charles Leclerc',
    team: 'Ferrari',
    teamColor: '#E8002D',
    s1Segments: [...S1_PURPLE_8],
    s2Segments: [...S2_GREEN_8],
    s3Segments: ['purple', 'purple', 'purple', 'green', 'green', 'green', 'pending', 'pending', 'pending'],
    s1Time: '24.840',
    s2Time: '32.080',
    s3Time: '—',
    s1Status: 'purple',
    s2Status: 'green',
    s3Status: 'none',
    currentLapTime: 'PUSH',
    trackProgress: 0.92,
    rawSignalRPayload: {
      Lines: {
        '16': {
          Sectors: {
            '2': {
              Segments: {
                '5': { Status: 2049 },
              },
            },
          },
        },
      },
    },
  },
  {
    frameIndex: 7,
    description: 'S3 Seg 6 lit purple (Turn 15 final hairpin apex)',
    driverNumber: '16',
    driverName: 'Charles Leclerc',
    team: 'Ferrari',
    teamColor: '#E8002D',
    s1Segments: [...S1_PURPLE_8],
    s2Segments: [...S2_GREEN_8],
    s3Segments: ['purple', 'purple', 'purple', 'green', 'green', 'green', 'purple', 'pending', 'pending'],
    s1Time: '24.840',
    s2Time: '32.080',
    s3Time: '—',
    s1Status: 'purple',
    s2Status: 'green',
    s3Status: 'none',
    currentLapTime: 'PUSH',
    trackProgress: 0.95,
    rawSignalRPayload: {
      Lines: {
        '16': {
          Sectors: {
            '2': {
              Segments: {
                '6': { Status: 2052 },
              },
            },
          },
        },
      },
    },
  },
  {
    frameIndex: 8,
    description: 'S3 Seg 7 lit purple (Full throttle on pit straight)',
    driverNumber: '16',
    driverName: 'Charles Leclerc',
    team: 'Ferrari',
    teamColor: '#E8002D',
    s1Segments: [...S1_PURPLE_8],
    s2Segments: [...S2_GREEN_8],
    s3Segments: ['purple', 'purple', 'purple', 'green', 'green', 'green', 'purple', 'purple', 'pending'],
    s1Time: '24.840',
    s2Time: '32.080',
    s3Time: '—',
    s1Status: 'purple',
    s2Status: 'green',
    s3Status: 'none',
    currentLapTime: 'PUSH',
    trackProgress: 0.98,
    rawSignalRPayload: {
      Lines: {
        '16': {
          Sectors: {
            '2': {
              Segments: {
                '7': { Status: 2052 },
              },
            },
          },
        },
      },
    },
  },
  {
    frameIndex: 9,
    description: 'S3 Seg 8 lit purple & Finish Line Crossed! (NEW POLE: 1:36.420)',
    driverNumber: '16',
    driverName: 'Charles Leclerc',
    team: 'Ferrari',
    teamColor: '#E8002D',
    s1Segments: [...S1_PURPLE_8],
    s2Segments: [...S2_GREEN_8],
    s3Segments: ['purple', 'purple', 'purple', 'green', 'green', 'green', 'purple', 'purple', 'purple'],
    s1Time: '24.840',
    s2Time: '32.080',
    s3Time: '39.500',
    s1Status: 'purple',
    s2Status: 'green',
    s3Status: 'purple',
    currentLapTime: '1:36.420',
    trackProgress: 1.0,
    rawSignalRPayload: {
      Lines: {
        '16': {
          BestLapTime: { Value: '1:36.420', Lap: 15 },
          LastLapTime: { Value: '1:36.420' },
          Sectors: {
            '2': {
              Value: '39.500',
              OverallFastest: true,
              Segments: {
                '8': { Status: 2052 },
              },
            },
          },
        },
      },
    },
  },
];
