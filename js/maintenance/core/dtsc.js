export const DEFAULT_DTSC_SETTINGS = {
  preferredSource: 'S1',
  transitionType: 'delayed',
  transferCommit: true,
  s1OutageDelay: 2,
  s2StartDelay: 3,
  s2StableDelay: 5,
  transferDelayS1S2: 1,
  neutralTimeToS2: 2,
  s1ReturnStableDelay: 5,
  transferDelayS2S1: 2,
  neutralTimeToS1: 2,
  s2CooldownDelay: 6,
  closedTransitionMaxMs: 100
};

export const DTSC_SOURCE_BASIS = [
  'Woodward DTSC-200A supports utility-generator, generator-generator, and utility-utility applications.',
  'Transfer modes include open, delayed neutral, and closed transition with in-phase/synch check.',
  'Transfer commit means a transfer can remain committed once the non-preferred source stable timer has started.',
  'Simulator compresses minute-style commissioning delays into seconds while keeping the displayed unit label as minutes when selected.'
];

export function buildDtscSequence(settings, scenario) {
  const s = { ...DEFAULT_DTSC_SETTINGS, ...settings };
  const events = [];
  let t = 0;
  const add = (duration, state, title, detail, side = 'control') => {
    const start = t;
    const end = t + Math.max(0, Number(duration) || 0);
    events.push({ start, end, duration: end - start, state, title, detail, side });
    t = end;
  };

  add(0, 'NORMAL_S1', 'Initial condition', 'Load is supplied by Source 1. Source 2 is standby.', 's1');

  if (scenario === 'momentary' && !s.transferCommit) {
    add(s.s1OutageDelay, 'S1_OUTAGE_TIMER', 'S1 outage timer active', 'Utility dip is being verified before starting transfer sequence.', 's1');
    add(Math.max(1, s.s2StableDelay / 2), 'ABORT_RESTORE', 'Preferred source restored', 'Transfer is aborted because transfer commit is disabled and S2 stable timer did not finish.', 's1');
    add(0, 'NORMAL_S1', 'Remain on Source 1', 'Load never transferred because preferred source recovered in time.', 's1');
    return withMeta(events, s);
  }

  add(s.s1OutageDelay, 'S1_OUTAGE_TIMER', 'S1 outage timer active', 'Source 1 voltage/frequency is outside acceptable limits.', 's1');
  add(s.s2StartDelay, 'S2_START_DELAY', 'S2 start delay active', 'Engine/start command is issued to Source 2 after the delay expires.', 's2');
  add(s.s2StableDelay, 'S2_STABLE_TIMER', s.transferCommit ? 'S2 stable timer active - transfer committed' : 'S2 stable timer active', 'Source 2 must remain within voltage/frequency window before load transfer.', 's2');
  add(s.transferDelayS1S2, 'TRANSFER_DELAY_S1S2', 'Transfer delay S1 to S2', 'Optional delay before opening preferred source path.', 'control');

  if (s.transitionType === 'closed') {
    add(Math.max(0.1, s.closedTransitionMaxMs / 1000), 'CLOSED_OVERLAP', 'Closed transition overlap', 'S1 and S2 are momentarily paralleled only after in-phase/synch check permit.', 'both');
  } else {
    add(0.2, 'OPEN_S1', 'Open Source 1 breaker/contactor', 'Load is removed from Source 1 before closing Source 2.', 's1');
    if (s.transitionType === 'delayed') {
      add(s.neutralTimeToS2, 'NEUTRAL_TO_S2', 'Neutral timer to Source 2 active', 'ATS remains in neutral/open position before Source 2 close.', 'control');
    }
  }

  add(0.2, 'CLOSE_S2', 'Close Source 2 breaker/contactor', 'Load is now supplied by Source 2.', 's2');
  add(0, 'LOAD_ON_S2', 'Emergency source carrying load', 'S2 is loaded. S1 remains unavailable or unstable.', 's2');

  if (scenario === 'fail-only') return withMeta(events, s);

  add(s.s1ReturnStableDelay, 'S1_STABLE_RETURN', 'S1 stable timer active', 'Preferred source has returned and must remain stable before retransfer.', 's1');
  add(s.transferDelayS2S1, 'TRANSFER_DELAY_S2S1', 'Transfer delay S2 to S1', 'Optional delay before returning to preferred source.', 'control');

  if (s.transitionType === 'closed') {
    add(Math.max(0.1, s.closedTransitionMaxMs / 1000), 'CLOSED_RETRANSFER', 'Closed transition retransfer', 'Sources are momentarily paralleled under synch-check supervision.', 'both');
  } else {
    add(0.2, 'OPEN_S2', 'Open Source 2 breaker/contactor', 'Load is removed from S2 before closing S1.', 's2');
    if (s.transitionType === 'delayed') {
      add(s.neutralTimeToS1, 'NEUTRAL_TO_S1', 'Neutral timer to Source 1 active', 'ATS remains in neutral/open position before preferred source close.', 'control');
    }
  }

  add(0.2, 'CLOSE_S1', 'Close Source 1 breaker/contactor', 'Load is back on preferred source.', 's1');
  add(s.s2CooldownDelay, 'S2_COOLDOWN', 'S2 cooldown timer active', 'Engine/generator remains running unloaded for cooldown.', 's2');
  add(0, 'NORMAL_S1', 'Normal restored', 'Load on Source 1. Source 2 stopped or standby.', 's1');

  return withMeta(events, s);
}

