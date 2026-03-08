import { useState, useMemo, useReducer } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

/* ══════════════════════════════════════════════
   ETF DATABASE — historical data calibrated
   ══════════════════════════════════════════════ */
const DB = {
  VOO:  { nm:"Vanguard S&P 500",         cat:"Large Blend",   r:14.86, d:1.3, er:.03, b:1.00, dd:-24.5, c:"#2563eb",
    hist:{2015:1.31,2016:12.17,2017:21.77,2018:-4.50,2019:31.35,2020:18.29,2021:28.78,2022:-18.19,2023:26.32,2024:24.98,2025:17.82} },
  QQQ:  { nm:"Invesco Nasdaq-100",       cat:"Large Growth",  r:18.30, d:0.6, er:.20, b:1.15, dd:-33.0, c:"#7c3aed",
    hist:{2015:9.45,2016:7.10,2017:32.66,2018:-0.12,2019:38.98,2020:48.40,2021:27.42,2022:-32.58,2023:54.85,2024:25.58,2025:24.80} },
  SCHD: { nm:"Schwab Dividend Equity",   cat:"Dividend Value", r:11.00, d:3.5, er:.06, b:.80, dd:-16.0, c:"#059669",
    hist:{2015:-1.42,2016:16.43,2017:15.47,2018:-5.56,2019:27.18,2020:2.40,2021:29.87,2022:-3.23,2023:3.67,2024:12.09,2025:9.80} },
  VTI:  { nm:"Vanguard Total Market",    cat:"Total Market",  r:14.50, d:1.3, er:.03, b:1.02, dd:-25.0, c:"#d97706",
    hist:{2015:0.40,2016:12.68,2017:21.19,2018:-5.13,2019:30.80,2020:20.95,2021:25.72,2022:-19.53,2023:26.07,2024:23.87,2025:17.00} },
  VIG:  { nm:"Vanguard Div Appreciation",cat:"Div Growth",    r:12.00, d:1.8, er:.06, b:.85, dd:-18.0, c:"#db2777",
    hist:{2015:-0.83,2016:10.98,2017:20.94,2018:-2.01,2019:29.58,2020:15.48,2021:23.68,2022:-9.84,2023:14.52,2024:17.75,2025:13.50} },
  SPY:  { nm:"SPDR S&P 500 Trust",       cat:"Large Blend",   r:14.77, d:1.2, er:.09, b:1.00, dd:-24.5, c:"#6d28d9",
    hist:{2015:1.25,2016:12.00,2017:21.70,2018:-4.56,2019:31.22,2020:18.37,2021:28.75,2022:-18.17,2023:26.19,2024:24.89,2025:17.70} },
  VGT:  { nm:"Vanguard Info Tech",       cat:"Sector Tech",   r:19.00, d:0.6, er:.10, b:1.20, dd:-34.0, c:"#0891b2",
    hist:{2015:5.90,2016:13.70,2017:38.78,2018:-0.30,2019:48.00,2020:46.00,2021:30.30,2022:-33.70,2023:50.10,2024:24.20,2025:22.00} },
  SPLG: { nm:"SPDR S&P 500 Low Cost",   cat:"Large Blend",   r:14.80, d:1.3, er:.02, b:1.00, dd:-24.5, c:"#ea580c",
    hist:{2015:1.30,2016:12.10,2017:21.70,2018:-4.52,2019:31.30,2020:18.30,2021:28.70,2022:-18.20,2023:26.30,2024:24.95,2025:17.80} },
};

const INTERVALS = [
  { id:"weekly", nm:"Mingguan", factor:52/12, perYr:52 },
  { id:"biweekly", nm:"2 Mingguan", factor:26/12, perYr:26 },
  { id:"monthly", nm:"Bulanan", factor:1, perYr:12 },
  { id:"quarterly", nm:"3 Bulanan", factor:1/3, perYr:4 },
];

const ALLOC_MODES = [{ id:"pct", nm:"%" }, { id:"usd", nm:"USD" }];

/* ══════════════════════════════════════════════
   FORMATTERS
   ══════════════════════════════════════════════ */
const $=(n,d=0)=>{if(n==null||isNaN(n))return"$0";const a=Math.abs(n),s=n<0?"-":"";if(a>=1e9)return`${s}$${(a/1e9).toFixed(1)}B`;if(a>=1e6)return`${s}$${(a/1e6).toFixed(1)}M`;return`${s}$${a.toLocaleString("en",{minimumFractionDigits:d,maximumFractionDigits:d})}`};
const R=n=>`Rp${Math.round(n||0).toLocaleString("id")}`;
const P=(n,d=1)=>`${(n||0).toFixed(d)}%`;
const td=()=>new Date().toISOString().slice(0,10);

/* ══════════════════════════════════════════════
   FORECAST ENGINE — 3-method blended
   Uses: (1) 10Y CAGR, (2) 5Y recent CAGR, (3) mean reversion model
   Weighted blend for more accurate forward projection
   ══════════════════════════════════════════════ */
function forecast(etf, adjPct) {
  const h = Object.values(etf.hist);
  const recent5 = h.slice(-5);
  const cagr10 = etf.r;
  const cagr5 = recent5.reduce((a,v)=>a*(1+v/100),1) ** (1/5) * 100 - 100;
  // Mean reversion: if recent >> long-term, dampen forward estimate
  const deviation = cagr5 - cagr10;
  const meanRevAdj = -deviation * 0.3; // 30% mean reversion pull
  const blended = cagr10 * 0.4 + cagr5 * 0.35 + (cagr10 + meanRevAdj) * 0.25;
  return {
    base: blended + adjPct,
    bull: blended + adjPct + 4,
    bear: blended + adjPct - 6,
    conservative: blended + adjPct - 2.5,
    optimistic: blended + adjPct + 2,
    cagr10, cagr5, blended,
    volatility: Math.sqrt(h.reduce((s,v)=>s+Math.pow(v-cagr10,2),0)/h.length),
  };
}

/* ══════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════ */
const INIT = {
  // Global config
  idr:1000000, rate:16900, fee:0.3, spread:0.25, yrs:10, adj:0,
  annInc:0, divReinvest:true, interval:"monthly", allocMode:"pct",
  // App mode
  appMode:"sim", // "sim" | "record"
  view:"main",
  // Slots
  slots:[
    {tk:"VOO",alloc:50,usd:0,txns:[]},
    {tk:"QQQ",alloc:20,usd:0,txns:[]},
    {tk:"SCHD",alloc:15,usd:0,txns:[]},
    {tk:"SPY",alloc:15,usd:0,txns:[]},
  ],
  editIdx:null, showCfg:true,
};

