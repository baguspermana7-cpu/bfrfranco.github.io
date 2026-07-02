/* ============================================================================
   rz-article-editorial.js — editorial-register runtime for articles (v1.49.10)
   Part of RZ Dark System v1. Activates ONLY when the page declares
   <html data-rz-register="editorial">. Pure progressive enhancement:
   - injects a read-progress bar
   - builds a compact sticky "Related" rail from the page's existing
     .related-articles cards (W-D) — zero per-article markup edits
   - staggers entrance of [data-rz-enter] elements (falls back to hero/h2/p)
   Honours prefers-reduced-motion. Zero deps, ES5-safe.
   ============================================================================ */
(function(){
  'use strict';
  var root=document.documentElement;
  if(root.getAttribute('data-rz-register')!=='editorial') return;

  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* derive a thumbnail path from an article href: article-N.html ->
     assets/article-N-hero.webp (20+) or -cover.webp (1-19). onerror cascades. */
  function thumbFor(href){
    var m=/article-(\d+)/.exec(href||''); if(!m) return null;
    var n=+m[1];
    return { primary:'assets/article-'+n+'-'+(n>=20?'hero':'cover')+'.webp',
             alt:'assets/article-'+n+'-'+(n>=20?'cover':'hero')+'.webp' };
  }

  /* W-D — build a compact sticky related rail from the bottom "Continue Reading"
     cards, so it requires no per-article markup. CSS collapses it < 1024px. */
  function buildRail(){
    var container=document.querySelector('.article-content > .container');
    var src=document.querySelector('.related-articles');
    if(!container||!src) return;
    if(document.querySelector('.article-rail')) return;            /* idempotent */
    var cards=src.querySelectorAll('.related-card');
    if(cards.length<2) return;

    var rail=document.createElement('aside');
    rail.className='article-rail';
    rail.setAttribute('aria-label','Related articles');
    var head=document.createElement('div');
    head.className='article-rail-head'; head.textContent='Related';
    rail.appendChild(head);

    var limit=Math.min(cards.length,4),i;
    for(i=0;i<limit;i++){
      var c=cards[i];
      var href=c.getAttribute('href')||'#';
      var titleEl=c.querySelector('h4')||c.querySelector('h3');
      var title=titleEl?titleEl.textContent.trim():(c.textContent||'').trim().slice(0,80);
      var a=document.createElement('a');
      a.className='rz-rail-card'; a.href=href;
      var t=thumbFor(href);
      if(t){
        var im=document.createElement('img');
        im.className='rz-rail-thumb'; im.loading='lazy'; im.alt='';
        im.width=64; im.height=44; im.src=t.primary;
        (function(img,fallback){
          var tried=false;
          img.onerror=function(){ if(!tried){tried=true; img.src=fallback;} else { img.style.display='none'; } };
        })(im,t.alt);
        a.appendChild(im);
      }
      var sp=document.createElement('span');
      sp.className='rz-rail-title'; sp.textContent=title;
      a.appendChild(sp);
      rail.appendChild(a);
    }
    container.appendChild(rail);
    document.querySelector('.article-content').classList.add('rz-has-rail');
  }

  /* heading anchor links — hover a section h2 to copy its deep link (v1.50.24) */
  function buildAnchors(){
    var body=document.querySelector('.article-body'); if(!body) return;
    var used={};
    [].forEach.call(body.querySelectorAll('h2'),function(h,i){
      if(h.querySelector('.rz-anchor')) return;
      if(!h.id){
        var slug=(h.textContent||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||('section-'+i);
        while(used[slug]||document.getElementById(slug)) slug+='-'+i;
        h.id=slug;
      }
      used[h.id]=1;
      var a=document.createElement('a');
      a.className='rz-anchor'; a.href='#'+h.id; a.textContent='#';
      a.setAttribute('aria-label','Copy link to this section');
      a.addEventListener('click',function(ev){
        ev.preventDefault();
        var url=location.origin+location.pathname+'#'+h.id;
        try{ history.replaceState(null,'','#'+h.id); }catch(e){}
        var done=function(){ a.textContent='✓'; a.classList.add('rz-copied');
          setTimeout(function(){ a.textContent='#'; a.classList.remove('rz-copied'); },1200); };
        if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done,done);
        else done();
      });
      h.appendChild(a);
    });
  }

  /* live "~N min left" chip in the rail head (v1.50.24) */
  function buildMinLeft(){
    var head=document.querySelector('.article-rail-head'); if(!head) return null;
    var body=document.querySelector('.article-body'); if(!body) return null;
    /* prose-only word count (p/li/blockquote/h2-h4) — body.textContent would
       also count embedded calculator/widget text and badly over-estimate */
    var words=0;
    [].forEach.call(body.querySelectorAll('p,li,blockquote,h2,h3,h4'),function(el){
      words+=(el.textContent||'').split(/\s+/).length;
    });
    var total=Math.max(1,Math.round(words/220));
    var chip=document.createElement('span'); chip.className='rz-minleft';
    head.appendChild(chip);
    return function(progress){
      var left=Math.ceil(total*(1-progress));
      chip.textContent=left<=0?'done':('≈'+left+' min left');
    };
  }

  function init(){
    try{ buildRail(); }catch(e){}
    try{ buildAnchors(); }catch(e){}
    var minLeft=null;
    try{ minLeft=buildMinLeft(); }catch(e){}
    /* read-progress bar */
    var bar=document.createElement('div');
    bar.className='rz-read-prog';
    bar.setAttribute('aria-hidden','true');
    document.body.appendChild(bar);
    function onScroll(){
      var doc=document.documentElement,bd=document.body;
      var st=window.pageYOffset||doc.scrollTop||bd.scrollTop||0;
      var max=(doc.scrollHeight||bd.scrollHeight)-window.innerHeight;
      var p=max>0?Math.min(st/max,1):0;
      bar.style.width=(p*100)+'%';
      if(minLeft) minLeft(p);
    }
    window.addEventListener('scroll',onScroll,{passive:true});
    onScroll();

    if(reduce) return;

    /* entrance stagger — explicit [data-rz-enter] or auto-tag hero + body blocks */
    var els=document.querySelectorAll('[data-rz-enter]');
    if(!els.length){
      var auto=[];
      var hero=document.querySelector('.article-hero');
      if(hero){[].push.apply(auto,hero.children);}
      var body=document.querySelector('.article-body');
      if(body){[].forEach.call(body.children,function(c){var t=c.tagName;if(t==='H2'||t==='H3'||t==='P'||c.className.indexOf('callout')>-1||c.className.indexOf('quote')>-1||c.className.indexOf('box')>-1){auto.push(c);}});}
      auto.forEach(function(el){el.setAttribute('data-rz-enter','');});
      els=document.querySelectorAll('[data-rz-enter]');
    }
    if(!els.length) return;
    if('IntersectionObserver' in window){
      var io=new IntersectionObserver(function(es){
        es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('rz-in');io.unobserve(e.target);}});
      },{threshold:.1});
      [].forEach.call(els,function(el){io.observe(el);});
    }else{
      [].forEach.call(els,function(el){el.classList.add('rz-in');});
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