function withMeta(events, settings) {
  return {
    settings,
    totalDuration: events.reduce((max, event) => Math.max(max, event.end), 0),
    events
  };
}

export function eventAt(sequence, time) {
  const exactZeroDuration = sequence.events.find((event) => event.duration === 0 && time === event.start);
  if (exactZeroDuration) return exactZeroDuration;
  return sequence.events.find((event) => time >= event.start && time < event.end) || sequence.events[sequence.events.length - 1];
}

export function deriveDtscHmiState(sequence, time) {
  const event = eventAt(sequence, time);
  const s = sequence.settings || DEFAULT_DTSC_SETTINGS;
  const state = event?.state || 'UNKNOWN';
  const progress = event?.duration > 0 ? clamp((time - event.start) / event.duration, 0, 1) : 1;
  const remaining = event?.duration > 0 ? Math.max(0, event.end - time) : 0;
  const closedOverlap = ['CLOSED_OVERLAP', 'CLOSED_RETRANSFER'].includes(state);
  const neutral = ['OPEN_S1', 'NEUTRAL_TO_S2', 'OPEN_S2', 'NEUTRAL_TO_S1'].includes(state);
  const s1Unavailable = ['S1_OUTAGE_TIMER', 'S2_START_DELAY', 'S2_STABLE_TIMER', 'TRANSFER_DELAY_S1S2', 'OPEN_S1', 'NEUTRAL_TO_S2', 'CLOSE_S2', 'LOAD_ON_S2'].includes(state);
  const s2StartCommand = ['S2_START_DELAY', 'S2_STABLE_TIMER', 'TRANSFER_DELAY_S1S2', 'OPEN_S1', 'NEUTRAL_TO_S2', 'CLOSED_OVERLAP', 'CLOSE_S2', 'LOAD_ON_S2', 'S1_STABLE_RETURN', 'TRANSFER_DELAY_S2S1', 'OPEN_S2', 'NEUTRAL_TO_S1', 'CLOSED_RETRANSFER', 'CLOSE_S1', 'S2_COOLDOWN'].includes(state);
  const s2Stable = ['TRANSFER_DELAY_S1S2', 'OPEN_S1', 'NEUTRAL_TO_S2', 'CLOSED_OVERLAP', 'CLOSE_S2', 'LOAD_ON_S2', 'S1_STABLE_RETURN', 'TRANSFER_DELAY_S2S1', 'OPEN_S2', 'NEUTRAL_TO_S1', 'CLOSED_RETRANSFER', 'CLOSE_S1', 'S2_COOLDOWN'].includes(state);
  const normalRestored = state === 'NORMAL_S1' && time > 0;
  const s1ReturnTiming = state === 'S1_STABLE_RETURN';
  const s1StableReturn = normalRestored || ['TRANSFER_DELAY_S2S1', 'OPEN_S2', 'NEUTRAL_TO_S1', 'CLOSED_RETRANSFER', 'CLOSE_S1', 'S2_COOLDOWN'].includes(state);

  const s1Breaker = breakerState('s1', state, closedOverlap);
  const s2Breaker = breakerState('s2', state, closedOverlap);
  const bus = busState(s1Breaker, s2Breaker, neutral, closedOverlap);
  const requirement = requirementForEvent(event, progress, remaining);
  const alarms = [];
  if (s1Unavailable) alarms.push('S1 V/F abnormal or unavailable to load transfer logic.');
  if (neutral) alarms.push('Load bus is intentionally open during transfer dead time.');
  if (closedOverlap && (s.closedTransitionMaxMs || 0) > 100) alarms.push('Closed transition overlap exceeds 100 ms review threshold.');
  if (!alarms.length) alarms.push('No active sequence alarm in this simulated state.');

  return {
    event,
    progress,
    remainingSeconds: remaining,
    sources: {
      s1: {
        label: 'S1 Utility',
        status: s1Unavailable ? 'ABNORMAL' : 'AVAILABLE',
        healthy: !s1Unavailable,
        stable: !s1Unavailable || s1StableReturn,
        returnTiming: s1ReturnTiming,
        returnStable: s1StableReturn,
        voltageFrequency: s1Unavailable ? 'OUT OF LIMIT' : 'WITHIN LIMIT'
      },
      s2: {
        label: 'S2 Emergency',
        status: s2Stable ? 'STABLE' : s2StartCommand ? 'STARTING' : 'STANDBY',
        startCommand: s2StartCommand,
        stable: s2Stable,
        voltageFrequency: s2Stable ? 'WITHIN LIMIT' : s2StartCommand ? 'VERIFYING' : 'NOT RUNNING'
      }
    },
    breakers: {
      s1: s1Breaker,
      s2: s2Breaker
    },
    bus,
    requirement,
    permissives: [
      { label: 'S1 voltage/frequency', state: s1Unavailable ? 'OUT' : 'OK', tone: s1Unavailable ? 'crit' : 'ok' },
      { label: 'S2 start command', state: s2StartCommand ? 'ACTIVE' : 'STANDBY', tone: s2StartCommand ? 'ok' : 'idle' },
      { label: 'S2 stabilization', state: s2Stable ? 'PASSED' : state === 'S2_STABLE_TIMER' ? 'TIMING' : 'WAIT', tone: s2Stable ? 'ok' : state === 'S2_STABLE_TIMER' ? 'warn' : 'idle' },
      { label: 'S1 return stable', state: s1StableReturn ? 'PASSED' : s1ReturnTiming ? 'TIMING' : 'N/A', tone: s1StableReturn ? 'ok' : s1ReturnTiming ? 'warn' : 'idle' },
      { label: 'Neutral / open verify', state: neutral ? 'ACTIVE' : 'CLEAR', tone: neutral ? 'warn' : 'ok' },
      { label: 'Synch-check permit', state: s.transitionType === 'closed' ? closedOverlap ? 'PERMIT ACTIVE' : 'REQUIRED' : 'N/A', tone: s.transitionType === 'closed' ? closedOverlap ? 'ok' : 'warn' : 'idle' },
      { label: 'Transfer commit', state: s.transferCommit ? 'ENABLED' : 'DISABLED', tone: s.transferCommit ? 'ok' : 'warn' }
    ],
    alarms
  };
}

