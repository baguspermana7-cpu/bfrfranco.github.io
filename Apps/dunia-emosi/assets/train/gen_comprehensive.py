#!/usr/bin/env python3
"""Generate 125 unique SVG train icons for Dunia Emosi app."""
import os

OUT_DIR = "/home/baguspermana7/rz-work/Apps/dunia-emosi/assets/train"

def wheel(cx, cy, r, spoke_color, fill="#1a1a1a", stroke="#555"):
    spokes = ""
    import math
    n = 6 if r >= 10 else 4
    for i in range(n):
        angle = math.pi * i / n
        x1 = cx + r * math.cos(angle)
        y1 = cy + r * math.sin(angle)
        x2 = cx - r * math.cos(angle)
        y2 = cy - r * math.sin(angle)
        spokes += f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{spoke_color}" stroke-width="1.2"/>\n'
    hub_r = max(1.5, r * 0.22)
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>\n'
            + spokes +
            f'<circle cx="{cx}" cy="{cy}" r="{hub_r:.1f}" fill="{spoke_color}"/>\n')

def svg_wrap(content, label, vb="0 0 200 130", w=200, h=130):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}">
{content}
  <text x="{w//2}" y="{h-4}" font-family="Arial,sans-serif" font-size="7" fill="#555" text-anchor="middle">{label}</text>
</svg>'''

# Rail helper
def rail(x1, x2, y=112):
    return f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="#888" stroke-width="2.5"/>\n'

SVGS = {}

# ============================================================
# EARLY STEAM
# ============================================================

# 1. blenkinsop-rack (1812) - rack gear on rail, 0-4-0, dark brown
SVGS["blenkinsop-rack"] = svg_wrap(f'''
  <!-- boiler horizontal -->
  <rect x="40" y="48" width="90" height="32" rx="8" fill="#5C2A00"/>
  <rect x="125" y="56" width="25" height="20" rx="3" fill="#3a1a00"/>
  <!-- chimney tall tapered -->
  <rect x="55" y="20" width="14" height="30" rx="4" fill="#2a1400"/>
  <rect x="51" y="16" width="22" height="8" rx="3" fill="#1a0a00"/>
  <!-- smoke puffs -->
  <circle cx="62" cy="12" r="5" fill="#aaa" opacity="0.5"/>
  <circle cx="70" cy="9" r="4" fill="#aaa" opacity="0.35"/>
  <!-- rack gear on rail - key feature -->
  <rect x="30" y="108" width="140" height="5" rx="1" fill="#777"/>
  <rect x="30" y="113" width="140" height="3" rx="1" fill="#555"/>
  <!-- rack teeth -->
  {''.join(f'<rect x="{30+i*8}" y="107" width="4" height="7" fill="#444"/>' for i in range(18))}
  <!-- 4 drive wheels -->
  {wheel(65, 100, 11, "#8B6914", "#2C1A0E", "#8B6914")}
  {wheel(88, 100, 11, "#8B6914", "#2C1A0E", "#8B6914")}
  {wheel(111, 100, 11, "#8B6914", "#2C1A0E", "#8B6914")}
  {wheel(134, 100, 11, "#8B6914", "#2C1A0E", "#8B6914")}
  <!-- coupling rod -->
  <rect x="65" y="98" width="69" height="4" rx="2" fill="#8B6914" opacity="0.8"/>
  <!-- cab window -->
  <rect x="128" y="58" width="14" height="10" rx="2" fill="#87CEEB" opacity="0.7"/>
''', "Blenkinsop Rack · 1812")

# 2. catch-me-who-can (1808) - VERTICAL boiler, 0-2-0, Trevithick
SVGS["catch-me-who-can"] = svg_wrap(f'''
  <!-- vertical boiler - tall cylinder, key feature -->
  <rect x="75" y="30" width="36" height="58" rx="10" fill="#6B3A2A"/>
  <ellipse cx="93" cy="30" rx="18" ry="8" fill="#5a2e1e"/>
  <!-- chimney from top -->
  <rect x="88" y="10" width="10" height="22" rx="3" fill="#333"/>
  <rect x="84" y="7" width="18" height="7" rx="3" fill="#222"/>
  <!-- smoke -->
  <circle cx="93" cy="5" r="5" fill="#bbb" opacity="0.45"/>
  <!-- only 2 drive wheels, large -->
  {wheel(78, 100, 12, "#c87820", "#2a1800", "#c87820")}
  {wheel(108, 100, 12, "#c87820", "#2a1800", "#c87820")}
  <!-- elliptical track hint -->
  <ellipse cx="93" cy="115" rx="60" ry="6" fill="none" stroke="#888" stroke-width="2.5" stroke-dasharray="4,4"/>
  <!-- firebox -->
  <rect x="80" y="76" width="26" height="14" rx="3" fill="#8B4513"/>
  <!-- frame -->
  <rect x="60" y="88" width="66" height="6" rx="2" fill="#5C2A00"/>
''', "Catch Me Who Can · 1808")

# 3. planet-class (1830, UK) - inside cylinders, 2-2-0, green/black, tender
SVGS["planet-class"] = svg_wrap(f'''
  <!-- tender car right -->
  <rect x="145" y="58" width="45" height="35" rx="4" fill="#2a2a2a"/>
  <rect x="148" y="62" width="20" height="12" rx="2" fill="#555" opacity="0.6"/>
  {wheel(158, 103, 8, "#777", "#111", "#777")}
  {wheel(178, 103, 8, "#777", "#111", "#777")}
  <!-- coupling -->
  <rect x="138" y="70" width="10" height="4" rx="1" fill="#888"/>
  <!-- loco body green -->
  <rect x="45" y="52" width="95" height="38" rx="6" fill="#1a5c1a"/>
  <!-- boiler barrel -->
  <rect x="50" y="58" width="70" height="24" rx="8" fill="#1d6b1d"/>
  <!-- inside cylinder hint - visible box under boiler -->
  <rect x="60" y="78" width="30" height="10" rx="2" fill="#0f3d0f"/>
  <!-- 2 small pony, 2 large driver -->
  {wheel(52, 103, 7, "#c8a800", "#111", "#c8a800")}
  {wheel(70, 103, 7, "#c8a800", "#111", "#c8a800")}
  {wheel(100, 103, 12, "#c8a800", "#111", "#c8a800")}
  {wheel(127, 103, 12, "#c8a800", "#111", "#c8a800")}
  <!-- chimney copper cap -->
  <rect x="63" y="28" width="13" height="26" rx="3" fill="#1a1a1a"/>
  <rect x="59" y="24" width="21" height="7" rx="3" fill="#b87333"/>
  <!-- dome -->
  <ellipse cx="105" cy="55" rx="14" ry="8" fill="#115011"/>
  <!-- cab -->
  <rect x="125" y="52" width="22" height="38" rx="3" fill="#0f3d0f"/>
  <rect x="128" y="56" width="14" height="12" rx="2" fill="#87CEEB" opacity="0.6"/>
''', "Planet Class · 1830")

# 4. stourbridge-lion (1829, USA) - horizontal boiler BLUE with lion face, 0-4-0
SVGS["stourbridge-lion"] = svg_wrap(f'''
  <!-- main boiler horizontal BLUE -->
  <rect x="35" y="50" width="100" height="36" rx="10" fill="#1a3a8c"/>
  <!-- lion face on front (right side) -->
  <circle cx="130" cy="68" r="18" fill="#c8a020"/>
  <!-- lion eyes -->
  <circle cx="125" cy="64" r="3" fill="#1a1a1a"/>
  <circle cx="135" cy="64" r="3" fill="#1a1a1a"/>
  <!-- lion nose/mouth -->
  <ellipse cx="130" cy="72" rx="5" ry="3" fill="#8B4513"/>
  <path d="M125,73 Q130,78 135,73" stroke="#1a1a1a" stroke-width="1.5" fill="none"/>
  <!-- lion mane -->
  <circle cx="130" cy="68" r="20" fill="none" stroke="#c87820" stroke-width="4" opacity="0.6"/>
  <!-- chimney -->
  <rect x="50" y="20" width="15" height="32" rx="4" fill="#1a1a1a"/>
  <rect x="46" y="16" width="23" height="8" rx="3" fill="#444"/>
  <!-- smoke -->
  <circle cx="57" cy="11" r="5" fill="#bbb" opacity="0.4"/>
  <!-- 4 wheels 0-4-0 -->
  {wheel(58, 100, 11, "#c8a020", "#0d1e5c", "#c8a020")}
  {wheel(82, 100, 11, "#c8a020", "#0d1e5c", "#c8a020")}
  {wheel(106, 100, 11, "#c8a020", "#0d1e5c", "#c8a020")}
  <!-- coupling rod -->
  <rect x="58" y="98" width="48" height="4" rx="2" fill="#c8a020" opacity="0.8"/>
  <!-- frame -->
  <rect x="35" y="84" width="100" height="6" rx="2" fill="#0d1e5c"/>
  {rail(25, 175)}
