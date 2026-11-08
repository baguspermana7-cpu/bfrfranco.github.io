# build-cx-assets.py — Blender (4.5 LTS, headless) generator for the Cx campus equipment library.
#   ~/tools/blender/blender -b --python tools/cx-assets/build-cx-assets.py -- assets/cx/campus-equipment.glb
# One mesh per campus family (PRD v1.1 §11 / §41 K15), named by the family id, metres, origin at the
# footprint centre on the floor, Y up in the export. Faces carry a grey factor in COLOR_0 (1 = body) that the
# campus multiplies by the per-instance status tint, so the handbook tag stays the hue. Deterministic: no
# randomness, fixed segment counts, so the exported file is reproducible and the gate can hash it.
import bpy, bmesh, sys, math
from mathutils import Vector, Matrix

# Shade factors ≥ 0.40: the campus multiplies them by a mid-grey status tint, so 0.25 rendered as black (owner K16).
# Mirrored in js/rz-cx-assets.js (the primitive fallback) and gated by tools/test-cx-glb.mjs (COLOR_0 ∈ [0.40, 1]).
BODY, LIGHT, DETAIL, GLASS, FRAME, DARK, VENT = 1.0, 0.92, 0.78, 0.68, 0.62, 0.5, 0.42
SEG = 16

# family → (w, h, d) as the campus places them (js/rz-cx-campus.js family() calls)
SIZES = {
  'racks': (0.6, 2.2, 1.2), 'cdu': (1.2, 2.0, 1.0), 'crah': (2.4, 2.6, 1.0), 'ups': (1.0, 2.2, 0.9),
  'unit_subs': (2.2, 2.4, 1.6), 'lv_busway': (1.6, 2.2, 0.8), 'bms': (0.8, 2.0, 0.8), 'fire': (1.6, 1.6, 0.8),
  'chillers': (5.0, 2.6, 2.4), 'fws': (1.4, 1.4, 2.4), 'dry_coolers': (4.0, 2.4, 2.4), 'generators': (3.0, 3.2, 12.0),
  'hv_intake': (2.0, 7.0, 2.0), 'main_tx': (6.0, 4.5, 4.0), 'mv_board': (20.0, 5.0, 8.0),
}

class Part:
    """collects bmesh pieces for one family; Blender Z is up here, the exporter turns it into Y up."""
    def __init__(self):
        self.bm = bmesh.new()
        self.shades = []   # one grey factor per face, in face order (written as a FLOAT_COLOR attribute, exported raw)
    def _add(self, bm_src, mat, shade):
        bm_src.transform(mat)
        tmp = bpy.data.meshes.new('tmp'); bm_src.to_mesh(tmp); bm_src.free()
        n0 = len(self.bm.faces); self.bm.from_mesh(tmp); bpy.data.meshes.remove(tmp)
        self.shades.extend([shade] * (len(self.bm.faces) - n0))
    def box(self, w, h, d, x, y, z, shade, bevel=0.03, rz=0.0):
        """w along X, d along Y (depth), h along Z; (x, y, z) = centre; bevel in metres (0 = none)"""
        b = bmesh.new(); bmesh.ops.create_cube(b, size=1.0)
        if bevel > 0 and min(w, h, d) > bevel * 4:
            bmesh.ops.scale(b, vec=(w, d, h), verts=b.verts)
            bmesh.ops.bevel(b, geom=list(b.edges), offset=bevel, segments=1, affect='EDGES', profile=0.7)
        else:
            bmesh.ops.scale(b, vec=(w, d, h), verts=b.verts)
        m = Matrix.Translation((x, y, z)) @ Matrix.Rotation(rz, 4, 'Z')
        self._add(b, m, shade)
    def cyl(self, r1, r2, length, x, y, z, shade, axis='z', seg=SEG):
        b = bmesh.new()
        bmesh.ops.create_cone(b, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=length)
        rot = {'z': Matrix.Identity(4), 'x': Matrix.Rotation(math.pi / 2, 4, 'Y'), 'y': Matrix.Rotation(math.pi / 2, 4, 'X')}[axis]
        self._add(b, Matrix.Translation((x, y, z)) @ rot, shade)
    def ring(self, r, tube, x, y, z, shade, seg=SEG):
        b = bmesh.new()
        bmesh.ops.create_circle(b, cap_ends=False, segments=seg, radius=r)
        # extrude a thin tube: build torus-like ring from two circles (cheap: 2 rings of faces)
        b.free(); b = bmesh.new()
        bmesh.ops.create_cone(b, cap_ends=False, segments=seg, radius1=r, radius2=r, depth=tube)
        inner = bmesh.new(); bmesh.ops.create_cone(inner, cap_ends=False, segments=seg, radius1=r - tube, radius2=r - tube, depth=tube)
        for f in inner.faces: f.normal_flip()
        tmp = bpy.data.meshes.new('t2'); inner.to_mesh(tmp); inner.free(); b.from_mesh(tmp); bpy.data.meshes.remove(tmp)
        self._add(b, Matrix.Translation((x, y, z)), shade)
    def slab_tilted(self, w, h, d, x, y, z, rx, shade):
        b = bmesh.new(); bmesh.ops.create_cube(b, size=1.0); bmesh.ops.scale(b, vec=(w, d, h), verts=b.verts)
        self._add(b, Matrix.Translation((x, y, z)) @ Matrix.Rotation(rx, 4, 'X'), shade)
    def finish(self, name):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        me = bpy.data.meshes.new(name); self.bm.to_mesh(me); self.bm.free()
        col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        assert len(me.polygons) == len(self.shades), (name, len(me.polygons), len(self.shades))
        for poly, s in zip(me.polygons, self.shades):
            for li in poly.loop_indices: col.data[li].color = (s, s, s, 1.0)
        me.color_attributes.active_color = col
        ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
        return ob

def cabinet(P, w, h, d, panel=VENT, inset=0.06, plinth=0.1, vents=3):
    P.box(w, plinth, d, 0, 0, plinth / 2, DARK, bevel=0)
    P.box(w, h - plinth, d, 0, 0, plinth + (h - plinth) / 2, BODY)
    P.box(w - inset * 2, h - plinth - inset * 2, 0.02, 0, -d / 2 - 0.005, plinth + (h - plinth) / 2, panel, bevel=0)
    for i in range(vents):
        P.box(w - inset * 3, 0.05, 0.015, 0, -d / 2 - 0.02, plinth + 0.25 + i * (h - plinth - 0.5) / max(1, vents - 1), FRAME, bevel=0)