function rd(s,{type:t,p}) {
  switch(t) {
    case "SET": return {...s,...p};
    case "CFG": return {...s,...p};
    case "SLOT_ADD": {
      if(s.slots.length>=6||s.slots.find(x=>x.tk===p))return s;
      return {...s,slots:[...s.slots,{tk:p,alloc:0,usd:0,txns:[]}]};
    }
    case "SLOT_RM": return {...s,slots:s.slots.filter((_,i)=>i!==p),editIdx:null};
    case "SLOT_UPD": {
      const sl=[...s.slots]; sl[p.i]={...sl[p.i],...p.d}; return {...s,slots:sl};
    }
    case "TX_ADD": {
      const sl=[...s.slots],x=sl[p.i];
      sl[p.i]={...x,txns:[...x.txns,{id:Date.now(),dt:td(),pr:"",am:"",note:""}]};
      return {...s,slots:sl};
    }
    case "TX_UPD": {
      const sl=[...s.slots],x=sl[p.i];
      sl[p.i]={...x,txns:x.txns.map(t=>t.id===p.id?{...t,[p.f]:p.v}:t)};
      return {...s,slots:sl};
    }
    case "TX_DEL": {
      const sl=[...s.slots],x=sl[p.i];
      sl[p.i]={...x,txns:x.txns.filter(t=>t.id!==p.id)};
      return {...s,slots:sl};
    }
    case "TX_BULK": {
      const sl=[...s.slots],x=sl[p.i];
      const nw=[];const dt=new Date();
      for(let m=0;m<p.n;m++){
        const d2=new Date(dt);
        if(s.interval==="weekly")d2.setDate(d2.getDate()+7*(m+1));
        else if(s.interval==="biweekly")d2.setDate(d2.getDate()+14*(m+1));
        else if(s.interval==="quarterly")d2.setMonth(d2.getMonth()+3*(m+1));
        else d2.setMonth(d2.getMonth()+m+1);
        nw.push({id:Date.now()+m,dt:d2.toISOString().slice(0,10),pr:String(p.pr),am:String(p.am),note:`Plan #${m+1}`});
      }
      sl[p.i]={...x,txns:[...x.txns,...nw].sort((a,b)=>a.dt.localeCompare(b.dt))};
      return {...s,slots:sl};
    }
    default: return s;
  }
}

/* ══════════════════════════════════════════════
   UI COMPONENTS
   ══════════════════════════════════════════════ */
const cs={bg:"#06080e",sf:"#0c1018",sf2:"#111820",bd:"#1a2233",acc:"#3b82f6",grn:"#22c55e",red:"#ef4444",amb:"#eab308",pur:"#8b5cf6",cyn:"#06b6d4",pnk:"#f472b6",t1:"#e8ecf4",t2:"#8b97ad",t3:"#475569",f:"'IBM Plex Sans',system-ui",m:"'IBM Plex Mono',monospace"};

