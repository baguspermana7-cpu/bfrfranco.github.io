/* Generate coolant-fluid-properties.csv from the frozen CDU engine.
 * Reproducible: node data/cdu/build-fluid-properties.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JS = path.join(__dirname, '..', '..', 'js');
const sb = { module: undefined, console }; sb.window = sb; sb.globalThis = sb;
const ctx = vm.createContext(sb);
function load(f){ const c=readFileSync(path.join(JS,f),'utf8'); sb.module={exports:{}}; vm.runInContext(c,ctx,{filename:f}); }
load('cdu-model.js'); load('cdu-engine.js');
const E = sb.CDU_ENGINE;
const rows = [['fluid','temp_c','glycol_pct','density_kg_per_l','cp_kj_per_kgk','viscosity_mpas','thermal_cond_w_mk','prandtl','source','basis_tag']];
function pr(label, props, t, g, src, tag){
  const rho=props.rho, cp=props.cp, mu=props.mu, k=props.k;
  const pr = (mu*cp*1000)/k; // Pr = mu*cp/k (cp J/kgK = kJ*1000)
  rows.push([label,t,g,(rho/1000).toFixed(4),cp.toFixed(3),(mu*1000).toFixed(3),k.toFixed(3),pr.toFixed(2),src,tag]);
}
for(let t=5;t<=60;t+=5){ pr('water',E.waterProps(t),t,0,'IAPWS-class fit (cdu-engine waterProps)','STANDARD'); }
for(let t=5;t<=60;t+=5){ pr('pg25',E.pg25Props(t,25),t,25,'ASHRAE HoF 2021 ch.31 (engine pg25Props)','ILLUSTRATIVE'); }
writeFileSync(path.join(__dirname,'coolant-fluid-properties.csv'), rows.map(r=>r.join(',')).join('\n')+'\n');
console.log('wrote coolant-fluid-properties.csv with '+(rows.length-1)+' rows');