def family_racks(P, w, h, d):
    cabinet(P, w, h, d, panel=DARK, vents=5)
    P.box(0.03, h * 0.5, 0.03, -w / 2 + 0.06, -d / 2 - 0.03, h * 0.55, LIGHT, bevel=0)       # door handle
    P.box(w * 0.8, 0.08, 0.3, 0, d * 0.1, h + 0.04, FRAME, bevel=0)                          # overhead tray stub
    P.box(w - 0.12, 0.12, d - 0.2, 0, 0, h + 0.06, GLASS, bevel=0)                           # top blanking

def family_cdu(P, w, h, d):
    cabinet(P, w, h, d, panel=VENT, vents=2)
    P.box(w * 0.5, 0.25, 0.02, 0, -d / 2 - 0.02, h * 0.82, GLASS, bevel=0)                   # HMI screen
    for s in (-1, 1):                                                                        # supply/return to the rear
        P.cyl(0.045, 0.045, 0.3, s * w * 0.25, d / 2 - 0.1, h + 0.1, LIGHT, axis='y', seg=12)
        P.cyl(0.045, 0.045, 0.3, s * w * 0.25, d / 2 - 0.1, h + 0.1, LIGHT, axis='z', seg=12)

def family_crah(P, w, h, d):
    cabinet(P, w, h * 0.82, d, panel=VENT, vents=0)
    for i in range(6):                                                                       # filter louvres
        P.box(w - 0.3, 0.04, 0.02, 0, -d / 2 - 0.025, 0.35 + i * (h * 0.82 - 0.7) / 5, FRAME, bevel=0)
    P.box(w - 0.2, h * 0.18, d - 0.2, 0, 0, h * 0.82 + h * 0.09, DETAIL)                     # plenum
    for i in range(2): P.ring(0.32, 0.08, -w / 4 + i * w / 2, 0, h + 0.02, FRAME)             # fan rings
    for i in range(2): P.cyl(0.05, 0.05, 0.1, -w / 4 + i * w / 2, 0, h + 0.02, DARK, seg=8)   # hubs

def family_ups(P, w, h, d):
    cabinet(P, w, h, d, panel=VENT, vents=2)
    P.box(w * 0.6, 0.2, 0.02, 0, -d / 2 - 0.02, h * 0.85, GLASS, bevel=0)
    P.box(w * 0.5, 0.2, 0.3, 0, d * 0.2, h + 0.1, FRAME, bevel=0)                            # cable entry

def family_unit_subs(P, w, h, d):
    P.box(w, 0.12, d, 0, 0, 0.06, DARK, bevel=0)
    P.box(w, h - 0.12, d, 0, 0, 0.12 + (h - 0.12) / 2, BODY)
    for s in (-1, 1):
        for i in range(5): P.box(w - 0.4, 0.06, 0.03, 0, s * (d / 2 + 0.015), 0.4 + i * (h - 0.9) / 4, VENT, bevel=0)
    for i in range(3): P.cyl(0.22, 0.22, h * 0.55, -w * 0.3 + i * w * 0.3, 0, h * 0.5, DETAIL, seg=14)  # cast-resin coils (seen through the louvre)
    P.box(w * 0.4, 0.3, 0.4, w * 0.2, 0, h - 0.15, FRAME, bevel=0)                           # cable box

def family_lv_busway(P, w, h, d):
    P.box(w, 0.1, d, 0, 0, 0.05, DARK, bevel=0)
    P.box(w, h - 0.1, d, 0, 0, 0.1 + (h - 0.1) / 2, BODY)
    doors = 3
    for i in range(doors):
        P.box(w / doors - 0.08, h - 0.5, 0.02, -w / 2 + w / doors * (i + 0.5), -d / 2 - 0.01, 0.1 + (h - 0.5) / 2 + 0.1, LIGHT, bevel=0)
        P.box(0.03, 0.25, 0.03, -w / 2 + w / doors * (i + 0.5) + w / doors * 0.3, -d / 2 - 0.03, h * 0.5, FRAME, bevel=0)
    P.box(w + 0.2, 0.25, 0.25, 0, 0, h + 0.02, FRAME, bevel=0)                               # busway duct

def family_bms(P, w, h, d):
    cabinet(P, w, h, d, panel=DARK, vents=0)
    P.box(w * 0.6, h * 0.25, 0.02, 0, -d / 2 - 0.02, h * 0.7, GLASS, bevel=0)

def family_fire(P, w, h, d):
    P.box(w * 0.4, h, d * 0.6, -w * 0.3, 0, h / 2, BODY)                                     # panel
    P.box(w * 0.3, h * 0.3, 0.02, -w * 0.3, -d * 0.3 - 0.02, h * 0.7, GLASS, bevel=0)
    for i in range(2):                                                                       # agent cylinders
        P.cyl(0.18, 0.18, h * 0.85, w * 0.05 + i * 0.42, 0, h * 0.425, LIGHT, seg=14)
        P.cyl(0.07, 0.07, 0.15, w * 0.05 + i * 0.42, 0, h * 0.85 + 0.07, FRAME, seg=10)

def family_chillers(P, w, h, d):
    P.box(w, 0.2, d, 0, 0, 0.1, DARK, bevel=0)                                               # skid
    for i, (r, z) in enumerate(((0.55, 0.85), (0.55, 1.95))):                                # evaporator (low), condenser (high)
        P.cyl(r, r, w * 0.82, 0, 0, z, BODY, axis='x', seg=18)
        P.cyl(r * 0.55, r * 0.55, 0.3, -w * 0.41 - 0.15, 0, z, FRAME, axis='x', seg=12)
        P.cyl(r * 0.55, r * 0.55, 0.3, w * 0.41 + 0.15, 0, z, FRAME, axis='x', seg=12)
    for s in (-1, 1): P.cyl(0.32, 0.32, 1.0, s * w * 0.2, d * 0.32, 1.4, DETAIL, axis='x', seg=14)  # compressors
    P.box(0.7, 1.4, 0.4, w * 0.36, -d * 0.35, 1.0, LIGHT)                                    # control panel
    P.box(0.35, 0.5, 0.02, w * 0.36, -d * 0.35 - 0.21, 1.3, GLASS, bevel=0)
    P.cyl(0.12, 0.12, 1.2, -w * 0.3, -d * 0.3, 0.8, LIGHT, axis='z', seg=10)                # water connections
    P.cyl(0.12, 0.12, 1.2, -w * 0.3, d * 0.3, 0.8, LIGHT, axis='z', seg=10)