const Box=({children,style,ac,onClick})=><div onClick={onClick} style={{background:cs.sf,border:`1px solid ${cs.bd}`,borderRadius:6,borderLeft:ac?`3px solid ${ac}`:undefined,cursor:onClick?"pointer":undefined,...style}}>{children}</div>;
const Num=({l,v,c,s})=><div><div style={{fontSize:14,fontWeight:700,color:c||cs.t1,fontFamily:cs.m}}>{v}</div><div style={{fontSize:9,color:cs.t3,marginTop:1}}>{l}</div>{s&&<div style={{fontSize:8,color:cs.t3}}>{s}</div>}</div>;
const Inp=({l,v,onChange,pre,suf,w,step,ph,type="number"})=><div style={{display:"flex",flexDirection:"column",gap:2,width:w,minWidth:0}}>
  {l&&<label style={{fontSize:8,color:cs.t3,fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>{l}</label>}
  <div style={{display:"flex",alignItems:"center",background:cs.bg,border:`1px solid ${cs.bd}`,borderRadius:4,height:28,overflow:"hidden"}}>
    {pre&&<span style={{padding:"0 4px",fontSize:9,color:cs.t3,background:"#080b12",borderRight:`1px solid ${cs.bd}`,height:"100%",display:"flex",alignItems:"center",whiteSpace:"nowrap"}}>{pre}</span>}
    <input type={type} value={v} onChange={e=>onChange(type==="number"?(e.target.value===""?"":+e.target.value):e.target.value)} step={step} placeholder={ph}
      style={{flex:1,padding:"0 5px",background:"transparent",border:"none",color:cs.t1,fontSize:11,fontFamily:cs.m,outline:"none",width:"100%",minWidth:0}}/>
    {suf&&<span style={{padding:"0 4px",fontSize:8,color:cs.t3,whiteSpace:"nowrap"}}>{suf}</span>}
  </div>
</div>;

const Pill=({active,onClick,children,color})=><button onClick={onClick} style={{
  padding:"4px 10px",borderRadius:4,border:`1px solid ${active?color||cs.acc:cs.bd}`,
  background:active?`${color||cs.acc}18`:"transparent",color:active?color||cs.acc:cs.t3,
  fontSize:10,fontWeight:active?700:500,cursor:"pointer",fontFamily:cs.f,transition:"all .15s"
}}>{children}</button>;

/* ══════════════════════════════════════════════
   NARRATIVE ENGINE
   ══════════════════════════════════════════════ */
function buildNarrative(sd,tot,proj,cfg,netPer,totalAl,intv) {
  const lines=[];
  if(!sd.length)return{lines,wR:0,wD:0,wB:0,wER:0,wDD:0,risk:"—",riskC:cs.t3,techP:0,divP:0,sp5P:0};
  const wR=totalAl>0?sd.reduce((a,x)=>a+x.fc.base*x.al,0)/totalAl:0;
  const wD=totalAl>0?sd.reduce((a,x)=>a+x.etf.d*x.al,0)/totalAl:0;
  const wB=totalAl>0?sd.reduce((a,x)=>a+x.etf.b*x.al,0)/totalAl:0;
  const wER=totalAl>0?sd.reduce((a,x)=>a+x.etf.er*x.al,0)/totalAl:0;
  const wDD=totalAl>0?sd.reduce((a,x)=>a+x.etf.dd*x.al,0)/totalAl:0;
  const techP=sd.filter(x=>["QQQ","VGT"].includes(x.tk)).reduce((a,x)=>a+x.al,0);
  const divP=sd.filter(x=>["SCHD","VIG"].includes(x.tk)).reduce((a,x)=>a+x.al,0);
  const sp5P=sd.filter(x=>["VOO","SPY","SPLG"].includes(x.tk)).reduce((a,x)=>a+x.al,0);
  const dup=sd.filter(x=>["VOO","SPY","SPLG"].includes(x.tk));
  const risk=wB>1.08?"AGGRESSIVE":wB>0.95?"MODERATE":"CONSERVATIVE";
  const riskC=risk==="AGGRESSIVE"?cs.red:risk==="MODERATE"?cs.amb:cs.grn;
  const fin=proj[proj.length-1];
  const yr5=proj.find(p=>Math.abs(p.m-60)<4);

  lines.push({i:"📊",t:"Forecast Engine",x:
    `Blended forecast model (40% 10Y CAGR + 35% recent 5Y + 25% mean-reversion): weighted projected return ${P(wR)}/yr. `+
    `Interval: ${intv.nm} (${intv.perYr}×/tahun). `+
    (cfg.annInc>0?`DCA naik ${cfg.annInc}%/tahun (compounding). `:"")
  });

  lines.push({i:"🛡️",t:`Risk: ${risk} (β ${wB.toFixed(2)})`,x:
    `Max drawdown estimate: ${P(wDD)}. `+
    (fin?`Worst case dari ${$(fin.val)}: bisa turun ${$(Math.abs(wDD/100)*fin.val)} dalam crash. `:"")
    +(risk==="AGGRESSIVE"?`Tech ${techP}% tinggi — siap volatilitas 30%+.`
    :risk==="MODERATE"?`Balance baik antara growth & income.`
    :`Defensif — return lebih rendah tapi stabil.`),
    c:riskC
  });

  if(dup.length>1) lines.push({i:"⚠️",t:"S&P 500 Overlap",x:
    `${dup.map(x=>x.tk).join("+")} semua track S&P 500 (total ${sp5P}%). Konsolidasi ke satu (VOO: ER 0.03%) kecuali sengaja split untuk averaging strategy berbeda.`,c:cs.amb});

  lines.push({i:"💰",t:"Cost Analysis",x:
    `Blended ER: ${P(wER,3)}/yr. Trading cost: ${P(cfg.fee+cfg.spread)} per transaksi × ${intv.perYr}×/yr = ~${P((cfg.fee+cfg.spread)*intv.perYr/100*100,2)} drag/yr. `+
    (wER>0.10?`Tip: ganti ETF ber-ER >0.10% ke alternatif murah.`:`ER efisien.`)
  });

  lines.push({i:"💎",t:"Dividend",x:
    `Weighted yield: ${P(wD)}/yr. `+
    (fin?`Tahun ke-${cfg.yrs}: ~${$(fin.divMo)}/bulan = ${R(fin.divMo*cfg.rate)}/bulan. `:"")
    +(cfg.divReinvest?"DRIP ON — compound optimal.":"DRIP OFF — pertimbangkan aktifkan.")
    +(divP<10?` Dividend alloc rendah (${divP}%). Tambah SCHD/VIG untuk income.`:"")
  });

  if(fin) lines.push({i:"🚀",t:`Proyeksi ${cfg.yrs}yr`,x:
    `DCA ${$(netPer)}/${intv.nm.toLowerCase()}: Modal ${$(fin.inv)} → ${$(fin.val)} (+${P(fin.pPct)}). `+
    `IDR: ${R(fin.valIDR)}. `+(yr5?`5yr checkpoint: ${$(yr5.val)} (+${P(yr5.pPct)}). `:"")
  });

  lines.push({i:"🌐",t:"Currency Hedge",x:
    `IDR melemah ~2-3%/yr historis. DCA USD = natural hedge. Bonus ~${P(2.5)}/yr saat convert balik. `+
    (fin?`${$(fin.val)} @18,500 (est 2030+) = ${R(fin.val*18500)} vs @${cfg.rate.toLocaleString()} = ${R(fin.valIDR)}.`:"")
  });

  const recs=[];
  if(techP>40)recs.push("Kurangi tech <35%");
  if(divP===0)recs.push("Tambah 10-20% dividend ETF");
  if(dup.length>1)recs.push("Konsolidasi S&P 500 duplicates");
  if(cfg.annInc===0)recs.push("Set annual increase 5-10%");
  if(!cfg.divReinvest)recs.push("Aktifkan dividend reinvest");
  if(totalAl!==100)recs.push(`Alokasi ${totalAl}% — harus 100%`);
  if(sd.length<2)recs.push("Diversifikasi ke 2-3 ETF");
  if(cfg.yrs<5)recs.push("Horizon <5yr terlalu pendek untuk equity");
  if(!recs.length)recs.push("Portfolio optimal — stay consistent");
  lines.push({i:"✅",t:"Rekomendasi",x:recs.join(" · "),c:cs.grn});

  return{lines,wR,wD,wB,wER,wDD,risk,riskC,techP,divP,sp5P};
}

/* ══════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════ */
export default function App(){
  const[s,d]=useReducer(rd,INIT);
  const D=(t,p)=>d({type:t,p});
  const{idr,rate,fee,spread,yrs,adj,annInc,divReinvest,interval,allocMode,appMode,view,slots,editIdx,showCfg}=s;
  const[bkN,setBkN]=useState(12);
  const[bkPr,setBkPr]=useState("");
  const[bkAm,setBkAm]=useState("");

  const intv=INTERVALS.find(x=>x.id===interval)||INTERVALS[2];
  const grossPer=useMemo(()=>(idr/rate)*(1-fee/100-spread/100)*intv.factor,[idr,rate,fee,spread,intv]);
  const netPerYr=grossPer*intv.perYr;
  const totalAl=slots.reduce((a,x)=>a+x.alloc,0);

  // Slot analytics
  const sd=useMemo(()=>slots.map((sl,i)=>{
    const etf=DB[sl.tk]; const fc=forecast(etf,adj);
    const txns=sl.txns.filter(t=>+t.pr>0&&+t.am>0);
    const inv=txns.reduce((a,t)=>a+ +t.am,0);
    const sh=txns.reduce((a,t)=>a+ +t.am/+t.pr,0);
    const avg=sh>0?inv/sh:0;
    const last=txns.length>0?+txns[txns.length-1].pr:0;
    const cur=sh*last; const gl=cur-inv; const glP=inv>0?gl/inv*100:0;
    const annD=cur*etf.d/100;
    const perUSD=allocMode==="usd"?sl.usd:grossPer*sl.alloc/100;
    return{i,tk:sl.tk,al:sl.alloc,usd:sl.usd,etf,fc,txns:sl.txns,inv,sh,avg,last,cur,gl,glP,annD,perUSD,txnCount:txns.length};
  }),[slots,grossPer,adj,allocMode]);

  const tot=useMemo(()=>{
    const t={inv:0,cur:0,annD:0};
    sd.forEach(x=>{t.inv+=x.inv;t.cur+=x.cur;t.annD+=x.annD});
    t.gl=t.cur-t.inv;t.glP=t.inv>0?t.gl/t.inv*100:0;
    return t;
  },[sd]);

  // Projection
  const proj=useMemo(()=>{
    const periods=yrs*intv.perYr;const pts=[];
    let vals=sd.map(x=>appMode==="record"?x.cur:0);
    let cumInv=appMode==="record"?tot.inv:0;
    for(let p=0;p<=periods;p++){
      if(p>0){
        const yrNum=Math.floor((p-1)/intv.perYr);
        const incM=Math.pow(1+annInc/100,yrNum);
        sd.forEach((x,i)=>{
          const mr=x.fc.base/100/intv.perYr;
          const dr=divReinvest?x.etf.d/100/intv.perYr:0;
          const contrib=x.perUSD*incM;
          vals[i]=vals[i]*(1+mr+dr)+contrib;
          cumInv+=contrib;
        });
      }
      const tv=vals.reduce((a,b)=>a+b,0);
      const dm=sd.reduce((a,x,i)=>a+vals[i]*x.etf.d/100/12,0);
      const mo=p/intv.perYr*12;
      if(p===0||p%intv.perYr===0||p===periods||(p<=intv.perYr&&p%(Math.max(1,Math.floor(intv.perYr/4)))===0)){
        const yr=p/intv.perYr;
        pts.push({m:mo,p,yr,lbl:p===0?"Now":yr<1?`${Math.round(mo)}mo`:`${yr%1===0?yr:yr.toFixed(1)}yr`,
          val:tv,inv:cumInv,profit:tv-cumInv,pPct:cumInv>0?(tv-cumInv)/cumInv*100:0,divMo:dm,valIDR:tv*rate});
      }
    }
    return pts;
  },[sd,yrs,intv,annInc,divReinvest,appMode,tot,rate]);

  // Scenarios
  const scens=useMemo(()=>{
    const adjs=[{n:"Bear",a:-6,c:cs.red},{n:"Consv",a:-2.5,c:cs.amb},{n:"Base",a:0,c:cs.acc},{n:"Bull",a:3,c:cs.grn},{n:"Opti",a:6,c:cs.pur}];
    return[1,2,3,5,7,10,15,20].filter(y=>y<=yrs).map(y=>{
      const row={yr:y,inv:(appMode==="record"?tot.inv:0)+sd.reduce((a,x)=>a+x.perUSD,0)*intv.perYr*y};
      adjs.forEach(sc=>{
        let vs=sd.map(x=>appMode==="record"?x.cur:0);
        const periods=y*intv.perYr;
        for(let p=1;p<=periods;p++){
          const inc=Math.pow(1+annInc/100,Math.floor((p-1)/intv.perYr));
          sd.forEach((x,i)=>{
            const base=forecast(x.etf,adj+sc.a).base;
            const mr=base/100/intv.perYr;
            const dr=divReinvest?x.etf.d/100/intv.perYr:0;
            vs[i]=vs[i]*(1+mr+dr)+x.perUSD*inc;
          });
        }
        row[sc.n]=vs.reduce((a,b)=>a+b,0);
      });
      return row;
    });
  },[sd,yrs,intv,annInc,divReinvest,adj,appMode,tot]);

  const milestones=useMemo(()=>
    [1e3,5e3,1e4,25e3,5e4,1e5,25e4,5e5,1e6].map(t=>{const pt=proj.find(p=>p.val>=t);return pt?{t,lbl:pt.lbl,idr:t*rate}:null}).filter(Boolean)
  ,[proj,rate]);

  const narr=useMemo(()=>buildNarrative(sd,tot,proj,s,grossPer,totalAl,intv),[sd,tot,proj,s,grossPer,totalAl,intv]);
  const pie=sd.map(x=>({name:x.tk,value:x.al,color:x.etf.c}));
  const fin=proj[proj.length-1];

  return(
  <div style={{fontFamily:cs.f,background:cs.bg,color:cs.t1,minHeight:"100vh",maxWidth:820,margin:"0 auto"}}>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;600;700&display=swap" rel="stylesheet"/>

    {/* ═══ HEADER ═══ */}
    <div style={{padding:"12px 12px 8px",borderBottom:`1px solid ${cs.bd}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div>
          <h1 style={{margin:0,fontSize:15,fontWeight:800,letterSpacing:-.4}}>DCA Portfolio Intelligence</h1>
          <p style={{margin:0,fontSize:8,color:cs.t3}}>Gotrade Indonesia — Simulate · Record · Analyze</p>
        </div>
        <button onClick={()=>D("CFG",{showCfg:!showCfg})} style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${cs.bd}`,background:showCfg?cs.sf2:"transparent",color:cs.t2,fontSize:10,cursor:"pointer"}}>⚙</button>
      </div>

      {/* App Mode Toggle */}
      <div style={{display:"flex",gap:4,marginBottom:8}}>
        {[{m:"sim",l:"🔬 Simulation Mode",d:"Simulasi DCA tanpa data aktual"},{m:"record",l:"📒 Actual Record",d:"Track investasi nyata + proyeksi"}].map(x=>
          <button key={x.m} onClick={()=>D("CFG",{appMode:x.m})} style={{
            flex:1,padding:"8px 10px",borderRadius:5,border:`1.5px solid ${appMode===x.m?cs.acc:cs.bd}`,
            background:appMode===x.m?`${cs.acc}12`:"transparent",cursor:"pointer",textAlign:"left",
          }}>
            <div style={{fontSize:11,fontWeight:700,color:appMode===x.m?cs.acc:cs.t2}}>{x.l}</div>
            <div style={{fontSize:8,color:cs.t3,marginTop:1}}>{x.d}</div>
          </button>
        )}
      </div>

      {/* Config */}
      {showCfg&&(
        <div style={{padding:10,background:cs.sf2,borderRadius:5,border:`1px solid ${cs.bd}`,marginBottom:6}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginBottom:6}}>
            <Inp l="Cicilan" v={idr} onChange={v=>D("CFG",{idr:v})} pre="Rp"/>
            <Inp l="Kurs" v={rate} onChange={v=>D("CFG",{rate:v})} pre="$="/>
            <Inp l="Fee" v={fee} onChange={v=>D("CFG",{fee:v})} suf="%" step={.1}/>
            <Inp l="Spread" v={spread} onChange={v=>D("CFG",{spread:v})} suf="%" step={.1}/>
            <Inp l="Proyeksi" v={yrs} onChange={v=>D("CFG",{yrs:Math.max(1,Math.min(30,v||1))})} suf="thn"/>
            <Inp l="Adj Return" v={adj} onChange={v=>D("CFG",{adj:v})} suf="%" step={.5}/>
            <Inp l="DCA +/thn" v={annInc} onChange={v=>D("CFG",{annInc:v})} suf="%"/>
            <div style={{display:"flex",flexDirection:"column",gap:2}}>
              <label style={{fontSize:8,color:cs.t3,fontWeight:600,textTransform:"uppercase"}}>DRIP</label>
              <button onClick={()=>D("CFG",{divReinvest:!divReinvest})} style={{height:28,borderRadius:4,
                border:`1px solid ${divReinvest?cs.grn:cs.bd}`,background:divReinvest?`${cs.grn}18`:"transparent",
                color:divReinvest?cs.grn:cs.t3,fontSize:10,fontWeight:700,cursor:"pointer"}}>{divReinvest?"ON ✓":"OFF"}</button>
            </div>
          </div>

          {/* Interval + Alloc mode */}
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:9,color:cs.t3,fontWeight:600}}>Interval:</span>
            <div style={{display:"flex",gap:3}}>
              {INTERVALS.map(iv=><Pill key={iv.id} active={interval===iv.id} onClick={()=>D("CFG",{interval:iv.id})}>{iv.nm}</Pill>)}
            </div>
            <span style={{fontSize:9,color:cs.t3,fontWeight:600,marginLeft:8}}>Alokasi:</span>
            <div style={{display:"flex",gap:3}}>
              {ALLOC_MODES.map(am=><Pill key={am.id} active={allocMode===am.id} onClick={()=>D("CFG",{allocMode:am.id})} color={cs.pur}>{am.nm}</Pill>)}
            </div>
          </div>

          <div style={{display:"flex",justifyContent:"space-between",padding:"5px 8px",background:cs.bg,borderRadius:4}}>
            <span style={{fontSize:9,color:cs.t3}}>Net per {intv.nm.toLowerCase()}</span>
            <span style={{fontSize:13,fontWeight:700,color:cs.grn,fontFamily:cs.m}}>{$(grossPer,2)}<span style={{fontSize:9,color:cs.t3,fontWeight:400}}> ({R(idr)} × {intv.factor.toFixed(2)})</span></span>
          </div>
        </div>
      )}

      {/* Quick bar */}
      {!showCfg&&(
        <div style={{display:"flex",justifyContent:"space-between",padding:"4px 8px",background:cs.sf2,borderRadius:4,fontSize:9,color:cs.t3,alignItems:"center"}}>
          <span>DCA: <b style={{color:cs.grn,fontFamily:cs.m}}>{$(grossPer,2)}/{intv.nm.toLowerCase()}</b></span>
          {appMode==="record"&&<span>Value: <b style={{color:cs.acc,fontFamily:cs.m}}>{$(tot.cur)}</b></span>}
          <span>Risk: <b style={{color:narr.riskC}}>{narr.risk}</b></span>
          {fin&&<span>{yrs}yr: <b style={{color:cs.acc,fontFamily:cs.m}}>{$(fin.val)}</b></span>}
        </div>
      )}
    </div>

    {/* ═══ NAV ═══ */}
    <div style={{display:"flex",borderBottom:`1px solid ${cs.bd}`}}>
      {[{id:"main",l:"Dashboard"},{id:"txn",l:appMode==="sim"?"Plan Entry":"Record"},{id:"proj",l:"Projection"},{id:"anal",l:"Analysis"}].map(n=>
        <button key={n.id} onClick={()=>D("SET",{view:n.id})} style={{
          flex:1,padding:"7px 0",border:"none",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:cs.f,
          background:view===n.id?cs.sf:"transparent",color:view===n.id?cs.acc:cs.t3,
          borderBottom:view===n.id?`2px solid ${cs.acc}`:"2px solid transparent",
        }}>{n.l}</button>
      )}
    </div>

    <div style={{padding:10}}>

    {/* ══════ DASHBOARD ══════ */}
    {view==="main"&&(<>
      {/* Metrics */}
      {appMode==="record"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:5,marginBottom:8}}>
          {[{l:"Invested",v:$(tot.inv)},{l:"Value",v:$(tot.cur),c:cs.acc},{l:"P&L",v:`${tot.gl>=0?"+":""}${$(tot.gl)}`,c:tot.gl>=0?cs.grn:cs.red,s:P(tot.glP)},{l:"Div/yr",v:$(tot.annD),c:cs.cyn}]
            .map((x,i)=><Box key={i} style={{padding:"7px 8px"}}><Num l={x.l} v={x.v} c={x.c} s={x.s}/></Box>)}
        </div>
      )}

      {/* Allocation */}
      <Box style={{padding:10,marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
          <span style={{fontSize:10,fontWeight:700}}>Allocation {allocMode==="usd"?"(USD)":"(%)"}</span>
          <span style={{fontSize:10,fontFamily:cs.m,color:totalAl===100||allocMode==="usd"?cs.grn:cs.red,fontWeight:700}}>
            {allocMode==="pct"?`${totalAl}%`:$(sd.reduce((a,x)=>a+x.perUSD,0))+`/${intv.nm.toLowerCase()}`}
          </span>
        </div>

        {allocMode==="pct"&&<div style={{display:"flex",height:5,borderRadius:3,overflow:"hidden",marginBottom:6,background:cs.bd}}>
          {sd.map((x,i)=><div key={i} style={{width:`${x.al}%`,background:x.etf.c,transition:"width .2s"}}/>)}
        </div>}

        <div style={{display:"flex",gap:8}}>
          <div style={{flex:1}}>
            {sd.map((x,i)=>(
              <div key={i} onClick={()=>D("SET",{editIdx:i,view:"txn"})} style={{
                display:"flex",alignItems:"center",gap:6,padding:"5px 6px",marginBottom:2,borderRadius:4,cursor:"pointer",
                border:`1px solid ${editIdx===i?x.etf.c:cs.bd}`,background:editIdx===i?`${x.etf.c}08`:"transparent",
              }}>
                <div style={{width:5,height:5,borderRadius:"50%",background:x.etf.c,flexShrink:0}}/>
                <span style={{fontSize:11,fontWeight:800,color:x.etf.c,fontFamily:cs.m,width:34}}>{x.tk}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:9,color:cs.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{x.etf.nm}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0,display:"flex",alignItems:"center",gap:6}}>
                  {allocMode==="pct"?(
                    <input type="number" value={x.al} onChange={e=>D("SLOT_UPD",{i,d:{alloc:Math.max(0,Math.min(100,+e.target.value||0))}})}
                      onClick={e=>e.stopPropagation()}
                      style={{width:36,textAlign:"center",padding:"2px",background:cs.bg,border:`1px solid ${cs.bd}`,borderRadius:3,color:x.etf.c,fontSize:11,fontFamily:cs.m,fontWeight:700,outline:"none"}}/>
                  ):(
                    <input type="number" value={x.usd} step="1" placeholder="0" onChange={e=>D("SLOT_UPD",{i,d:{usd:+e.target.value||0}})}
                      onClick={e=>e.stopPropagation()}
                      style={{width:50,textAlign:"right",padding:"2px 4px",background:cs.bg,border:`1px solid ${cs.bd}`,borderRadius:3,color:x.etf.c,fontSize:11,fontFamily:cs.m,fontWeight:700,outline:"none"}}/>
                  )}
                  <span style={{fontSize:8,color:cs.t3,width:14}}>{allocMode==="pct"?"%":"$"}</span>
                  <span style={{fontSize:9,color:cs.t3,fontFamily:cs.m,width:40,textAlign:"right"}}>{$(x.perUSD,1)}</span>
                </div>
              </div>
            ))}
          </div>
          {allocMode==="pct"&&<div style={{width:70,height:70,flexShrink:0}}><ResponsiveContainer><PieChart>
            <Pie data={pie} dataKey="value" cx="50%" cy="50%" innerRadius={16} outerRadius={32} strokeWidth={0} paddingAngle={2}>
              {pie.map((d,i)=><Cell key={i} fill={d.color}/>)}
            </Pie>
          </PieChart></ResponsiveContainer></div>}
        </div>

        {slots.length<6&&(
          <div style={{display:"flex",gap:3,flexWrap:"wrap",paddingTop:5,borderTop:`1px solid ${cs.bd}`,marginTop:5}}>
            <span style={{fontSize:8,color:cs.t3,display:"flex",alignItems:"center"}}>+</span>
            {Object.keys(DB).filter(t=>!slots.find(x=>x.tk===t)).map(t=>
              <button key={t} onClick={()=>D("SLOT_ADD",t)} style={{padding:"1px 7px",borderRadius:8,border:`1px solid ${DB[t].c}40`,background:"transparent",color:DB[t].c,fontSize:8,fontWeight:700,cursor:"pointer"}}>{t}</button>
            )}
          </div>
        )}
      </Box>

      {/* Narrative preview */}
      <Box style={{padding:10,marginBottom:8}}>
        <div style={{fontSize:10,fontWeight:700,marginBottom:6}}>🧠 Intelligence</div>
        {narr.lines.slice(0,3).map((ln,i)=>(
          <div key={i} style={{padding:"4px 0",borderBottom:i<2?`1px solid ${cs.bd}10`:undefined}}>
            <div style={{fontSize:9,fontWeight:700,color:ln.c||cs.t1}}>{ln.i} {ln.t}</div>
            <div style={{fontSize:9,color:cs.t2,lineHeight:1.5}}>{ln.x}</div>
          </div>
        ))}
        <button onClick={()=>D("SET",{view:"anal"})} style={{marginTop:6,padding:"4px 0",width:"100%",borderRadius:3,border:`1px dashed ${cs.acc}30`,background:"transparent",color:cs.acc,fontSize:9,fontWeight:600,cursor:"pointer"}}>Full Analysis →</button>
      </Box>

      {/* Mini chart */}
      {proj.length>2&&(
        <Box style={{padding:10}}>
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart data={proj} margin={{top:0,right:0,bottom:0,left:0}}>
              <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={cs.acc} stopOpacity={.25}/><stop offset="100%" stopColor={cs.acc} stopOpacity={0}/></linearGradient></defs>
              <XAxis dataKey="lbl" tick={{fontSize:7,fill:cs.t3}} axisLine={false} tickLine={false}/>
              <YAxis hide/>
              <Area type="monotone" dataKey="val" stroke={cs.acc} fill="url(#g1)" strokeWidth={1.5}/>
              <Area type="monotone" dataKey="inv" stroke={cs.t3} fill="none" strokeWidth={1} strokeDasharray="3 3"/>
            </AreaChart>
          </ResponsiveContainer>
          {fin&&<div style={{display:"flex",justifyContent:"space-between",marginTop:3,fontSize:8,color:cs.t3}}>
            <span>{yrs}yr: <b style={{color:cs.acc}}>{$(fin.val)}</b></span>
            <span>+<b style={{color:cs.grn}}>{P(fin.pPct)}</b></span>
            <span><b style={{color:cs.amb}}>{R(fin.valIDR)}</b></span>
            <span>Div: <b style={{color:cs.cyn}}>{$(fin.divMo)}/mo</b></span>
          </div>}
        </Box>
      )}
    </>)}

    {/* ══════ TRANSACTIONS / PLAN ══════ */}
    {view==="txn"&&(<>
      <div style={{display:"flex",gap:3,marginBottom:8}}>
        {sd.map((x,i)=><button key={i} onClick={()=>D("SET",{editIdx:i})} style={{
          flex:1,padding:"5px 2px",borderRadius:4,border:`1.5px solid ${editIdx===i?x.etf.c:cs.bd}`,
          background:editIdx===i?`${x.etf.c}10`:"transparent",color:editIdx===i?x.etf.c:cs.t3,
          fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:cs.m
        }}>{x.tk}<br/><span style={{fontSize:7,fontWeight:400}}>{x.txnCount}tx</span></button>)}
      </div>

      {editIdx!==null&&editIdx<sd.length&&(()=>{
        const x=sd[editIdx],sl=slots[editIdx];
        return(<>
          <Box style={{padding:10,marginBottom:6}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:16,fontWeight:800,color:x.etf.c,fontFamily:cs.m}}>{x.tk}</span>
                <span style={{fontSize:9,color:cs.t2}}>{x.etf.nm} · {x.etf.cat}</span>
              </div>
              <button onClick={()=>D("SLOT_RM",editIdx)} style={{padding:"1px 6px",borderRadius:3,border:`1px solid ${cs.red}40`,background:"transparent",color:cs.red,fontSize:8,cursor:"pointer"}}>×</button>
            </div>
            <div style={{fontSize:8,color:cs.t3,marginBottom:4}}>
              Forecast: {P(x.fc.base)} (10Y:{P(x.fc.cagr10)} 5Y:{P(x.fc.cagr5)} Blend:{P(x.fc.blended)}) · Div:{P(x.etf.d)} · ER:{P(x.etf.er,2)} · β:{x.etf.b} · MaxDD:{P(x.etf.dd)}
            </div>
            {appMode==="record"&&x.txnCount>0&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,padding:6,background:cs.bg,borderRadius:4}}>
                <Num l="Shares" v={x.sh>0?x.sh.toFixed(3):"—"}/><Num l="Avg" v={x.avg>0?$(x.avg,2):"—"}/>
                <Num l="Value" v={$(x.cur)} c={cs.acc}/><Num l="P&L" v={x.inv>0?`${x.gl>=0?"+":""}${P(x.glP)}`:"—"} c={x.gl>=0?cs.grn:cs.red}/>
              </div>
            )}
          </Box>

          {/* Bulk generator */}
          <Box style={{padding:8,marginBottom:6,borderColor:`${cs.pur}30`,background:`${cs.pur}05`}}>
            <div style={{fontSize:9,fontWeight:700,color:cs.pur,marginBottom:4}}>⚡ Quick Generate ({intv.nm})</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 70px",gap:4}}>
              <Inp l={`Jumlah ${intv.nm.toLowerCase()}`} v={bkN} onChange={setBkN}/>
              <Inp l="Est. harga" v={bkPr} onChange={setBkPr} pre="$" ph="0.00"/>
              <Inp l="Amount" v={bkAm} onChange={setBkAm} pre="$" ph={x.perUSD>0?x.perUSD.toFixed(0):"0"}/>
              <div style={{display:"flex",alignItems:"flex-end"}}><button onClick={()=>{
                if(+bkPr>0)D("TX_BULK",{i:editIdx,n:bkN||12,pr:+bkPr,am:+(bkAm||x.perUSD.toFixed(0))});
              }} style={{padding:"0 8px",height:28,borderRadius:4,border:"none",background:cs.pur,color:"#fff",fontSize:9,fontWeight:700,cursor:"pointer",width:"100%"}}>Go</button></div>
            </div>
            <div style={{fontSize:8,color:cs.t3,marginTop:3}}>Generate {bkN} entries × {$(+(bkAm||x.perUSD.toFixed(0)))} setiap {intv.nm.toLowerCase()}</div>
          </Box>

          {/* Transaction list */}
          <Box style={{padding:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:10,fontWeight:700}}>Entries</span>
              <span style={{fontSize:9,color:cs.t3}}>{sl.txns.length} total</span>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"20px 92px 78px 78px 64px 20px",gap:3,padding:"3px 0",borderBottom:`1px solid ${cs.bd}`}}>
              {["#","Tanggal","Harga","Amount","Shares",""].map((h,i)=><span key={i} style={{fontSize:7,color:cs.t3,fontWeight:700,textTransform:"uppercase"}}>{h}</span>)}
            </div>

            {sl.txns.length===0&&<div style={{padding:20,textAlign:"center",fontSize:10,color:cs.t3}}>Belum ada entry</div>}

            <div style={{maxHeight:300,overflowY:"auto"}}>
              {sl.txns.map((t,ti)=>{
                const sh=+t.pr>0&&+t.am>0?+t.am/+t.pr:0;
                return(
                  <div key={t.id} style={{display:"grid",gridTemplateColumns:"20px 92px 78px 78px 64px 20px",gap:3,padding:"3px 0",borderBottom:`1px solid ${cs.bd}10`}}>
                    <span style={{fontSize:8,color:cs.t3,display:"flex",alignItems:"center"}}>{ti+1}</span>
                    <input type="date" value={t.dt} onChange={e=>D("TX_UPD",{i:editIdx,id:t.id,f:"dt",v:e.target.value})}
                      style={{padding:"2px 3px",background:cs.bg,border:`1px solid ${cs.bd}`,borderRadius:3,color:cs.t1,fontSize:10,fontFamily:cs.m}}/>
                    <div style={{display:"flex",alignItems:"center",background:cs.bg,border:`1px solid ${cs.bd}`,borderRadius:3}}>
                      <span style={{padding:"0 2px",fontSize:7,color:cs.t3}}>$</span>
                      <input type="number" value={t.pr} step="0.01" placeholder="0.00" onChange={e=>D("TX_UPD",{i:editIdx,id:t.id,f:"pr",v:e.target.value})}
                        style={{width:"100%",padding:"2px",background:"transparent",border:"none",color:cs.t1,fontSize:10,fontFamily:cs.m,outline:"none"}}/>
                    </div>
                    <div style={{display:"flex",alignItems:"center",background:cs.bg,border:`1px solid ${cs.bd}`,borderRadius:3}}>
                      <span style={{padding:"0 2px",fontSize:7,color:cs.t3}}>$</span>
                      <input type="number" value={t.am} step="1" placeholder="0" onChange={e=>D("TX_UPD",{i:editIdx,id:t.id,f:"am",v:e.target.value})}
                        style={{width:"100%",padding:"2px",background:"transparent",border:"none",color:cs.t1,fontSize:10,fontFamily:cs.m,outline:"none"}}/>
                    </div>
                    <span style={{fontSize:10,color:x.etf.c,fontFamily:cs.m,display:"flex",alignItems:"center"}}>{sh>0?sh.toFixed(3):"—"}</span>
                    <button onClick={()=>D("TX_DEL",{i:editIdx,id:t.id})} style={{background:"transparent",border:"none",color:cs.red,cursor:"pointer",fontSize:12,padding:0}}>×</button>
                  </div>
                );
              })}
            </div>

            <button onClick={()=>D("TX_ADD",{i:editIdx})} style={{
              marginTop:6,padding:"6px 0",width:"100%",borderRadius:4,border:`1.5px dashed ${cs.acc}40`,
              background:"transparent",color:cs.acc,fontSize:10,fontWeight:700,cursor:"pointer"
            }}>+ Entry Manual</button>
          </Box>
        </>);
      })()}
    </>)}

    {/* ══════ PROJECTION ══════ */}
    {view==="proj"&&(<>
      <Box style={{padding:10,marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <span style={{fontSize:10,fontWeight:700}}>Growth · {yrs}yr · {intv.nm}</span>
          <Inp v={adj} onChange={v=>D("CFG",{adj:v})} pre="±" suf="%" w={80} step={.5}/>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={proj} margin={{top:5,right:5,bottom:5,left:5}}>
            <defs><linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={cs.acc} stopOpacity={.25}/><stop offset="100%" stopColor={cs.acc} stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke={cs.bd}/>
            <XAxis dataKey="lbl" tick={{fontSize:8,fill:cs.t3}} axisLine={false}/>
            <YAxis tickFormatter={v=>$(v)} tick={{fontSize:8,fill:cs.t3}} axisLine={false} width={44}/>
            <Tooltip contentStyle={{background:cs.sf,border:`1px solid ${cs.bd}`,borderRadius:5,fontSize:9,fontFamily:cs.m}} formatter={(v,n)=>[$(v),n==="val"?"Portfolio":"Modal"]}/>
            <Area type="monotone" dataKey="inv" stroke={cs.t3} fill="none" strokeWidth={1} strokeDasharray="4 3"/>
            <Area type="monotone" dataKey="val" stroke={cs.acc} fill="url(#gP)" strokeWidth={2}/>
          </AreaChart>
        </ResponsiveContainer>
      </Box>

      <Box style={{padding:10,marginBottom:8,overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["","Modal","Nilai","Profit","Return","IDR","Div/bln"].map((h,i)=>
            <th key={i} style={{padding:"3px 4px",textAlign:i?"right":"left",fontSize:7,color:cs.t3,fontWeight:700,borderBottom:`1px solid ${cs.bd}`,whiteSpace:"nowrap"}}>{h}</th>
          )}</tr></thead>
          <tbody>{proj.filter(p=>p.m>0&&(p.m%12===0||p.p===yrs*intv.perYr)).map((p,i)=>
            <tr key={i}><td style={{padding:"3px 4px",fontSize:10,fontWeight:700,color:cs.acc,fontFamily:cs.m}}>{p.lbl}</td>
            <td style={{padding:"3px 4px",textAlign:"right",fontSize:9,fontFamily:cs.m,color:cs.t3}}>{$(p.inv,0)}</td>
            <td style={{padding:"3px 4px",textAlign:"right",fontSize:9,fontFamily:cs.m,fontWeight:600}}>{$(p.val,0)}</td>
            <td style={{padding:"3px 4px",textAlign:"right",fontSize:9,fontFamily:cs.m,color:p.profit>=0?cs.grn:cs.red}}>{p.profit>=0?"+":""}{$(p.profit,0)}</td>
            <td style={{padding:"3px 4px",textAlign:"right",fontSize:9,fontFamily:cs.m,color:p.pPct>=0?cs.grn:cs.red}}>{p.pPct>=0?"+":""}{P(p.pPct)}</td>
            <td style={{padding:"3px 4px",textAlign:"right",fontSize:8,fontFamily:cs.m,color:cs.amb}}>{R(p.valIDR)}</td>
            <td style={{padding:"3px 4px",textAlign:"right",fontSize:8,fontFamily:cs.m,color:cs.cyn}}>{$(p.divMo,0)}</td>
            </tr>
          )}</tbody>
        </table>
      </Box>

      <Box style={{padding:10,marginBottom:8}}>
        <div style={{fontSize:10,fontWeight:700,color:cs.cyn,marginBottom:4}}>Dividend Income</div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={proj.filter(p=>p.m>0&&p.m%12===0)} margin={{top:0,right:0,bottom:0,left:0}}>
            <XAxis dataKey="lbl" tick={{fontSize:7,fill:cs.t3}} axisLine={false}/>
            <YAxis tickFormatter={v=>$(v)} tick={{fontSize:7,fill:cs.t3}} axisLine={false} width={32}/>
            <Tooltip contentStyle={{background:cs.sf,border:`1px solid ${cs.bd}`,borderRadius:5,fontSize:9}} formatter={v=>[`${$(v)}/bln (${R(v*rate)})`,""]}/>
            <Bar dataKey="divMo" fill={cs.cyn} radius={[2,2,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </Box>

      {milestones.length>0&&(
        <Box style={{padding:10,marginBottom:8}}>
          <div style={{fontSize:10,fontWeight:700,marginBottom:4}}>🎯 Milestones</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(85px,1fr))",gap:4}}>
            {milestones.map((m,i)=><div key={i} style={{padding:"5px 6px",background:cs.bg,borderRadius:4,border:`1px solid ${cs.bd}`,textAlign:"center"}}>
              <div style={{fontSize:11,fontWeight:800,fontFamily:cs.m,color:cs.grn}}>{$(m.t,0)}</div>
              <div style={{fontSize:8,color:cs.acc,fontWeight:600}}>@{m.lbl}</div>
              <div style={{fontSize:7,color:cs.t3}}>{R(m.idr)}</div>
            </div>)}
          </div>
        </Box>
      )}

      <Box style={{padding:10}}>
        <div style={{fontSize:10,fontWeight:700,marginBottom:4}}>5-Scenario</div>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={scens} margin={{top:5,right:5,bottom:5,left:5}}>
            <CartesianGrid strokeDasharray="3 3" stroke={cs.bd}/>
            <XAxis dataKey="yr" tickFormatter={v=>`${v}y`} tick={{fontSize:8,fill:cs.t3}}/>
            <YAxis tickFormatter={v=>$(v)} tick={{fontSize:8,fill:cs.t3}} width={44}/>
            <Tooltip contentStyle={{background:cs.sf,border:`1px solid ${cs.bd}`,borderRadius:5,fontSize:9,fontFamily:cs.m}} formatter={v=>$(v,0)} labelFormatter={l=>`${l}yr`}/>
            <Line dataKey="inv" stroke={cs.t3} strokeDasharray="5 5" strokeWidth={1} dot={false} name="Modal"/>
            {[{k:"Bear",c:cs.red},{k:"Consv",c:cs.amb},{k:"Base",c:cs.acc},{k:"Bull",c:cs.grn},{k:"Opti",c:cs.pur}].map(x=>
              <Line key={x.k} dataKey={x.k} stroke={x.c} strokeWidth={x.k==="Base"?2:1.2} dot={false}/>
            )}
            <Legend wrapperStyle={{fontSize:7}}/>
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </>)}

    {/* ══════ ANALYSIS ══════ */}
    {view==="anal"&&(<>
      <Box style={{padding:10,marginBottom:8}}>
        <div style={{fontSize:12,fontWeight:800,marginBottom:2}}>🧠 Portfolio Intelligence</div>
        <div style={{fontSize:8,color:cs.t3,marginBottom:8}}>Blended forecast · {intv.nm} DCA · {appMode==="record"?"Actual+Projection":"Pure Simulation"}</div>

        <div style={{display:"flex",gap:8,marginBottom:10,padding:8,background:cs.bg,borderRadius:5}}>
          <div style={{textAlign:"center",width:80}}>
            <div style={{fontSize:20,fontWeight:800,color:narr.riskC,fontFamily:cs.m}}>{narr.wB.toFixed(2)}β</div>
            <div style={{fontSize:9,fontWeight:700,color:narr.riskC}}>{narr.risk}</div>
          </div>
          <div style={{flex:1,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:3}}>
            <Num l="Forecast" v={P(narr.wR)} c={cs.grn}/><Num l="Div Yield" v={P(narr.wD)} c={cs.cyn}/>
            <Num l="ER" v={P(narr.wER,3)}/><Num l="MaxDD" v={P(narr.wDD)} c={cs.red}/>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5,marginBottom:8}}>
          {[{l:"S&P 500",v:narr.sp5P,c:cs.acc},{l:"Tech/Growth",v:narr.techP,c:cs.pur},{l:"Dividend",v:narr.divP,c:cs.grn}].map((x,i)=>
            <div key={i} style={{padding:6,background:cs.bg,borderRadius:4,textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:800,fontFamily:cs.m,color:x.c}}>{x.v}%</div>
              <div style={{fontSize:8,color:cs.t3}}>{x.l}</div>
              <div style={{height:3,background:`${x.c}20`,borderRadius:2,marginTop:3}}><div style={{height:3,background:x.c,borderRadius:2,width:`${Math.min(100,x.v)}%`}}/></div>
            </div>
          )}
        </div>
      </Box>

      {narr.lines.map((ln,i)=>(
        <Box key={i} ac={ln.c||cs.bd} style={{padding:10,marginBottom:5}}>
          <div style={{fontSize:9,fontWeight:700,color:ln.c||cs.t1}}>{ln.i} {ln.t}</div>
          <div style={{fontSize:9,color:cs.t2,lineHeight:1.6,marginTop:2}}>{ln.x}</div>
        </Box>
      ))}

      <Box style={{padding:10,marginTop:5,overflowX:"auto"}}>
        <div style={{fontSize:10,fontWeight:700,marginBottom:4}}>ETF Comparison</div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["ETF","Al%","Forecast","5Y","Div","ER","β","DD","$/period"].map((h,i)=>
            <th key={i} style={{padding:"3px",textAlign:i>1?"right":"left",fontSize:7,color:cs.t3,fontWeight:700,borderBottom:`1px solid ${cs.bd}`}}>{h}</th>
          )}</tr></thead>
          <tbody>{sd.map((x,i)=>
            <tr key={i}><td style={{padding:"3px",fontSize:10,fontWeight:800,color:x.etf.c,fontFamily:cs.m}}>{x.tk}</td>
            <td style={{padding:"3px",fontSize:10,fontFamily:cs.m}}>{x.al}%</td>
            <td style={{padding:"3px",textAlign:"right",fontSize:10,fontFamily:cs.m,color:cs.grn,fontWeight:600}}>{P(x.fc.base)}</td>
            <td style={{padding:"3px",textAlign:"right",fontSize:9,fontFamily:cs.m,color:cs.t2}}>{P(x.fc.cagr5)}</td>
            <td style={{padding:"3px",textAlign:"right",fontSize:9,fontFamily:cs.m,color:cs.cyn}}>{P(x.etf.d)}</td>
            <td style={{padding:"3px",textAlign:"right",fontSize:9,fontFamily:cs.m,color:x.etf.er>.1?cs.amb:cs.t2}}>{P(x.etf.er,2)}</td>
            <td style={{padding:"3px",textAlign:"right",fontSize:9,fontFamily:cs.m,color:x.etf.b>1.1?cs.red:cs.t2}}>{x.etf.b}</td>
            <td style={{padding:"3px",textAlign:"right",fontSize:9,fontFamily:cs.m,color:cs.red}}>{P(x.etf.dd)}</td>
            <td style={{padding:"3px",textAlign:"right",fontSize:9,fontFamily:cs.m}}>{$(x.perUSD,1)}</td>
            </tr>
          )}</tbody>
        </table>
      </Box>

      {/* Historical returns table */}
      <Box style={{padding:10,marginTop:5,overflowX:"auto"}}>
        <div style={{fontSize:10,fontWeight:700,marginBottom:4}}>Historical Annual Returns (%)</div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><th style={{padding:"2px 3px",fontSize:7,color:cs.t3,textAlign:"left"}}>Year</th>
            {sd.map((x,i)=><th key={i} style={{padding:"2px 3px",fontSize:8,color:x.etf.c,fontWeight:700,textAlign:"right"}}>{x.tk}</th>)}
          </tr></thead>
          <tbody>{Object.keys(sd[0]?.etf.hist||{}).reverse().map(yr=>
            <tr key={yr}><td style={{padding:"2px 3px",fontSize:9,color:cs.t3,fontFamily:cs.m}}>{yr}</td>
            {sd.map((x,i)=>{const v=x.etf.hist[yr];return(
              <td key={i} style={{padding:"2px 3px",textAlign:"right",fontSize:9,fontFamily:cs.m,color:v>=0?cs.grn:cs.red}}>{v>=0?"+":""}{v?.toFixed(1)}</td>
            )})}</tr>
          )}</tbody>
        </table>
      </Box>
    </>)}

    </div>
    <div style={{padding:"8px 12px",textAlign:"center",borderTop:`1px solid ${cs.bd}`,fontSize:7,color:cs.t3}}>⚠️ Bukan nasihat keuangan. Past performance ≠ future results. Riset sendiri sebelum investasi.</div>
  </div>);
}