''', "Stourbridge Lion · 1829")

# 5. tom-thumb (1830, USA) - tiny VERTICAL boiler, 0-2-2, very compact
SVGS["tom-thumb"] = svg_wrap(f'''
  <!-- very compact, tiny vertical boiler -->
  <rect x="72" y="40" width="30" height="45" rx="8" fill="#5C3A1E"/>
  <ellipse cx="87" cy="40" rx="15" ry="6" fill="#3a2010"/>
  <!-- thin chimney tall -->
  <rect x="83" y="12" width="8" height="30" rx="3" fill="#222"/>
  <rect x="79" y="9" width="16" height="6" rx="2" fill="#333"/>
  <!-- smoke small -->
  <circle cx="87" cy="7" r="4" fill="#ccc" opacity="0.4"/>
  <!-- water pump visible on side -->
  <rect x="65" y="55" width="10" height="18" rx="3" fill="#7B5030"/>
  <rect x="61" y="60" width="8" height="8" rx="2" fill="#5a3a1a"/>
  <!-- very compact frame -->
  <rect x="55" y="80" width="68" height="8" rx="3" fill="#3a2010"/>
  <!-- 2 small drive wheels + 2 small trailing -->
  {wheel(70, 102, 9, "#c87820", "#2a1800", "#c87820")}
  {wheel(92, 102, 9, "#c87820", "#2a1800", "#c87820")}
  {wheel(114, 102, 7, "#996010", "#1a1000", "#996010")}
  {wheel(130, 102, 7, "#996010", "#1a1000", "#996010")}
  {rail(45, 160)}
''', "Tom Thumb · 1830")

# 6. dewitt-clinton (1831, USA) - tall funnel chimney, 2-2-0, coach carriages
SVGS["dewitt-clinton"] = svg_wrap(f'''
  <!-- coach carriage trailing - stagecoach style -->
  <rect x="130" y="62" width="55" height="32" rx="5" fill="#8B4513"/>
  <rect x="134" y="66" width="14" height="12" rx="2" fill="#87CEEB" opacity="0.6"/>
  <rect x="153" y="66" width="14" height="12" rx="2" fill="#87CEEB" opacity="0.6"/>
  {wheel(142, 105, 8, "#c8a820", "#3a1a00", "#c8a820")}
  {wheel(170, 105, 8, "#c8a820", "#3a1a00", "#c8a820")}
  <!-- coupling between loco and coach -->
  <rect x="120" y="72" width="15" height="4" rx="1" fill="#666"/>
  <!-- loco body black -->
  <rect x="30" y="58" width="95" height="36" rx="5" fill="#1a1a1a"/>
  <!-- boiler barrel -->
  <rect x="35" y="63" width="65" height="24" rx="7" fill="#2a2a2a"/>
  <!-- very tall funnel chimney - key feature -->
  <rect x="48" y="18" width="12" height="42" rx="3" fill="#111"/>
  <!-- flared top - very prominent -->
  <path d="M42,20 Q44,14 54,12 Q64,14 66,20 Z" fill="#111"/>
  <rect x="42" y="12" width="24" height="8" rx="3" fill="#222"/>
  <!-- smoke puffs -->
  <circle cx="54" cy="8" r="5" fill="#ddd" opacity="0.5"/>
  <circle cx="62" cy="6" r="4" fill="#ddd" opacity="0.35"/>
  <!-- 2 small pony + 2 drive wheels, 2-2-0 -->
  {wheel(50, 105, 7, "#888", "#111", "#888")}
  {wheel(68, 105, 7, "#888", "#111", "#888")}
  {wheel(95, 105, 11, "#888", "#111", "#888")}
  {wheel(118, 105, 11, "#888", "#111", "#888")}
  <!-- cab area -->
  <rect x="98" y="58" width="28" height="36" rx="3" fill="#2a2a2a"/>
  {rail(20, 190)}
''', "DeWitt Clinton · 1831")

# 7. best-friend-charleston (1830, USA) - barrel-shaped VERTICAL boiler (fat cylinder), 0-4-0
SVGS["best-friend-charleston"] = svg_wrap(f'''
  <!-- fat barrel vertical boiler - very round, key feature -->
  <ellipse cx="85" cy="68" rx="30" ry="32" fill="#5a1a00"/>
  <!-- boiler bands -->
  <ellipse cx="85" cy="55" rx="30" ry="5" fill="none" stroke="#3a1000" stroke-width="2"/>
  <ellipse cx="85" cy="70" rx="30" ry="5" fill="none" stroke="#3a1000" stroke-width="2"/>
  <ellipse cx="85" cy="82" rx="29" ry="4" fill="none" stroke="#3a1000" stroke-width="2"/>
  <!-- firebox at base -->
  <rect x="68" y="88" width="34" height="12" rx="3" fill="#8B2500"/>
  <!-- thin chimney from center top -->
  <rect x="81" y="16" width="8" height="24" rx="2" fill="#222"/>
  <rect x="77" y="13" width="16" height="7" rx="3" fill="#333"/>
  <!-- smoke -->
  <circle cx="85" cy="10" r="4" fill="#ccc" opacity="0.4"/>
  <!-- frame -->
  <rect x="35" y="94" width="110" height="7" rx="3" fill="#3a1000"/>
  <!-- 4 wheels 0-4-0 - all same size -->
  {wheel(52, 108, 10, "#c87820", "#2a0e00", "#c87820")}
  {wheel(75, 108, 10, "#c87820", "#2a0e00", "#c87820")}
  {wheel(98, 108, 10, "#c87820", "#2a0e00", "#c87820")}
  {wheel(121, 108, 10, "#c87820", "#2a0e00", "#c87820")}
  <!-- coupling rod -->
  <rect x="52" y="106" width="69" height="4" rx="2" fill="#c87820" opacity="0.8"/>
  {rail(30, 170)}
''', "Best Friend Charleston · 1830")

# ============================================================
# AMERICAN STEAM 1860-1940
# ============================================================

# 8. mogul-2-6-0 - 1 small pony + 3 large drivers
SVGS["mogul-2-6-0"] = svg_wrap(f'''
  <!-- boiler -->
  <rect x="30" y="52" width="115" height="34" rx="8" fill="#1a1a1a"/>
  <rect x="35" y="58" width="80" height="22" rx="7" fill="#2a2a2a"/>
  <!-- cab -->
  <rect x="130" y="44" width="38" height="42" rx="4" fill="#1a1a1a"/>
  <rect x="133" y="48" width="16" height="14" rx="2" fill="#87CEEB" opacity="0.6"/>
  <!-- chimney -->
  <rect x="42" y="22" width="14" height="32" rx="4" fill="#111"/>
  <rect x="38" y="18" width="22" height="8" rx="3" fill="#333"/>
  <!-- smoke box -->
  <circle cx="37" cy="66" r="15" fill="#111"/>
  <!-- dome + sandbox -->
  <ellipse cx="95" cy="54" rx="14" ry="9" fill="#1a1a1a"/>
  <ellipse cx="115" cy="57" rx="10" ry="7" fill="#1a1a1a"/>
  <!-- 1 small pony + 3 large drivers, 2-6-0 -->
  {wheel(48, 103, 7, "#777", "#111", "#777")}
  {wheel(75, 103, 12, "#777", "#111", "#777")}
  {wheel(100, 103, 12, "#777", "#111", "#777")}
  {wheel(125, 103, 12, "#777", "#111", "#777")}
  <!-- coupling rod on drivers -->
  <rect x="75" y="101" width="50" height="4" rx="2" fill="#666" opacity="0.8"/>
  <!-- steam pipes -->
  <line x1="50" y2="65" x1="50" x2="75" y2="65" stroke="#555" stroke-width="3"/>
  {rail(20, 185)}
''', "Mogul 2-6-0 · 1860")

# 9. consolidation-2-8-0 - 1 small + 4 large drivers, boxy cab
SVGS["consolidation-2-8-0"] = svg_wrap(f'''
  <rect x="20" y="52" width="140" height="34" rx="7" fill="#111"/>
  <rect x="25" y="58" width="95" height="22" rx="7" fill="#1e1e1e"/>
  <!-- boxy cab -->
  <rect x="148" y="44" width="35" height="42" rx="3" fill="#111"/>
  <rect x="151" y="48" width="14" height="14" rx="2" fill="#87CEEB" opacity="0.6"/>
  <!-- chimney straight -->
  <rect x="32" y="18" width="14" height="36" rx="3" fill="#0d0d0d"/>
  <rect x="28" y="14" width="22" height="8" rx="2" fill="#222"/>
  <!-- smokebox -->
  <circle cx="26" cy="67" r="16" fill="#0d0d0d"/>
  <!-- dome -->
  <ellipse cx="105" cy="54" rx="14" ry="9" fill="#0d0d0d"/>
  <!-- 1 small pony + 4 large drivers, 2-8-0 -->
  {wheel(38, 102, 7, "#666", "#111", "#666")}
  {wheel(65, 102, 12, "#666", "#111", "#666")}
  {wheel(88, 102, 12, "#666", "#111", "#666")}
  {wheel(111, 102, 12, "#666", "#111", "#666")}
  {wheel(134, 102, 12, "#666", "#111", "#666")}
  <!-- coupling rod -->
  <rect x="65" y="100" width="69" height="4" rx="2" fill="#555" opacity="0.8"/>
  {rail(10, 190)}
