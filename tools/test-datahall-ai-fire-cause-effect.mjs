/*
 * Contract tests for the DC AI fire cause-and-effect data engine.
 * Run: node tools/test-datahall-ai-fire-cause-effect.mjs
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = path.join(
  __dirname,
  '..',
  'js',
  'datahall-ai',
  'fire-cause-effect.js'
);

assert.equal(
  existsSync(MODULE_PATH),
  true,
  'fire-cause-effect.js must exist before its behavior can pass'
);

const require = createRequire(import.meta.url);
const CauseEffect = require(MODULE_PATH);

function deepFrozen(value) {
  if (value === null || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.keys(value).every((key) => deepFrozen(value[key]));
}

function systems(rows) {
  return new Set(rows.flatMap((row) => row.outputs.map((output) => output.system)));
}

function testBaseContract() {
  assert.ok(deepFrozen(CauseEffect.BASE_ROWS), 'base rows are deeply frozen');
  assert.ok(deepFrozen(CauseEffect.AUTHORITY), 'authority contract is deeply frozen');
  assert.equal(CauseEffect.AUTHORITY.controllingSystem, 'FACP');
  assert.equal(CauseEffect.AUTHORITY.bmsMode, 'MONITOR_ONLY');

  const validation = CauseEffect.validateRows(CauseEffect.BASE_ROWS);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.deepEqual(validation.errors, []);

  CauseEffect.BASE_ROWS.forEach((row) => {
    [
      'id', 'initiatingEvent', 'zone', 'stage', 'delaySeconds', 'outputs',
      'commandState', 'requiredFeedback', 'failureState', 'overrideInhibit',
      'resetAuthority', 'basis', 'runtime'
    ].forEach((field) => assert.ok(field in row, `${row.id} contains ${field}`));
    assert.ok(row.outputs.length > 0, `${row.id} has at least one effect`);
    assert.equal(typeof row.runtime.currentState, 'string');
    assert.ok('lastTestAt' in row.runtime);
  });
}

function testRequiredSystemCoverage() {
  const covered = systems(CauseEffect.BASE_ROWS);
  [
    'notification',
    'public_address',
    'fire_brigade',
    'noc_sms',
    'elevator',
    'access_control',
    'ahu_crah',
    'smoke_control',
    'clean_agent',
    'zoned_epo',
    'generator',
    'cctv',
    'bms_event'
  ].forEach((system) => assert.ok(covered.has(system), `${system} is represented`));
}

function testAuthorityAndNoGlobalShutdown() {
  CauseEffect.BASE_ROWS.forEach((row) => {
    row.outputs.forEach((output) => {
      if (output.system === 'bms_event') {
        assert.equal(output.authority, 'MONITOR_ONLY');
      } else if (output.commandType === 'control') {
        assert.equal(output.authority, 'FACP');
      }

      if (output.system === 'ahu_crah' || output.system === 'zoned_epo') {
        assert.notEqual(output.scope, 'ALL');
        assert.notEqual(output.action, 'GLOBAL_SHUTDOWN');
      }
    });
  });
}

function testEventEvaluationResolvesOnlyEventZone() {
  const result = CauseEffect.evaluateEvent({
    eventId: 'confirmed_fire',
    zoneId: 'Z3',
    elapsedSeconds: 0
  });

  assert.equal(result.authority, 'FACP');
  assert.equal(result.zoneId, 'Z3');
  assert.ok(result.commands.length >= 6);
  assert.ok(
    result.commands.some((command) =>
      command.system === 'ahu_crah' && command.resolvedScope === 'Z3'
    ),
    'selected-zone AHU/CRAH sequence is resolved to Z3'
  );
  assert.ok(
    result.commands.some((command) =>
      command.system === 'elevator' && command.resolvedScope === 'ELEVATOR_GROUP'
    ),
    'elevator recall retains its explicitly engineered group scope'
  );
  assert.equal(
    result.commands.some((command) => command.action === 'GLOBAL_SHUTDOWN'),
    false
  );

  const manualCall = CauseEffect.evaluateEvent({
    eventId: 'manual_call_point',
    zoneId: 'Z5',
    elapsedSeconds: 0
  });
  assert.equal(
    manualCall.commands.some((command) => command.action === 'RELEASE_AGENT'),
    false,
    'manual call point alone never releases clean agent'
  );
}

function testDelayAndProofAreData() {
  const beforeDelay = CauseEffect.evaluateEvent({
    eventId: 'suppression_release',
    zoneId: 'Z7',
    elapsedSeconds: 10
  });
  assert.equal(beforeDelay.commands.length, 0, 'effects do not issue before row delay');
  assert.ok(beforeDelay.pending.length > 0, 'pre-delay effects remain visibly pending');

  const blockedAfterDelay = CauseEffect.evaluateEvent({
    eventId: 'suppression_release',
    zoneId: 'Z7',
    elapsedSeconds: 30
  });
  assert.equal(blockedAfterDelay.commands.length, 0, 'elapsed time alone cannot release agent');
  assert.ok(blockedAfterDelay.blocked.length >= 5, 'missing interlock proofs are explicit');

  const afterDelay = CauseEffect.evaluateEvent({
    eventId: 'suppression_release',
    zoneId: 'Z7',
    elapsedSeconds: 30,
    interlocks: {
      confirmedFire: true,
      abortActive: false,
      inhibited: false,
      enclosureIsolated: true,
      releaseCircuitReady: true,
      preDischargeWarningComplete: true
    }
  });
  const release = afterDelay.commands.find((command) => command.action === 'RELEASE_AGENT');
  assert.ok(release, 'release command becomes eligible after delay');
  assert.ok(release.requiredFeedback.length > 0, 'release requires proof/feedback');
  assert.ok(release.failureState.length > 0, 'release defines a failure/trouble state');

  const inhibitedRows = CauseEffect.applyRuntime(CauseEffect.BASE_ROWS, {
    'CE-SUPPRESSION-ARMED': {
      currentState: 'inhibited',
      commandState: 'held',
      feedbackState: 'pending',
      inhibited: true
    }
  });
  const inhibited = CauseEffect.evaluateEvent({
    eventId: 'suppression_armed',
    zoneId: 'Z7',
    elapsedSeconds: 0,
    runtimeRows: inhibitedRows
  });
  assert.equal(inhibited.commands.length, 0, 'runtime inhibit blocks the row outputs');
  assert.ok(inhibited.blocked.some((item) => item.reason === 'ROW_INHIBITED'));
}

function testRuntimeUpdatesAreImmutable() {
  const baseRow = CauseEffect.BASE_ROWS.find((row) => row.id === 'CE-CONFIRMED-FIRE');
  const updated = CauseEffect.applyRuntime(CauseEffect.BASE_ROWS, {
    'CE-CONFIRMED-FIRE': {
      currentState: 'active',
      commandState: 'issued',
      feedbackState: 'proved',
      inhibited: false,
      lastTestAt: '2026-08-01T10:00:00Z'
    }
  });
  const updatedRow = updated.find((row) => row.id === 'CE-CONFIRMED-FIRE');

  assert.equal(baseRow.runtime.currentState, 'normal', 'base row is not mutated');
  assert.equal(baseRow.runtime.lastTestAt, null);
  assert.equal(updatedRow.runtime.currentState, 'active');
  assert.equal(updatedRow.runtime.lastTestAt, '2026-08-01T10:00:00Z');
  assert.ok(deepFrozen(updated), 'updated runtime rows are deeply frozen');

  assert.throws(
    () => CauseEffect.applyRuntime(CauseEffect.BASE_ROWS, {
      'CE-SUPPRESSION-RELEASE': { inhibited: true }
    }),
    /cannot be inhibited/i,
    'a non-inhibitable release row cannot be silently suppressed at runtime'
  );
}

function testInvalidEngineeringShortcutsAreRejected() {
  const source = CauseEffect.BASE_ROWS[0];
  const missingProof = [{
    ...source,
    requiredFeedback: []
  }];
  assert.equal(CauseEffect.validateRows(missingProof).valid, false);

  const globalShutdown = [{
    ...source,
    outputs: [{
      id: 'BAD-HVAC',
      system: 'ahu_crah',
      action: 'GLOBAL_SHUTDOWN',
      scope: 'ALL',
      commandType: 'control',
      authority: 'FACP',
      requiredFeedback: ['ALL_OFF']
    }]
  }];
  const globalResult = CauseEffect.validateRows(globalShutdown);
  assert.equal(globalResult.valid, false);
  assert.ok(globalResult.errors.some((error) => /global shutdown/i.test(error)));

  const bmsControl = [{
    ...source,
    outputs: [{
      id: 'BAD-BMS',
      system: 'bms_event',
      action: 'CONTROL_FIRE_SEQUENCE',
      scope: 'EVENT_ZONE',
      commandType: 'control',
      authority: 'BMS',
      requiredFeedback: ['COMMAND_ACK']
    }]
  }];
  const bmsResult = CauseEffect.validateRows(bmsControl);
  assert.equal(bmsResult.valid, false);
  assert.ok(bmsResult.errors.some((error) => /BMS.*monitor/i.test(error)));

  const wrongRowAuthority = [{ ...source, authority: 'BMS' }];
  const authorityResult = CauseEffect.validateRows(wrongRowAuthority);
  assert.equal(authorityResult.valid, false);
  assert.ok(authorityResult.errors.some((error) => /row authority.*FACP/i.test(error)));

  const malformedOutput = [{ ...source, outputs: [null] }];
  const malformedResult = CauseEffect.validateRows(malformedOutput);
  assert.equal(malformedResult.valid, false);
  assert.ok(malformedResult.errors.some((error) => /output must be an object/i.test(error)));

  const wrongReset = [{ ...source, resetAuthority: 'BMS_RESET' }];
  assert.equal(CauseEffect.validateRows(wrongReset).valid, false);

  const wrongInhibit = [{
    ...source,
    overrideInhibit: { ...source.overrideInhibit, authority: 'BMS' }
  }];
  assert.equal(CauseEffect.validateRows(wrongInhibit).valid, false);

  const badRuntime = [{
    ...source,
    runtime: { ...source.runtime, currentState: 'invented' }
  }];
  assert.equal(CauseEffect.validateRows(badRuntime).valid, false);

  const releaseRow = CauseEffect.BASE_ROWS.find((row) => row.id === 'CE-SUPPRESSION-RELEASE');
  const disguisedReleaseInhibit = [{
    ...releaseRow,
    runtime: { ...releaseRow.runtime, currentState: 'inhibited' }
  }];
  const releaseRuntimeResult = CauseEffect.validateRows(disguisedReleaseInhibit);
  assert.equal(releaseRuntimeResult.valid, false);
  assert.ok(releaseRuntimeResult.errors.some((error) => /non-inhibitable/i.test(error)));

  const shutdownAlias = [{
    ...source,
    outputs: [{
      id: 'BAD-HVAC-ALIAS',
      system: 'ahu_crah',
      action: 'SHUTDOWN_ALL',
      scope: 'BUILDING',
      commandType: 'control',
      authority: 'FACP',
      requiredFeedback: ['ALL_OFF']
    }]
  }];
  const aliasResult = CauseEffect.validateRows(shutdownAlias);
  assert.equal(aliasResult.valid, false);
  assert.ok(aliasResult.errors.some((error) => /not allowed/i.test(error)));
}

testBaseContract();
testRequiredSystemCoverage();
testAuthorityAndNoGlobalShutdown();
testEventEvaluationResolvesOnlyEventZone();
testDelayAndProofAreData();
testRuntimeUpdatesAreImmutable();
testInvalidEngineeringShortcutsAreRejected();

console.log('PASS: DC AI fire cause-and-effect invariants');
