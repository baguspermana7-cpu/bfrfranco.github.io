/* ============================================================================
   rz-article-editorial.js — editorial-register runtime for articles (v1.43.9)
   Part of RZ Dark System v1. Activates ONLY when the page declares
   <html data-rz-register="editorial">. Pure progressive enhancement:
   - injects a read-progress bar
   - staggers entrance of [data-rz-enter] elements (falls back to hero/h2/p)
   Honours prefers-reduced-motion. Zero deps, ES5-safe.
   ============================================================================ */
(function(){
  'use strict';
  var root=document.documentElement;
  if(root.getAttribute('data-rz-register')!=='editorial') return;

  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  function init(){
    /* read-progress bar */
    var bar=document.createElement('div');
    bar.className='rz-read-prog';
    bar.setAttribute('aria-hidden','true');
    document.body.appendChild(bar);
    function onScroll(){
      var doc=document.documentElement,bd=document.body;
      var st=window.pageYOffset||doc.scrollTop||bd.scrollTop||0;
      var max=(doc.scrollHeight||bd.scrollHeight)-window.innerHeight;
      bar.style.width=(max>0?Math.min(st/max*100,100):0)+'%';
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