''', "Consolidation 2-8-0 · 1866")

# 10. ten-wheeler-4-6-0 - 2 small + 3 large drivers, slender
SVGS["ten-wheeler-4-6-0"] = svg_wrap(f'''
  <!-- slender boiler -->
  <rect x="20" y="55" width="135" height="30" rx="8" fill="#111"/>
  <rect x="28" y="60" width="90" height="20" rx="7" fill="#1e1e1e"/>
  <!-- cab -->
  <rect x="140" y="47" width="38" height="38" rx="4" fill="#111"/>
  <rect x="143" y="51" width="15" height="13" rx="2" fill="#87CEEB" opacity="0.6"/>
  <!-- slender chimney -->
  <rect x="35" y="20" width="12" height="37" rx="4" fill="#0d0d0d"/>
  <rect x="31" y="16" width="20" height="7" rx="3" fill="#333"/>
  <!-- smokebox round -->
  <circle cx="24" cy="68" r="15" fill="#0d0d0d"/>
  <!-- dome -->
  <ellipse cx="100" cy="57" rx="13" ry="8" fill="#0d0d0d"/>
  <!-- 2 small pony + 3 large, 4-6-0 -->
  {wheel(34, 101, 7, "#777", "#111", "#777")}
  {wheel(54, 101, 7, "#777", "#111", "#777")}
  {wheel(80, 101, 12, "#777", "#111", "#777")}
  {wheel(103, 101, 12, "#777", "#111", "#777")}
  {wheel(126, 101, 12, "#777", "#111", "#777")}
  <!-- coupling rod -->
  <rect x="80" y="99" width="46" height="4" rx="2" fill="#555" opacity="0.8"/>
  {rail(10, 190)}
''', "Ten-Wheeler 4-6-0 · 1870")

# 11. mikado-2-8-2 - 1 small + 4 large + 1 small trailing
SVGS["mikado-2-8-2"] = svg_wrap(f'''
  <rect x="18" y="52" width="148" height="34" rx="7" fill="#111"/>
  <rect x="24" y="58" width="100" height="22" rx="7" fill="#1e1e1e"/>
  <rect x="152" y="44" width="36" height="42" rx="4" fill="#0d0d0d"/>
  <rect x="155" y="48" width="14" height="14" rx="2" fill="#87CEEB" opacity="0.6"/>
  <rect x="30" y="18" width="13" height="36" rx="3" fill="#0d0d0d"/>
  <rect x="26" y="14" width="21" height="8" rx="2" fill="#222"/>
  <circle cx="22" cy="67" r="16" fill="#0d0d0d"/>
  <ellipse cx="110" cy="54" rx="13" ry="9" fill="#0d0d0d"/>
  <!-- 1 pony + 4 drivers + 1 trailing = 2-8-2 -->
  {wheel(36, 101, 7, "#666", "#111", "#666")}
  {wheel(62, 101, 12, "#666", "#111", "#666")}
  {wheel(84, 101, 12, "#666", "#111", "#666")}
  {wheel(106, 101, 12, "#666", "#111", "#666")}
  {wheel(128, 101, 12, "#666", "#111", "#666")}
  {wheel(155, 101, 8, "#666", "#111", "#666")}
  <rect x="62" y="99" width="66" height="4" rx="2" fill="#555" opacity="0.8"/>
  {rail(10, 192)}
''', "Mikado 2-8-2 · 1897")

# 12. atlantic-4-4-2 - 2 small + 2 large + 1 trailing, elegant long
SVGS["atlantic-4-4-2"] = svg_wrap(f'''
  <!-- elegant long boiler -->
  <rect x="18" y="54" width="145" height="30" rx="10" fill="#111"/>
  <rect x="26" y="60" width="100" height="19" rx="8" fill="#1a1a1a"/>
  <!-- slender elegant chimney -->
  <rect x="30" y="20" width="11" height="36" rx="4" fill="#0d0d0d"/>
  <rect x="26" y="16" width="19" height="7" rx="3" fill="#333"/>
  <circle cx="22" cy="67" r="14" fill="#0d0d0d"/>
  <ellipse cx="105" cy="56" rx="12" ry="8" fill="#0d0d0d"/>
  <rect x="148" y="47" width="35" height="37" rx="4" fill="#0d0d0d"/>
  <rect x="151" y="51" width="13" height="13" rx="2" fill="#87CEEB" opacity="0.6"/>
  <!-- 2+2+1 = 4-4-2 -->
  {wheel(36, 100, 7, "#888", "#111", "#888")}
  {wheel(55, 100, 7, "#888", "#111", "#888")}
  {wheel(82, 100, 13, "#888", "#111", "#888")}
  {wheel(108, 100, 13, "#888", "#111", "#888")}
  {wheel(150, 100, 9, "#888", "#111", "#888")}
  <rect x="82" y="98" width="26" height="4" rx="2" fill="#555" opacity="0.8"/>
  {rail(10, 192)}
''', "Atlantic 4-4-2 · 1900")

# 13. berkshire-2-8-4 - 1 small + 4 large + 2 trailing, LARGE firebox/boiler
SVGS["berkshire-2-8-4"] = svg_wrap(f'''
  <!-- LARGE boiler, wide firebox rear -->
  <rect x="14" y="48" width="155" height="40" rx="8" fill="#111"/>
  <rect x="20" y="55" width="100" height="26" rx="8" fill="#1e1e1e"/>
  <!-- wide firebox -->
  <rect x="120" y="44" width="50" height="44" rx="5" fill="#0d0d0d"/>
  <!-- cab on top of firebox -->
  <rect x="155" y="36" width="36" height="52" rx="4" fill="#0d0d0d"/>
  <rect x="158" y="40" width="14" height="15" rx="2" fill="#87CEEB" opacity="0.6"/>
  <rect x="26" y="14" width="14" height="36" rx="3" fill="#0d0d0d"/>
  <rect x="22" y="10" width="22" height="8" rx="2" fill="#333"/>
  <circle cx="18" cy="65" r="17" fill="#0d0d0d"/>
  <ellipse cx="100" cy="50" rx="14" ry="10" fill="#0d0d0d"/>
  <!-- 1 pony + 4 drivers + 2 trailing -->
  {wheel(32, 101, 7, "#666", "#111", "#666")}
  {wheel(55, 101, 12, "#666", "#111", "#666")}
  {wheel(76, 101, 12, "#666", "#111", "#666")}
  {wheel(97, 101, 12, "#666", "#111", "#666")}
  {wheel(118, 101, 12, "#666", "#111", "#666")}
  {wheel(144, 101, 9, "#666", "#111", "#666")}
  {wheel(163, 101, 9, "#666", "#111", "#666")}
  <rect x="55" y="99" width="63" height="4" rx="2" fill="#555" opacity="0.8"/>
  {rail(8, 195)}
''', "Berkshire 2-8-4 · 1925")

# 14. hudson-4-6-4 - STREAMLINED silver/gray shroud, NYC colors
SVGS["hudson-4-6-4"] = svg_wrap(f'''
  <!-- streamlined shroud silver -->
  <path d="M15,68 Q25,38 45,34 L170,34 L175,68 L170,102 L45,102 Q25,98 15,68 Z" fill="#C0C0C0"/>
  <path d="M15,68 Q22,50 45,46 L45,90 Q22,86 15,68 Z" fill="#999" opacity="0.5"/>
  <!-- NYC stripe -->
  <rect x="45" y="62" width="130" height="12" fill="#1a1a1a" opacity="0.5"/>
  <!-- windows -->
  <rect x="140" y="40" width="16" height="14" rx="2" fill="#87CEEB" opacity="0.7"/>
  <!-- headlight -->
  <circle cx="18" cy="68" r="7" fill="#FFE040" opacity="0.9"/>
  <!-- 2+3+2 = 4-6-4 -->
  {wheel(38, 108, 8, "#aaa", "#888", "#aaa")}
  {wheel(57, 108, 8, "#aaa", "#888", "#aaa")}
  {wheel(80, 108, 12, "#aaa", "#888", "#aaa")}
  {wheel(103, 108, 12, "#aaa", "#888", "#aaa")}
  {wheel(126, 108, 12, "#aaa", "#888", "#aaa")}
  {wheel(152, 108, 9, "#aaa", "#888", "#aaa")}
  {wheel(170, 108, 9, "#aaa", "#888", "#aaa")}
  <rect x="80" y="106" width="46" height="4" rx="2" fill="#888" opacity="0.8"/>
  {rail(10, 195)}
