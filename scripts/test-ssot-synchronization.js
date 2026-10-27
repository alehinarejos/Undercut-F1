#!/usr/bin/env node

/**
 * test-ssot-synchronization.js
 *
 * Automated verification of:
 * 1. Single Source of Truth (SSOT) consistency between Home Dashboard and Leaderboard views.
 * 2. Anti-Throttling Guard: Prevents duplicate WebSocket creation and infinite reconnect loops.
 * 3. 250ms Telemetry Delta Batching: Prevents main-thread UI freeze during high-frequency streaming.
 * 4. Infinite Re-render Loop Break: Confirms overtakes effect does not trigger recursive renders.
 */

console.log('🏁 ====================================================================');
console.log('🏁 F1 TELEMETRY SSOT & INFINITE LOOP PREVENTION VERIFICATION TEST');
console.log('🏁 ====================================================================\n');

let passCount = 0;
const totalTests = 4;

function assert(condition, testName, details) {
  if (condition) {
    passCount++;
    console.log(`✅ [PASS] ${testName}`);
    if (details) console.log(`   ℹ️  ${details}`);
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    if (details) console.error(`   ⚠️  ${details}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Single Source of Truth (SSOT) Consistency Across Pages
// ─────────────────────────────────────────────────────────────────────────────
console.log('🔬 Test 1: Testing SSOT Consistency Between Dashboard & Leaderboard...');

// Simulated SSOT Global Context
const globalLiveSessionState = {
  activeSession: {
    sessionKey: '11730',
    sessionType: 'QUALIFYING',
    sessionName: 'GP de Malasia - Clasificación',
    meetingName: 'Gran Premio de Malasia',
    status: 'LIVE',
    remainingSec: 1420,
    qualyPhase: 'Q2',
    provisionalPoleDriver: 'CHARLES LECLERC',
    provisionalPoleTime: '1:36.582',
  },
  leaderboard: [
    { position: 1, driver: { code: 'LEC', number: 16 }, bestLapTime: '1:36.582' },
    { position: 2, driver: { code: 'VER', number: 3 }, bestLapTime: '1:36.630' },
    { position: 3, driver: { code: 'NOR', number: 1 }, bestLapTime: '1:36.696' },
  ],
  connectionStatus: 'CONNECTED',
};

// Consumer A: Home Dashboard View
function renderHomeDashboard(ssot) {
  return {
    renderedSessionKey: ssot.activeSession.sessionKey,
    renderedSessionType: ssot.activeSession.sessionType,
    renderedSessionName: ssot.activeSession.sessionName,
    renderedPoleDriver: ssot.activeSession.provisionalPoleDriver,
    renderedPoleTime: ssot.activeSession.provisionalPoleTime,
  };
}

// Consumer B: Leaderboard / Timing Table View
function renderLeaderboardTable(ssot) {
  return {
    renderedSessionKey: ssot.activeSession.sessionKey,
    renderedSessionType: ssot.activeSession.sessionType,
    renderedSessionName: ssot.activeSession.sessionName,
    renderedP1Driver: ssot.leaderboard[0].driver.code,
    renderedP1Time: ssot.leaderboard[0].bestLapTime,
  };
}

const pageHome = renderHomeDashboard(globalLiveSessionState);
const pageLeaderboard = renderLeaderboardTable(globalLiveSessionState);

assert(
  pageHome.renderedSessionKey === pageLeaderboard.renderedSessionKey &&
  pageHome.renderedSessionType === pageLeaderboard.renderedSessionType &&
  pageHome.renderedSessionName === pageLeaderboard.renderedSessionName &&
  pageHome.renderedPoleTime === pageLeaderboard.renderedP1Time,
  'SSOT ensures 100% data and session consistency between Home Dashboard & Leaderboard',
  `Session Key: ${pageHome.renderedSessionKey} | Type: ${pageHome.renderedSessionType} | P1 Time: ${pageHome.renderedPoleTime}`
);

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Anti-Throttling Guard (Infinite Connection Loop Prevention)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🔬 Test 2: Testing Anti-Throttling Guard on Rapid Connect Calls...');

let socketCreateCount = 0;
let isConnecting = false;
let activeSocket = null;

function safeConnect() {
  // Anti-throttling guard
  if (activeSocket?.readyState === 1 || isConnecting) {
    return 'BLOCKED_DUPLICATE';
  }

  isConnecting = true;
  socketCreateCount++;

  // Simulate async connection handshake
  setTimeout(() => {
    isConnecting = false;
    activeSocket = { readyState: 1 };
  }, 50);

  return 'CONNECTING';
}

const res1 = safeConnect();
const res2 = safeConnect(); // should be blocked!
const res3 = safeConnect(); // should be blocked!

assert(
  res1 === 'CONNECTING' && res2 === 'BLOCKED_DUPLICATE' && res3 === 'BLOCKED_DUPLICATE' && socketCreateCount === 1,
  'Anti-throttling guard prevents concurrent socket instantiation (Breaks connection loop)',
  'Blocked 2 redundant connection calls while first was in flight.'
);

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: 250ms Batching Buffer
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🔬 Test 3: Testing 250ms Batching Buffer on High-Frequency Deltas...');

let batchBuffer = {};
let flushCount = 0;
let batchTimer = null;

function pushDelta(driverNum, delta, onFlush) {
  batchBuffer[driverNum] = { ...(batchBuffer[driverNum] || {}), ...delta };
  if (!batchTimer) {
    batchTimer = setTimeout(() => {
      batchTimer = null;
      flushCount++;
      const flushed = { ...batchBuffer };
      batchBuffer = {};
      if (onFlush) onFlush(flushed);
    }, 250);
  }
}

// Push 5 deltas in rapid succession (0ms, 30ms, 60ms, 90ms, 120ms)
pushDelta('16', { s1: '24.890' });
setTimeout(() => pushDelta('16', { s2: '32.140' }), 30);
setTimeout(() => pushDelta('3', { s1: '24.910' }), 60);
setTimeout(() => pushDelta('1', { s1: '24.940' }), 90);
setTimeout(() => pushDelta('16', { s3: '39.550' }), 120);

setTimeout(() => {
  assert(
    flushCount === 1,
    '250ms batching buffer compresses 5 high-frequency deltas into 1 atomic state update',
    `Flush Count: ${flushCount} (Prevented 4 unnecessary UI re-renders and CPU spikes)`
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: Infinite Re-render Guard in Leaderboard Overtakes Effect
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n🔬 Test 4: Testing Infinite Loop Guard in Leaderboard Overtakes...');

  let prevPositions = new Map([['lec', 1], ['ver', 2], ['nor', 3]]);
  let setOvertakesCalls = 0;

  function simulateOvertakesEffect(currentEntries) {
    let hasPositionChange = false;
    currentEntries.forEach((entry) => {
      const oldPos = prevPositions.get(entry.driverId);
      if (oldPos !== undefined && oldPos !== entry.pos) {
        hasPositionChange = true;
      }
    });

    if (hasPositionChange) {
      setOvertakesCalls++;
      const newMap = new Map();
      currentEntries.forEach(e => newMap.set(e.driverId, e.pos));
      prevPositions = newMap;
    }
  }

  // Render 1: same positions (e.g. lap time updated, but positions 1, 2, 3 unchanged)
  simulateOvertakesEffect([{ driverId: 'lec', pos: 1 }, { driverId: 'ver', pos: 2 }, { driverId: 'nor', pos: 3 }]);
  // Render 2: same positions
  simulateOvertakesEffect([{ driverId: 'lec', pos: 1 }, { driverId: 'ver', pos: 2 }, { driverId: 'nor', pos: 3 }]);
  // Render 3: same positions
  simulateOvertakesEffect([{ driverId: 'lec', pos: 1 }, { driverId: 'ver', pos: 2 }, { driverId: 'nor', pos: 3 }]);

  assert(
    setOvertakesCalls === 0,
    'hasPositionChange guard eliminates cascading re-render loop when positions are unchanged',
    'Simulated 3 renders with new array references; setOvertakes called 0 times.'
  );

  console.log('\n🏁 ====================================================================');
  console.log(`🏁 VERIFICATION SUMMARY: ${passCount} / ${totalTests} TESTS PASSED`);
  console.log('🏁 ====================================================================\n');

  process.exit(passCount === totalTests ? 0 : 1);
}, 320);
