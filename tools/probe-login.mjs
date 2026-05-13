import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--disable-setuid-sandbox']});
const p = await b.newPage();
const errs=[];
p.on('pageerror', e=>errs.push(e.message));
p.on('console', m => { if(m.type()==='error') errs.push(m.text()); });
await p.goto(`http://localhost:8081/spares-readiness-calculator.html?nc=${Date.now()}`, { waitUntil:'networkidle2'});
const r = await p.evaluate(() => {
  const btn = document.querySelector('.nav-login-btn, #navLoginBtn');
  if (!btn) return { ok:false, reason:'no button' };
  const onclick = btn.getAttribute('onclick');
  const result = { foundBtn: true, onclick, btnHTML: btn.outerHTML.slice(0,200) };
  // Try clicking
  try { btn.click(); result.clickOk = true; } catch(e) { result.clickErr = e.message; }
  // Check what dialog elements exist
  result.modalVisible = !!document.querySelector('#loginModal:not([hidden]),.login-modal.active,.rz-auth-modal');
  result.authReady = typeof window._rzAuth === 'object' ? Object.keys(window._rzAuth) : null;
  return result;
});
console.log(JSON.stringify(r, null, 2));
console.log('Page errors:', errs.length);
errs.slice(0,5).forEach(e=>console.log('  ',e));
await b.close();