''', "Hudson 4-6-4 · 1927")

# 15. texas-2-10-4 - 1 small + 5 HUGE drivers + 2 trailing, MASSIVE wide firebox
SVGS["texas-2-10-4"] = svg_wrap(f'''
  <!-- massive boiler -->
  <rect x="10" y="48" width="165" height="42" rx="8" fill="#111"/>
  <rect x="16" y="54" width="110" height="28" rx="8" fill="#1a1a1a"/>
  <!-- WIDE firebox rear -->
  <rect x="118" y="40" width="58" height="50" rx="5" fill="#0d0d0d"/>
  <rect x="162" y="32" width="28" height="58" rx="4" fill="#0d0d0d"/>
  <rect x="165" y="36" width="12" height="15" rx="2" fill="#87CEEB" opacity="0.6"/>
  <rect x="22" y="12" width="15" height="38" rx="3" fill="#0d0d0d"/>
  <rect x="18" y="8" width="23" height="9" rx="2" fill="#333"/>
  <circle cx="14" cy="67" r="17" fill="#0d0d0d"/>
  <ellipse cx="92" cy="50" rx="13" ry="9" fill="#0d0d0d"/>
  <!-- 1 pony + 5 huge drivers + 2 trailing -->
  {wheel(28, 103, 7, "#666", "#111", "#666")}
  {wheel(50, 103, 13, "#666", "#111", "#666")}
  {wheel(70, 103, 13, "#666", "#111", "#666")}
  {wheel(90, 103, 13, "#666", "#111", "#666")}
  {wheel(110, 103, 13, "#666", "#111", "#666")}
  {wheel(130, 103, 13, "#666", "#111", "#666")}
  {wheel(154, 103, 9, "#666", "#111", "#666")}
  {wheel(173, 103, 9, "#666", "#111", "#666")}
  <rect x="50" y="101" width="80" height="4" rx="2" fill="#555" opacity="0.8"/>
  {rail(5, 198)}
''', "Texas 2-10-4 · 1925")

# 16. challenger-4-6-6-4 - UP gray/yellow, articulated joint visible
SVGS["challenger-4-6-6-4"] = svg_wrap(f'''
  <!-- UP gray body -->
  <rect x="8" y="50" width="180" height="40" rx="8" fill="#7a7a7a"/>
  <!-- articulation joint - key feature, slight S curve in body -->
  <line x1="96" y1="48" x2="96" y2="94" stroke="#555" stroke-width="3" stroke-dasharray="3,2"/>
  <rect x="93" y="50" width="6" height="40" fill="#666"/>
  <!-- front unit boiler -->
  <rect x="14" y="55" width="80" height="28" rx="7" fill="#898989"/>
  <!-- rear unit boiler -->
  <rect x="100" y="55" width="78" height="28" rx="7" fill="#898989"/>
  <!-- cab -->
  <rect x="166" y="42" width="32" height="48" rx="4" fill="#6a6a6a"/>
  <rect x="169" y="46" width="13" height="14" rx="2" fill="#87CEEB" opacity="0.6"/>
  <!-- chimney front -->
  <rect x="22" y="16" width="14" height="36" rx="4" fill="#555"/>
  <rect x="18" y="12" width="22" height="8" rx="2" fill="#666"/>
  <!-- yellow UP stripe -->
  <rect x="8" y="62" width="180" height="8" fill="#FFD700" opacity="0.8"/>
  <!-- smokebox -->
  <circle cx="12" cy="68" r="16" fill="#555"/>
  <!-- 2+3+3+2 = 4-6-6-4 -->
  {wheel(22, 103, 8, "#FFD700", "#555", "#FFD700")}
  {wheel(42, 103, 8, "#FFD700", "#555", "#FFD700")}
  {wheel(62, 103, 12, "#FFD700", "#555", "#FFD700")}
  {wheel(80, 103, 12, "#FFD700", "#555", "#FFD700")}
  {wheel(98, 103, 12, "#FFD700", "#555", "#FFD700")}
  {wheel(116, 103, 12, "#FFD700", "#555", "#FFD700")}
  {wheel(134, 103, 12, "#FFD700", "#555", "#FFD700")}
  {wheel(152, 103, 12, "#FFD700", "#555", "#FFD700")}
  {wheel(170, 103, 8, "#FFD700", "#555", "#FFD700")}
  {wheel(185, 103, 8, "#FFD700", "#555", "#FFD700")}
  {rail(5, 198)}
''', "Challenger 4-6-6-4 · 1936")

# 17. hiawatha-class-a - Art Deco teardrop, 4-4-2, orange/gray
SVGS["hiawatha-class-a"] = svg_wrap(f'''
  <!-- ART DECO teardrop streamlined nose -->
  <path d="M12,68 C12,40 30,30 55,28 L175,28 L175,108 L55,108 C30,106 12,96 12,68 Z" fill="#C0C0C0"/>
  <!-- orange band -->
  <rect x="55" y="58" width="120" height="20" fill="#FF6600"/>
  <path d="M12,68 C12,58 28,52 55,58 L55,78 C28,84 12,78 12,68 Z" fill="#FF6600"/>
  <!-- black top stripe -->
  <rect x="55" y="28" width="120" height="15" fill="#1a1a1a"/>
  <path d="M30,28 C20,30 14,40 12,55 L12,48 C16,34 26,28 40,26 Z" fill="#1a1a1a"/>
  <!-- cab windows -->
  <rect x="148" y="34" width="16" height="14" rx="2" fill="#87CEEB" opacity="0.7"/>
  <!-- headlight round -->
  <circle cx="16" cy="68" r="8" fill="#FFE040" opacity="0.9"/>
  <!-- 2+2+1 = 4-4-2 -->
  {wheel(48, 112, 8, "#CC5500", "#888", "#CC5500")}
  {wheel(67, 112, 8, "#CC5500", "#888", "#CC5500")}
  {wheel(95, 112, 13, "#CC5500", "#888", "#CC5500")}
  {wheel(120, 112, 13, "#CC5500", "#888", "#CC5500")}
  {wheel(152, 112, 9, "#CC5500", "#888", "#CC5500")}
  <rect x="95" y="110" width="25" height="4" rx="2" fill="#CC5500" opacity="0.8"/>
  {rail(10, 195)}
''', "Hiawatha Class A · 1935")

# 18. prr-k4s-pacific - 2+3+1, Tuscan RED, Belpaire firebox
SVGS["prr-k4s-pacific"] = svg_wrap(f'''
  <!-- Tuscan red body -->
  <rect x="18" y="50" width="148" height="36" rx="7" fill="#8B0000"/>
  <rect x="24" y="56" width="100" height="24" rx="7" fill="#9B1010"/>
  <!-- Belpaire firebox - trapezoidal top, key feature -->
  <polygon points="118,44 168,44 172,50 114,50" fill="#6a0000"/>
  <rect x="118" y="44" width="54" height="42" rx="0" fill="#700000"/>
  <!-- cab -->
  <rect x="158" y="38" width="32" height="48" rx="3" fill="#6a0000"/>
  <rect x="161" y="42" width="13" height="14" rx="2" fill="#87CEEB" opacity="0.6"/>
  <rect x="28" y="16" width="13" height="36" rx="3" fill="#4a0000"/>
  <rect x="24" y="12" width="21" height="8" rx="2" fill="#600000"/>
  <circle cx="22" cy="66" r="16" fill="#4a0000"/>
  <ellipse cx="108" cy="52" rx="13" ry="9" fill="#6a0000"/>
  <!-- PRR keystone on cab -->
  <polygon points="170,46 176,50 176,62 170,66 164,62 164,50" fill="#FFD700" opacity="0.8"/>
  <!-- 2+3+1 = 4-6-2 -->
  {wheel(34, 101, 8, "#FFD700", "#4a0000", "#FFD700")}
  {wheel(54, 101, 8, "#FFD700", "#4a0000", "#FFD700")}
  {wheel(80, 101, 13, "#FFD700", "#4a0000", "#FFD700")}
  {wheel(103, 101, 13, "#FFD700", "#4a0000", "#FFD700")}
  {wheel(126, 101, 13, "#FFD700", "#4a0000", "#FFD700")}
  {wheel(158, 101, 9, "#FFD700", "#4a0000", "#FFD700")}
  <rect x="80" y="99" width="46" height="4" rx="2" fill="#c8a800" opacity="0.8"/>
  {rail(10, 195)}
