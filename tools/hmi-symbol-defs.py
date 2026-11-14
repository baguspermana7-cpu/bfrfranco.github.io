#!/usr/bin/env python3
"""HMI symbol definitions -> assets/engineering/<kind>.svg + manifest.json entries (R128, PRD §4).

  python3 tools/hmi-symbol-defs.py --apply    # write SVGs + merge manifest entries (existing kinds untouched)
  python3 tools/hmi-symbol-defs.py --check    # exit 1 if any SVG / manifest entry differs from these definitions

Geometry is authored on the 0..48 box of the existing library, strokes currentColor. Shapes carrying class="b" are the
symbol BODY: the renderer fills it when the item runs (ISA-101: filled = running, outline = stopped). Ports sit on the
6-unit grid so connectors meet them exactly. New kinds carry "dcmoc": false so DCMOC's TypeScript union is unchanged.
Shapes are drawn from the standards' published conventions (ISO 10628-2 / ISO 14617, IEC 60617, ANSI/ISA-5.1, NFPA 170);
no vendor clip-art.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'engineering')
BOW = 'M6 14 L24 24 L6 34 Z M42 14 L24 24 L42 34 Z'          # ISO 10628 two-way valve body
LINE_H = 'M0 24 H6 M42 24 H48'
LINE_V = 'M24 0 V12 M24 36 V48'

P = lambda **k: k  # ports helper: name=[x, y, medium]

DEFS = {
    # ── process / mechanical (ISO 10628-2, ISO 14617) ─────────────────────────────────────────────
    'pumpCentrifugal': dict(label='Centrifugal pump', category='process', standard='ISO 10628-2 / ISO 14617-9', tag='P',
        body=f'<path d="M0 24 H10 M38 24 H48"/><circle class="b" cx="24" cy="24" r="14"/><path d="M17 15 L34 24 L17 33"/>',
        ports=P(suction=[0, 24, 'liquid'], discharge=[48, 24, 'liquid']), states=['running', 'stopped', 'standby', 'fault', 'manual']),
    'pumpVfd': dict(label='Pump with variable-speed drive', category='process', standard='ISO 10628-2 + ISA-5.1 SC', tag='P',
        body=f'<path d="M0 30 H10 M38 30 H48"/><circle class="b" cx="24" cy="30" r="12"/><path d="M18 22 L33 30 L18 38"/><rect x="16" y="0" width="16" height="10" rx="1"/><path d="M24 10 V18" stroke-dasharray="2 2"/><path d="M19 7 L22 3 L26 7 L29 3"/>',
        ports=P(suction=[0, 30, 'liquid'], discharge=[48, 30, 'liquid'], signal=[24, 0, 'signal']), states=['running', 'stopped', 'standby', 'fault', 'manual']),
    'valveGate': dict(label='Gate valve (isolation)', category='valve', standard='ISO 10628-2', tag='V',
        body=f'<path d="{LINE_H}"/><path class="b" d="{BOW}"/>',
        ports=P(a=[0, 24, 'any'], b=[48, 24, 'any']), states=['open', 'closed', 'locked']),
    'valveGlobe': dict(label='Globe valve (throttling)', category='valve', standard='ISO 10628-2', tag='V',
        body=f'<path d="{LINE_H}"/><path class="b" d="{BOW}"/><circle cx="24" cy="24" r="3" fill="currentColor"/>',
        ports=P(a=[0, 24, 'any'], b=[48, 24, 'any']), states=['open', 'closed']),
    'valveBall': dict(label='Ball valve', category='valve', standard='ISO 10628-2', tag='V',
        body=f'<path d="{LINE_H}"/><path class="b" d="{BOW}"/><circle cx="24" cy="24" r="6"/>',
        ports=P(a=[0, 24, 'any'], b=[48, 24, 'any']), states=['open', 'closed', 'locked']),
    'valveButterfly': dict(label='Butterfly valve', category='valve', standard='ISO 10628-2', tag='V',
        body='<path d="M0 24 H14 M34 24 H48 M14 12 V36 M34 12 V36"/><path d="M16 34 L32 14"/><circle cx="24" cy="24" r="2.5" fill="currentColor"/>',
        ports=P(a=[0, 24, 'any'], b=[48, 24, 'any']), states=['open', 'closed']),
    'valveCheck': dict(label='Check (non-return) valve', category='valve', standard='ISO 10628-2', tag='V',
        body='<path d="M0 24 H12 M36 24 H48"/><path class="b" d="M12 12 L34 24 L12 36 Z"/><path d="M36 12 V36"/>',
        ports=P(inlet=[0, 24, 'any'], outlet=[48, 24, 'any']), states=['open', 'closed']),
    'valve3Way': dict(label='Three-way valve', category='valve', standard='ISO 10628-2', tag='V',
        body=f'<path d="{LINE_H} M24 42 V48"/><path class="b" d="{BOW} M14 42 L24 24 L34 42 Z"/>',
        ports=P(a=[0, 24, 'any'], b=[48, 24, 'any'], c=[24, 48, 'any']), states=['open', 'closed', 'modulating']),
    'valveControlPneu': dict(label='Control valve, diaphragm actuator', category='valve', standard='ISO 10628-2 + ISA-5.1', tag='TV',
        body=f'<path d="{LINE_H}"/><path class="b" d="{BOW}"/><path d="M24 24 V12 M12 12 A12 8 0 0 1 36 12 Z"/>',
        ports=P(a=[0, 24, 'any'], b=[48, 24, 'any'], signal=[24, 0, 'signal']), states=['open', 'closed', 'modulating', 'fault', 'manual']),
    'valveControlMotor': dict(label='Control valve, electric actuator', category='valve', standard='ISO 10628-2 + ISA-5.1', tag='TV',
        body=f'<path d="{LINE_H}"/><path class="b" d="{BOW}"/><path d="M24 24 V14"/><rect x="14" y="2" width="20" height="12" rx="1"/><path d="M19 11 V5 L24 9 L29 5 V11"/>',
        ports=P(a=[0, 24, 'any'], b=[48, 24, 'any'], signal=[24, 0, 'signal']), states=['open', 'closed', 'modulating', 'fault', 'manual']),
    'valve3WayMotor': dict(label='Three-way control valve, electric actuator', category='valve', standard='ISO 10628-2 + ISA-5.1', tag='TV',
        body=f'<path d="{LINE_H} M24 42 V48 M24 24 V14"/><path class="b" d="{BOW} M14 42 L24 24 L34 42 Z"/><rect x="14" y="2" width="20" height="12" rx="1"/><path d="M19 11 V5 L24 9 L29 5 V11"/>',
        ports=P(a=[0, 24, 'any'], b=[48, 24, 'any'], c=[24, 48, 'any'], signal=[24, 0, 'signal']), states=['modulating', 'fault', 'manual']),
    'valveRelief': dict(label='Pressure-relief valve', category='valve', standard='ISO 10628-2', tag='PSV',
        body='<path d="M24 48 V36 M36 24 H48"/><path class="b" d="M14 42 L24 24 L34 42 Z M36 14 L24 24 L36 34 Z"/><path d="M24 24 V6 M18 8 L30 11 L18 14 L30 17 L18 20"/>',
        ports=P(inlet=[24, 48, 'any'], outlet=[48, 24, 'any']), states=['closed', 'open']),
    'valveBalancing': dict(label='Balancing valve (with test points)', category='valve', standard='ISO 10628-2', tag='BV',
        body=f'<path d="{LINE_H}"/><path class="b" d="{BOW}"/><path d="M12 38 L36 10 M31 10 H36 V15"/><circle cx="10" cy="10" r="2"/><circle cx="38" cy="38" r="2"/>',
        ports=P(a=[0, 24, 'any'], b=[48, 24, 'any']), states=['open']),
    'valveSolenoid': dict(label='Solenoid valve', category='valve', standard='ISO 10628-2 + ISA-5.1', tag='XV',
        body=f'<path d="{LINE_H} M24 24 V14"/><path class="b" d="{BOW}"/><rect x="16" y="2" width="16" height="12" rx="1"/><path d="M19 8 H29"/>',
        ports=P(a=[0, 24, 'any'], b=[48, 24, 'any'], signal=[24, 0, 'signal']), states=['open', 'closed', 'fault']),
    'strainerY': dict(label='Y-strainer', category='process', standard='ISO 10628-2', tag='STR',
        body='<path d="M0 24 H48"/><path class="b" d="M14 24 L26 44 H36 L24 24 Z"/><path d="M19 28 L28 40 M23 26 L32 40" stroke-dasharray="2 2"/>',
        ports=P(inlet=[0, 24, 'liquid'], outlet=[48, 24, 'liquid']), states=['clean', 'blocked']),
    'filterCartridge': dict(label='Filter', category='process', standard='ISO 10628-2', tag='F',
        body='<path d="M0 24 H10 M38 24 H48"/><rect class="b" x="10" y="10" width="28" height="28" rx="1"/><path d="M10 38 L38 10" stroke-dasharray="3 2"/>',
        ports=P(inlet=[0, 24, 'any'], outlet=[48, 24, 'any']), states=['clean', 'loaded', 'blocked']),
    'hxPlate': dict(label='Plate heat exchanger', category='process', standard='ISO 10628-2', tag='HX',
        body='<path d="M0 12 H10 M0 36 H10 M38 12 H48 M38 36 H48"/><rect class="b" x="10" y="4" width="28" height="40" rx="1"/><path d="M14 10 L20 16 L14 22 L20 28 L14 34 L20 40 M34 10 L28 16 L34 22 L28 28 L34 34 L28 40"/>',
        ports=P(hotIn=[0, 12, 'liquid'], hotOut=[0, 36, 'liquid'], coldIn=[48, 36, 'liquid'], coldOut=[48, 12, 'liquid']), states=['running', 'stopped', 'fault']),
    'hxShellTube': dict(label='Shell-and-tube heat exchanger', category='process', standard='ISO 10628-2', tag='HX',
        body='<path d="M0 24 H6 M42 24 H48 M18 6 V12 M30 36 V42"/><rect class="b" x="6" y="12" width="36" height="24" rx="12"/><path d="M10 24 L16 18 L22 30 L28 18 L34 30 L38 24"/>',
        ports=P(tubeIn=[0, 24, 'liquid'], tubeOut=[48, 24, 'liquid'], shellIn=[18, 6, 'liquid'], shellOut=[30, 42, 'liquid']), states=['running', 'stopped']),
    'coolingCoil': dict(label='Air cooling coil', category='process', standard='ISO 10628-2', tag='CC',
        body='<path d="M12 48 V42 M36 48 V42"/><rect class="b" x="6" y="6" width="36" height="36" rx="1"/><path d="M6 42 L42 6"/><path d="M12 14 H36 M12 22 H36 M12 30 H36" stroke-dasharray="2 2"/>',
        ports=P(waterIn=[12, 48, 'liquid'], waterOut=[36, 48, 'liquid'], airIn=[0, 24, 'air'], airOut=[48, 24, 'air']), states=['running', 'stopped']),
    'fanAxial': dict(label='Fan', category='process', standard='ISO 14617-8', tag='FN',
        body='<circle class="b" cx="24" cy="24" r="16"/><path d="M24 24 C30 14 36 16 34 22 Z M24 24 C18 34 12 32 14 26 Z"/><circle cx="24" cy="24" r="2" fill="currentColor"/>',
        ports=P(inlet=[0, 24, 'air'], outlet=[48, 24, 'air']), states=['running', 'stopped', 'fault']),
    'dryCoolerV': dict(label='Dry cooler, V-bank', category='process', standard='ISO 10628-2', tag='DC',
        body='<path d="M0 42 H6 M42 42 H48"/><path class="b" d="M6 42 L18 18 H30 L42 42 Z"/><path d="M10 34 L16 22 M38 34 L32 22" stroke-dasharray="2 2"/><circle cx="18" cy="9" r="6"/><circle cx="30" cy="9" r="6"/><path d="M15 9 H21 M27 9 H33"/>',
        ports=P(inlet=[0, 42, 'liquid'], outlet=[48, 42, 'liquid']), states=['running', 'stopped', 'fault']),
    'chillerWater': dict(label='Water-cooled chiller', category='process', standard='ISO 10628-2', tag='CH',
        body='<path d="M0 12 H6 M0 36 H6 M42 12 H48 M42 36 H48"/><rect class="b" x="6" y="4" width="36" height="40" rx="1"/><path d="M6 24 H42"/><path d="M12 12 L16 8 L20 16 L24 8 L28 16 L32 8 L36 12" /><path d="M12 36 L16 32 L20 40 L24 32 L28 40 L32 32 L36 36"/><circle cx="24" cy="24" r="4" fill="currentColor"/>',
        ports=P(cwIn=[48, 12, 'liquid'], cwOut=[0, 12, 'liquid'], chwIn=[48, 36, 'liquid'], chwOut=[0, 36, 'liquid']), states=['running', 'stopped', 'standby', 'fault']),
    'tankExpansion': dict(label='Expansion vessel (diaphragm)', category='process', standard='ISO 10628-2', tag='ET',
        body='<path d="M24 42 V48"/><rect class="b" x="12" y="4" width="24" height="38" rx="12"/><path d="M12 24 C18 20 30 28 36 24"/>',
        ports=P(port=[24, 48, 'liquid']), states=['normal']),
    'tankBuffer': dict(label='Buffer / day tank', category='process', standard='ISO 10628-2', tag='TK',
        body='<path d="M0 36 H8 M40 12 H48"/><rect class="b" x="8" y="2" width="32" height="44" rx="2"/><path d="M8 18 H40" stroke-dasharray="3 2"/>',
        ports=P(inlet=[48, 12, 'any'], outlet=[0, 36, 'any']), states=['normal', 'low', 'high']),
    'dosingPot': dict(label='Chemical dosing pot', category='process', standard='ISO 10628-2', tag='DP',
        body='<path d="M12 48 V40 M36 48 V40"/><path class="b" d="M10 14 H38 V36 A6 6 0 0 1 32 42 H16 A6 6 0 0 1 10 36 Z"/><path d="M18 14 L20 4 H28 L30 14"/>',
        ports=P(inlet=[12, 48, 'liquid'], outlet=[36, 48, 'liquid']), states=['normal']),
    'airVent': dict(label='Automatic air vent', category='process', standard='ISO 10628-2', tag='AV',
        body='<path d="M24 48 V36"/><rect class="b" x="16" y="18" width="16" height="18" rx="2"/><path d="M24 18 V4 M19 9 L24 4 L29 9"/>',
        ports=P(port=[24, 48, 'any']), states=['normal']),
    'drain': dict(label='Drain', category='process', standard='ISO 10628-2', tag='DR',
        body='<path d="M24 0 V18"/><path class="b" d="M12 18 H36 L28 32 H20 Z"/><path d="M20 38 H28 M22 43 H26"/>',
        ports=P(port=[24, 0, 'any']), states=['normal']),
    'reducer': dict(label='Reducer', category='process', standard='ISO 10628-2', tag='',
        body='<path d="M0 24 H12 M36 24 H48"/><path class="b" d="M12 10 L36 18 V30 L12 38 Z"/>',
        ports=P(large=[0, 24, 'any'], small=[48, 24, 'any']), states=[]),
    'flexConnector': dict(label='Flexible connector', category='process', standard='ISO 10628-2', tag='',
        body='<path d="M0 24 H10 M38 24 H48 M10 14 V34 M38 14 V34 M10 18 C16 12 16 36 24 30 C32 12 32 36 38 30"/>',
        ports=P(a=[0, 24, 'any'], b=[48, 24, 'any']), states=[]),
    'quickDisconnect': dict(label='Quick-disconnect coupling (dripless)', category='process', standard='ISO 10628-2', tag='QD',
        body='<path d="M0 24 H12 M36 24 H48"/><path class="b" d="M12 14 H22 V34 H12 Z M26 14 H36 V34 H26 Z"/><path d="M22 24 H26"/>',
        ports=P(a=[0, 24, 'liquid'], b=[48, 24, 'liquid']), states=['connected', 'disconnected']),
    'coldPlate': dict(label='Cold plate', category='process', standard='ISO 10628-2 (heat transfer surface)', tag='CP',
        body='<path d="M0 12 H6 M0 36 H6"/><rect class="b" x="6" y="4" width="36" height="40" rx="1"/><path d="M6 12 H36 V20 H12 V28 H36 V36 H6"/>',
        ports=P(inlet=[0, 12, 'liquid'], outlet=[0, 36, 'liquid']), states=['running', 'stopped']),
    'flowMeter': dict(label='Flow meter (magnetic)', category='instrument', standard='ISO 10628-2 + ISA-5.1 FE', tag='FE',
        body='<path d="M0 24 H12 M36 24 H48"/><rect class="b" x="12" y="12" width="24" height="24" rx="1"/><circle cx="24" cy="24" r="7"/>',
        ports=P(a=[0, 24, 'liquid'], b=[48, 24, 'liquid']), states=['normal', 'fault']),
    'btuMeter': dict(label='Energy (BTU) meter', category='instrument', standard='ISA-5.1 EQ', tag='EQ',
        body='<path d="M0 24 H12 M36 24 H48"/><rect class="b" x="12" y="12" width="24" height="24" rx="1"/><path d="M16 30 L22 18 L26 26 L32 16"/>',
        ports=P(a=[0, 24, 'liquid'], b=[48, 24, 'liquid']), states=['normal', 'fault']),
    'offSheet': dict(label='Off-sheet connector', category='annotation', standard='ISO 10628-1 continuation', tag='',
        body='<path class="b" d="M6 12 H34 L44 24 L34 36 H6 Z"/>',
        ports=P(port=[0, 24, 'any']), states=[]),
    # ── instruments (ANSI/ISA-5.1) ───────────────────────────────────────────────────────────────
    'instField': dict(label='Instrument, field mounted', category='instrument', standard='ANSI/ISA-5.1', tag='',
        body='<circle class="b" cx="24" cy="20" r="14"/><path d="M24 34 V48"/>',
        ports=P(process=[24, 48, 'any']), states=['normal', 'alarm', 'fault', 'stale']),
    'instPanel': dict(label='Instrument, control-room (DCS/BMS) function', category='instrument', standard='ANSI/ISA-5.1', tag='',
        body='<circle class="b" cx="24" cy="20" r="14"/><path d="M10 20 H38 M24 34 V48"/>',
        ports=P(process=[24, 48, 'any']), states=['normal', 'alarm', 'fault', 'stale']),
    'instPlc': dict(label='Controller function, PLC', category='instrument', standard='ANSI/ISA-5.1', tag='',
        body='<rect x="8" y="4" width="32" height="32" rx="0"/><path class="b" d="M24 6 L38 20 L24 34 L10 20 Z"/><path d="M24 36 V48"/>',
        ports=P(process=[24, 48, 'signal']), states=['normal', 'fault']),
    # ── electrical (IEC 60617; IEEE C37.2 numbers as text) ─────────────────────────────────────────
    'cbIec': dict(label='Circuit breaker', category='electrical', standard='IEC 60617-7', tag='CB',
        body='<path d="M24 0 V14 M24 34 V48"/><path class="b" d="M24 34 L13 17"/><path d="M20 10 L28 18 M28 10 L20 18"/>',
        ports=P(line=[24, 0, 'power'], load=[24, 48, 'power']), states=['closed', 'open', 'tripped', 'locked']),
    'cbDrawout': dict(label='Circuit breaker, withdrawable', category='electrical', standard='IEC 60617-7', tag='CB',
        body='<path d="M24 0 V4 M24 8 V14 M24 34 V40 M24 44 V48"/><path d="M19 1 L24 6 L29 1 M19 47 L24 42 L29 47"/><path class="b" d="M24 34 L13 17"/><path d="M20 10 L28 18 M28 10 L20 18"/>',
        ports=P(line=[24, 0, 'power'], load=[24, 48, 'power']), states=['closed', 'open', 'tripped', 'racked-out', 'test', 'locked']),
    'disconnector': dict(label='Disconnector', category='electrical', standard='IEC 60617-7', tag='DS',
        body='<path d="M24 0 V14 M24 34 V48 M18 14 H30"/><path class="b" d="M24 34 L13 17"/>',
        ports=P(line=[24, 0, 'power'], load=[24, 48, 'power']), states=['closed', 'open', 'locked']),
    'switchDisconnector': dict(label='Switch-disconnector', category='electrical', standard='IEC 60617-7', tag='SD',
        body='<path d="M24 0 V14 M24 34 V48 M18 14 H30"/><circle cx="24" cy="14" r="2.5"/><path class="b" d="M24 34 L13 17"/>',
        ports=P(line=[24, 0, 'power'], load=[24, 48, 'power']), states=['closed', 'open', 'locked']),
    'earthSwitch': dict(label='Earthing switch', category='electrical', standard='IEC 60617-7', tag='ES',
        body='<path d="M24 0 V14 M24 34 V38 M14 38 H34 M17 42 H31 M20 46 H28"/><path class="b" d="M24 34 L13 17"/>',
        ports=P(line=[24, 0, 'power']), states=['open', 'closed']),
    'fuse': dict(label='Fuse', category='electrical', standard='IEC 60617-7', tag='F',
        body='<path d="M24 0 V48"/><rect class="b" x="17" y="12" width="14" height="24" rx="1"/>',
        ports=P(line=[24, 0, 'power'], load=[24, 48, 'power']), states=['healthy', 'blown']),
    'contactor': dict(label='Contactor', category='electrical', standard='IEC 60617-7', tag='K',
        body='<path d="M24 0 V14 M24 34 V48"/><path d="M20 14 A4 4 0 0 0 28 14"/><path class="b" d="M24 34 L13 17"/>',
        ports=P(line=[24, 0, 'power'], load=[24, 48, 'power']), states=['closed', 'open']),
    'transformer2w': dict(label='Two-winding transformer', category='electrical', standard='IEC 60617-6', tag='TX',
        body='<path d="M24 0 V6 M24 42 V48"/><circle class="b" cx="24" cy="17" r="11"/><circle cx="24" cy="31" r="11"/><path d="M20 15 L24 11 L28 15 Z M20 30 L24 34 L28 30 M24 34 V28" stroke-width="1.2"/>',
        ports=P(hv=[24, 0, 'power'], lv=[24, 48, 'power']), states=['energized', 'de-energized', 'fault']),
    'transformer3w': dict(label='Three-winding transformer', category='electrical', standard='IEC 60617-6', tag='TX',
        body='<circle class="b" cx="24" cy="16" r="10"/><circle cx="17" cy="29" r="10"/><circle cx="31" cy="29" r="10"/><path d="M24 0 V6 M12 38 L6 48 M36 38 L42 48"/>',
        ports=P(hv=[24, 0, 'power'], lv1=[6, 48, 'power'], lv2=[42, 48, 'power']), states=['energized', 'de-energized', 'fault']),
    'generatorIec': dict(label='Generator', category='electrical', standard='IEC 60617-6', tag='G',
        body='<circle class="b" cx="24" cy="22" r="14"/><path d="M24 36 V48"/><path d="M17 22 C19 17 22 17 24 22 C26 27 29 27 31 22"/>',
        ports=P(out=[24, 48, 'power']), states=['running', 'stopped', 'standby', 'fault']),
    'utilitySource': dict(label='Utility supply', category='electrical', standard='IEC 60617-2', tag='GRID',
        body='<path d="M24 30 V48"/><path class="b" d="M10 30 L24 4 L38 30 Z"/><path d="M17 22 H31"/>',
        ports=P(out=[24, 48, 'power']), states=['energized', 'de-energized']),
    'atsIec': dict(label='Automatic transfer switch', category='electrical', standard='IEC 60617-7', tag='ATS',
        body='<path d="M12 0 V12 M36 0 V12 M24 36 V48 M8 12 H16 M32 12 H40"/><path class="b" d="M24 36 L12 14"/><circle cx="24" cy="36" r="2" fill="currentColor"/><path d="M16 24 H32" stroke-dasharray="2 2"/>',
        ports=P(sourceA=[12, 0, 'power'], sourceB=[36, 0, 'power'], load=[24, 48, 'power']), states=['on-a', 'on-b', 'open', 'fault']),
    'rectifier': dict(label='Rectifier (AC/DC)', category='electrical', standard='IEC 60617-6', tag='REC',
        body='<path d="M24 0 V8 M24 40 V48"/><rect class="b" x="8" y="8" width="32" height="32" rx="1"/><path d="M8 40 L40 8"/><path d="M12 18 C14 14 16 14 18 18 C20 22 22 22 24 18"/><path d="M26 32 H36 M26 35 H36" stroke-dasharray="2 1.5"/>',
        ports=P(ac=[24, 0, 'power'], dc=[24, 48, 'dc']), states=['running', 'stopped', 'fault']),
    'inverterIec': dict(label='Inverter (DC/AC)', category='electrical', standard='IEC 60617-6', tag='INV',
        body='<path d="M24 0 V8 M24 40 V48"/><rect class="b" x="8" y="8" width="32" height="32" rx="1"/><path d="M8 40 L40 8"/><path d="M12 14 H22 M12 17 H22" stroke-dasharray="2 1.5"/><path d="M26 32 C28 28 30 28 32 32 C34 36 36 36 38 32"/>',
        ports=P(dc=[24, 0, 'dc'], ac=[24, 48, 'power']), states=['running', 'stopped', 'fault']),
    'staticSwitch': dict(label='Static transfer switch (thyristor pair)', category='electrical', standard='IEC 60617-5', tag='SS',
        body='<path d="M24 0 V12 M24 36 V48 M12 12 H36 M12 36 H36 M12 12 V36 M36 12 V36"/><path class="b" d="M12 18 L18 30 H6 Z M36 30 L42 18 H30 Z"/><path d="M6 18 H18 M30 30 H42"/>',
        ports=P(line=[24, 0, 'power'], load=[24, 48, 'power']), states=['on', 'off', 'fault']),
    'batteryIec': dict(label='Battery string', category='electrical', standard='IEC 60617-6', tag='BAT',
        body='<path d="M24 0 V16 M24 32 V48 M10 16 H38 M16 22 H32 M10 28 H38 M16 34 H32" /><path class="b" d="M10 16 H38 V18 H10 Z"/>',
        ports=P(pos=[24, 0, 'dc'], neg=[24, 48, 'dc']), states=['charging', 'discharging', 'float', 'fault']),
    'currentTransformer': dict(label='Current transformer', category='electrical', standard='IEC 60617-6', tag='CT',
        body='<path d="M24 0 V48"/><circle class="b" cx="24" cy="24" r="8"/><path d="M32 24 H44"/>',
        ports=P(line=[24, 0, 'power'], load=[24, 48, 'power'], secondary=[48, 24, 'signal']), states=[]),
    'voltageTransformer': dict(label='Voltage transformer', category='electrical', standard='IEC 60617-6', tag='VT',
        body='<path d="M24 0 V10"/><circle class="b" cx="24" cy="18" r="8"/><circle cx="24" cy="30" r="8"/><path d="M24 38 V42 M18 42 H30 M20 46 H28"/>',
        ports=P(line=[24, 0, 'power']), states=[]),
    'powerMeter': dict(label='Power / energy meter', category='electrical', standard='IEC 60617-8', tag='PM',
        body='<path d="M0 24 H10"/><circle class="b" cx="24" cy="24" r="14"/><path d="M16 28 L22 18 L26 26 L32 18"/>',
        ports=P(input=[0, 24, 'signal']), states=['normal', 'fault', 'stale']),
    'protectionRelay': dict(label='Protection relay (IEEE C37.2 device numbers)', category='electrical', standard='IEC 60617-7 / IEEE C37.2', tag='R',
        body='<path d="M0 24 H8"/><rect class="b" x="8" y="10" width="32" height="28" rx="1"/>',
        ports=P(input=[0, 24, 'signal']), states=['normal', 'picked-up', 'tripped']),
    'surgeArrester': dict(label='Surge arrester', category='electrical', standard='IEC 60617-7', tag='SA',
        body='<path d="M24 0 V10 M24 38 V42 M16 42 H32 M19 46 H29"/><rect class="b" x="16" y="10" width="16" height="28" rx="1"/><path d="M24 16 V30 M20 26 L24 30 L28 26"/>',
        ports=P(line=[24, 0, 'power']), states=[]),
    'earth': dict(label='Earth / protective earth', category='electrical', standard='IEC 60617-2', tag='PE',
        body='<path d="M24 0 V24 M10 24 H38 M15 31 H33 M20 38 H28"/>',
        ports=P(port=[24, 0, 'power']), states=[]),
    'busTap': dict(label='Busway tap-off unit', category='electrical', standard='IEC 60617-7', tag='TAP',
        body='<path d="M24 0 V10 M24 38 V48"/><rect class="b" x="12" y="10" width="24" height="28" rx="1"/><path d="M24 14 V20 M24 32 V34"/><path d="M24 32 L19 22"/>',
        ports=P(bus=[24, 0, 'power'], load=[24, 48, 'power']), states=['closed', 'open', 'tripped']),
    'psuAcDc': dict(label='Power supply shelf (AC/DC)', category='electrical', standard='IEC 60617-6', tag='PS',
        body='<path d="M12 0 V8 M36 0 V8 M24 40 V48"/><rect class="b" x="6" y="8" width="36" height="32" rx="1"/><path d="M6 40 L42 8"/><path d="M10 18 C12 14 14 14 16 18 C18 22 20 22 22 18"/><path d="M28 32 H38 M28 35 H38" stroke-dasharray="2 1.5"/>',
        ports=P(feedA=[12, 0, 'power'], feedB=[36, 0, 'power'], dc=[24, 48, 'dc']), states=['running', 'standby', 'fault']),
    # ── fire and life safety (NFPA 170 conventions) ────────────────────────────────────────────────
    'sounder': dict(label='Sounder', category='fire', standard='NFPA 170', tag='SND',
        body='<path d="M24 48 V40"/><path class="b" d="M10 18 H20 L32 8 V40 L20 30 H10 Z"/><path d="M36 16 C40 20 40 28 36 32"/>',
        ports=P(loop=[24, 48, 'signal']), states=['normal', 'active', 'fault', 'isolated']),
    'strobe': dict(label='Visual alarm (strobe)', category='fire', standard='NFPA 170', tag='STR',
        body='<path d="M24 48 V40"/><rect class="b" x="8" y="8" width="32" height="32" rx="1"/><path d="M28 12 L18 26 H26 L20 36"/>',
        ports=P(loop=[24, 48, 'signal']), states=['normal', 'active', 'fault', 'isolated']),
    'facp': dict(label='Fire alarm control panel', category='fire', standard='NFPA 170', tag='FACP',
        body='<path d="M24 48 V42"/><rect class="b" x="4" y="6" width="40" height="36" rx="1"/><path d="M4 16 H44"/><path d="M10 24 H22 M10 30 H22 M10 36 H22"/><circle cx="34" cy="30" r="5"/>',
        ports=P(loop=[24, 48, 'signal']), states=['normal', 'alarm', 'fault', 'disabled']),
    'releasePanel': dict(label='Extinguishing release panel', category='fire', standard='NFPA 170 / NFPA 2001', tag='RCP',
        body='<path d="M24 48 V42"/><rect class="b" x="4" y="6" width="40" height="36" rx="1"/><path d="M4 16 H44"/><path d="M14 36 L24 22 L34 36 Z"/>',
        ports=P(out=[24, 48, 'signal']), states=['normal', 'pre-discharge', 'released', 'abort', 'fault', 'disabled']),
    'nozzle': dict(label='Discharge nozzle', category='fire', standard='NFPA 170 / NFPA 2001', tag='NZ',
        body='<path d="M24 0 V18"/><path class="b" d="M16 18 H32 L28 28 H20 Z"/><path d="M18 34 L12 42 M24 34 V44 M30 34 L36 42"/>',
        ports=P(inlet=[24, 0, 'agent']), states=['normal', 'discharged']),
    'selectorValve': dict(label='Selector valve', category='fire', standard='NFPA 170 / NFPA 2001', tag='SV',
        body=f'<path d="{LINE_H} M24 24 V14"/><path class="b" d="{BOW}"/><rect x="16" y="2" width="16" height="12" rx="1"/><path d="M20 5 H28 M20 9 H28"/>',
        ports=P(a=[0, 24, 'agent'], b=[48, 24, 'agent'], signal=[24, 0, 'signal']), states=['closed', 'open', 'fault']),
    'abortSwitch': dict(label='Abort / hold switch', category='fire', standard='NFPA 170', tag='ABT',
        body='<path d="M24 48 V42"/><rect class="b" x="8" y="10" width="32" height="32" rx="1"/><circle cx="24" cy="26" r="8"/><path d="M20 26 H28"/>',
        ports=P(loop=[24, 48, 'signal']), states=['normal', 'active', 'fault']),
    'damperFire': dict(label='Fire / smoke damper with actuator', category='fire', standard='NFPA 170', tag='FD',
        body='<path d="M0 24 H8 M40 24 H48 M24 10 V4"/><rect class="b" x="8" y="10" width="32" height="28" rx="1"/><path d="M10 36 L38 12"/><rect x="18" y="0" width="12" height="6"/>',
        ports=P(a=[0, 24, 'air'], b=[48, 24, 'air'], signal=[24, 0, 'signal']), states=['open', 'closed', 'fault']),
    'doorRelease': dict(label='Door holder / release', category='fire', standard='NFPA 170', tag='DH',
        body='<path d="M24 48 V40"/><rect class="b" x="10" y="8" width="28" height="32" rx="1"/><path d="M10 8 L30 14 V46"/>',
        ports=P(loop=[24, 48, 'signal']), states=['held', 'released', 'fault']),
    'interfaceModule': dict(label='Interface module (monitor / control)', category='fire', standard='NFPA 170', tag='IM',
        body='<path d="M24 48 V40 M24 0 V8"/><rect class="b" x="8" y="8" width="32" height="32" rx="1"/><path d="M14 24 H34 M28 18 L34 24 L28 30"/>',
        ports=P(loop=[24, 48, 'signal'], out=[24, 0, 'signal']), states=['normal', 'active', 'fault', 'isolated']),
    'leakSensor': dict(label='Leak detection (rope / point)', category='fire', standard='— (BMS practice)', tag='LD',
        body='<path d="M24 48 V40"/><path class="b" d="M24 8 C30 18 34 24 34 30 A10 10 0 0 1 14 30 C14 24 18 18 24 8 Z"/><path d="M4 44 C10 40 14 48 20 44 M28 44 C34 40 38 48 44 44"/>',
        ports=P(loop=[24, 48, 'signal']), states=['normal', 'alarm', 'fault', 'isolated']),
    # ── network (neutral geometry, no vendor icons) ────────────────────────────────────────────────
    'netSwitch': dict(label='Network switch', category='network', standard='— (neutral)', tag='SW',
        body='<path d="M24 0 V12 M24 36 V48"/><rect class="b" x="4" y="12" width="40" height="24" rx="1"/><path d="M10 20 H22 M18 17 L22 20 L18 23 M38 28 H26 M30 25 L26 28 L30 31"/>',
        ports=P(up=[24, 0, 'data'], down=[24, 48, 'data']), states=['up', 'degraded', 'down']),
    'netRouter': dict(label='Router', category='network', standard='— (neutral)', tag='RTR',
        body='<path d="M24 0 V8 M24 40 V48"/><circle class="b" cx="24" cy="24" r="16"/><path d="M14 24 H34 M24 14 V34 M30 20 L34 24 L30 28 M18 20 L14 24 L18 28"/>',
        ports=P(up=[24, 0, 'data'], down=[24, 48, 'data']), states=['up', 'degraded', 'down']),
    'netFirewall': dict(label='Firewall', category='network', standard='— (neutral)', tag='FW',
        body='<path d="M24 0 V8 M24 40 V48"/><rect class="b" x="6" y="8" width="36" height="32" rx="1"/><path d="M6 19 H42 M6 30 H42 M18 8 V19 M30 19 V30 M18 30 V40"/>',
        ports=P(outside=[24, 0, 'data'], inside=[24, 48, 'data']), states=['up', 'degraded', 'down']),
    'netServer': dict(label='Server / compute node', category='network', standard='— (neutral)', tag='SRV',
        body='<path d="M24 0 V6"/><rect class="b" x="8" y="6" width="32" height="38" rx="1"/><path d="M8 18 H40 M8 30 H40"/><circle cx="34" cy="12" r="1.5" fill="currentColor"/><circle cx="34" cy="24" r="1.5" fill="currentColor"/><circle cx="34" cy="36" r="1.5" fill="currentColor"/>',
        ports=P(nic=[24, 0, 'data']), states=['up', 'degraded', 'down']),
    'netCarrier': dict(label='Carrier / external network', category='network', standard='— (neutral)', tag='ISP',
        body='<path d="M24 36 V48"/><path class="b" d="M12 36 A8 8 0 0 1 12 20 A10 10 0 0 1 30 14 A9 9 0 0 1 38 36 Z"/>',
        ports=P(handoff=[24, 48, 'data']), states=['up', 'degraded', 'down']),
    'netOdf': dict(label='Fibre distribution (ODF / patch)', category='network', standard='— (neutral)', tag='ODF',
        body='<path d="M24 0 V12 M24 36 V48"/><rect class="b" x="4" y="12" width="40" height="24" rx="1"/><circle cx="12" cy="24" r="2"/><circle cx="20" cy="24" r="2"/><circle cx="28" cy="24" r="2"/><circle cx="36" cy="24" r="2"/>',
        ports=P(a=[24, 0, 'data'], b=[24, 48, 'data']), states=['normal']),
    'bmsController': dict(label='BMS controller (DDC / PLC)', category='network', standard='— (neutral)', tag='DDC',
        body='<path d="M24 0 V8 M12 40 V48 M36 40 V48"/><rect class="b" x="6" y="8" width="36" height="32" rx="1"/><path d="M12 16 H36 M12 22 H28"/><path d="M12 32 H16 M20 32 H24 M28 32 H32"/>',
        ports=P(net=[24, 0, 'data'], io1=[12, 48, 'signal'], io2=[36, 48, 'signal']), states=['online', 'offline', 'fault']),
}

GRID = 6


def svg_text(kind, d):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linecap="round" stroke-linejoin="round">\n'
            f'  <!-- {d["label"]} — {d["standard"]} (generated by tools/hmi-symbol-defs.py) -->\n'
            f'  {d["body"]}\n</svg>\n')


def manifest_entry(kind, d):
    return {'file': f'{kind}.svg', 'viewBox': '0 0 48 48', 'label': d['label'], 'category': d['category'],
            'dcmoc': False, 'standard': d['standard'], 'tagPrefix': d['tag'],
            'ports': d['ports'], 'states': d['states']}


def problems():
    out = []
    for kind, d in DEFS.items():
        for name, (x, y, _m) in d['ports'].items():
            if x % GRID or y % GRID or not (0 <= x <= 48 and 0 <= y <= 48):
                out.append(f'{kind}.{name} port ({x},{y}) off the {GRID}-unit grid')
        if 'Gradient' in d['body'] or 'filter' in d['body']:
            out.append(f'{kind}: gradient/filter in symbol body')
    return out


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else '--check'
    errs = problems()
    if errs:
        print('\n'.join(errs)); sys.exit(1)
    mpath = os.path.join(SRC, 'manifest.json')
    manifest = json.load(open(mpath))
    clash = [k for k in DEFS if k in manifest and manifest[k].get('dcmoc', True) is not False]
    if clash:
        print('kinds already owned by the DCMOC library:', clash); sys.exit(1)
    stale = []
    for kind, d in DEFS.items():
        f = os.path.join(SRC, f'{kind}.svg')
        want = svg_text(kind, d)
        if not os.path.exists(f) or open(f).read() != want:
            stale.append(f'{kind}.svg')
            if mode == '--apply':
                open(f, 'w').write(want)
        if manifest.get(kind) != manifest_entry(kind, d):
            stale.append(f'manifest:{kind}')
            manifest[kind] = manifest_entry(kind, d)
    if mode == '--apply':
        json.dump(manifest, open(mpath, 'w'), indent=2, ensure_ascii=False)
        open(mpath, 'a').write('\n')
        print(f'hmi symbols: {len(DEFS)} kinds, {len(stale)} file(s)/entr(ies) written')
    else:
        print(f'hmi symbols: {len(DEFS)} kinds, {len(stale)} stale' + (': ' + ', '.join(stale[:8]) if stale else ''))
        sys.exit(1 if stale else 0)


if __name__ == '__main__':
    main()
