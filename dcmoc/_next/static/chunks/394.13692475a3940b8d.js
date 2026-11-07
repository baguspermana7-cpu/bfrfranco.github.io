"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[394],{50394:(e,t,i)=>{i.d(t,{openStandardReport:()=>p});let o="#1e3a5f",n=["#10b981","#f59e0b","#3b82f6","#22d3ee","#ef4444","#14b8a6","#0ea5e9","#d97706"],a={info:{bg:"#eff6ff",border:"#bfdbfe",title:"#1e40af"},good:{bg:"#ecfdf5",border:"#a7f3d0",title:"#065f46"},warn:{bg:"#fffbeb",border:"#fde68a",title:"#92400e"}},l=e=>String(e??"—").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),d=(e,t)=>`<h2 style="font-size:13px;color:${o};margin:18px 0 8px;padding-left:8px;border-left:4px solid ${t};">${l(e)}</h2>`;function r(e,t){return`<div style="flex:1;background:${t?o:"#f8fafc"};${t?"color:white;border:none;":"border:1px solid #e5e7eb;"}border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:9px;${t?"opacity:.7;":"color:#94a3b8;"}text-transform:uppercase;letter-spacing:1px;">${l(e.label)}</div>
        <div style="font-size:18px;font-weight:700;color:${t?"#fbbf24":o};font-family:monospace;margin:3px 0;">${l(e.value)}</div>
        <div style="font-size:9.5px;${t?"opacity:.8;":"color:#94a3b8;"}">${l(e.sub??"")}</div>
    </div>`}function p(e){let t,i,p,s,x,f,c,g,b,$,m,y,h=window.open("","_blank");return!!h&&(h.document.write((t=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}),i=0,p=()=>n[i++%n.length],s=e.kpis.length?`<div style="display:flex;gap:10px;margin:14px 0;">${e.kpis.slice(0,4).map((e,t)=>r(e,0===t)).join("")}</div>`+(e.kpis.length>4?`<div style="display:flex;gap:10px;margin:0 0 14px;">${e.kpis.slice(4,8).map(e=>r(e,!1)).join("")}</div>`:""):"",x=e.config?.length?d("Configuration",p())+`<table style="width:100%;font-size:11px;">${Array.from({length:Math.ceil(e.config.length/2)},(t,i)=>{let o=e.config[2*i],n=e.config[2*i+1];return`<tr>
                    <td style="padding:4px 0;color:#94a3b8;width:150px;">${l(o[0])}</td><td style="padding:4px 0;font-weight:600;">${l(o[1])}</td>
                    ${n?`<td style="padding:4px 0;color:#94a3b8;width:150px;">${l(n[0])}</td><td style="padding:4px 0;font-weight:600;">${l(n[1])}</td>`:"<td></td><td></td>"}
                </tr>`}).join("")}</table>`:"",f=e.donut?`<div style="text-align:center;margin:8px 0;">${function(e){let t=e.slices.filter(e=>e.value>0),i=t.reduce((e,t)=>e+t.value,0);if(!i)return"";let n=14*t.length+8,a=-Math.PI/2,d=`<svg width="230" height="${172.5+n+10}" xmlns="http://www.w3.org/2000/svg" role="img">`;t.forEach(e=>{let t=e.value/i,o=a,n=a+2*t*Math.PI,l=+(t>.5),r=40.48000000000001;d+=`<path d="M${115+73.60000000000001*Math.cos(o)},${87.4+73.60000000000001*Math.sin(o)} A73.60000000000001,73.60000000000001 0 ${l},1 ${115+73.60000000000001*Math.cos(n)},${87.4+73.60000000000001*Math.sin(n)} L${115+r*Math.cos(n)},${87.4+r*Math.sin(n)} A${r},${r} 0 ${l},0 ${115+r*Math.cos(o)},${87.4+r*Math.sin(o)} Z" fill="${e.color}" opacity="0.85"/>`,a=n});let r=i>=1e6?`$${(i/1e6).toFixed(1)}M`:i>=1e3?`$${(i/1e3).toFixed(0)}K`:`${Math.round(i)}`;return d+=`<text x="115" y="${83.4}" text-anchor="middle" font-size="14" font-weight="700" fill="${o}" font-family="monospace">${l(r)}</text><text x="115" y="${99.4}" text-anchor="middle" font-size="9" fill="#6b7280">${l(e.unitLabel)}</text>`,t.forEach((e,t)=>{let o=182.5+14*t;d+=`<rect x="10" y="${o}" width="8" height="8" rx="2" fill="${e.color}"/><text x="22" y="${o+8}" font-size="8.5" fill="#374151">${l(e.label)} ${(e.value/i*100).toFixed(1)}%</text>`}),d+"</svg>"}(e.donut)}</div>`:"",c=e.sections.map(e=>{let t,i;return d(e.title,p())+(t=e.head.map(e=>`<th scope="col" style="padding:6px 8px;text-align:left;font-size:10px;">${l(e)}</th>`).join(""),i=e.rows.map((e,t)=>`<tr${t%2?' style="background:#f9fafb;"':""}>${e.map(e=>`<td style="padding:5px 8px;font-size:10.5px;border-bottom:1px solid #f1f5f9;">${l(e)}</td>`).join("")}</tr>`).join(""),`<table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
        <tr style="background:${o};color:white;">${t}</tr>${i}</table>`)}).join(""),g=(e.callouts??[]).map(e=>{let t=a[e.tone??"info"];return`<div style="background:${t.bg};border:1px solid ${t.border};border-radius:10px;padding:12px;margin:10px 0;">
            <div style="font-size:12px;font-weight:700;color:${t.title};margin-bottom:5px;">${l(e.title)}</div>
            <p style="font-size:11px;line-height:1.6;color:#374151;margin:0;">${l(e.body)}</p>
        </div>`}).join(""),b=e.assessment?`
        <h2 style="font-size:15px;color:${o};border-bottom:3px solid ${o};padding-bottom:6px;margin:20px 0 12px;">Executive Assessment</h2>
        <div style="display:flex;gap:12px;margin-bottom:12px;">
            <div style="flex:0 0 140px;background:${e.assessment.color??"#0284c7"};color:white;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:10px;opacity:.8;text-transform:uppercase;letter-spacing:1px;">Profile</div>
                <div style="font-size:15px;font-weight:800;margin:4px 0;">${l(e.assessment.label)}</div>
                <div style="font-size:11px;opacity:.9;">${l(e.assessment.valueLine)}</div>
            </div>
            <div style="flex:1;font-size:11.5px;line-height:1.65;color:#374151;">${l(e.assessment.narrative)}</div>
        </div>`:"",$=e.actions?.length?d("Prioritized Action Items",p())+`<table style="width:100%;border-collapse:collapse;">${e.actions.map(e=>{let t="HIGH"===e.priority?"#dc2626":"MEDIUM"===e.priority?"#d97706":"#059669";return`<tr><td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;width:70px;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${t};color:white;font-size:9px;font-weight:700;">${l(e.priority)}</span></td>
                    <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;">${l(e.action)}</td></tr>`}).join("")}</table>`:"",m=e.summaryBand?.length?`<div style="display:flex;gap:8px;background:${o};border-radius:10px;padding:12px;margin:18px 0 10px;">${e.summaryBand.map(e=>`<div style="flex:1;text-align:center;color:white;">
                <div style="font-size:13px;font-weight:700;font-family:monospace;">${l(e.value)}</div>
                <div style="font-size:7.5px;opacity:.65;text-transform:uppercase;letter-spacing:.5px;">${l(e.label)}</div>
            </div>`).join("")}</div>`:"",y=e.headline??e.kpis[0],`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${l(e.title)} — ${t}</title>
    <style>
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{margin:12mm 15mm;}}
        table{page-break-inside:auto;}tr{page-break-inside:avoid;}
        body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#111827;margin:0;padding:20px 26px;font-size:12px;}
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${o};padding-bottom:10px;">
        <div>
            <div style="font-size:20px;font-weight:800;color:${o};">${l(e.title)}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">DC-OS \xb7 ${l(e.layer)} \xb7 ${l(e.project)} \xb7 Generated ${t}${e.orgName?` \xb7 ${l(e.orgName)}`:""}</div>
        </div>
        ${y?`<div style="background:${o};color:#fbbf24;border-radius:8px;padding:8px 14px;text-align:center;">
            <div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">${l(y.label)}</div>
            <div style="font-size:16px;font-weight:800;font-family:monospace;">${l(y.value)}</div>
        </div>`:""}
    </div>
    ${s}${x}${c}${f}${g}${b}${$}${m}
    ${e.note?`<p style="font-size:10px;color:#64748b;line-height:1.5;margin:10px 0;">${l(e.note)}</p>`:""}
    <div style="border-top:1px solid #e5e7eb;margin-top:14px;padding-top:8px;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between;">
        <span>Planning estimates — engine-computed from the placed requirements; not a quotation. DC-OS \xb7 resistancezero.com</span>
        <span>CONFIDENTIAL</span>
    </div>
    </body></html>`)),h.document.close(),window.setTimeout(()=>{try{h.print()}catch{}},500),!0)}}}]);