export function analyzeDtscSequence(sequence) {
  const events = sequence.events || [];
  const firstLoadOnS2 = events.find((event) => event.state === 'CLOSE_S2' || event.state === 'LOAD_ON_S2');
  const firstLoadBackS1 = events.find((event) => event.state === 'CLOSE_S1' || event.title === 'Normal restored');
  const neutralToS2 = sumDurations(events, ['OPEN_S1', 'NEUTRAL_TO_S2']);
  const neutralToS1 = sumDurations(events, ['OPEN_S2', 'NEUTRAL_TO_S1']);
  const closedOverlap = sumDurations(events, ['CLOSED_OVERLAP', 'CLOSED_RETRANSFER']);
  const warnings = [];
  const s = sequence.settings || {};

  if (s.transitionType === 'closed' && (s.closedTransitionMaxMs || 0) > 100) {
    warnings.push('Closed transition overlap above 100 ms should be treated as high-risk and verified against synch-check/paralleling limits.');
  }
  if (s.transitionType === 'delayed' && Math.max(s.neutralTimeToS2 || 0, s.neutralTimeToS1 || 0) > 10) {
    warnings.push('Delayed-neutral timer is long enough to create visible load outage; confirm downstream UPS/load ride-through.');
  }
  if (!s.transferCommit) {
    warnings.push('Transfer commit disabled: preferred-source return can abort transfer before S2 is accepted.');
  }
  if ((s.s2StableDelay || 0) < 2) {
    warnings.push('S2 stable timer is short; validate voltage/frequency stability before load acceptance.');
  }
  if (!warnings.length) warnings.push('Sequence timing is internally consistent for maintenance simulation.');

  return {
    outageToS2Seconds: firstLoadOnS2 ? firstLoadOnS2.end : 0,
    retransferStartSeconds: firstLoadBackS1 ? firstLoadBackS1.start : 0,
    loadInterruptionToS2Seconds: neutralToS2,
    loadInterruptionToS1Seconds: neutralToS1,
    closedOverlapSeconds: closedOverlap,
    warnings
  };
}

