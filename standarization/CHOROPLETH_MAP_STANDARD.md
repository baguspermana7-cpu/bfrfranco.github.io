# Choropleth Map Overlay Standard — ResistanceZero

> **Version**: 1.0 | **Created**: 2026-05-02
> **Status**: Active — applies to all Leaflet choropleth overlays on map pages.
> **Reference implementation**: `js/pln-energy-dashboard.js` (PLN Java-Bali Grid Monitor)

---

## When to Use a Choropleth

Use a Leaflet choropleth overlay whenever a map needs to encode a continuous scalar metric per polygon (province, region, zone). Examples:

- Carbon intensity (gCO₂/kWh) per province
- Power utilization (%) per grid zone
- Cost index per country/region

---

## Color Ramp Standard

### Gradient Stops

Use **evenly-spaced stops** matching the reference scale for the metric. For carbon intensity (0–1500 gCO₂/kWh):

```js
var CARBON_STOPS = [
    [0,    '#22c55e'],  // saturated green  — clean grid
    [300,  '#fde047'],  // saturated yellow — moderate
    [600,  '#f97316'],  // saturated orange — high
    [900,  '#dc2626'],  // saturated red    — very high
    [1200, '#7c2d12'],  // dark brown       — coal-heavy
    [1500, '#0c0a09']   // near-black       — worst case
];
```

Rules:
- **Evenly spaced** — equal interval per stop (e.g. 300 gCO₂/kWh). Never cluster stops in the expected data range.
- **Saturated tones** — each adjacent stop must be visually distinct at a glance. No pastel ramps.
- **Reference**: mirrors [electricitymaps.com](https://app.electricitymaps.com) legend scale.

### Continuous Interpolation

Always use `lerpHex(a, b, t)` between adjacent stops — never discrete buckets.

```js
function carbonColor(gco2) {
    // ... find lo/hi bracket, lerp between stops
}
```

---

## Opacity Standard

| State      | `fillOpacity` | `weight` | `stroke` | `color`                      |
|------------|---------------|----------|----------|------------------------------|
| **Rest**   | `0.15`        | `1.2`    | `true`   | `rgba(255,255,255,0.35)`     |
| **Hover**  | `0.35`        | `2.5`    | `true`   | `#ffffff`                    |
| **Active** | `0.45`        | `2.5`    | `true`   | `#ffffff`                    |

**Critical rule**: Base `fillOpacity` must stay at **0.10–0.20** (80–90% transparent). The map tiles (roads, labels, substation markers) must remain visible through the color tint. Never set fillOpacity ≥ 0.5 at rest — this buries the base map.

---

## Hover Effect

Every `onEachFeature` handler must wire both `mouseover` and `mouseout`:

```js
lyr.on('mouseover', function () {
    lyr.setStyle({ weight: 2.5, color: '#ffffff', stroke: true, fillOpacity: 0.35 });
    if (lyr.bringToFront) { try { lyr.bringToFront(); } catch (e) {} }
});
lyr.on('mouseout', function () {
    lyr.setStyle({ weight: 1.2, color: 'rgba(255,255,255,0.35)', stroke: true, fillOpacity: 0.15 });
});
```

`bringToFront()` ensures the hovered province stroke renders above adjacent polygons.

---

## Legend Control

- **Position**: `bottomleft` — never overlaps right-side panels.
- **Style**: horizontal continuous gradient bar (CSS linear-gradient using the same stops), tick labels below.
- **Width**: 260–300px. Min text size 10px.
- **Border**: `rgba(96,165,250,0.18)` — blue-tint, not pure white.
- **Background**: `rgba(15,23,42,0.88)` — dark navy, matches page dark theme.

---

## Toggle Button

- **Position**: `topleft` — clear of legend and right panels.
- **Active state**: amber fill `linear-gradient(135deg,#f59e0b,#b45309)` + label text "Gradient ON".
- **Inactive state**: muted dark bg + label "Gradient OFF".
- Clicking toggles `L.GeoJSON` layer visibility and updates button style.

---

## GeoJSON Source

- **Source**: Natural Earth Data 10m admin-1 states/provinces (public domain).
- **URL**: `https://github.com/nvkelso/natural-earth-vector` — `ne_10m_admin_1_states_provinces.geojson`
- **Simplification**: `shapely.simplify(tolerance=0.004, preserve_topology=True)` — approx 500m resolution.
- **Target vertex count**: 100–500 per feature. Do not use placeholder polygons (<100 vertices).
- **Property schema**: `prov` (join key, e.g. `jakarta-banten`) + `label` (display name).

---

## Polygon Quality Checklist

Before shipping a choropleth for any region:

- [ ] All features have ≥100 vertices (coastline/border fidelity)
- [ ] Adjacent provinces share no overlapping geometry
- [ ] `prov` key matches the join key used by the data layer
- [ ] File size < 150 KB for the GeoJSON served to browser
- [ ] `fillOpacity` at rest is 0.10–0.20 (map shows through)
- [ ] Hover effect wired (mouseover + mouseout)
- [ ] Toggle button at `topleft`, legend at `bottomleft`
- [ ] Legend gradient uses same stops as `carbonColor()` (or equivalent metric function)

---

## Integration Pattern

```js
// 1. Build provinceData map (prov key → aggregate)
var aggs = {};
ED.computeProvinceAggregates(window.PLN_JAVA_GRID || {}).forEach(function(a) {
    if (a && a.prov) aggs[a.prov] = a;
});

// 2. Render choropleth
ED.renderProvinceChoropleth(map, aggs).then(function(layer) {
    choroplethLayer = layer;
});

// 3. Add legend + toggle
ED.addChoroplethLegend(map, 'bottomleft');
ED.addChoroplethToggleButton(map, function(visible) {
    if (choroplethLayer) {
        visible ? choroplethLayer.addTo(map) : map.removeLayer(choroplethLayer);
    }
});
```

---

## Cross-References

| File | Role |
|------|------|
| `js/pln-energy-dashboard.js` | Reference implementation of `renderProvinceChoropleth`, `addChoroplethLegend`, `addChoroplethToggleButton` |
| `js/pln-indonesia-provinces.geojson` | Example Natural Earth GeoJSON — Java+Bali, 5 features |
| `standarization/PLN_DATA_SCHEMA.md` | ProvinceAggregate schema (join key shape) |
| `standarization/UI_FEATURES_STANDARD.md` | Global map/UI conventions |