def family_fws(P, w, h, d):
    P.box(w, 0.12, d, 0, 0, 0.06, DARK, bevel=0)                                             # baseplate
    P.cyl(0.33, 0.33, d * 0.5, 0, d * 0.18, 0.55, BODY, axis='y', seg=16)                    # motor
    P.box(0.4, 0.15, 0.3, 0, d * 0.18, 0.95, FRAME, bevel=0)                                 # terminal box
    P.cyl(0.38, 0.38, 0.35, 0, -d * 0.3, 0.55, LIGHT, axis='y', seg=18)                      # volute
    P.cyl(0.14, 0.14, 0.4, 0, -d * 0.45, 0.55, LIGHT, axis='y', seg=12)                      # suction
    P.cyl(0.12, 0.12, h - 0.55, 0, -d * 0.3, 0.55 + (h - 0.55) / 2, LIGHT, axis='z', seg=12) # discharge up
    P.cyl(0.2, 0.2, 0.08, 0, -d * 0.3, h - 0.04, FRAME, axis='z', seg=12)                    # flange

def family_dry_coolers(P, w, h, d):
    for s in (-1, 1): P.box(0.12, h * 0.45, 0.12, s * (w / 2 - 0.1), 0, h * 0.225, FRAME, bevel=0)  # legs (front)
    for s in (-1, 1): P.box(0.12, h * 0.45, 0.12, s * (w / 2 - 0.1), d * 0.4, h * 0.225, FRAME, bevel=0)
    for s in (-1, 1): P.slab_tilted(w - 0.2, h * 0.55, 0.16, 0, s * d * 0.28, h * 0.5 + 0.1, s * math.radians(-32), DETAIL)  # V coils
    P.box(w, 0.1, d, 0, 0, h * 0.8, BODY, bevel=0)                                           # fan deck
    fans = 3
    for i in range(fans):
        x = -w / 2 + w / fans * (i + 0.5)
        P.ring(0.5, 0.1, x, 0, h * 0.86, FRAME); P.cyl(0.08, 0.08, 0.12, x, 0, h * 0.86, DARK, seg=8)
        for k in range(3):                                                                   # three blades
            a = k * 2 * math.pi / 3
            P.box(0.36, 0.03, 0.12, x + math.cos(a) * 0.22, math.sin(a) * 0.22, h * 0.86, LIGHT, bevel=0, rz=a)

def family_generators(P, w, h, d):
    P.box(w, 0.15, d, 0, 0, 0.075, DARK, bevel=0)                                            # skid
    P.box(w, h * 0.72, d, 0, 0, 0.15 + h * 0.36, BODY, bevel=0.05)                            # container
    for i in range(7): P.box(0.02, h * 0.5, 0.9, -w / 2 - 0.01, -d / 2 + 1.0 + i * (d - 2.0) / 6, 0.15 + h * 0.4, VENT, bevel=0)  # louvres
    P.box(w - 0.4, h * 0.5, 0.02, 0, -d / 2 - 0.015, 0.15 + h * 0.4, VENT, bevel=0)          # radiator end
    P.cyl(0.22, 0.22, h * 0.28, w * 0.25, d * 0.35, 0.15 + h * 0.72 + h * 0.14, FRAME, seg=14)  # exhaust stack
    P.cyl(0.35, 0.35, 2.4, w * 0.25, d * 0.2, 0.15 + h * 0.72 + 0.4, LIGHT, axis='y', seg=14)   # silencer
    P.box(0.8, 0.6, 0.6, -w * 0.2, d * 0.3, 0.15 + h * 0.72 + 0.3, DETAIL)                  # roof box

def family_hv_intake(P, w, h, d):
    for s in (-1, 1):                                                                        # lattice columns (two boxes + cross bars)
        P.box(0.35, h * 0.85, 0.35, s * (w / 2 - 0.2), 0, h * 0.425, FRAME, bevel=0)
        for k in range(4): P.box(0.42, 0.06, 0.42, s * (w / 2 - 0.2), 0, 0.8 + k * h * 0.2, DARK, bevel=0)
    P.box(w + 0.2, 0.35, 0.35, 0, 0, h * 0.85, FRAME, bevel=0)                               # beam
    for i in range(3):                                                                       # post insulators + line fittings
        x = -w * 0.3 + i * w * 0.3
        P.cyl(0.12, 0.12, h * 0.13, x, 0, h * 0.85 + h * 0.065, BODY, seg=10)
        for k in range(4): P.cyl(0.2, 0.2, 0.05, x, 0, h * 0.87 + k * h * 0.03, DETAIL, seg=10)
        P.cyl(0.1, 0.1, h * 0.3, x, d * 0.3, h * 0.85 - h * 0.15, LIGHT, seg=10)            # drop lead

def family_main_tx(P, w, h, d):
    tw, th, td = w * 0.5, h * 0.55, d * 0.45
    P.box(w, 0.2, d, 0, 0, 0.1, DARK, bevel=0)
    P.box(tw, th, td, 0, 0, 0.2 + th / 2, BODY, bevel=0.06)                                  # tank
    P.box(tw + 0.1, 0.15, td + 0.1, 0, 0, 0.2 + th + 0.075, FRAME, bevel=0)                   # cover
    fins = 7; fw = tw - 0.4
    for s in (-1, 1):
        for i in range(fins): P.box(0.06, th * 0.8, 0.85, -fw / 2 + i * fw / (fins - 1), s * (td / 2 + 0.45), 0.2 + th / 2, DETAIL, bevel=0)
        P.cyl(0.08, 0.08, fw + 0.2, 0, s * (td / 2 + 0.8), 0.2 + th * 0.88, FRAME, axis='x', seg=8)
        P.cyl(0.08, 0.08, fw + 0.2, 0, s * (td / 2 + 0.8), 0.2 + th * 0.12, FRAME, axis='x', seg=8)
    P.cyl(0.42, 0.42, tw * 0.9, 0, -td * 0.25, 0.2 + th + 0.6, BODY, axis='x', seg=16)       # conservator
    for x in (-tw * 0.3, tw * 0.3): P.box(0.2, 0.5, 0.2, x, -td * 0.25, 0.2 + th + 0.25, FRAME, bevel=0)
    hb = h - 0.2 - th - 0.2
    for i in range(3):                                                                       # HV bushings (tall) + LV bushings (short)
        x = -tw * 0.3 + i * tw * 0.3
        P.cyl(0.1, 0.17, hb, x, td * 0.28, 0.2 + th + hb / 2, LIGHT, seg=10)
        for k in range(5): P.cyl(0.2, 0.2, 0.05, x, td * 0.28, 0.2 + th + 0.3 + k * hb * 0.15, DETAIL, seg=10)
        P.cyl(0.12, 0.12, 0.1, x, td * 0.28, h - 0.15, FRAME, seg=8)
        P.cyl(0.08, 0.12, 0.7, x, td * 0.02, 0.2 + th + 0.5, LIGHT, seg=8)