''', "PRR K4s Pacific · 1914")

# 19. 20th-century-limited - fully streamlined gray aluminum, 4-6-4
SVGS["20th-century-limited"] = svg_wrap(f'''
  <!-- full aluminum shroud streamlined -->
  <path d="M12,68 Q22,36 50,32 L178,32 L182,68 L178,104 L50,104 Q22,100 12,68 Z" fill="#D8D8D8"/>
  <!-- NYC gray stripe -->
  <path d="M50,52 L178,52 L178,84 L50,84 Q30,80 18,68 Q30,56 50,52 Z" fill="#A8A8A8"/>
  <!-- black nose accent -->
  <path d="M12,68 Q18,52 34,48 L34,88 Q18,84 12,68 Z" fill="#111" opacity="0.5"/>
  <!-- cab window -->
  <rect x="148" y="38" width="18" height="15" rx="2" fill="#87CEEB" opacity="0.7"/>
  <!-- Century lettering band -->
  <rect x="50" y="62" width="128" height="12" fill="#888" opacity="0.4"/>
  <!-- headlight -->
  <circle cx="15" cy="68" r="8" fill="#FFE040" opacity="0.9"/>
  <!-- 4-6-4 -->
  {wheel(44, 108, 8, "#C0C0C0", "#888", "#C0C0C0")}
  {wheel(62, 108, 8, "#C0C0C0", "#888", "#C0C0C0")}
  {wheel(86, 108, 13, "#C0C0C0", "#888", "#C0C0C0")}
  {wheel(109, 108, 13, "#C0C0C0", "#888", "#C0C0C0")}
  {wheel(132, 108, 13, "#C0C0C0", "#888", "#C0C0C0")}
  {wheel(158, 108, 9, "#C0C0C0", "#888", "#C0C0C0")}
  {wheel(175, 108, 9, "#C0C0C0", "#888", "#C0C0C0")}
  {rail(10, 196)}
''', "20th Century Limited · 1938")

# 20. broadway-limited - streamlined Tuscan red, T1 style
SVGS["broadway-limited"] = svg_wrap(f'''
  <path d="M14,68 Q28,36 52,32 L176,32 L180,68 L176,104 L52,104 Q28,100 14,68 Z" fill="#8B0000"/>
  <!-- gold stripe -->
  <path d="M52,56 L176,56 L176,80 L52,80 Q34,76 18,68 Q34,60 52,56 Z" fill="#C09000"/>
  <!-- dark maroon shroud sides -->
  <path d="M14,68 Q24,52 42,50 L42,86 Q24,84 14,68 Z" fill="#600000" opacity="0.7"/>
  <rect x="148" y="38" width="18" height="15" rx="2" fill="#87CEEB" opacity="0.7"/>
  <circle cx="16" cy="68" r="8" fill="#FFE040" opacity="0.9"/>
  <!-- 4-6-4 -->
  {wheel(46, 108, 8, "#C09000", "#600000", "#C09000")}
  {wheel(64, 108, 8, "#C09000", "#600000", "#C09000")}
  {wheel(88, 108, 13, "#C09000", "#600000", "#C09000")}
  {wheel(111, 108, 13, "#C09000", "#600000", "#C09000")}
  {wheel(134, 108, 13, "#C09000", "#600000", "#C09000")}
  {wheel(160, 108, 9, "#C09000", "#600000", "#C09000")}
  {wheel(177, 108, 9, "#C09000", "#600000", "#C09000")}
  {rail(10, 195)}
''', "Broadway Limited · 1938")

# 21. california-zephyr - VISTA-DOME stainless steel, diesel + dome car
SVGS["california-zephyr"] = svg_wrap(f'''
  <!-- diesel loco front -->
  <rect x="8" y="48" width="65" height="55" rx="5" fill="#C8C8C8"/>
  <path d="M8,75 Q8,48 20,46 L73,46 L73,103 L8,103 Z" fill="#DCDCDC"/>
  <!-- diesel nose stripes -->
  <rect x="8" y="72" width="65" height="8" fill="#CC0000"/>
  <!-- diesel windows -->
  <rect x="14" y="52" width="20" height="14" rx="2" fill="#87CEEB" opacity="0.7"/>
  <!-- stainless passenger cars -->
  <rect x="76" y="52" width="55" height="51" rx="3" fill="#C8C8C8"/>
  <rect x="134" y="52" width="55" height="51" rx="3" fill="#C8C8C8"/>
  <!-- VISTA-DOME car - raised dome, key feature -->
  <rect x="76" y="38" width="50" height="20" rx="4" fill="#D8D8D8"/>
  <rect x="80" y="34" width="42" height="10" rx="3" fill="#e8e8e8"/>
  <!-- dome windows -->
  <rect x="82" y="36" width="8" height="6" rx="1" fill="#87CEEB" opacity="0.8"/>
  <rect x="94" y="36" width="8" height="6" rx="1" fill="#87CEEB" opacity="0.8"/>
  <rect x="106" y="36" width="8" height="6" rx="1" fill="#87CEEB" opacity="0.8"/>
  <!-- car windows -->
  <rect x="80" y="60" width="10" height="8" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="95" y="60" width="10" height="8" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="110" y="60" width="10" height="8" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="138" y="60" width="10" height="8" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="153" y="60" width="10" height="8" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="168" y="60" width="10" height="8" rx="1" fill="#87CEEB" opacity="0.6"/>
  <!-- silver stripe -->
  <rect x="76" y="72" width="113" height="6" fill="#999"/>
  <!-- bogies -->
  {wheel(24, 111, 7, "#888", "#aaa", "#888")}
  {wheel(48, 111, 7, "#888", "#aaa", "#888")}
  {wheel(90, 111, 7, "#aaa", "#bbb", "#aaa")}
  {wheel(110, 111, 7, "#aaa", "#bbb", "#aaa")}
  {wheel(148, 111, 7, "#aaa", "#bbb", "#aaa")}
  {wheel(168, 111, 7, "#aaa", "#bbb", "#aaa")}
  {rail(5, 198)}
''', "California Zephyr · 1949")

# 22. orient-express - dark BLUE Wagon-Lits + GOLD trim, steam front
SVGS["orient-express"] = svg_wrap(f'''
  <!-- steam loco front compact -->
  <rect x="8" y="55" width="60" height="38" rx="6" fill="#1a1a1a"/>
  <rect x="12" y="60" width="40" height="26" rx="6" fill="#2a2a2a"/>
  <rect x="16" y="26" width="11" height="31" rx="3" fill="#111"/>
  <rect x="13" y="22" width="17" height="7" rx="3" fill="#333"/>
  <circle cx="12" cy="72" r="14" fill="#111"/>
  <!-- Wagon-Lits dark blue carriages with gold -->
  <rect x="70" y="46" width="65" height="47" rx="4" fill="#00205B"/>
  <rect x="138" y="46" width="55" height="47" rx="4" fill="#00205B"/>
  <!-- gold letterboard stripe -->
  <rect x="70" y="52" width="65" height="8" fill="#C8A800"/>
  <rect x="138" y="52" width="55" height="8" fill="#C8A800"/>
  <!-- gold lower stripe -->
  <rect x="70" y="82" width="65" height="5" fill="#C8A800"/>
  <rect x="138" y="82" width="55" height="5" fill="#C8A800"/>
  <!-- car windows -->
  <rect x="74" y="62" width="9" height="12" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="88" y="62" width="9" height="12" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="102" y="62" width="9" height="12" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="116" y="62" width="9" height="12" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="142" y="62" width="9" height="12" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="156" y="62" width="9" height="12" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="170" y="62" width="9" height="12" rx="1" fill="#87CEEB" opacity="0.6"/>
  <!-- couplings -->
  <rect x="67" y="68" width="6" height="5" rx="1" fill="#888"/>
  <rect x="135" y="68" width="6" height="5" rx="1" fill="#888"/>
  <!-- loco wheels -->
  {wheel(22, 103, 8, "#888", "#111", "#888")}
  {wheel(42, 103, 8, "#888", "#111", "#888")}
  {wheel(60, 103, 11, "#888", "#111", "#888")}
  <!-- car bogies -->
  {wheel(84, 103, 7, "#C8A800", "#00205B", "#C8A800")}
  {wheel(110, 103, 7, "#C8A800", "#00205B", "#C8A800")}
  {wheel(148, 103, 7, "#C8A800", "#00205B", "#C8A800")}
  {wheel(172, 103, 7, "#C8A800", "#00205B", "#C8A800")}
  {rail(5, 198)}