function sumDurations(events, states) {
  return events
    .filter((event) => states.includes(event.state))
    .reduce((sum, event) => sum + event.duration, 0);
}

export function dtscWorkbookSheets(sequence) {
  const s = sequence.settings;
  const analysis = analyzeDtscSequence(sequence);
  return [
    {
      name: 'Sequence Summary',
      widths: [34, 18, 90],
      rows: [
        ['Metric', 'Value', 'Interpretation'],
        ['Outage to S2 load acceptance (s)', analysis.outageToS2Seconds.toFixed(1), 'Elapsed simulation time from S1 abnormal to S2 breaker/contactor close.'],
        ['Load interruption to S2 (s)', analysis.loadInterruptionToS2Seconds.toFixed(1), 'Open/delayed-neutral interval before S2 is closed.'],
        ['Retransfer interruption to S1 (s)', analysis.loadInterruptionToS1Seconds.toFixed(1), 'Open/delayed-neutral interval before S1 is restored.'],
        ['Closed overlap total (s)', analysis.closedOverlapSeconds.toFixed(3), 'Expected to be short and synch-check supervised.'],
        ['Warnings / validation', analysis.warnings.join(' '), 'Maintenance review notes.']
      ]
    },
    {
      name: 'ATS Sequence',
      widths: [10, 10, 18, 28, 80],
      rows: [
        ['Start s', 'End s', 'State', 'Step', 'Detail'],
        ...sequence.events.map((event) => [event.start.toFixed(1), event.end.toFixed(1), event.state, event.title, event.detail])
      ]
    },
    {
      name: 'HMI States',
      widths: [10, 10, 18, 18, 16, 18, 16, 18, 28, 18],
      rows: [
        ['Start s', 'End s', 'State', 'S1 V/F', 'QF1 S1', 'S2 V/F', 'QF2 S2', 'Load bus', 'Active requirement', 'Requirement progress'],
        ...sequence.events.map((event) => {
          const hmi = deriveDtscHmiState(sequence, event.duration > 0 ? event.start + event.duration / 2 : event.start);
          return [
            event.start.toFixed(1),
            event.end.toFixed(1),
            event.state,
            hmi.sources.s1.voltageFrequency,
            hmi.breakers.s1.position,
            hmi.sources.s2.voltageFrequency,
            hmi.breakers.s2.position,
            hmi.bus.label,
            hmi.requirement.label,
            `${Math.round(hmi.requirement.progress * 100)}%`
          ];
        })
      ]
    },
    {
      name: 'Settings',
      widths: [30, 20, 80],
      rows: [
        ['Setting', 'Value', 'Note'],
        ['Preferred source', s.preferredSource, 'Source priority used by this simulator'],
        ['Transition type', s.transitionType, 'open, delayed, or closed'],
        ['Transfer commit', s.transferCommit ? 'YES' : 'NO', 'If YES, transfer to non-preferred source remains committed after stable timer starts'],
        ['S1 outage delay', s.s1OutageDelay, 'Simulator seconds; may represent minute-labelled commissioning setting'],
        ['S2 start delay', s.s2StartDelay, 'Simulator seconds'],
        ['S2 stable delay', s.s2StableDelay, 'Simulator seconds'],
        ['Neutral time to S2', s.neutralTimeToS2, 'Used for delayed transition'],
        ['S1 return stable delay', s.s1ReturnStableDelay, 'Simulator seconds'],
        ['Neutral time to S1', s.neutralTimeToS1, 'Used for delayed transition'],
        ['S2 cooldown delay', s.s2CooldownDelay, 'Simulator seconds']
      ]
    }
  ];
}