def family_mv_board(P, w, h, d):
    P.box(w, 0.15, d, 0, 0, 0.075, DARK, bevel=0)
    P.box(w, h - 0.45, d, 0, 0, 0.15 + (h - 0.45) / 2, BODY, bevel=0.08)
    P.box(w + 0.4, 0.3, d + 0.4, 0, 0, h - 0.15, FRAME, bevel=0)                             # roof slab
    for i in range(4): P.box(w * 0.14, h * 0.35, 0.04, -w * 0.36 + i * w * 0.24, -d / 2 - 0.02, h * 0.55, VENT, bevel=0)   # louvres
    P.box(1.6, 2.4, 0.05, w * 0.38, -d / 2 - 0.025, 1.35, GLASS, bevel=0)                    # door
    for i in range(3): P.box(1.2, 0.6, 1.2, -w * 0.3 + i * w * 0.3, d * 0.2, h + 0.1, DETAIL)  # roof units
    for i in range(3): P.ring(0.4, 0.08, -w * 0.3 + i * w * 0.3, d * 0.2, h + 0.42, FRAME)

# ── high-detail twins (owner K17 2026-11-08 "super detail dan accurate, tapi tetap responsive") ───────────────────────
# `<family>_hi` shares the footprint and origin of its low twin; the campus draws it only for the focused building
# (LOD), so each may spend more triangles (budgets in tools/test-cx-glb.mjs). Parts are the ones a commissioning
# engineer recognises on the real machine; proportions are plausible for the footprint, not vendor drawings.

def sheds(P, x, y, z0, n, r, step, shade, seg=8):
    """insulator sheds: n thin discs up a bushing/post"""
    for k in range(n): P.cyl(r, r, 0.04, x, y, z0 + k * step, shade, seg=seg)

def fan(P, x, y, z, r, blades=3, shade_ring=FRAME):
    P.ring(r, r * 0.2, x, y, z, shade_ring); P.cyl(r * 0.16, r * 0.16, 0.12, x, y, z, DARK, seg=8)
    for k in range(blades):
        a = k * 2 * math.pi / blades
        P.box(r * 0.72, 0.03, 0.1, x + math.cos(a) * r * 0.44, y + math.sin(a) * r * 0.44, z, LIGHT, bevel=0, rz=a)

def family_racks_hi(P, w, h, d):
    cabinet(P, w, h, d, panel=DARK, vents=0)
    for i in range(6):                                                                       # perforated door band
        P.box(w - 0.14, 0.05, 0.012, 0, -d / 2 - 0.022, 0.3 + i * (h - 0.7) / 5, VENT, bevel=0)
    P.box(0.03, h * 0.5, 0.03, -w / 2 + 0.06, -d / 2 - 0.035, h * 0.55, LIGHT, bevel=0)      # handle
    P.box(0.05, 0.12, 0.04, -w / 2 + 0.06, -d / 2 - 0.04, h * 0.3, FRAME, bevel=0)           # lock
    P.box(w * 0.8, 0.08, 0.3, 0, d * 0.1, h + 0.04, FRAME, bevel=0)                          # overhead tray stub
    P.box(w - 0.12, 0.12, d - 0.2, 0, 0, h + 0.06, GLASS, bevel=0)                           # top blanking
    for s in (-1, 1): P.cyl(0.03, 0.03, h * 0.8, s * w * 0.3, d / 2 + 0.05, h * 0.42, LIGHT, seg=8)   # rear TCS manifold pair
    P.box(0.06, h * 0.7, 0.04, w / 2 - 0.06, d / 2 + 0.06, h * 0.4, FRAME, bevel=0)          # rear PDU strip

def family_cdu_hi(P, w, h, d):
    cabinet(P, w, h, d, panel=VENT, vents=0)
    for i in range(4): P.box(w - 0.2, 0.04, 0.015, 0, -d / 2 - 0.025, 0.3 + i * 0.18, FRAME, bevel=0)   # louvre
    P.box(w * 0.5, 0.25, 0.02, 0, -d / 2 - 0.02, h * 0.82, GLASS, bevel=0)                   # HMI screen
    P.box(w * 0.5, 0.06, 0.03, 0, -d / 2 - 0.03, h * 0.72, DARK, bevel=0)                    # status bar
    for s in (-1, 1):                                                                        # two pumps (housing + motor) seen at the rear
        P.cyl(0.12, 0.12, 0.14, s * w * 0.22, d / 2, 0.6, DETAIL, axis='y', seg=12)           # pump housings (rear)
        P.cyl(0.05, 0.05, 0.3, s * w * 0.25, d / 2 - 0.1, h + 0.08, LIGHT, axis='y', seg=12)    # header stubs
        P.cyl(0.05, 0.05, 0.3, s * w * 0.25, d / 2 - 0.1, h + 0.08, LIGHT, axis='z', seg=12)
        P.cyl(0.09, 0.09, 0.03, s * w * 0.25, d / 2 + 0.04, h + 0.08, FRAME, axis='y', seg=12)  # flanges
        P.cyl(0.09, 0.09, 0.03, s * w * 0.25, d / 2 - 0.1, h + 0.2, FRAME, axis='z', seg=12)

def family_crah_hi(P, w, h, d):
    cabinet(P, w, h * 0.82, d, panel=VENT, vents=0)
    for i in range(6): P.box(w - 0.3, 0.04, 0.02, 0, -d / 2 - 0.025, 0.35 + i * (h * 0.82 - 0.7) / 5, FRAME, bevel=0)   # inlet grille
    P.box(w - 0.24, h * 0.82 - 0.5, 0.012, 0, -d / 2 - 0.012, 0.1 + (h * 0.82 - 0.5) / 2 + 0.1, GLASS, bevel=0)          # filter frame
    for s in (-1, 1): P.box(0.04, h * 0.82 - 0.5, 0.03, s * (w / 2 - 0.14), -d / 2 - 0.03, 0.1 + (h * 0.82 - 0.5) / 2 + 0.1, FRAME, bevel=0)
    P.box(w - 0.2, h * 0.18, d - 0.2, 0, 0, h * 0.82 + h * 0.09, DETAIL)                     # plenum
    for i in range(4): fan(P, -w * 0.375 + i * w * 0.25, 0, h + 0.02, 0.26)                  # fan wall: four fans
    P.box(w * 0.4, 0.18, 0.02, 0, -d / 2 - 0.02, h * 0.82 - 0.25, GLASS, bevel=0)             # controller display

