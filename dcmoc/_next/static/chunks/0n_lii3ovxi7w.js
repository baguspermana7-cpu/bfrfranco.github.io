(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,76131,t=>{"use strict";let e="#1e3a5f",i=["#10b981","#f59e0b","#3b82f6","#8b5cf6","#ef4444","#14b8a6","#0ea5e9","#d97706"],o={info:{bg:"#eff6ff",border:"#bfdbfe",title:"#1e40af"},good:{bg:"#ecfdf5",border:"#a7f3d0",title:"#065f46"},warn:{bg:"#fffbeb",border:"#fde68a",title:"#92400e"}},n=t=>String(t??"—").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),a=(t,i)=>`<h2 style="font-size:13px;color:${e};margin:18px 0 8px;padding-left:8px;border-left:4px solid ${i};">${n(t)}</h2>`;function l(t,i){return`<div style="flex:1;background:${i?e:"#f8fafc"};${i?"color:white;border:none;":"border:1px solid #e5e7eb;"}border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:9px;${i?"opacity:.7;":"color:#94a3b8;"}text-transform:uppercase;letter-spacing:1px;">${n(t.label)}</div>
        <div style="font-size:18px;font-weight:700;color:${i?"#fbbf24":e};font-family:monospace;margin:3px 0;">${n(t.value)}</div>
        <div style="font-size:9.5px;${i?"opacity:.8;":"color:#94a3b8;"}">${n(t.sub??"")}</div>
    </div>`}t.s(["openStandardReport",0,function(t){let d,r,p,s,x,c,f,g,b,$,m,y,h=window.open("","_blank");return!!h&&(h.document.write((d=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}),r=0,p=()=>i[r++%i.length],s=t.kpis.length?`<div style="display:flex;gap:10px;margin:14px 0;">${t.kpis.slice(0,4).map((t,e)=>l(t,0===e)).join("")}</div>`+(t.kpis.length>4?`<div style="display:flex;gap:10px;margin:0 0 14px;">${t.kpis.slice(4,8).map(t=>l(t,!1)).join("")}</div>`:""):"",x=t.config?.length?a("Configuration",p())+`<table style="width:100%;font-size:11px;">${Array.from({length:Math.ceil(t.config.length/2)},(e,i)=>{let o=t.config[2*i],a=t.config[2*i+1];return`<tr>
                    <td style="padding:4px 0;color:#94a3b8;width:150px;">${n(o[0])}</td><td style="padding:4px 0;font-weight:600;">${n(o[1])}</td>
                    ${a?`<td style="padding:4px 0;color:#94a3b8;width:150px;">${n(a[0])}</td><td style="padding:4px 0;font-weight:600;">${n(a[1])}</td>`:"<td></td><td></td>"}
                </tr>`}).join("")}</table>`:"",c=t.donut?`<div style="text-align:center;margin:8px 0;">${function(t){let i=t.slices.filter(t=>t.value>0),o=i.reduce((t,e)=>t+e.value,0);if(!o)return"";let a=14*i.length+8,l=-Math.PI/2,d=`<svg width="230" height="${172.5+a+10}" xmlns="http://www.w3.org/2000/svg" role="img">`;i.forEach(t=>{let e=t.value/o,i=l,n=l+2*e*Math.PI,a=+(e>.5),r=40.48000000000001;d+=`<path d="M${115+73.60000000000001*Math.cos(i)},${87.4+73.60000000000001*Math.sin(i)} A73.60000000000001,73.60000000000001 0 ${a},1 ${115+73.60000000000001*Math.cos(n)},${87.4+73.60000000000001*Math.sin(n)} L${115+r*Math.cos(n)},${87.4+r*Math.sin(n)} A${r},${r} 0 ${a},0 ${115+r*Math.cos(i)},${87.4+r*Math.sin(i)} Z" fill="${t.color}" opacity="0.85"/>`,l=n});let r=o>=1e6?`$${(o/1e6).toFixed(1)}M`:o>=1e3?`$${(o/1e3).toFixed(0)}K`:`${Math.round(o)}`;return d+=`<text x="115" y="${83.4}" text-anchor="middle" font-size="14" font-weight="700" fill="${e}" font-family="monospace">${n(r)}</text><text x="115" y="${99.4}" text-anchor="middle" font-size="9" fill="#6b7280">${n(t.unitLabel)}</text>`,i.forEach((t,e)=>{let i=182.5+14*e;d+=`<rect x="10" y="${i}" width="8" height="8" rx="2" fill="${t.color}"/><text x="22" y="${i+8}" font-size="8.5" fill="#374151">${n(t.label)} ${(t.value/o*100).toFixed(1)}%</text>`}),d+"</svg>"}(t.donut)}</div>`:"",f=t.sections.map(t=>{let i,o;return a(t.title,p())+(i=t.head.map(t=>`<th scope="col" style="padding:6px 8px;text-align:left;font-size:10px;">${n(t)}</th>`).join(""),o=t.rows.map((t,e)=>`<tr${e%2?' style="background:#f9fafb;"':""}>${t.map(t=>`<td style="padding:5px 8px;font-size:10.5px;border-bottom:1px solid #f1f5f9;">${n(t)}</td>`).join("")}</tr>`).join(""),`<table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
        <tr style="background:${e};color:white;">${i}</tr>${o}</table>`)}).join(""),g=(t.callouts??[]).map(t=>{let e=o[t.tone??"info"];return`<div style="background:${e.bg};border:1px solid ${e.border};border-radius:10px;padding:12px;margin:10px 0;">
            <div style="font-size:12px;font-weight:700;color:${e.title};margin-bottom:5px;">${n(t.title)}</div>
            <p style="font-size:11px;line-height:1.6;color:#374151;margin:0;">${n(t.body)}</p>
        </div>`}).join(""),b=t.assessment?`
        <h2 style="font-size:15px;color:${e};border-bottom:3px solid ${e};padding-bottom:6px;margin:20px 0 12px;">Executive Assessment</h2>
        <div style="display:flex;gap:12px;margin-bottom:12px;">
            <div style="flex:0 0 140px;background:${t.assessment.color??"#0284c7"};color:white;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:10px;opacity:.8;text-transform:uppercase;letter-spacing:1px;">Profile</div>
                <div style="font-size:15px;font-weight:800;margin:4px 0;">${n(t.assessment.label)}</div>
                <div style="font-size:11px;opacity:.9;">${n(t.assessment.valueLine)}</div>
            </div>
            <div style="flex:1;font-size:11.5px;line-height:1.65;color:#374151;">${n(t.assessment.narrative)}</div>
        </div>`:"",$=t.actions?.length?a("Prioritized Action Items",p())+`<table style="width:100%;border-collapse:collapse;">${t.actions.map(t=>{let e="HIGH"===t.priority?"#dc2626":"MEDIUM"===t.priority?"#d97706":"#059669";return`<tr><td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;width:70px;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${e};color:white;font-size:9px;font-weight:700;">${n(t.priority)}</span></td>
                    <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;">${n(t.action)}</td></tr>`}).join("")}</table>`:"",m=t.summaryBand?.length?`<div style="display:flex;gap:8px;background:${e};border-radius:10px;padding:12px;margin:18px 0 10px;">${t.summaryBand.map(t=>`<div style="flex:1;text-align:center;color:white;">
                <div style="font-size:13px;font-weight:700;font-family:monospace;">${n(t.value)}</div>
                <div style="font-size:7.5px;opacity:.65;text-transform:uppercase;letter-spacing:.5px;">${n(t.label)}</div>
            </div>`).join("")}</div>`:"",y=t.headline??t.kpis[0],`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${n(t.title)} — ${d}</title>
    <style>
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{margin:12mm 15mm;}}
        table{page-break-inside:auto;}tr{page-break-inside:avoid;}
        body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#111827;margin:0;padding:20px 26px;font-size:12px;}
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${e};padding-bottom:10px;">
        <div>
            <div style="font-size:20px;font-weight:800;color:${e};">${n(t.title)}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">DC-OS \xb7 ${n(t.layer)} \xb7 ${n(t.project)} \xb7 Generated ${d}${t.orgName?` \xb7 ${n(t.orgName)}`:""}</div>
        </div>
        ${y?`<div style="background:${e};color:#fbbf24;border-radius:8px;padding:8px 14px;text-align:center;">
            <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">${n(y.label)}</div>
            <div style="font-size:16px;font-weight:800;font-family:monospace;">${n(y.value)}</div>
        </div>`:""}
    </div>
    ${s}${x}${f}${c}${g}${b}${$}${m}
    ${t.note?`<p style="font-size:10px;color:#64748b;line-height:1.5;margin:10px 0;">${n(t.note)}</p>`:""}
    <div style="border-top:1px solid #e5e7eb;margin-top:14px;padding-top:8px;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between;">
        <span>Planning estimates — engine-computed from the placed requirements; not a quotation. DC-OS \xb7 resistancezero.com</span>
        <span>CONFIDENTIAL</span>
    </div>
    </body></html>`)),h.document.close(),window.setTimeout(()=>{try{h.print()}catch{}},500),!0)}])}]);