function breakerState(source, state, closedOverlap) {
  const s1Closed = closedOverlap || ['NORMAL_S1', 'S1_OUTAGE_TIMER', 'S2_START_DELAY', 'S2_STABLE_TIMER', 'TRANSFER_DELAY_S1S2', 'ABORT_RESTORE', 'CLOSE_S1', 'S2_COOLDOWN'].includes(state);
  const s2Closed = closedOverlap || ['CLOSE_S2', 'LOAD_ON_S2', 'S1_STABLE_RETURN', 'TRANSFER_DELAY_S2S1'].includes(state);
  if (source === 's1') {
    if (state === 'OPEN_S1') return { position: 'OPENING', closed: false, transition: true, label: 'QF1 S1 incomer opening' };
    if (state === 'CLOSE_S1') return { position: 'CLOSING', closed: true, transition: true, label: 'QF1 S1 incomer closing' };
    return { position: s1Closed ? 'CLOSED' : 'OPEN', closed: s1Closed, transition: false, label: 'QF1 S1 incomer' };
  }
  if (state === 'OPEN_S2') return { position: 'OPENING', closed: false, transition: true, label: 'QF2 S2 incomer opening' };
  if (state === 'CLOSE_S2') return { position: 'CLOSING', closed: true, transition: true, label: 'QF2 S2 incomer closing' };
  return { position: s2Closed ? 'CLOSED' : 'OPEN', closed: s2Closed, transition: false, label: 'QF2 S2 incomer' };
}

function busState(s1Breaker, s2Breaker, neutral, closedOverlap) {
  if (closedOverlap) return { energized: true, label: 'PARALLEL', tone: 'warn', detail: 'S1 and S2 are momentarily paralleled under synch-check supervision.' };
  if (s1Breaker.closed && !s2Breaker.closed) return { energized: true, label: 'ON S1', tone: 'ok', detail: 'Load bus supplied by Source 1 incomer.' };
  if (s2Breaker.closed && !s1Breaker.closed) return { energized: true, label: 'ON S2', tone: 'ok', detail: 'Load bus supplied by Source 2 incomer.' };
  if (neutral) return { energized: false, label: 'OPEN', tone: 'crit', detail: 'Load bus is open during neutral/dead-transfer interval.' };
  return { energized: false, label: 'NO SOURCE', tone: 'crit', detail: 'No incomer is closed to the load bus.' };
}

function requirementForEvent(event, progress, remaining) {
  const base = {
    label: 'No active timer requirement',
    requiredSeconds: 0,
    remainingSeconds: 0,
    progress: 1,
    status: 'SATISFIED',
    detail: 'State is instantaneous or already stable.'
  };
  if (!event) return base;
  const map = {
    S1_OUTAGE_TIMER: ['S1 outage verification', 'Confirm S1 voltage/frequency remains outside acceptable limits before starting transfer logic.'],
    S2_START_DELAY: ['S2 start delay', 'Wait before issuing or completing the Source 2 engine/start command.'],
    S2_STABLE_TIMER: ['S2 stabilization requirement', 'S2 voltage and frequency must remain inside the accepted window for the full stable timer.'],
    TRANSFER_DELAY_S1S2: ['S1 to S2 transfer delay', 'Intentional delay before opening the preferred-source path.'],
    NEUTRAL_TO_S2: ['Neutral dead-time to S2', 'Both incomers remain open until delayed-neutral timer is complete.'],
    S1_STABLE_RETURN: ['S1 return stabilization requirement', 'Preferred source must remain stable before retransfer is permitted.'],
    TRANSFER_DELAY_S2S1: ['S2 to S1 retransfer delay', 'Intentional delay before returning load to the preferred source.'],
    NEUTRAL_TO_S1: ['Neutral dead-time to S1', 'Both incomers remain open until preferred-source close is permitted.'],
    S2_COOLDOWN: ['S2 cooldown requirement', 'Source 2 remains running unloaded for cooldown after load returns to Source 1.'],
    CLOSED_OVERLAP: ['Closed-transition overlap', 'Synch-check must permit short paralleling before the outgoing incomer opens.'],
    CLOSED_RETRANSFER: ['Closed retransfer overlap', 'Synch-check must permit short paralleling before returning to Source 1.']
  };
  const [label, detail] = map[event.state] || [base.label, base.detail];
  return {
    label,
    requiredSeconds: event.duration,
    remainingSeconds: remaining,
    progress,
    status: progress >= 1 ? 'SATISFIED' : 'TIMING',
    detail
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}