def family_ups_hi(P, w, h, d):
    cabinet(P, w, h, d, panel=VENT, vents=0)
    for i in range(5): P.box(w - 0.16, h * 0.12, 0.015, 0, -d / 2 - 0.022, 0.35 + i * h * 0.15, DETAIL, bevel=0)   # power module slots
    for i in range(5): P.box(0.08, 0.03, 0.02, w / 2 - 0.16, -d / 2 - 0.03, 0.4 + i * h * 0.15, GLASS, bevel=0)     # module status windows
    P.box(w * 0.6, 0.2, 0.02, 0, -d / 2 - 0.02, h * 0.88, GLASS, bevel=0)                   # HMI
    P.box(0.02, h - 0.3, 0.025, 0, -d / 2 - 0.028, 0.1 + (h - 0.3) / 2 + 0.05, FRAME, bevel=0)   # door seam
    P.box(0.03, 0.3, 0.03, w * 0.3, -d / 2 - 0.035, h * 0.5, LIGHT, bevel=0)                 # handle
    P.box(w * 0.5, 0.2, 0.3, 0, d * 0.2, h + 0.1, FRAME, bevel=0)                            # top busbar duct

def family_unit_subs_hi(P, w, h, d):
    P.box(w, 0.12, d, 0, 0, 0.06, DARK, bevel=0)
    for s in (-1, 1): P.box(0.12, 0.12, d, s * (w / 2 - 0.3), 0, 0.06, FRAME, bevel=0)      # rails
    P.box(w, h - 0.12, d, 0, 0, 0.12 + (h - 0.12) / 2, BODY)
    for s in (-1, 1):
        for i in range(8): P.box(w - 0.4, 0.05, 0.03, 0, s * (d / 2 + 0.015), 0.35 + i * (h - 0.8) / 7, VENT, bevel=0)   # ventilated enclosure
    for i in range(3):                                                                       # cast-resin coils over a core
        x = -w * 0.3 + i * w * 0.3
        P.cyl(0.24, 0.24, h * 0.5, x, 0, h * 0.5, DETAIL, seg=16)
        P.cyl(0.14, 0.14, h * 0.62, x, 0, h * 0.5, FRAME, seg=12)
    P.box(w * 0.78, 0.5, 0.18, 0, 0, h * 0.5 + h * 0.31 + 0.09, FRAME, bevel=0)              # top yoke
    P.box(w * 0.78, 0.5, 0.18, 0, 0, h * 0.5 - h * 0.31 - 0.09, FRAME, bevel=0)              # bottom yoke
    P.box(w * 0.4, 0.3, 0.4, w * 0.2, 0, h - 0.15, FRAME, bevel=0)                           # LV terminal box
    for i in range(3): P.cyl(0.04, 0.04, 0.3, -w * 0.3 + i * 0.25, 0, h + 0.1, LIGHT, seg=8)  # LV bushings
    P.box(0.3, 0.25, 0.02, -w * 0.2, -d / 2 - 0.03, h * 0.85, GLASS, bevel=0)               # temperature monitor

def family_lv_busway_hi(P, w, h, d):
    P.box(w, 0.1, d, 0, 0, 0.05, DARK, bevel=0)
    P.box(w, h - 0.1, d, 0, 0, 0.1 + (h - 0.1) / 2, BODY)
    doors = 3
    for i in range(doors):
        x = -w / 2 + w / doors * (i + 0.5)
        P.box(w / doors - 0.08, h - 0.5, 0.02, x, -d / 2 - 0.01, 0.1 + (h - 0.5) / 2 + 0.1, LIGHT, bevel=0)
        P.box(0.03, 0.25, 0.03, x + w / doors * 0.3, -d / 2 - 0.03, h * 0.5, FRAME, bevel=0)          # handle
        P.box(w / doors - 0.2, 0.2, 0.015, x, -d / 2 - 0.025, h * 0.72, DARK, bevel=0)                 # breaker window
        P.box(w / doors - 0.3, 0.06, 0.02, x, -d / 2 - 0.03, h * 0.72, GLASS, bevel=0)                 # breaker handle
        P.box(0.12, 0.12, 0.015, x - w / doors * 0.25, -d / 2 - 0.025, h * 0.86, GLASS, bevel=0)        # meter
        P.box(w / doors - 0.3, 0.05, 0.015, x, -d / 2 - 0.022, 0.3, VENT, bevel=0)                      # bottom vent
    P.box(w + 0.2, 0.25, 0.25, 0, 0, h + 0.02, FRAME, bevel=0)                               # busway duct
    for s in (-1, 1): P.box(0.04, 0.33, 0.33, s * (w / 2 + 0.08), 0, h + 0.02, DARK, bevel=0)   # duct joint flanges

def family_bms_hi(P, w, h, d):
    cabinet(P, w, h, d, panel=DARK, vents=0)
    for i in range(7):                                                                       # 19" patch panels / controllers
        P.box(w - 0.18, 0.08, 0.015, 0, -d / 2 - 0.022, 0.3 + i * (h - 0.75) / 6, DETAIL, bevel=0)
        P.box(w - 0.3, 0.02, 0.01, 0, -d / 2 - 0.03, 0.3 + i * (h - 0.75) / 6, GLASS, bevel=0)   # port/LED row
    P.box(w * 0.6, h * 0.14, 0.02, 0, -d / 2 - 0.025, h * 0.86, GLASS, bevel=0)              # operator screen
    P.box(0.05, h - 0.4, 0.05, w / 2 - 0.05, d / 2 + 0.03, h * 0.55, FRAME, bevel=0)         # rear cable manager

def family_fire_hi(P, w, h, d):
    P.box(w * 0.4, h, d * 0.6, -w * 0.3, 0, h / 2, BODY)                                     # panel
    P.box(w * 0.3, h * 0.3, 0.02, -w * 0.3, -d * 0.3 - 0.02, h * 0.7, GLASS, bevel=0)        # annunciator
    for i in range(2): P.box(w * 0.28, 0.03, 0.015, -w * 0.3, -d * 0.3 - 0.028, h * 0.3 + i * 0.12, DARK, bevel=0)   # zone LEDs
    P.box(w * 0.32, 0.02, 0.1, -w * 0.3, -d * 0.3 - 0.06, h * 0.52, FRAME, bevel=0)          # key switch shelf
    P.box(w * 0.5, 0.1, d * 0.6, w * 0.22, 0, 0.05, DARK, bevel=0)                           # cylinder rack base
    for i in range(3):                                                                       # agent cylinders with valves and manifold risers
        x = w * 0.05 + i * 0.3
        P.cyl(0.14, 0.14, h * 0.78, x, 0, h * 0.44, LIGHT, seg=14)
        P.cyl(0.06, 0.06, 0.12, x, 0, h * 0.83 + 0.06, FRAME, seg=10)
        P.cyl(0.025, 0.025, 0.22, x, 0, h * 0.83 + 0.23, DETAIL, seg=8)
    P.cyl(0.035, 0.035, 0.75, w * 0.35, 0, h * 0.83 + 0.34, FRAME, axis='x', seg=8)         # manifold
    P.box(w * 0.5, 0.04, 0.05, w * 0.22, 0, h * 0.6, FRAME, bevel=0)                         # cylinder bracket

