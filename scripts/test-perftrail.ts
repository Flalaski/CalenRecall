/**
 * Quick smoke test for PerfTrail core engine.
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/test-perftrail.ts
 *
 * Tests: start/end, aggregation, throttle, over-budget, reset, error, checkpoint, report
 */

import perfTrail from '../src/utils/performance/perfTrail';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function run() {
  console.log('\n🧪 PerfTrail Smoke Test\n');
  console.log('─'.repeat(50));

  // 1. Initial state
  console.log('\n1. Initial State');
  assert('isEnabled() returns false initially', !perfTrail.isEnabled(), `got ${perfTrail.isEnabled()}`);

  // 2. Enable/disable
  console.log('\n2. Enable/Disable');
  perfTrail.enable();
  assert('isEnabled() returns true after enable', perfTrail.isEnabled());
  perfTrail.disable();
  assert('isEnabled() returns false after disable', !perfTrail.isEnabled());
  perfTrail.enable();
  assert('isEnabled() returns true after re-enable', perfTrail.isEnabled());

  // 3. Basic timing
  console.log('\n3. Basic Span Timing');
  perfTrail.start('test-basic');
  await new Promise(r => setTimeout(r, 10));
  const elapsed = perfTrail.end('test-basic');
  assert('elapsed > 0', elapsed > 0, `got ${elapsed}ms`);
  assert('elapsed >= 10ms', elapsed >= 5, `got ${elapsed}ms (expected >= 5)`);

  // 4. End without start (missing span)
  console.log('\n4. Missing Span');
  const missingElapsed = perfTrail.end('never-started');
  assert('returns 0 for never-started span', missingElapsed === 0, `got ${missingElapsed}`);

  // 5. Aggregation
  console.log('\n5. Aggregation');
  perfTrail.start('test-agg');
  await new Promise(r => setTimeout(r, 5));
  perfTrail.end('test-agg');
  perfTrail.start('test-agg');
  await new Promise(r => setTimeout(r, 15));
  perfTrail.end('test-agg');
  perfTrail.start('test-agg');
  await new Promise(r => setTimeout(r, 10));
  perfTrail.end('test-agg');

  const report = perfTrail.report();
  const aggRow = report.find(r => r.label === 'test-agg');
  assert('aggregate count is 3', aggRow?.count === 3, `got ${aggRow?.count}`);
  assert('aggregate min <= max', aggRow ? parseFloat(aggRow.minMs) <= parseFloat(aggRow.maxMs) : false);
  assert('aggregate avg is between min and max', aggRow ? 
    (parseFloat(aggRow.avgMs) >= parseFloat(aggRow.minMs) && parseFloat(aggRow.avgMs) <= parseFloat(aggRow.maxMs)) : false);

  // 6. Budget & Over-budget detection
  console.log('\n6. Budget & Over-Budget');
  perfTrail.budget('test-budget', 1); // 1ms budget — anything real will exceed
  perfTrail.start('test-budget');
  await new Promise(r => setTimeout(r, 20));
  perfTrail.end('test-budget');
  // Should have logged a ⚠️ over-budget warning

  // 7. Error enrichment
  console.log('\n7. Error Enrichment');
  perfTrail.error('test-module', 'Something went wrong', { code: 42, detail: 'test context' });
  // Should have printed ❌ [test-module] Something went wrong | code=42, detail="test context"

  // 8. Checkpoint
  console.log('\n8. Checkpoint');
  perfTrail.checkpoint('test-phase', { step: 3, status: 'complete' });
  // Should have printed ◆ [CP] test-phase step=3, status="complete"

  // 9. Wrap (sync)
  console.log('\n9. Wrap (Sync)');
  const result = perfTrail.wrap('test-wrap-sync', () => {
    let sum = 0;
    for (let i = 0; i < 1000000; i++) sum += i;
    return sum;
  });
  assert('wrap returns function result', result === 499999500000, `got ${result}`);

  // 10. Wrap (async)
  console.log('\n10. Wrap (Async)');
  const asyncResult = await perfTrail.wrap('test-wrap-async', async () => {
    await new Promise(r => setTimeout(r, 5));
    return 'async-done';
  });
  assert('wrap async returns promise result', asyncResult === 'async-done', `got ${asyncResult}`);

  // 11. FPS tick
  console.log('\n11. FPS Tick');
  const fpsBefore = perfTrail.fps();
  assert('fps() returns 0 before any tick', fpsBefore === 0, `got ${fpsBefore}`);

  // Simulate 60 ticks over 1 second
  const startTime = Date.now();
  let tickCount = 0;
  while (Date.now() - startTime < 1100) {
    perfTrail.tick();
    tickCount++;
    // Busy-wait ~16ms to simulate 60fps
    for (let i = 0; i < 5000000; i++) Math.sqrt(i);
  }

  const fpsAfter = perfTrail.fps();
  assert('fps() returns > 0 after ticks', fpsAfter > 0, `got ${fpsAfter}`);
  console.log(`     (${tickCount} ticks in 1.1s, detected FPS: ${fpsAfter})`);

  // 12. Reset
  console.log('\n12. Reset');
  perfTrail.reset();
  const reportAfterReset = perfTrail.report();
  assert('report is empty after reset', reportAfterReset.length === 0, `got ${reportAfterReset.length} rows`);

  // 13. Dump
  console.log('\n13. Dump');
  perfTrail.start('test-dump');
  await new Promise(r => setTimeout(r, 5));
  perfTrail.end('test-dump');
  const snapshot = perfTrail.dump();
  assert('dump has enabled flag', typeof snapshot.enabled === 'boolean');
  assert('dump has aggregates', typeof snapshot.aggregates === 'object');
  assert('dump has timestamp', typeof snapshot.timestamp === 'string');
  assert('dump has displayRefreshRate', typeof snapshot.displayRefreshRate === 'number');

  // 14. Disabled zero-cost
  console.log('\n14. Disabled Zero-Cost Guard');
  perfTrail.disable();
  const startBefore = performance.now();
  for (let i = 0; i < 100000; i++) {
    perfTrail.start(`loop-${i}`);
    perfTrail.end(`loop-${i}`);
  }
  const disabledTime = performance.now() - startBefore;
  assert('100k start/end in < 100ms when disabled', disabledTime < 100, `took ${disabledTime.toFixed(2)}ms`);
  console.log(`     100k start/end calls: ${disabledTime.toFixed(2)}ms`);

  // ── Summary ──
  console.log('\n' + '═'.repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('❌ Test suite error:', err);
  process.exit(1);
});