''', "Orient Express · 1883")

print("Early steam + American steam batch: OK")

# ============================================================
# BRITISH STEAM
# ============================================================

# 23. castle-class-gwr
SVGS["castle-class-gwr"] = svg_wrap(f'''
  <rect x="18" y="52" width="148" height="34" rx="7" fill="#1B5E20"/>
  <rect x="24" y="58" width="98" height="22" rx="7" fill="#2E7D32"/>
  <rect x="30" y="18" width="13" height="36" rx="3" fill="#1a1a1a"/>
  <rect x="26" y="14" width="21" height="8" rx="3" fill="#b87333"/>
  <circle cx="22" cy="67" r="16" fill="#1B5E20"/>
  <ellipse cx="90" cy="54" rx="13" ry="9" fill="#1B5E20"/>
  <circle cx="90" cy="54" r="8" fill="#b87333"/>
  <circle cx="90" cy="54" r="5" fill="#1B5E20"/>
  <rect x="148" y="45" width="36" height="41" rx="4" fill="#1a4c1a"/>
  <rect x="151" y="49" width="14" height="14" rx="2" fill="#87CEEB" opacity="0.6"/>
  <rect x="25" y="78" width="120" height="5" fill="#CC0000"/>
  {wheel(34, 101, 8, "#b87333", "#1B5E20", "#b87333")}
  {wheel(54, 101, 8, "#b87333", "#1B5E20", "#b87333")}
  {wheel(80, 101, 13, "#b87333", "#1B5E20", "#b87333")}
  {wheel(103, 101, 13, "#b87333", "#1B5E20", "#b87333")}
  {wheel(126, 101, 13, "#b87333", "#1B5E20", "#b87333")}
  <rect x="80" y="99" width="46" height="4" rx="2" fill="#b87333" opacity="0.8"/>
  {rail(10, 195)}
''', "Castle Class GWR · 1923")

# 24. king-class-gwr
SVGS["king-class-gwr"] = svg_wrap(f'''
  <rect x="16" y="48" width="152" height="40" rx="8" fill="#1B5E20"/>
  <rect x="22" y="54" width="102" height="26" rx="8" fill="#2E7D32"/>
  <rect x="30" y="14" width="15" height="36" rx="3" fill="#1a1a1a"/>
  <rect x="26" y="10" width="23" height="8" rx="3" fill="#b87333"/>
  <circle cx="20" cy="67" r="18" fill="#1B5E20"/>
  <ellipse cx="92" cy="52" rx="15" ry="10" fill="#1B5E20"/>
  <rect x="24" y="75" width="130" height="7" fill="#CC0000"/>
  <rect x="150" y="43" width="36" height="45" rx="4" fill="#1a4c1a"/>
  <rect x="153" y="47" width="14" height="15" rx="2" fill="#87CEEB" opacity="0.6"/>
  {wheel(34, 103, 9, "#b87333", "#1B5E20", "#b87333")}
  {wheel(55, 103, 9, "#b87333", "#1B5E20", "#b87333")}
  {wheel(82, 103, 14, "#b87333", "#1B5E20", "#b87333")}
  {wheel(106, 103, 14, "#b87333", "#1B5E20", "#b87333")}
  {wheel(130, 103, 14, "#b87333", "#1B5E20", "#b87333")}
  <rect x="82" y="101" width="48" height="4" rx="2" fill="#b87333" opacity="0.8"/>
  {rail(8, 195)}
''', "King Class GWR · 1927")

# 25. gresley-a3-pacific
SVGS["gresley-a3-pacific"] = svg_wrap(f'''
  <rect x="18" y="50" width="148" height="36" rx="8" fill="#4a7c20"/>
  <rect x="24" y="56" width="100" height="24" rx="8" fill="#5a9030"/>
  <rect x="28" y="16" width="13" height="36" rx="3" fill="#1a1a1a"/>
  <rect x="24" y="12" width="21" height="8" rx="3" fill="#333"/>
  <circle cx="22" cy="67" r="16" fill="#3a6010"/>
  <ellipse cx="95" cy="52" rx="14" ry="9" fill="#3a6010"/>
  <ellipse cx="115" cy="56" rx="10" ry="7" fill="#3a6010"/>
  <rect x="22" y="78" width="110" height="6" fill="#333"/>
  <rect x="148" y="44" width="36" height="42" rx="4" fill="#3a6010"/>
  <rect x="151" y="48" width="14" height="14" rx="2" fill="#87CEEB" opacity="0.6"/>
  {wheel(34, 101, 8, "#c8c820", "#1a3000", "#c8c820")}
  {wheel(54, 101, 8, "#c8c820", "#1a3000", "#c8c820")}
  {wheel(80, 101, 13, "#c8c820", "#1a3000", "#c8c820")}
  {wheel(103, 101, 13, "#c8c820", "#1a3000", "#c8c820")}
  {wheel(126, 101, 13, "#c8c820", "#1a3000", "#c8c820")}
  {wheel(155, 101, 9, "#c8c820", "#1a3000", "#c8c820")}
  <rect x="80" y="99" width="46" height="4" rx="2" fill="#c8c820" opacity="0.7"/>
  {rail(10, 195)}
''', "Gresley A3 Pacific · 1928")

# 26. duchess-class-lms
SVGS["duchess-class-lms"] = svg_wrap(f'''
  <path d="M14,68 Q24,38 48,34 L174,34 L178,68 L174,102 L48,102 Q24,98 14,68 Z" fill="#8B1a2a"/>
  <path d="M48,50 L174,50 L174,58 L42,58 Q30,54 20,50 Z" fill="#C8A800"/>
  <path d="M48,78 L174,78 L174,86 L42,86 Q30,82 20,78 Z" fill="#C8A800"/>
  <rect x="148" y="40" width="18" height="14" rx="2" fill="#87CEEB" opacity="0.7"/>
  <circle cx="16" cy="68" r="7" fill="#FFE040" opacity="0.9"/>
  {wheel(44, 108, 8, "#C8A800", "#6a0015", "#C8A800")}
  {wheel(62, 108, 8, "#C8A800", "#6a0015", "#C8A800")}
  {wheel(86, 108, 13, "#C8A800", "#6a0015", "#C8A800")}
  {wheel(109, 108, 13, "#C8A800", "#6a0015", "#C8A800")}
  {wheel(132, 108, 13, "#C8A800", "#6a0015", "#C8A800")}
  {wheel(158, 108, 9, "#C8A800", "#6a0015", "#C8A800")}
  {rail(10, 195)}
''', "Duchess Class LMS · 1937")

# 27. britannia-class-br
SVGS["britannia-class-br"] = svg_wrap(f'''
  <rect x="18" y="50" width="148" height="36" rx="7" fill="#111"/>
  <rect x="24" y="56" width="100" height="24" rx="7" fill="#1e1e1e"/>
  <rect x="15" y="52" width="8" height="30" rx="2" fill="#1a1a1a" stroke="#555" stroke-width="1"/>
  <rect x="36" y="52" width="8" height="30" rx="2" fill="#1a1a1a" stroke="#555" stroke-width="1"/>
  <circle cx="26" cy="67" r="15" fill="#0d0d0d"/>
  <rect x="30" y="16" width="13" height="36" rx="3" fill="#0d0d0d"/>
  <rect x="26" y="12" width="21" height="8" rx="2" fill="#333"/>
  <ellipse cx="105" cy="53" rx="13" ry="9" fill="#0d0d0d"/>
  <rect x="24" y="80" width="120" height="4" fill="#CC4400"/>
  <rect x="148" y="44" width="36" height="42" rx="4" fill="#0d0d0d"/>
  <rect x="151" y="48" width="14" height="14" rx="2" fill="#87CEEB" opacity="0.6"/>
  {wheel(36, 101, 8, "#CC4400", "#111", "#CC4400")}
  {wheel(56, 101, 8, "#CC4400", "#111", "#CC4400")}
  {wheel(80, 101, 13, "#CC4400", "#111", "#CC4400")}
  {wheel(103, 101, 13, "#CC4400", "#111", "#CC4400")}
  {wheel(126, 101, 13, "#CC4400", "#111", "#CC4400")}
  {wheel(155, 101, 9, "#CC4400", "#111", "#CC4400")}
  <rect x="80" y="99" width="46" height="4" rx="2" fill="#CC4400" opacity="0.7"/>
  {rail(10, 195)}
''', "Britannia Class BR · 1951")

# ============================================================
# EUROPEAN STEAM
# ============================================================

# 29. drg-class-05 - FULLY streamlined RED
SVGS["drg-class-05"] = svg_wrap(f'''
  <path d="M12,68 C14,40 32,28 56,26 L178,26 L182,68 L178,110 L56,110 C32,108 14,96 12,68 Z" fill="#CC0000"/>
  <path d="M12,68 C13,52 28,46 48,44 L48,92 C28,90 13,84 12,68 Z" fill="#AA0000"/>
  <rect x="56" y="60" width="126" height="16" fill="#fff" opacity="0.15"/>
  <circle cx="15" cy="68" r="7" fill="#FFE040" opacity="0.9"/>
  <rect x="152" y="32" width="18" height="16" rx="2" fill="#87CEEB" opacity="0.7"/>
  {wheel(42, 114, 9, "#AA0000", "#700000", "#AA0000")}
  {wheel(61, 114, 9, "#AA0000", "#700000", "#AA0000")}
  {wheel(86, 114, 14, "#AA0000", "#700000", "#AA0000")}
  {wheel(109, 114, 14, "#AA0000", "#700000", "#AA0000")}
  {wheel(132, 114, 14, "#AA0000", "#700000", "#AA0000")}
  {wheel(158, 114, 9, "#AA0000", "#700000", "#AA0000")}
  {wheel(176, 114, 9, "#AA0000", "#700000", "#AA0000")}
  {rail(10, 196)}