def family_chillers_hi(P, w, h, d):
    P.box(w, 0.2, d, 0, 0, 0.1, DARK, bevel=0)                                               # skid
    for s in (-1, 1): P.box(w * 0.9, 0.12, 0.12, 0, s * d * 0.3, 0.26, FRAME, bevel=0)       # skid rails
    for i, (r, z) in enumerate(((0.55, 0.85), (0.55, 1.95))):                                # evaporator (low), condenser (high)
        P.cyl(r, r, w * 0.82, 0, 0, z, BODY, axis='x', seg=24)
        for s in (-1, 1):
            P.cyl(r * 0.6, r * 0.6, 0.3, s * (w * 0.41 + 0.15), 0, z, FRAME, axis='x', seg=16)     # water boxes
            P.cyl(r * 1.08, r * 1.08, 0.05, s * w * 0.41, 0, z, DETAIL, axis='x', seg=24)          # tube-sheet flanges
        for k in range(2): P.box(0.5, 0.3, 0.9 if i == 0 else 0.3, -w * 0.25 + k * w * 0.5, 0, 0.2 + (0.45 if i == 0 else 1.15), FRAME, bevel=0)   # saddles
    for s in (-1, 1):                                                                        # two compressors with motors
        P.cyl(0.32, 0.32, 1.0, s * w * 0.2, d * 0.32, 1.4, DETAIL, axis='x', seg=18)
        P.cyl(0.26, 0.26, 0.6, s * w * 0.2 + s * 0.8, d * 0.32, 1.4, FRAME, axis='x', seg=16)
        P.cyl(0.12, 0.12, 0.9, s * w * 0.2, d * 0.2, 1.75, LIGHT, axis='z', seg=10)          # discharge lines
    P.box(0.7, 1.4, 0.4, w * 0.36, -d * 0.35, 1.0, LIGHT)                                    # control panel
    P.box(0.35, 0.5, 0.02, w * 0.36, -d * 0.35 - 0.21, 1.3, GLASS, bevel=0)
    for (x, y) in ((-w * 0.3, -d * 0.3), (-w * 0.3, d * 0.3), (w * 0.1, -d * 0.3), (w * 0.1, d * 0.3)):   # water connections + flanges
        P.cyl(0.12, 0.12, 1.2, x, y, 0.8, LIGHT, axis='z', seg=12)
        P.cyl(0.19, 0.19, 0.05, x, y, 1.38, FRAME, axis='z', seg=12)
        P.cyl(0.08, 0.08, 0.22, x, y, 1.0, DARK, axis='y', seg=8)                            # valve handwheel stub
    P.box(0.5, 0.4, 0.35, -w * 0.05, -d * 0.36, 1.1, DETAIL)                                 # economiser / oil separator box

def family_fws_hi(P, w, h, d):
    P.box(w, 0.12, d, 0, 0, 0.06, DARK, bevel=0)                                             # baseplate
    for s in (-1, 1): P.box(0.1, 0.1, d, s * (w / 2 - 0.1), 0, 0.17, FRAME, bevel=0)        # skid rails
    P.cyl(0.33, 0.33, d * 0.5, 0, d * 0.18, 0.55, BODY, axis='y', seg=20)                    # motor
    P.cyl(0.28, 0.28, 0.12, 0, d * 0.45, 0.55, FRAME, axis='y', seg=20)                      # fan cowl
    for i in range(5): P.box(0.7, 0.03, 0.05, 0, d * 0.06 + i * 0.1, 0.9, DETAIL, bevel=0)   # cooling fins
    P.box(0.4, 0.15, 0.3, 0, d * 0.18, 0.95, FRAME, bevel=0)                                 # terminal box
    P.box(0.5, 0.25, 0.5, 0, -d * 0.1, 0.55, DETAIL)                                         # coupling guard
    P.cyl(0.38, 0.38, 0.35, 0, -d * 0.3, 0.55, LIGHT, axis='y', seg=24)                      # volute
    P.cyl(0.14, 0.14, 0.4, 0, -d * 0.45, 0.55, LIGHT, axis='y', seg=16)                      # suction
    P.cyl(0.2, 0.2, 0.05, 0, -d * 0.5 + 0.05, 0.55, FRAME, axis='y', seg=16)                  # suction flange
    P.cyl(0.12, 0.12, h - 0.55, 0, -d * 0.3, 0.55 + (h - 0.55) / 2, LIGHT, axis='z', seg=16) # discharge up
    P.cyl(0.2, 0.2, 0.08, 0, -d * 0.3, h - 0.04, FRAME, axis='z', seg=16)                    # flange
    P.cyl(0.06, 0.06, 0.06, 0.2, -d * 0.3, h - 0.3, GLASS, axis='x', seg=10)                 # pressure gauge
    for s in (-1, 1): P.box(0.16, 0.12, 0.3, s * 0.3, -d * 0.3, 0.2, FRAME, bevel=0)        # pump feet

def family_dry_coolers_hi(P, w, h, d):
    for s in (-1, 1):
        for y in (-d * 0.4, d * 0.4): P.box(0.12, h * 0.45, 0.12, s * (w / 2 - 0.1), y, h * 0.225, FRAME, bevel=0)   # four legs
    for s in (-1, 1):
        P.slab_tilted(w - 0.2, h * 0.55, 0.16, 0, s * d * 0.28, h * 0.5 + 0.1, s * math.radians(-32), DETAIL)   # V coils
        for i in range(9): P.slab_tilted(0.03, h * 0.5, 0.2, -w / 2 + 0.3 + i * (w - 0.6) / 8, s * d * 0.3, h * 0.5 + 0.1, s * math.radians(-32), FRAME)   # coil fin plates
        P.cyl(0.07, 0.07, w - 0.4, 0, s * d * 0.42, h * 0.3, LIGHT, axis='x', seg=10)         # header pipes
    P.box(w, 0.1, d, 0, 0, h * 0.8, BODY, bevel=0)                                           # fan deck
    for i in range(5): fan(P, -w / 2 + w / 5 * (i + 0.5), 0, h * 0.86, 0.36)                 # five fans
    P.box(0.3, 0.4, 0.3, w / 2 - 0.25, -d / 2 + 0.25, h * 0.2, DETAIL, bevel=0)              # control box

