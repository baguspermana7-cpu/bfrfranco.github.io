/* ============================================================================
 * datahall-ai/fire-cause-effect.js
 * Immutable fire cause-and-effect contract for the DC AI operator UI.
 *
 * FACP remains the life-safety authority. BMS/DCIM is monitor-only. Every
 * control effect is explicit, scoped, proof-bearing, and safe to render as a
 * list or matrix; no detector input is translated into a global shutdown.
 * ES5-compatible, zero-build, and free of DOM dependencies.
 * ==========================================================================*/
(function (root) {
  'use strict';
  var AUTHORITY = {
    controllingSystem: 'FACP',
    bmsMode: 'MONITOR_ONLY',
    resetAuthority: 'AUTHORIZED_FACP_MANUAL_RESET',
    simulationMode: 'TRAINING_ONLY_NO_REAL_OUTPUT'
  };
  var REQUIRED_FIELDS = [
    'id', 'initiatingEvent', 'zone', 'stage', 'delaySeconds', 'outputs',
    'commandState', 'requiredFeedback', 'failureState', 'overrideInhibit',
    'resetAuthority', 'basis', 'authority', 'runtime'
  ];
  var VALID_RUNTIME_STATE = {
    normal: true, active: true, trouble: true, inhibited: true, reset: true
  };
  var VALID_COMMAND_STATE = {
    idle: true, issued: true, held: true, complete: true
  };
  var VALID_FEEDBACK_STATE = {
    not_required: true, pending: true, proved: true, failed: true
  };
  var RELEASE_INTERLOCKS = [
    { field: 'confirmedFire', required: true, reason: 'CONFIRMED_FIRE_NOT_PROVED' },
    { field: 'abortActive', required: false, reason: 'ABORT_NOT_PROVED_CLEAR' },
    { field: 'inhibited', required: false, reason: 'INHIBIT_NOT_PROVED_CLEAR' },
    { field: 'enclosureIsolated', required: true, reason: 'ENCLOSURE_ISOLATION_NOT_PROVED' },
    { field: 'releaseCircuitReady', required: true, reason: 'RELEASE_CIRCUIT_NOT_READY' },
    { field: 'preDischargeWarningComplete', required: true, reason: 'PRE_DISCHARGE_WARNING_NOT_COMPLETE' }
  ];
  var OUTPUT_POLICIES = {
    notification: {
      actions: ['PREALARM_NOTIFY', 'ACTION_NOTIFY', 'FIRE_1_NOTIFY',
        'CONFIRMED_FIRE_NOTIFY', 'GENERAL_FIRE_ALARM', 'WATERFLOW_FIRE_ALARM',
        'PRE_DISCHARGE_WARNING', 'ABORT_ACTIVE_WARNING', 'AGENT_DISCHARGE_ALARM',
        'POST_DISCHARGE_EVACUATION', 'EPO_ACTIVE_WARNING', 'LEAK_RESPONSE_NOTIFY'],
      scopes: ['OPERATIONS_TEAM', 'OPERATIONS_AND_SECURITY', 'RESPONSE_TEAM',
        'BUILDING_NOTIFICATION_ZONES', 'EVENT_ZONE'],
      commandType: 'control', authority: 'FACP'
    },
    public_address: {
      actions: ['VOICE_EVACUATION_MESSAGE'],
      scopes: ['BUILDING_NOTIFICATION_ZONES'],
      commandType: 'control', authority: 'FACP'
    },
    fire_brigade: {
      actions: ['TRANSMIT_CONFIRMED_FIRE'],
      scopes: ['FIRE_BRIGADE_INTERFACE'],
      commandType: 'control', authority: 'FACP'
    },
    noc_sms: {
      actions: ['NOTIFY_ESCALATION'],
      scopes: ['NOC_ON_CALL'],
      commandType: 'control', authority: 'FACP'
    },
    elevator: {
      actions: ['RECALL'], scopes: ['ELEVATOR_GROUP'],
      commandType: 'control', authority: 'FACP'
    },
    access_control: {
      actions: ['RELEASE_EGRESS_AND_HOLD_OPEN_SEQUENCE'],
      scopes: ['BUILDING_EGRESS_PATH'],
      commandType: 'control', authority: 'FACP'
    },
    ahu_crah: {
      actions: ['EXECUTE_ENGINEERED_ZONE_SEQUENCE',
        'EXECUTE_PRE_DISCHARGE_ZONE_SEQUENCE'],
      scopes: ['EVENT_ZONE'], commandType: 'control', authority: 'FACP'
    },
    smoke_control: {
      actions: ['EXECUTE_ENGINEERED_ZONE_SEQUENCE', 'ISOLATE_AGENT_ENCLOSURE'],
      scopes: ['EVENT_ZONE'], commandType: 'control', authority: 'FACP'
    },
    clean_agent: {
      actions: ['ARM_COUNTDOWN', 'HOLD_RELEASE', 'RELEASE_AGENT',
        'LOCKOUT_AFTER_DISCHARGE'],
      scopes: ['EVENT_ZONE'], commandType: 'control', authority: 'FACP'
    },
    zoned_epo: {
      actions: ['ISOLATE_ZONE_POWER'], scopes: ['EVENT_ZONE'],
      commandType: 'control', authority: 'FACP'
    },
    generator: {
      actions: ['EXECUTE_PROJECT_APPROVED_FIRE_SEQUENCE'],
      scopes: ['GENERATOR_GROUP'], commandType: 'control', authority: 'FACP'
    },
    cctv: {
      actions: ['BOOKMARK_EVENT', 'FOCUS_AND_BOOKMARK'], scopes: ['EVENT_ZONE'],
      commandType: 'control', authority: 'FACP'
    },
    bms_event: {
      actions: ['PUBLISH_EVENT'], scopes: ['EVENT_ZONE'],
      commandType: 'monitor', authority: 'MONITOR_ONLY'
    },
    preaction: {
      actions: ['MONITOR_VALVE_AND_FLOW'], scopes: ['EVENT_ZONE'],
      commandType: 'control', authority: 'FACP'
    },
    leak_control: {
      actions: ['ISOLATE_AFFECTED_BRANCH'], scopes: ['EVENT_ZONE'],
      commandType: 'control', authority: 'FACP'
    }
  };
  function deepFreeze(value) {
    var keys;
    var i;
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) { return value; }
    keys = Object.keys(value);
    for (i = 0; i < keys.length; i += 1) { deepFreeze(value[keys[i]]); }
    return Object.freeze(value);
  }
  function clone(value) {
    var result;
    var keys;
    var i;
    if (value === null || typeof value !== 'object') { return value; }
    if (Object.prototype.toString.call(value) === '[object Array]') {
      result = [];
      for (i = 0; i < value.length; i += 1) { result.push(clone(value[i])); }
      return result;
    }
    result = {};
    keys = Object.keys(value);
    for (i = 0; i < keys.length; i += 1) { result[keys[i]] = clone(value[keys[i]]); }
    return result;
  }
  function output(id, system, action, scope, commandType, authority, feedback) {
    return {
      id: id,
      system: system,
      action: action,
      scope: scope,
      commandType: commandType,
      authority: authority,
      requiredFeedback: feedback.slice()
    };
  }
  function defaultRuntime() {
    return {
      currentState: 'normal',
      commandState: 'idle',
      feedbackState: 'not_required',
      inhibited: false,
      lastTestAt: null
    };
  }
  function row(spec) {
    return {
      id: spec.id,
      initiatingEvent: { id: spec.eventId, label: spec.eventLabel },
      zone: { id: 'EVENT_ZONE', scope: 'selected-fire-zone' },
      stage: spec.stage,
      delaySeconds: spec.delaySeconds,
      outputs: spec.outputs,
      commandState: spec.commandState,
      requiredFeedback: spec.requiredFeedback,
      failureState: spec.failureState,
      overrideInhibit: {
        allowed: spec.inhibitAllowed !== false,
        authority: 'AUTHORIZED_FACP_OPERATOR',
        indication: 'FACP_TROUBLE_WHEN_INHIBITED'
      },
      resetAuthority: AUTHORITY.resetAuthority,
      basis: [
        'PROJECT_BASIS_OF_DESIGN',
        'AHJ_APPROVED_CAUSE_AND_EFFECT',
        'CURRENT_ADOPTED_FIRE_AND_BUILDING_CODES'
      ],
      authority: 'FACP',
      runtime: defaultRuntime()
    };
  }
  var BASE_ROWS = deepFreeze([
    row({
      id: 'CE-VESDA-ALERT',
      eventId: 'vesda_alert',
      eventLabel: 'VESDA Alert threshold',
      stage: 1,
      delaySeconds: 0,
      commandState: 'PREALARM',
      requiredFeedback: ['FACP_EVENT_LATCHED', 'OPERATOR_NOTIFICATION_ACK'],
      failureState: ['FACP_TROUBLE', 'NOTIFICATION_PATH_FAIL'],
      outputs: [
        output('OUT-VA-NOTIFY', 'notification', 'PREALARM_NOTIFY', 'OPERATIONS_TEAM', 'control', 'FACP', ['NOTIFICATION_ACK']),
        output('OUT-VA-CCTV', 'cctv', 'BOOKMARK_EVENT', 'EVENT_ZONE', 'control', 'FACP', ['BOOKMARK_ID']),
        output('OUT-VA-BMS', 'bms_event', 'PUBLISH_EVENT', 'EVENT_ZONE', 'monitor', 'MONITOR_ONLY', ['EVENT_INGESTED'])
      ]
    }),
    row({
      id: 'CE-VESDA-ACTION',
      eventId: 'vesda_action',
      eventLabel: 'VESDA Action threshold',
      stage: 2,
      delaySeconds: 0,
      commandState: 'INVESTIGATE',
      requiredFeedback: ['FACP_EVENT_LATCHED', 'INVESTIGATION_ASSIGNED'],
      failureState: ['FACP_TROUBLE', 'NO_OPERATOR_ACK'],
      outputs: [
        output('OUT-VACT-NOTIFY', 'notification', 'ACTION_NOTIFY', 'OPERATIONS_AND_SECURITY', 'control', 'FACP', ['NOTIFICATION_ACK']),
        output('OUT-VACT-CCTV', 'cctv', 'FOCUS_AND_BOOKMARK', 'EVENT_ZONE', 'control', 'FACP', ['CAMERA_PRESET_ACK', 'BOOKMARK_ID']),
        output('OUT-VACT-BMS', 'bms_event', 'PUBLISH_EVENT', 'EVENT_ZONE', 'monitor', 'MONITOR_ONLY', ['EVENT_INGESTED'])
      ]
    }),
    row({
      id: 'CE-VESDA-FIRE-1',
      eventId: 'vesda_fire_1',
      eventLabel: 'VESDA Fire 1 threshold',
      stage: 2,
      delaySeconds: 0,
      commandState: 'SECOND_SOURCE_REQUIRED',
      requiredFeedback: ['FACP_EVENT_LATCHED', 'SECOND_DETECTION_SOURCE_STATUS'],
      failureState: ['DETECTION_ZONE_TROUBLE', 'SECOND_SOURCE_UNAVAILABLE'],
      outputs: [
        output('OUT-VF1-NOTIFY', 'notification', 'FIRE_1_NOTIFY', 'RESPONSE_TEAM', 'control', 'FACP', ['NOTIFICATION_ACK']),
        output('OUT-VF1-CCTV', 'cctv', 'FOCUS_AND_BOOKMARK', 'EVENT_ZONE', 'control', 'FACP', ['CAMERA_PRESET_ACK', 'BOOKMARK_ID']),
        output('OUT-VF1-BMS', 'bms_event', 'PUBLISH_EVENT', 'EVENT_ZONE', 'monitor', 'MONITOR_ONLY', ['EVENT_INGESTED'])
      ]
    }),
    row({
      id: 'CE-VESDA-FIRE-2',
      eventId: 'vesda_fire_2',
      eventLabel: 'VESDA Fire 2 confirmed threshold',
      stage: 3,
      delaySeconds: 0,
      commandState: 'CONFIRMED_FIRE',
      requiredFeedback: ['FACP_CONFIRMED_FIRE', 'OUTPUT_MODULE_FEEDBACK'],
      failureState: ['OUTPUT_MODULE_TROUBLE', 'INTERFACE_FEEDBACK_FAIL'],
      outputs: [
        output('OUT-VF2-NOTIFY', 'notification', 'CONFIRMED_FIRE_NOTIFY', 'BUILDING_NOTIFICATION_ZONES', 'control', 'FACP', ['NAC_FEEDBACK']),
        output('OUT-VF2-HVAC', 'ahu_crah', 'EXECUTE_ENGINEERED_ZONE_SEQUENCE', 'EVENT_ZONE', 'control', 'FACP', ['UNIT_STATUS', 'AIRFLOW_PROOF']),
        output('OUT-VF2-SMOKE', 'smoke_control', 'EXECUTE_ENGINEERED_ZONE_SEQUENCE', 'EVENT_ZONE', 'control', 'FACP', ['DAMPER_END_SWITCH', 'FAN_STATUS']),
        output('OUT-VF2-BMS', 'bms_event', 'PUBLISH_EVENT', 'EVENT_ZONE', 'monitor', 'MONITOR_ONLY', ['EVENT_INGESTED'])
      ]
    }),
    row({
      id: 'CE-MULTI-SENSOR-CONFIRM',
      eventId: 'multi_sensor_confirmation',
      eventLabel: 'Smoke and heat multi-sensor confirmation',
      stage: 3,
      delaySeconds: 0,
      commandState: 'CONFIRMED_FIRE',
      requiredFeedback: ['TWO_SOURCE_CONFIRMATION', 'OUTPUT_MODULE_FEEDBACK'],
      failureState: ['DETECTION_ZONE_TROUBLE', 'INTERFACE_FEEDBACK_FAIL'],
      outputs: [
        output('OUT-MS-NOTIFY', 'notification', 'GENERAL_FIRE_ALARM', 'BUILDING_NOTIFICATION_ZONES', 'control', 'FACP', ['NAC_FEEDBACK']),
        output('OUT-MS-ELEV', 'elevator', 'RECALL', 'ELEVATOR_GROUP', 'control', 'FACP', ['RECALL_FLOOR_STATUS', 'CONTROLLER_ACK']),
        output('OUT-MS-ACCESS', 'access_control', 'RELEASE_EGRESS_AND_HOLD_OPEN_SEQUENCE', 'BUILDING_EGRESS_PATH', 'control', 'FACP', ['DOOR_RELAY_FEEDBACK', 'MAGLOCK_POWER_STATUS']),
        output('OUT-MS-HVAC', 'ahu_crah', 'EXECUTE_ENGINEERED_ZONE_SEQUENCE', 'EVENT_ZONE', 'control', 'FACP', ['UNIT_STATUS', 'AIRFLOW_PROOF']),
        output('OUT-MS-SMOKE', 'smoke_control', 'EXECUTE_ENGINEERED_ZONE_SEQUENCE', 'EVENT_ZONE', 'control', 'FACP', ['DAMPER_END_SWITCH', 'FAN_STATUS']),
        output('OUT-MS-CCTV', 'cctv', 'FOCUS_AND_BOOKMARK', 'EVENT_ZONE', 'control', 'FACP', ['CAMERA_PRESET_ACK', 'BOOKMARK_ID']),
        output('OUT-MS-BMS', 'bms_event', 'PUBLISH_EVENT', 'EVENT_ZONE', 'monitor', 'MONITOR_ONLY', ['EVENT_INGESTED'])
      ]
    }),
    row({
      id: 'CE-CONFIRMED-FIRE',
      eventId: 'confirmed_fire',
      eventLabel: 'Confirmed fire in two independent detection sources',
      stage: 3,
      delaySeconds: 0,
      commandState: 'CONFIRMED_FIRE',
      requiredFeedback: ['FACP_CONFIRMED_FIRE', 'OUTPUT_MODULE_FEEDBACK'],
      failureState: ['OUTPUT_MODULE_TROUBLE', 'INTERFACE_FEEDBACK_FAIL'],
      outputs: [
        output('OUT-CF-NOTIFY', 'notification', 'GENERAL_FIRE_ALARM', 'BUILDING_NOTIFICATION_ZONES', 'control', 'FACP', ['NAC_FEEDBACK']),
        output('OUT-CF-PA', 'public_address', 'VOICE_EVACUATION_MESSAGE', 'BUILDING_NOTIFICATION_ZONES', 'control', 'FACP', ['AMPLIFIER_HEALTH', 'MESSAGE_ACTIVE']),
        output('OUT-CF-BRIGADE', 'fire_brigade', 'TRANSMIT_CONFIRMED_FIRE', 'FIRE_BRIGADE_INTERFACE', 'control', 'FACP', ['TRANSMISSION_ACK']),
        output('OUT-CF-NOC', 'noc_sms', 'NOTIFY_ESCALATION', 'NOC_ON_CALL', 'control', 'FACP', ['DELIVERY_ACK']),
        output('OUT-CF-ELEV', 'elevator', 'RECALL', 'ELEVATOR_GROUP', 'control', 'FACP', ['RECALL_FLOOR_STATUS', 'CONTROLLER_ACK']),
        output('OUT-CF-ACCESS', 'access_control', 'RELEASE_EGRESS_AND_HOLD_OPEN_SEQUENCE', 'BUILDING_EGRESS_PATH', 'control', 'FACP', ['DOOR_RELAY_FEEDBACK', 'MAGLOCK_POWER_STATUS']),
        output('OUT-CF-HVAC', 'ahu_crah', 'EXECUTE_ENGINEERED_ZONE_SEQUENCE', 'EVENT_ZONE', 'control', 'FACP', ['UNIT_STATUS', 'AIRFLOW_PROOF']),
        output('OUT-CF-SMOKE', 'smoke_control', 'EXECUTE_ENGINEERED_ZONE_SEQUENCE', 'EVENT_ZONE', 'control', 'FACP', ['DAMPER_END_SWITCH', 'FAN_STATUS']),
        output('OUT-CF-CCTV', 'cctv', 'FOCUS_AND_BOOKMARK', 'EVENT_ZONE', 'control', 'FACP', ['CAMERA_PRESET_ACK', 'BOOKMARK_ID']),
        output('OUT-CF-GEN', 'generator', 'EXECUTE_PROJECT_APPROVED_FIRE_SEQUENCE', 'GENERATOR_GROUP', 'control', 'FACP', ['GENERATOR_CONTROLLER_ACK', 'PROJECT_SEQUENCE_STATUS']),
        output('OUT-CF-BMS', 'bms_event', 'PUBLISH_EVENT', 'EVENT_ZONE', 'monitor', 'MONITOR_ONLY', ['EVENT_INGESTED'])
      ]
    }),
    row({
      id: 'CE-MANUAL-CALL',
      eventId: 'manual_call_point',
      eventLabel: 'Manual call point operated',
      stage: 3,
      delaySeconds: 0,
      commandState: 'MANUAL_FIRE_ALARM',
      requiredFeedback: ['MCP_ADDRESS_LATCHED', 'OUTPUT_MODULE_FEEDBACK'],
      failureState: ['MCP_CIRCUIT_TROUBLE', 'INTERFACE_FEEDBACK_FAIL'],
      outputs: [
        output('OUT-MCP-NOTIFY', 'notification', 'GENERAL_FIRE_ALARM', 'BUILDING_NOTIFICATION_ZONES', 'control', 'FACP', ['NAC_FEEDBACK']),
        output('OUT-MCP-ELEV', 'elevator', 'RECALL', 'ELEVATOR_GROUP', 'control', 'FACP', ['RECALL_FLOOR_STATUS']),
        output('OUT-MCP-ACCESS', 'access_control', 'RELEASE_EGRESS_AND_HOLD_OPEN_SEQUENCE', 'BUILDING_EGRESS_PATH', 'control', 'FACP', ['DOOR_RELAY_FEEDBACK']),
        output('OUT-MCP-CCTV', 'cctv', 'FOCUS_AND_BOOKMARK', 'EVENT_ZONE', 'control', 'FACP', ['BOOKMARK_ID']),
        output('OUT-MCP-BMS', 'bms_event', 'PUBLISH_EVENT', 'EVENT_ZONE', 'monitor', 'MONITOR_ONLY', ['EVENT_INGESTED'])
      ]
    }),
    row({
      id: 'CE-PREACTION-SPRINKLER',
      eventId: 'preaction_or_sprinkler',
      eventLabel: 'Pre-action or sprinkler system operated',
      stage: 3,
      delaySeconds: 0,
      commandState: 'WATER_SYSTEM_ACTIVE',
      requiredFeedback: ['VALVE_TAMPER_STATUS', 'WATERFLOW_SWITCH_STATUS'],
      failureState: ['VALVE_SUPERVISORY', 'WATERFLOW_FEEDBACK_FAIL'],
      outputs: [
        output('OUT-PA-NOTIFY', 'notification', 'WATERFLOW_FIRE_ALARM', 'BUILDING_NOTIFICATION_ZONES', 'control', 'FACP', ['NAC_FEEDBACK']),
        output('OUT-PA-WATER', 'preaction', 'MONITOR_VALVE_AND_FLOW', 'EVENT_ZONE', 'control', 'FACP', ['VALVE_POSITION', 'WATERFLOW_STATUS']),
        output('OUT-PA-HVAC', 'ahu_crah', 'EXECUTE_ENGINEERED_ZONE_SEQUENCE', 'EVENT_ZONE', 'control', 'FACP', ['UNIT_STATUS', 'AIRFLOW_PROOF']),
        output('OUT-PA-BMS', 'bms_event', 'PUBLISH_EVENT', 'EVENT_ZONE', 'monitor', 'MONITOR_ONLY', ['EVENT_INGESTED'])
      ]
    }),
    row({
      id: 'CE-SUPPRESSION-ARMED',
      eventId: 'suppression_armed',
      eventLabel: 'Clean-agent release circuit armed',
      stage: 4,
      delaySeconds: 0,
      commandState: 'COUNTDOWN_ARMED',
      requiredFeedback: ['RELEASE_CIRCUIT_CONTINUITY', 'ABORT_CIRCUIT_STATUS', 'ZONE_ISOLATION_PROOF'],
      failureState: ['RELEASE_CIRCUIT_TROUBLE', 'ABORT_CIRCUIT_TROUBLE', 'ZONE_NOT_ISOLATED'],
      outputs: [
        output('OUT-SA-AGENT', 'clean_agent', 'ARM_COUNTDOWN', 'EVENT_ZONE', 'control', 'FACP', ['COUNTDOWN_ACTIVE', 'ABORT_AVAILABLE']),
        output('OUT-SA-HVAC', 'ahu_crah', 'EXECUTE_PRE_DISCHARGE_ZONE_SEQUENCE', 'EVENT_ZONE', 'control', 'FACP', ['UNIT_STATUS', 'AIRFLOW_PROOF']),
        output('OUT-SA-SMOKE', 'smoke_control', 'ISOLATE_AGENT_ENCLOSURE', 'EVENT_ZONE', 'control', 'FACP', ['DAMPER_END_SWITCH']),
        output('OUT-SA-NOTIFY', 'notification', 'PRE_DISCHARGE_WARNING', 'EVENT_ZONE', 'control', 'FACP', ['AUDIBLE_VISUAL_FEEDBACK']),
        output('OUT-SA-BMS', 'bms_event', 'PUBLISH_EVENT', 'EVENT_ZONE', 'monitor', 'MONITOR_ONLY', ['EVENT_INGESTED'])
      ]
    }),
    row({
      id: 'CE-SUPPRESSION-ABORT',
      eventId: 'suppression_abort',
      eventLabel: 'Clean-agent abort station held',
      stage: 4,
      delaySeconds: 0,
      commandState: 'RELEASE_HELD',
      requiredFeedback: ['ABORT_INPUT_LATCHED', 'RELEASE_OUTPUT_HELD'],
      failureState: ['ABORT_CIRCUIT_TROUBLE', 'RELEASE_OUTPUT_CONFLICT'],
      outputs: [
        output('OUT-SAB-AGENT', 'clean_agent', 'HOLD_RELEASE', 'EVENT_ZONE', 'control', 'FACP', ['RELEASE_OUTPUT_HELD']),
        output('OUT-SAB-NOTIFY', 'notification', 'ABORT_ACTIVE_WARNING', 'EVENT_ZONE', 'control', 'FACP', ['AUDIBLE_VISUAL_FEEDBACK']),
        output('OUT-SAB-BMS', 'bms_event', 'PUBLISH_EVENT', 'EVENT_ZONE', 'monitor', 'MONITOR_ONLY', ['EVENT_INGESTED'])
      ]
    }),
    row({
      id: 'CE-SUPPRESSION-RELEASE',
      eventId: 'suppression_release',
      eventLabel: 'Clean-agent automatic release sequence',
      stage: 5,
      delaySeconds: 30,
      commandState: 'RELEASE_ELIGIBLE_AFTER_DELAY',
      requiredFeedback: ['RELEASE_SOLENOID_CURRENT', 'CYLINDER_PRESSURE_SWITCH', 'DISCHARGE_PRESSURE_SWITCH'],
      failureState: ['RELEASE_CIRCUIT_TROUBLE', 'NO_DISCHARGE_PROOF', 'LOW_CYLINDER_PRESSURE'],
      inhibitAllowed: false,
      outputs: [
        output('OUT-SR-AGENT', 'clean_agent', 'RELEASE_AGENT', 'EVENT_ZONE', 'control', 'FACP', ['SOLENOID_CURRENT', 'DISCHARGE_PRESSURE_PROOF']),
        output('OUT-SR-NOTIFY', 'notification', 'AGENT_DISCHARGE_ALARM', 'EVENT_ZONE', 'control', 'FACP', ['AUDIBLE_VISUAL_FEEDBACK']),
        output('OUT-SR-BMS', 'bms_event', 'PUBLISH_EVENT', 'EVENT_ZONE', 'monitor', 'MONITOR_ONLY', ['EVENT_INGESTED'])
      ]
    }),
    row({
      id: 'CE-SUPPRESSION-DISCHARGED',
      eventId: 'suppression_discharged',
      eventLabel: 'Clean-agent discharge confirmed',
      stage: 6,
      delaySeconds: 0,
      commandState: 'DISCHARGED_LOCKOUT',
      requiredFeedback: ['CYLINDER_PRESSURE_SWITCH', 'DISCHARGE_PRESSURE_SWITCH', 'ZONE_LOCKOUT'],
      failureState: ['NO_DISCHARGE_PROOF', 'LOCKOUT_FAIL'],
      inhibitAllowed: false,
      outputs: [
        output('OUT-SD-AGENT', 'clean_agent', 'LOCKOUT_AFTER_DISCHARGE', 'EVENT_ZONE', 'control', 'FACP', ['ZONE_LOCKOUT']),
        output('OUT-SD-NOTIFY', 'notification', 'POST_DISCHARGE_EVACUATION', 'EVENT_ZONE', 'control', 'FACP', ['AUDIBLE_VISUAL_FEEDBACK']),
        output('OUT-SD-BMS', 'bms_event', 'PUBLISH_EVENT', 'EVENT_ZONE', 'monitor', 'MONITOR_ONLY', ['EVENT_INGESTED'])
      ]
    }),
    row({
      id: 'CE-ZONED-EPO',
      eventId: 'epo',
      eventLabel: 'Authorized zoned emergency power-off input',
      stage: 4,
      delaySeconds: 0,
      commandState: 'ZONE_ISOLATION',
      requiredFeedback: ['EPO_DUAL_CONFIRM', 'ZONE_BREAKER_POSITION'],
      failureState: ['EPO_CIRCUIT_TROUBLE', 'ZONE_BREAKER_FAIL_TO_OPEN'],
      inhibitAllowed: false,
      outputs: [
        output('OUT-EPO-POWER', 'zoned_epo', 'ISOLATE_ZONE_POWER', 'EVENT_ZONE', 'control', 'FACP', ['ZONE_BREAKER_OPEN', 'UPS_OUTPUT_STATUS']),
        output('OUT-EPO-NOTIFY', 'notification', 'EPO_ACTIVE_WARNING', 'EVENT_ZONE', 'control', 'FACP', ['NOTIFICATION_ACK']),
        output('OUT-EPO-BMS', 'bms_event', 'PUBLISH_EVENT', 'EVENT_ZONE', 'monitor', 'MONITOR_ONLY', ['EVENT_INGESTED'])
      ]
    }),
    row({
      id: 'CE-WATER-LEAK',
      eventId: 'water_leak',
      eventLabel: 'Water leak detection input',
      stage: 0,
      delaySeconds: 0,
      commandState: 'LEAK_RESPONSE',
      requiredFeedback: ['LEAK_ZONE_LATCHED', 'ISOLATION_VALVE_POSITION'],
      failureState: ['LEAK_CIRCUIT_TROUBLE', 'VALVE_FAIL_TO_CLOSE'],
      outputs: [
        output('OUT-LEAK-VALVE', 'leak_control', 'ISOLATE_AFFECTED_BRANCH', 'EVENT_ZONE', 'control', 'FACP', ['ISOLATION_VALVE_CLOSED']),
        output('OUT-LEAK-NOTIFY', 'notification', 'LEAK_RESPONSE_NOTIFY', 'OPERATIONS_TEAM', 'control', 'FACP', ['NOTIFICATION_ACK']),
        output('OUT-LEAK-BMS', 'bms_event', 'PUBLISH_EVENT', 'EVENT_ZONE', 'monitor', 'MONITOR_ONLY', ['EVENT_INGESTED'])
      ]
    })
  ]);
  function pushError(errors, rowId, message) {
    errors.push((rowId || '(unknown row)') + ': ' + message);
  }
  function isObject(value) {
    return Boolean(value) && typeof value === 'object' &&
      Object.prototype.toString.call(value) !== '[object Array]';
  }
  function isStringArray(value) {
    var i;
    if (Object.prototype.toString.call(value) !== '[object Array]' || !value.length) {
      return false;
    }
    for (i = 0; i < value.length; i += 1) {
      if (typeof value[i] !== 'string' || !value[i]) { return false; }
    }
    return true;
  }
  function policyAllows(policy, field, value) {
    return policy && policy[field].indexOf(value) !== -1;
  }
  function validateOutput(item, eventId, rowId, errors) {
    var fields = ['id', 'system', 'action', 'scope', 'commandType', 'authority', 'requiredFeedback'];
    var policy;
    var i;
    if (!isObject(item)) {
      pushError(errors, rowId, 'output must be an object');
      return;
    }
    for (i = 0; i < fields.length; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(item, fields[i])) {
        pushError(errors, rowId, 'output missing ' + fields[i]);
      }
    }
    if (!isStringArray(item.requiredFeedback)) {
      pushError(errors, rowId, 'output ' + item.id + ' lacks proof feedback');
    }
    policy = OUTPUT_POLICIES[item.system];
    if (!policy) {
      pushError(errors, rowId, 'output system is not allowed: ' + item.system);
      return;
    }
    if (!policyAllows(policy, 'actions', item.action)) {
      pushError(errors, rowId, 'action is not allowed for ' + item.system + ': ' + item.action);
    }
    if (!policyAllows(policy, 'scopes', item.scope)) {
      pushError(errors, rowId, 'scope is not allowed for ' + item.system + ': ' + item.scope);
    }
    if (item.commandType !== policy.commandType || item.authority !== policy.authority) {
      pushError(errors, rowId, 'authority/command type is not allowed for ' + item.system);
    }
    if (item.system === 'bms_event' &&
        (item.authority !== 'MONITOR_ONLY' || item.commandType !== 'monitor')) {
      pushError(errors, rowId, 'BMS must remain monitor-only for fire sequences');
    }
    if (item.commandType === 'control' && item.system !== 'bms_event' &&
        item.authority !== 'FACP') {
      pushError(errors, rowId, 'control output ' + item.id + ' is not under FACP authority');
    }
    if ((item.system === 'ahu_crah' || item.system === 'zoned_epo') &&
        (item.scope === 'ALL' || item.scope === 'BUILDING' ||
         item.action === 'GLOBAL_SHUTDOWN' || item.action === 'SHUTDOWN_ALL')) {
      pushError(errors, rowId, 'global shutdown shortcut is prohibited for HVAC and EPO');
    }
    if (item.action === 'RELEASE_AGENT' && eventId !== 'suppression_release') {
      pushError(errors, rowId, 'agent release requires the dedicated suppression release event');
    }
  }
  function validateRequiredFields(item, errors) {
    var i;
    for (i = 0; i < REQUIRED_FIELDS.length; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(item, REQUIRED_FIELDS[i])) {
        pushError(errors, item.id, 'missing ' + REQUIRED_FIELDS[i]);
      }
    }
  }
  function validateRuntime(runtime, rowItem, errors) {
    var fields = ['currentState', 'commandState', 'feedbackState', 'inhibited', 'lastTestAt'];
    var keys;
    var i;
    if (!isObject(runtime)) {
      pushError(errors, rowItem.id, 'runtime must be an object');
      return;
    }
    keys = Object.keys(runtime);
    for (i = 0; i < keys.length; i += 1) {
      if (fields.indexOf(keys[i]) === -1) {
        pushError(errors, rowItem.id, 'runtime field is not allowed: ' + keys[i]);
      }
    }
    for (i = 0; i < fields.length; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(runtime, fields[i])) {
        pushError(errors, rowItem.id, 'runtime missing ' + fields[i]);
      }
    }
    if (!VALID_RUNTIME_STATE[runtime.currentState]) {
      pushError(errors, rowItem.id, 'runtime current state is invalid');
    }
    if (!VALID_COMMAND_STATE[runtime.commandState]) {
      pushError(errors, rowItem.id, 'runtime command state is invalid');
    }
    if (!VALID_FEEDBACK_STATE[runtime.feedbackState]) {
      pushError(errors, rowItem.id, 'runtime feedback state is invalid');
    }
    if (typeof runtime.inhibited !== 'boolean') {
      pushError(errors, rowItem.id, 'runtime inhibited flag is invalid');
    }
    if (runtime.lastTestAt !== null && typeof runtime.lastTestAt !== 'string') {
      pushError(errors, rowItem.id, 'runtime lastTestAt is invalid');
    }
    if ((runtime.inhibited === true || runtime.currentState === 'inhibited') &&
        rowItem.overrideInhibit &&
        rowItem.overrideInhibit.allowed === false) {
      pushError(errors, rowItem.id, 'non-inhibitable row is inhibited');
    }
  }
  function validateAuthorities(item, errors) {
    if (item.authority !== 'FACP') {
      pushError(errors, item.id, 'row authority must remain FACP');
    }
    if (!isObject(item.overrideInhibit) ||
        typeof item.overrideInhibit.allowed !== 'boolean' ||
        item.overrideInhibit.authority !== 'AUTHORIZED_FACP_OPERATOR' ||
        item.overrideInhibit.indication !== 'FACP_TROUBLE_WHEN_INHIBITED') {
      pushError(errors, item.id, 'override/inhibit contract must remain FACP-controlled');
    }
    if (item.resetAuthority !== AUTHORITY.resetAuthority) {
      pushError(errors, item.id, 'reset authority must remain ' + AUTHORITY.resetAuthority);
    }
  }
  function validateRow(item, errors) {
    var eventId = item.initiatingEvent && item.initiatingEvent.id;
    var i;
    validateRequiredFields(item, errors);
    if (!eventId) { pushError(errors, item.id, 'initiating event id is required'); }
    validateAuthorities(item, errors);
    if (!isObject(item.zone) || item.zone.id !== 'EVENT_ZONE' ||
        item.zone.scope !== 'selected-fire-zone') {
      pushError(errors, item.id, 'zone must remain explicitly event-scoped');
    }
    if (typeof item.stage !== 'number' || !isFinite(item.stage) ||
        item.stage < 0 || Math.floor(item.stage) !== item.stage) {
      pushError(errors, item.id, 'stage must be a non-negative integer');
    }
    if (typeof item.delaySeconds !== 'number' || !isFinite(item.delaySeconds) ||
        item.delaySeconds < 0) {
      pushError(errors, item.id, 'delaySeconds must be non-negative');
    }
    if (!item.outputs || !item.outputs.length) {
      pushError(errors, item.id, 'at least one output is required');
    } else {
      for (i = 0; i < item.outputs.length; i += 1) {
        validateOutput(item.outputs[i], eventId, item.id, errors);
      }
    }
    if (!isStringArray(item.requiredFeedback)) {
      pushError(errors, item.id, 'requiredFeedback cannot be empty');
    }
    if (!isStringArray(item.failureState)) {
      pushError(errors, item.id, 'failureState cannot be empty');
    }
    if (!isStringArray(item.basis)) { pushError(errors, item.id, 'basis is required'); }
    validateRuntime(item.runtime, item, errors);
  }
  function validateRows(rows) {
    var errors = [];
    var ids = {};
    var i;
    var item;
    if (Object.prototype.toString.call(rows) !== '[object Array]') {
      return { valid: false, errors: ['rows must be an array'] };
    }
    for (i = 0; i < rows.length; i += 1) {
      item = rows[i] || {};
      validateRow(item, errors);
      if (!item.id) { continue; }
      if (ids[item.id]) { pushError(errors, item.id, 'duplicate row id'); }
      ids[item.id] = true;
    }
    return { valid: errors.length === 0, errors: errors };
  }
  function resolveScope(scope, zoneId) {
    return scope === 'EVENT_ZONE' ? zoneId : scope;
  }
  function commandFrom(rowItem, outputItem, zoneId) {
    var result = clone(outputItem);
    result.rowId = rowItem.id;
    result.eventId = rowItem.initiatingEvent.id;
    result.zoneId = zoneId;
    result.resolvedScope = resolveScope(outputItem.scope, zoneId);
    result.delaySeconds = rowItem.delaySeconds;
    result.failureState = rowItem.failureState.slice();
    result.resetAuthority = rowItem.resetAuthority;
    return result;
  }
  function blockedItem(rowItem, zoneId, reason) {
    return {
      rowId: rowItem.id,
      eventId: rowItem.initiatingEvent.id,
      zoneId: zoneId,
      reason: reason
    };
  }
  function validateReleaseInterlocks(interlocks) {
    var allowed = {};
    var keys;
    var i;
    if (interlocks === undefined) { return; }
    if (!isObject(interlocks)) { throw new Error('release interlocks must be an object'); }
    for (i = 0; i < RELEASE_INTERLOCKS.length; i += 1) {
      allowed[RELEASE_INTERLOCKS[i].field] = true;
    }
    keys = Object.keys(interlocks);
    for (i = 0; i < keys.length; i += 1) {
      if (!allowed[keys[i]]) { throw new Error('Unknown release interlock: ' + keys[i]); }
      if (typeof interlocks[keys[i]] !== 'boolean') {
        throw new Error('Release interlock ' + keys[i] + ' must be boolean');
      }
    }
  }
  function releaseBlockReasons(interlocks) {
    var values = interlocks || {};
    var reasons = [];
    var i;
    validateReleaseInterlocks(interlocks);
    for (i = 0; i < RELEASE_INTERLOCKS.length; i += 1) {
      if (values[RELEASE_INTERLOCKS[i].field] !== RELEASE_INTERLOCKS[i].required) {
        reasons.push(RELEASE_INTERLOCKS[i].reason);
      }
    }
    return reasons;
  }
  function runtimeBlockReasons(rowItem) {
    var reasons = [];
    if (rowItem.runtime.inhibited || rowItem.runtime.currentState === 'inhibited') {
      reasons.push('ROW_INHIBITED');
    }
    if (rowItem.runtime.currentState === 'trouble') { reasons.push('ROW_TROUBLE'); }
    if (rowItem.runtime.feedbackState === 'failed') { reasons.push('FEEDBACK_FAILED'); }
    return reasons;
  }
  function rowBlockReasons(rowItem, event) {
    var reasons = runtimeBlockReasons(rowItem);
    if (rowItem.initiatingEvent.id === 'suppression_release') {
      reasons = reasons.concat(releaseBlockReasons(event.interlocks));
    }
    return reasons;
  }
  function validateRuntimeRows(rows) {
    var validation = validateRows(rows);
    if (!validation.valid) {
      throw new Error('Invalid cause-and-effect rows: ' + validation.errors.join('; '));
    }
    return rows;
  }
  function evaluateEvent(event) {
    var rows;
    var matches;
    var elapsed;
    var commands = [];
    var pending = [];
    var blocked = [];
    var stage = 0;
    if (!event || typeof event.eventId !== 'string' || !event.eventId) {
      throw new Error('eventId is required');
    }
    if (typeof event.zoneId !== 'string' || !event.zoneId) {
      throw new Error('zoneId is required');
    }
    elapsed = Number(event.elapsedSeconds);
    if (!isFinite(elapsed) || elapsed < 0) { throw new Error('elapsedSeconds must be non-negative'); }
    rows = event.runtimeRows === undefined ? BASE_ROWS : validateRuntimeRows(event.runtimeRows);
    matches = rows.filter(function (item) {
      return item.initiatingEvent.id === event.eventId;
    });
    if (!matches.length) { throw new Error('Unknown fire initiating event: ' + event.eventId); }
    matches.forEach(function (item) {
      var reasons;
      stage = Math.max(stage, item.stage);
      if (elapsed < item.delaySeconds) {
        item.outputs.forEach(function (outputItem) {
          pending.push(commandFrom(item, outputItem, event.zoneId));
        });
        return;
      }
      reasons = rowBlockReasons(item, event);
      if (reasons.length) {
        reasons.forEach(function (reason) {
          blocked.push(blockedItem(item, event.zoneId, reason));
        });
        return;
      }
      item.outputs.forEach(function (outputItem) {
        commands.push(commandFrom(item, outputItem, event.zoneId));
      });
    });
    return deepFreeze({
      eventId: event.eventId,
      zoneId: event.zoneId,
      elapsedSeconds: elapsed,
      stage: stage,
      authority: AUTHORITY.controllingSystem,
      commands: commands,
      pending: pending,
      blocked: blocked
    });
  }
  function validateRuntimeUpdate(rowId, update, inhibitAllowed) {
    var allowed = {
      currentState: true,
      commandState: true,
      feedbackState: true,
      inhibited: true,
      lastTestAt: true
    };
    if (!isObject(update)) { throw new Error('Runtime update for ' + rowId + ' must be an object'); }
    Object.keys(update).forEach(function (key) {
      if (!allowed[key]) { throw new Error('Unknown runtime field for ' + rowId + ': ' + key); }
    });
    if (update.currentState !== undefined && !VALID_RUNTIME_STATE[update.currentState]) {
      throw new Error('Invalid runtime currentState for ' + rowId);
    }
    if (update.commandState !== undefined && !VALID_COMMAND_STATE[update.commandState]) {
      throw new Error('Invalid runtime commandState for ' + rowId);
    }
    if (update.feedbackState !== undefined && !VALID_FEEDBACK_STATE[update.feedbackState]) {
      throw new Error('Invalid runtime feedbackState for ' + rowId);
    }
    if (update.inhibited !== undefined && typeof update.inhibited !== 'boolean') {
      throw new Error('Invalid runtime inhibited flag for ' + rowId);
    }
    if ((update.inhibited === true || update.currentState === 'inhibited') &&
        inhibitAllowed === false) {
      throw new Error('Cause-and-effect row ' + rowId + ' cannot be inhibited');
    }
    if (update.lastTestAt !== undefined && update.lastTestAt !== null &&
        typeof update.lastTestAt !== 'string') {
      throw new Error('Invalid runtime lastTestAt for ' + rowId);
    }
  }
  function applyRuntime(rows, updates) {
    var validation = validateRows(rows);
    var known = {};
    var result;
    if (!validation.valid) {
      throw new Error('Invalid cause-and-effect rows: ' + validation.errors.join('; '));
    }
    rows.forEach(function (item) { known[item.id] = item; });
    Object.keys(updates || {}).forEach(function (id) {
      if (!known[id]) { throw new Error('Unknown cause-and-effect row: ' + id); }
      validateRuntimeUpdate(id, updates[id], known[id].overrideInhibit.allowed);
    });
    result = rows.map(function (item) {
      var copy = clone(item);
      var update = (updates || {})[item.id];
      if (update) {
        Object.keys(update).forEach(function (key) { copy.runtime[key] = clone(update[key]); });
      }
      return copy;
    });
    return deepFreeze(result);
  }
  var API = deepFreeze({
    AUTHORITY: deepFreeze(AUTHORITY),
    BASE_ROWS: BASE_ROWS,
    validateRows: validateRows,
    evaluateEvent: evaluateEvent,
    applyRuntime: applyRuntime,
    version: '1.0.0'
  });
  if (root) { root.RZDatahallAIFireCauseEffect = API; }
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
}(typeof window !== 'undefined' ? window :
  (typeof globalThis !== 'undefined' ? globalThis : this)));