''', "DRG Class 05 · 1935")

# 30. drb-class-52 - austerity wartime 2-10-0
SVGS["drb-class-52"] = svg_wrap(f'''
  <rect x="8" y="50" width="170" height="38" rx="4" fill="#111"/>
  <rect x="14" y="56" width="120" height="24" rx="5" fill="#181818"/>
  <rect x="18" y="16" width="14" height="36" rx="2" fill="#0d0d0d"/>
  <rect x="16" y="13" width="18" height="7" rx="1" fill="#1a1a1a"/>
  <rect x="160" y="42" width="28" height="46" rx="3" fill="#111"/>
  <rect x="163" y="46" width="12" height="13" rx="2" fill="#87CEEB" opacity="0.5"/>
  <circle cx="14" cy="67" r="15" fill="#0d0d0d"/>
  <rect x="100" y="50" width="20" height="12" rx="4" fill="#111"/>
  {wheel(22, 101, 7, "#444", "#111", "#444")}
  {wheel(45, 101, 12, "#444", "#111", "#444")}
  {wheel(64, 101, 12, "#444", "#111", "#444")}
  {wheel(83, 101, 12, "#444", "#111", "#444")}
  {wheel(102, 101, 12, "#444", "#111", "#444")}
  {wheel(121, 101, 12, "#444", "#111", "#444")}
  <rect x="45" y="99" width="76" height="4" rx="2" fill="#333" opacity="0.8"/>
  {rail(5, 197)}
''', "DRB Class 52 · 1941")

# 31. jnr-d51
SVGS["jnr-d51"] = svg_wrap(f'''
  <rect x="18" y="50" width="150" height="36" rx="7" fill="#111"/>
  <rect x="24" y="56" width="100" height="24" rx="7" fill="#1a1a1a"/>
  <rect x="148" y="44" width="36" height="42" rx="4" fill="#1a1a1a"/>
  <rect x="151" y="48" width="14" height="14" rx="2" fill="#87CEEB" opacity="0.6"/>
  <rect x="150" y="70" width="32" height="5" fill="#fff" opacity="0.8"/>
  <rect x="28" y="18" width="14" height="34" rx="3" fill="#111"/>
  <rect x="22" y="15" width="26" height="7" rx="2" fill="#222"/>
  <circle cx="22" cy="67" r="16" fill="#0d0d0d"/>
  <ellipse cx="100" cy="52" rx="14" ry="9" fill="#0d0d0d"/>
  {wheel(34, 101, 7, "#888", "#111", "#888")}
  {wheel(58, 101, 12, "#888", "#111", "#888")}
  {wheel(78, 101, 12, "#888", "#111", "#888")}
  {wheel(98, 101, 12, "#888", "#111", "#888")}
  {wheel(118, 101, 12, "#888", "#111", "#888")}
  {wheel(145, 101, 8, "#888", "#111", "#888")}
  <rect x="58" y="99" width="60" height="4" rx="2" fill="#666" opacity="0.8"/>
  {rail(10, 195)}
''', "JNR D51 · 1936")

# 32. jnr-c62
SVGS["jnr-c62"] = svg_wrap(f'''
  <rect x="16" y="48" width="152" height="40" rx="8" fill="#111"/>
  <rect x="22" y="54" width="105" height="26" rx="8" fill="#1a1a1a"/>
  <rect x="152" y="42" width="36" height="46" rx="4" fill="#0d0d0d"/>
  <rect x="155" y="46" width="18" height="16" rx="2" fill="#87CEEB" opacity="0.65"/>
  <rect x="26" y="14" width="14" height="36" rx="5" fill="#0d0d0d"/>
  <circle cx="33" cy="14" r="8" fill="#222"/>
  <circle cx="22" cy="67" r="18" fill="#0d0d0d"/>
  <ellipse cx="108" cy="50" rx="15" ry="10" fill="#0d0d0d"/>
  <rect x="24" y="78" width="124" height="5" fill="#CC0000"/>
  {wheel(36, 103, 8, "#aaa", "#111", "#aaa")}
  {wheel(56, 103, 8, "#aaa", "#111", "#aaa")}
  {wheel(80, 103, 14, "#aaa", "#111", "#aaa")}
  {wheel(103, 103, 14, "#aaa", "#111", "#aaa")}
  {wheel(126, 103, 14, "#aaa", "#111", "#aaa")}
  {wheel(152, 103, 9, "#aaa", "#111", "#aaa")}
  {wheel(170, 103, 9, "#aaa", "#111", "#aaa")}
  <rect x="80" y="101" width="46" height="4" rx="2" fill="#888" opacity="0.8"/>
  {rail(8, 196)}
''', "JNR C62 · 1949")

# 33. sncf-super-pacific
SVGS["sncf-super-pacific"] = svg_wrap(f'''
  <rect x="18" y="50" width="148" height="36" rx="7" fill="#111"/>
  <rect x="24" y="56" width="100" height="24" rx="7" fill="#1e1e1e"/>
  <rect x="28" y="16" width="12" height="36" rx="3" fill="#0d0d0d"/>
  <rect x="24" y="12" width="20" height="8" rx="3" fill="#b87333"/>
  <circle cx="22" cy="67" r="16" fill="#0d0d0d"/>
  <ellipse cx="85" cy="52" rx="12" ry="8" fill="#0d0d0d"/>
  <ellipse cx="110" cy="55" rx="9" ry="6" fill="#0d0d0d"/>
  <path d="M148,86 L148,44 Q155,38 170,36 L184,36 L184,86 Z" fill="#0d0d0d"/>
  <rect x="152" y="42" width="16" height="14" rx="2" fill="#87CEEB" opacity="0.6"/>
  <rect x="24" y="75" width="110" height="4" fill="#b87333"/>
  {wheel(34, 101, 8, "#b87333", "#111", "#b87333")}
  {wheel(54, 101, 8, "#b87333", "#111", "#b87333")}
  {wheel(78, 101, 13, "#b87333", "#111", "#b87333")}
  {wheel(101, 101, 13, "#b87333", "#111", "#b87333")}
  {wheel(124, 101, 13, "#b87333", "#111", "#b87333")}
  {wheel(153, 101, 9, "#b87333", "#111", "#b87333")}
  <rect x="78" y="99" width="46" height="4" rx="2" fill="#b87333" opacity="0.7"/>
  {rail(10, 195)}
''', "SNCF Super Pacific · 1923")

# 34. chapelon-242-a1 - double chimney 4-8-4
SVGS["chapelon-242-a1"] = svg_wrap(f'''
  <rect x="14" y="48" width="160" height="40" rx="8" fill="#111"/>
  <rect x="20" y="54" width="110" height="26" rx="8" fill="#1a1a1a"/>
  <rect x="26" y="14" width="10" height="36" rx="3" fill="#0d0d0d"/>
  <rect x="40" y="18" width="10" height="32" rx="3" fill="#0d0d0d"/>
  <rect x="22" y="10" width="32" height="8" rx="2" fill="#222"/>
  <circle cx="20" cy="67" r="17" fill="#0d0d0d"/>
  <ellipse cx="105" cy="51" rx="14" ry="9" fill="#0d0d0d"/>
  <rect x="158" y="42" width="32" height="46" rx="4" fill="#0d0d0d"/>
  <rect x="161" y="46" width="14" height="14" rx="2" fill="#87CEEB" opacity="0.6"/>
  {wheel(30, 102, 8, "#777", "#111", "#777")}
  {wheel(50, 102, 8, "#777", "#111", "#777")}
  {wheel(72, 102, 13, "#777", "#111", "#777")}
  {wheel(92, 102, 13, "#777", "#111", "#777")}
  {wheel(112, 102, 13, "#777", "#111", "#777")}
  {wheel(132, 102, 13, "#777", "#111", "#777")}
  {wheel(154, 102, 9, "#777", "#111", "#777")}
  {wheel(172, 102, 9, "#777", "#111", "#777")}
  <rect x="72" y="100" width="60" height="4" rx="2" fill="#555" opacity="0.8"/>
  {rail(8, 196)}