def family_generators_hi(P, w, h, d):
    P.box(w, 0.15, d, 0, 0, 0.075, DARK, bevel=0)                                            # skid / day tank base
    P.box(w * 0.5, 0.8, 0.5, 0, -d * 0.25, 0.15 + 0.25, DETAIL)                              # tank access
    P.box(w, h * 0.72, d, 0, 0, 0.15 + h * 0.36, BODY, bevel=0.05)                            # container
    for i in range(10): P.box(0.03, 0.03, h * 0.7, w / 2 + 0.01, -d / 2 + 0.6 + i * (d - 1.2) / 9, 0.15 + h * 0.36, FRAME, bevel=0)   # corrugation ribs
    for i in range(7): P.box(0.02, h * 0.5, 0.9, -w / 2 - 0.01, -d / 2 + 1.0 + i * (d - 2.0) / 6, 0.15 + h * 0.4, VENT, bevel=0)   # louvres
    P.box(w - 0.4, h * 0.5, 0.02, 0, -d / 2 - 0.015, 0.15 + h * 0.4, VENT, bevel=0)          # radiator end
    for i in range(6): P.box(w - 0.6, 0.03, 0.03, 0, -d / 2 - 0.03, 0.15 + h * 0.2 + i * h * 0.08, FRAME, bevel=0)   # radiator grille bars
    for s in (-1, 1):                                                                        # end doors with handles
        P.box(0.9, 0.02, h * 0.55, s * 0.5, d / 2 + 0.01, 0.15 + h * 0.33, LIGHT, bevel=0)
        P.box(0.04, 0.05, 0.25, s * 0.15, d / 2 + 0.04, 0.15 + h * 0.33, FRAME, bevel=0)
    for i in range(3): P.box(0.02, 1.4, h * 0.5, -w / 2 - 0.02, -d / 2 + 3.5 + i * 2.6, 0.15 + h * 0.4, LIGHT, bevel=0)   # side access door seams
    P.cyl(0.22, 0.22, h * 0.28, w * 0.25, d * 0.35, 0.15 + h * 0.72 + h * 0.14, FRAME, seg=16)  # exhaust stack
    P.cyl(0.32, 0.22, 0.2, w * 0.25, d * 0.35, 0.15 + h * 0.72 + h * 0.28 + 0.1, DARK, seg=16)   # rain cap
    P.cyl(0.35, 0.35, 2.4, w * 0.25, d * 0.2, 0.15 + h * 0.72 + 0.4, LIGHT, axis='y', seg=16)   # silencer
    P.box(0.8, 0.6, 0.6, -w * 0.2, d * 0.3, 0.15 + h * 0.72 + 0.3, DETAIL)                  # roof box
    for i in range(4): P.box(0.3, 0.3, 0.08, -w * 0.4 + (i % 2) * w * 0.8, -d * 0.45 + (i // 2) * d * 0.9, 0.15 + h * 0.72 + 0.04, FRAME, bevel=0)   # lifting lugs
    P.box(w * 0.3, 0.3, 0.02, -w * 0.2, -d / 2 - 0.03, 0.15 + h * 0.62, GLASS, bevel=0)       # control panel window

def family_hv_intake_hi(P, w, h, d):
    for s in (-1, 1):                                                                        # lattice columns: four posts + cross bracing
        cx = s * (w / 2 - 0.2)
        for px in (-0.14, 0.14):
            for py in (-0.14, 0.14): P.box(0.06, h * 0.85, 0.06, cx + px, py, h * 0.425, FRAME, bevel=0)
        for k in range(5): P.box(0.36, 0.04, 0.04, cx, 0, 0.6 + k * h * 0.17, DARK, bevel=0)
        for k in range(5): P.box(0.04, 0.36, 0.04, cx, 0, 0.6 + k * h * 0.17, DARK, bevel=0)
    P.box(w + 0.2, 0.35, 0.35, 0, 0, h * 0.85, FRAME, bevel=0)                               # beam
    for i in range(3):                                                                       # post insulators with sheds + line fittings
        x = -w * 0.3 + i * w * 0.3
        P.cyl(0.08, 0.08, h * 0.13, x, 0, h * 0.85 + h * 0.065, BODY, seg=10)
        sheds(P, x, 0, h * 0.87, 5, 0.2, h * 0.022, DETAIL)
        P.cyl(0.05, 0.05, 0.12, x, 0, h * 0.98 + 0.05, FRAME, seg=8)                         # clamp
        P.cyl(0.1, 0.1, h * 0.3, x, d * 0.3, h * 0.85 - h * 0.15, LIGHT, seg=10)             # drop lead
    for i in range(3):                                                                       # circuit breaker: three interrupter columns on support insulators
        x = -w * 0.3 + i * w * 0.3
        P.cyl(0.1, 0.1, h * 0.3, x, -d * 0.3, h * 0.15, BODY, seg=12)
        sheds(P, x, -d * 0.3, h * 0.05, 4, 0.18, h * 0.06, DETAIL)
        P.cyl(0.14, 0.14, h * 0.18, x, -d * 0.3, h * 0.3 + h * 0.09, LIGHT, seg=12)
        sheds(P, x, -d * 0.3, h * 0.32, 3, 0.2, h * 0.05, DETAIL)
    P.box(w * 0.7, 0.5, 0.6, 0, -d * 0.3, 0.3, DARK, bevel=0)                                # breaker mechanism cabinet
    P.box(w * 0.9, 0.08, 0.08, 0, -d * 0.3, h * 0.49, FRAME, bevel=0)                        # interrupter cross-bar

def family_main_tx_hi(P, w, h, d):
    tw, th, td = w * 0.5, h * 0.55, d * 0.45
    P.box(w, 0.2, d, 0, 0, 0.1, DARK, bevel=0)
    for s in (-1, 1): P.box(w * 0.9, 0.1, 0.1, 0, s * td * 0.4, 0.25, FRAME, bevel=0)       # rails
    P.box(tw, th, td, 0, 0, 0.2 + th / 2, BODY, bevel=0.06)                                  # tank
    for i in range(4): P.box(0.05, td + 0.02, th * 0.9, -tw / 2 + 0.3 + i * (tw - 0.6) / 3, 0, 0.2 + th / 2, LIGHT, bevel=0)   # tank stiffeners
    P.box(tw + 0.1, 0.15, td + 0.1, 0, 0, 0.2 + th + 0.075, FRAME, bevel=0)                   # cover
    fins = 12; fw = tw - 0.4
    for s in (-1, 1):                                                                        # radiator banks with headers
        for i in range(fins): P.box(0.05, th * 0.8, 0.85, -fw / 2 + i * fw / (fins - 1), s * (td / 2 + 0.45), 0.2 + th / 2, DETAIL, bevel=0)
        P.cyl(0.08, 0.08, fw + 0.2, 0, s * (td / 2 + 0.8), 0.2 + th * 0.88, FRAME, axis='x', seg=8)
        P.cyl(0.08, 0.08, fw + 0.2, 0, s * (td / 2 + 0.8), 0.2 + th * 0.12, FRAME, axis='x', seg=8)
        P.cyl(0.08, 0.08, 0.6, -fw / 2, s * (td / 2 + 0.45), 0.2 + th * 0.88, FRAME, axis='y', seg=8)   # header to tank
    for i in range(3): fan(P, -fw / 2 + 0.4 + i * (fw - 0.8) / 2, td / 2 + 1.0, 0.2 + th * 0.3, 0.3)   # cooling fans on one bank
    P.cyl(0.42, 0.42, tw * 0.9, 0, -td * 0.25, 0.2 + th + 0.6, BODY, axis='x', seg=20)       # conservator
    for x in (-tw * 0.3, tw * 0.3): P.box(0.2, 0.5, 0.2, x, -td * 0.25, 0.2 + th + 0.25, FRAME, bevel=0)
    P.cyl(0.1, 0.1, 0.5, -tw * 0.1, -td * 0.25, 0.2 + th + 0.25, DETAIL, axis='x', seg=10)    # Buchholz relay
    P.cyl(0.06, 0.06, 0.4, tw * 0.4, -td * 0.25, 0.2 + th + 0.9, FRAME, seg=8)               # breather
    P.box(0.5, 0.6, 1.1, tw / 2 + 0.3, -td * 0.1, 0.2 + th * 0.55, DETAIL)                   # on-load tap changer
    P.box(0.45, 0.6, 0.35, -tw / 2 - 0.25, td * 0.1, 0.2 + th * 0.35, FRAME, bevel=0)        # marshalling box
    hb = h - 0.2 - th - 0.2
    for i in range(3):                                                                       # HV bushings (tall, 6 sheds) + LV bushings (short, 3 sheds)
        x = -tw * 0.3 + i * tw * 0.3
        P.cyl(0.1, 0.17, hb, x, td * 0.28, 0.2 + th + hb / 2, LIGHT, seg=12)
        sheds(P, x, td * 0.28, 0.2 + th + 0.3, 6, 0.2, hb * 0.12, DETAIL)
        P.cyl(0.12, 0.12, 0.1, x, td * 0.28, h - 0.15, FRAME, seg=8)
        P.cyl(0.08, 0.12, 0.7, x, td * 0.02, 0.2 + th + 0.5, LIGHT, seg=10)
        sheds(P, x, td * 0.02, 0.2 + th + 0.25, 3, 0.15, 0.15, DETAIL, seg=10)
        P.cyl(0.06, 0.06, 0.1, x, td * 0.02, 0.2 + th + 0.9, FRAME, seg=8)

def family_mv_board_hi(P, w, h, d):
    P.box(w, 0.15, d, 0, 0, 0.075, DARK, bevel=0)
    P.box(w, h - 0.45, d, 0, 0, 0.15 + (h - 0.45) / 2, BODY, bevel=0.08)
    P.box(w + 0.4, 0.3, d + 0.4, 0, 0, h - 0.15, FRAME, bevel=0)                             # roof slab
    for s in (-1, 1): P.box(w + 0.4, 0.35, 0.12, 0, s * (d / 2 + 0.14), h + 0.17, DETAIL, bevel=0)   # parapets
    for s in (-1, 1): P.box(0.12, 0.35, d + 0.4, s * (w / 2 + 0.14), 0, h + 0.17, DETAIL, bevel=0)
    for i in range(4): P.box(w * 0.14, h * 0.35, 0.04, -w * 0.36 + i * w * 0.24, -d / 2 - 0.02, h * 0.55, VENT, bevel=0)   # louvres
    for i in range(4):
        for k in range(5): P.box(w * 0.13, 0.03, 0.05, -w * 0.36 + i * w * 0.24, -d / 2 - 0.045, h * 0.4 + k * h * 0.07, FRAME, bevel=0)   # louvre blades
    P.box(1.6, 2.4, 0.05, w * 0.38, -d / 2 - 0.025, 1.35, GLASS, bevel=0)                    # door
    P.box(0.05, 0.3, 0.05, w * 0.38 + 0.6, -d / 2 - 0.06, 1.2, FRAME, bevel=0)               # door handle
    for i in range(6): P.box(1.2, 0.03, 0.8, -w * 0.4 + i * w * 0.16, d / 2 + 0.015, h * 0.7, GLASS, bevel=0)   # high windows on the rear wall
    for i in range(3): P.box(1.2, 0.6, 1.2, -w * 0.3 + i * w * 0.3, d * 0.2, h + 0.1, DETAIL)  # roof units
    for i in range(3): fan(P, -w * 0.3 + i * w * 0.3, d * 0.2, h + 0.42, 0.4)
    for s in (-1, 1): P.cyl(0.06, 0.06, h, s * (w / 2 + 0.06), -d / 2 + 0.3, h / 2, FRAME, seg=8)   # downpipes
    P.box(2.0, 0.8, 0.9, -w * 0.3, -d / 2 + 0.8, 0.45, DETAIL)                               # cable entry trench cover

FAMILIES = {
  'racks': family_racks, 'cdu': family_cdu, 'crah': family_crah, 'ups': family_ups, 'unit_subs': family_unit_subs,
  'lv_busway': family_lv_busway, 'bms': family_bms, 'fire': family_fire, 'chillers': family_chillers, 'fws': family_fws,
  'dry_coolers': family_dry_coolers, 'generators': family_generators, 'hv_intake': family_hv_intake, 'main_tx': family_main_tx, 'mv_board': family_mv_board,
  'racks_hi': family_racks_hi, 'cdu_hi': family_cdu_hi, 'crah_hi': family_crah_hi, 'ups_hi': family_ups_hi, 'unit_subs_hi': family_unit_subs_hi,
  'lv_busway_hi': family_lv_busway_hi, 'bms_hi': family_bms_hi, 'fire_hi': family_fire_hi, 'chillers_hi': family_chillers_hi, 'fws_hi': family_fws_hi,
  'dry_coolers_hi': family_dry_coolers_hi, 'generators_hi': family_generators_hi, 'hv_intake_hi': family_hv_intake_hi, 'main_tx_hi': family_main_tx_hi, 'mv_board_hi': family_mv_board_hi,
}

def main():
    out = sys.argv[sys.argv.index('--') + 1]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for name, fn in FAMILIES.items():
        P = Part(); w, h, d = SIZES[name.replace('_hi', '')]; fn(P, w, h, d); ob = P.finish(name)
        ob.location = (0, 0, 0)
    try:
        bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, export_normals=True,
                                  export_materials='NONE', export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True)
    except TypeError:
        bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, export_normals=True, export_materials='NONE')
    print('exported', out, len(FAMILIES), 'families')

main()
