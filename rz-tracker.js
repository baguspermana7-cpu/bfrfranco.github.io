/**
 * ResistanceZero — Lightweight User Activity Tracker
 * Stores events in localStorage for admin dashboard consumption.
 * Captures: IP, country, city, timezone, screen, language, referrer, browser.
 *
 * Event types: page_view, pro_click, demo_login, pdf_export,
 *              cv_download, ws_download, calc_use, signup
 */
(function(){
    'use strict';
    var KEY='rz_user_events';
    var GEO_KEY='rz_geo_cache';
    var MAX_EVENTS=5000;
    var sessionId='ses_'+Math.random().toString(36).substring(2,10);

    // ═══ GEO INFO (cached per session) ═══
    var geoInfo=null;
    function loadGeo(){
        // Check cache (valid for 30 min)
        try{
            var cached=JSON.parse(sessionStorage.getItem(GEO_KEY)||'null');
            if(cached&&cached._ts&&Date.now()-cached._ts<1800000){geoInfo=cached;return Promise.resolve(cached)}
        }catch(e){}
        // Fetch from ipapi.co (free: 1000/day, HTTPS)
        return fetch('https://ipapi.co/json/',{mode:'cors'}).then(function(r){return r.json()}).then(function(d){
            geoInfo={
                ip:d.ip||'',
                country:d.country_name||'',
                cc:d.country_code||'',
                city:d.city||'',
                region:d.region||'',
                tz:d.timezone||'',
                org:d.org||'',
                _ts:Date.now()
            };
            try{sessionStorage.setItem(GEO_KEY,JSON.stringify(geoInfo))}catch(e){}
            // Patch existing events from this session that have no IP
            patchSessionEvents();
            return geoInfo;
        }).catch(function(){
            geoInfo={ip:'',country:'',cc:'',city:'',region:'',tz:Intl.DateTimeFormat().resolvedOptions().timeZone||'',org:'',_ts:Date.now()};
            return geoInfo;
        });
    }

    function patchSessionEvents(){
        if(!geoInfo||!geoInfo.ip)return;
        try{
            var events=getEvents();
            var patched=false;
            for(var i=0;i<events.length;i++){
                if(events[i].sid===sessionId&&!events[i].ip){
                    events[i].ip=geoInfo.ip;
                    events[i].country=geoInfo.country;
                    events[i].cc=geoInfo.cc;
                    events[i].city=geoInfo.city;
                    patched=true;
                }
            }
            if(patched)saveEvents(events);
        }catch(e){}
    }

    // ═══ DEVICE INFO ═══
    function getDevice(){
        var ua=navigator.userAgent;
        if(/Mobile|Android|iPhone|iPad/i.test(ua))return 'Mobile';
        if(/Tablet|iPad/i.test(ua))return 'Tablet';
        return 'Desktop';
    }
    function getBrowser(){
        var ua=navigator.userAgent;
        if(ua.indexOf('Edg/')!==-1)return 'Edge';
        if(ua.indexOf('OPR/')!==-1||ua.indexOf('Opera')!==-1)return 'Opera';
        if(ua.indexOf('Chrome/')!==-1)return 'Chrome';
        if(ua.indexOf('Safari/')!==-1&&ua.indexOf('Chrome/')===-1)return 'Safari';
        if(ua.indexOf('Firefox/')!==-1)return 'Firefox';
        return 'Other';
    }

    // ═══ STORAGE ═══
    function getEvents(){
        try{var r=localStorage.getItem(KEY);return r?JSON.parse(r):[]}catch(e){return[]}
    }
    function saveEvents(arr){
        try{
            if(arr.length>MAX_EVENTS)arr=arr.slice(0,MAX_EVENTS);
            localStorage.setItem(KEY,JSON.stringify(arr));
        }catch(e){}
    }

    // ═══ TRACK ═══
    function track(type,extra){
        var evt={
            type:type,
            page:location.pathname.split('/').pop()||'index.html',
            ts:Date.now(),
            ip:geoInfo?geoInfo.ip:'',
            country:geoInfo?geoInfo.country:'',
            cc:geoInfo?geoInfo.cc:'',
            city:geoInfo?geoInfo.city:'',
            tz:geoInfo?geoInfo.tz:(Intl.DateTimeFormat().resolvedOptions().timeZone||''),
            device:getDevice(),
            browser:getBrowser(),
            screen:screen.width+'x'+screen.height,
            lang:navigator.language||'',
            ref:document.referrer?new URL(document.referrer).hostname:'direct',
            ua:navigator.userAgent.substring(0,80),
            sid:sessionId
        };
        if(extra)for(var k in extra)evt[k]=extra[k];
        var events=getEvents();
        events.unshift(evt);
        saveEvents(events);
    }

    // Expose globally
    window.rzTrack=track;

    // ═══ INIT: fetch geo + track page view ═══
    track('page_view');
    loadGeo();

    // ═══ AUTO-DETECT EVENTS ═══
    document.addEventListener('click',function(e){
        var t=e.target;
        var btn=t.closest('button,a,[onclick]');
        if(!btn)return;

        var text=(btn.textContent||'').toLowerCase().trim();
        var cls=(btn.className||'').toLowerCase();
        var href=(btn.getAttribute('href')||'').toLowerCase();
        var onclick=(btn.getAttribute('onclick')||'').toLowerCase();

        // Pro mode toggle
        if(text.indexOf('pro mode')!==-1||text.indexOf('enable pro')!==-1||
           text.indexOf('activate pro')!==-1||cls.indexOf('pro-toggle')!==-1||
           onclick.indexOf('togglepro')!==-1||onclick.indexOf('enablepro')!==-1||
           onclick.indexOf('activatepro')!==-1){
            track('pro_click');
        }
        // PDF Export
        else if(text.indexOf('export pdf')!==-1||text.indexOf('download pdf')!==-1||
                text.indexOf('generate pdf')!==-1||text.indexOf('export report')!==-1||
                onclick.indexOf('exportpdf')!==-1||onclick.indexOf('generatepdf')!==-1||
                onclick.indexOf('downloadpdf')!==-1){
            track('pdf_export');
        }
        // CV Download
        else if(href.indexOf('cv')!==-1&&(href.indexOf('.pdf')!==-1||href.indexOf('download')!==-1)||
                text.indexOf('download cv')!==-1||text.indexOf('resume')!==-1){
            track('cv_download');
        }
        // Work Sample Download
        else if(text.indexOf('work sample')!==-1||text.indexOf('worksample')!==-1||
                text.indexOf('portfolio download')!==-1||
                (href.indexOf('sample')!==-1&&href.indexOf('.pdf')!==-1)){
            track('ws_download');
        }
        // Calculator use
        else if(text.indexOf('calculate')!==-1||text.indexOf('run calculation')!==-1||
                onclick.indexOf('calculate')!==-1||onclick.indexOf('runcalc')!==-1){
            track('calc_use');
        }
    });

    // ═══ DETECT DEMO LOGIN ═══
    window.addEventListener('rz-auth-change',function(e){
        if(e.detail&&e.detail.action==='login'){
            if(e.detail.email==='demo@resistancezero.com'){
                track('demo_login',{email:e.detail.email});
            } else {
                track('signup',{email:e.detail.email});
            }
        }
    });
})();