''', "Chapelon 242 A1 · 1942")

# 35. cpr-royal-hudson
SVGS["cpr-royal-hudson"] = svg_wrap(f'''
  <path d="M15,68 Q22,44 42,40 L174,40 L178,68 L174,96 L42,96 Q22,92 15,68 Z" fill="#1a4a1a"/>
  <rect x="42" y="40" width="136" height="56" rx="0" fill="#1a4a1a"/>
  <rect x="42" y="52" width="136" height="6" fill="#C8A800"/>
  <rect x="42" y="78" width="136" height="5" fill="#C8A800"/>
  <rect x="152" y="40" width="26" height="56" rx="3" fill="#133a13"/>
  <rect x="155" y="44" width="14" height="15" rx="2" fill="#87CEEB" opacity="0.65"/>
  <rect x="34" y="16" width="13" height="26" rx="3" fill="#0d1a0d"/>
  <circle cx="17" cy="68" r="8" fill="#FFE040" opacity="0.9"/>
  <polygon points="158,76 161,70 164,76 167,70 170,76" fill="#C8A800" opacity="0.8"/>
  {wheel(38, 104, 8, "#C8A800", "#0d2a0d", "#C8A800")}
  {wheel(57, 104, 8, "#C8A800", "#0d2a0d", "#C8A800")}
  {wheel(80, 104, 13, "#C8A800", "#0d2a0d", "#C8A800")}
  {wheel(103, 104, 13, "#C8A800", "#0d2a0d", "#C8A800")}
  {wheel(126, 104, 13, "#C8A800", "#0d2a0d", "#C8A800")}
  {wheel(152, 104, 9, "#C8A800", "#0d2a0d", "#C8A800")}
  {wheel(170, 104, 9, "#C8A800", "#0d2a0d", "#C8A800")}
  {rail(10, 195)}
''', "CPR Royal Hudson · 1937")

# 36. sar-class-25 - condensing LONG tender
SVGS["sar-class-25"] = svg_wrap(f'''
  <rect x="8" y="52" width="90" height="36" rx="7" fill="#111"/>
  <rect x="14" y="58" width="65" height="24" rx="6" fill="#1a1a1a"/>
  <rect x="100" y="46" width="92" height="42" rx="5" fill="#222"/>
  <rect x="104" y="42" width="84" height="8" rx="3" fill="#333"/>
  <line x1="112" y1="42" x2="112" y2="50" stroke="#555" stroke-width="2"/>
  <line x1="124" y1="42" x2="124" y2="50" stroke="#555" stroke-width="2"/>
  <line x1="136" y1="42" x2="136" y2="50" stroke="#555" stroke-width="2"/>
  <line x1="148" y1="42" x2="148" y2="50" stroke="#555" stroke-width="2"/>
  <line x1="160" y1="42" x2="160" y2="50" stroke="#555" stroke-width="2"/>
  <line x1="172" y1="42" x2="172" y2="50" stroke="#555" stroke-width="2"/>
  <line x1="184" y1="42" x2="184" y2="50" stroke="#555" stroke-width="2"/>
  <rect x="12" y="14" width="13" height="40" rx="3" fill="#0d0d0d"/>
  <rect x="8" y="10" width="21" height="8" rx="2" fill="#333"/>
  <circle cx="12" cy="68" r="16" fill="#0d0d0d"/>
  {wheel(20, 102, 8, "#666", "#111", "#666")}
  {wheel(40, 102, 8, "#666", "#111", "#666")}
  {wheel(58, 102, 12, "#666", "#111", "#666")}
  {wheel(74, 102, 12, "#666", "#111", "#666")}
  {wheel(90, 102, 12, "#666", "#111", "#666")}
  {wheel(118, 102, 8, "#555", "#222", "#555")}
  {wheel(138, 102, 8, "#555", "#222", "#555")}
  {wheel(158, 102, 8, "#555", "#222", "#555")}
  {wheel(178, 102, 8, "#555", "#222", "#555")}
  {rail(5, 198)}
''', "SAR Class 25 · 1953")

# 37. australian-3801
SVGS["australian-3801"] = svg_wrap(f'''
  <rect x="18" y="50" width="148" height="36" rx="8" fill="#1a4c1a"/>
  <rect x="24" y="56" width="98" height="24" rx="7" fill="#2a5c2a"/>
  <rect x="28" y="16" width="13" height="36" rx="3" fill="#0d1a0d"/>
  <rect x="24" y="12" width="21" height="8" rx="3" fill="#b87333"/>
  <circle cx="22" cy="67" r="16" fill="#133a13"/>
  <ellipse cx="98" cy="52" rx="14" ry="9" fill="#133a13"/>
  <rect x="25" y="74" width="50" height="10" rx="2" fill="#b87333"/>
  <rect x="148" y="44" width="36" height="42" rx="4" fill="#133a13"/>
  <rect x="151" y="48" width="14" height="14" rx="2" fill="#87CEEB" opacity="0.6"/>
  <ellipse cx="68" cy="54" rx="6" ry="4" fill="#b87333"/>
  {wheel(34, 101, 8, "#b87333", "#1a4c1a", "#b87333")}
  {wheel(54, 101, 8, "#b87333", "#1a4c1a", "#b87333")}
  {wheel(80, 101, 13, "#b87333", "#1a4c1a", "#b87333")}
  {wheel(103, 101, 13, "#b87333", "#1a4c1a", "#b87333")}
  {wheel(126, 101, 13, "#b87333", "#1a4c1a", "#b87333")}
  {wheel(155, 101, 9, "#b87333", "#1a4c1a", "#b87333")}
  <rect x="80" y="99" width="46" height="4" rx="2" fill="#b87333" opacity="0.7"/>
  {rail(10, 195)}
''', "Australian 3801 · 1943")

# 38. wap-class-india-steam
SVGS["wap-class-india-steam"] = svg_wrap(f'''
  <rect x="18" y="50" width="148" height="36" rx="6" fill="#111"/>
  <rect x="24" y="56" width="100" height="24" rx="6" fill="#1a1a1a"/>
  <rect x="28" y="18" width="16" height="34" rx="4" fill="#0d0d0d"/>
  <rect x="23" y="14" width="26" height="9" rx="3" fill="#444"/>
  <circle cx="22" cy="67" r="16" fill="#0d0d0d"/>
  <ellipse cx="90" cy="52" rx="13" ry="8" fill="#0d0d0d"/>
  <ellipse cx="112" cy="55" rx="9" ry="6" fill="#0d0d0d"/>
  <ellipse cx="128" cy="56" rx="7" ry="5" fill="#0d0d0d"/>
  <rect x="26" y="72" width="80" height="8" fill="#1a5c1a"/>
  <rect x="148" y="44" width="36" height="42" rx="3" fill="#0d0d0d"/>
  <rect x="151" y="48" width="15" height="14" rx="2" fill="#87CEEB" opacity="0.6"/>
  {wheel(34, 101, 8, "#888", "#111", "#888")}
  {wheel(54, 101, 8, "#888", "#111", "#888")}
  {wheel(80, 101, 13, "#888", "#111", "#888")}
  {wheel(103, 101, 13, "#888", "#111", "#888")}
  {wheel(126, 101, 13, "#888", "#111", "#888")}
  {wheel(155, 101, 9, "#888", "#111", "#888")}
  {rail(10, 195)}
''', "WAP Class India Steam · 1947")

# 39. trans-siberian
SVGS["trans-siberian"] = svg_wrap(f'''
  <rect x="8" y="55" width="65" height="34" rx="6" fill="#111"/>
  <rect x="14" y="60" width="44" height="22" rx="6" fill="#1a1a1a"/>
  <rect x="16" y="22" width="12" height="35" rx="3" fill="#0d0d0d"/>
  <rect x="12" y="18" width="20" height="7" rx="2" fill="#333"/>
  <circle cx="12" cy="70" r="15" fill="#0d0d0d"/>
  <rect x="75" y="52" width="40" height="37" rx="3" fill="#2a2a2a"/>
  <rect x="118" y="52" width="40" height="37" rx="3" fill="#2a2a2a"/>
  <rect x="161" y="52" width="33" height="37" rx="3" fill="#2a2a2a"/>
  <rect x="79" y="58" width="8" height="8" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="92" y="58" width="8" height="8" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="105" y="58" width="8" height="8" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="122" y="58" width="8" height="8" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="135" y="58" width="8" height="8" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="148" y="58" width="8" height="8" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="165" y="58" width="8" height="8" rx="1" fill="#87CEEB" opacity="0.6"/>
  <rect x="75" y="71" width="119" height="5" fill="#CC0000"/>
  <rect x="72" y="66" width="6" height="4" fill="#666"/>
  <rect x="116" y="66" width="5" height="4" fill="#666"/>
  <rect x="159" y="66" width="5" height="4" fill="#666"/>
  {wheel(22, 100, 8, "#666", "#111", "#666")}
  {wheel(42, 100, 8, "#666", "#111", "#666")}
  {wheel(60, 100, 11, "#666", "#111", "#666")}
  {wheel(88, 100, 7, "#555", "#333", "#555")}
  {wheel(106, 100, 7, "#555", "#333", "#555")}
  {wheel(129, 100, 7, "#555", "#333", "#555")}
  {wheel(148, 100, 7, "#555", "#333", "#555")}
  {wheel(168, 100, 7, "#555", "#333", "#555")}
  {wheel(185, 100, 7, "#555", "#333", "#555")}
  {rail(5, 198)}
''', "Trans-Siberian · 1891")

print("British + European steam batch: OK")
