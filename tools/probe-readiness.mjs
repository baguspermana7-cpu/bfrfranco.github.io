import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
const p = await b.newPage();
const errs=[];
p.on('pageerror', e=>errs.push(e.message));
p.on('console', m => { if(m.type()==='error') errs.push('console: '+m.text()); });
await p.goto(`http://localhost:8081/spares-readiness-calculator.html?nc=${Date.now()}`, { waitUntil:'networkidle2'});
await p.evaluate(() => window.switchTab('readiness'));
await new Promise(r=>setTimeout(r,200));
// Change an input and trigger change
const r = await p.evaluate(() => {
  const inputs = document.querySelectorAll('#pane-readiness input, #pane-readiness select');
  if (!inputs.length) return 'no-inputs';
  inputs[0].value = '99';
  inputs[0].dispatchEvent(new Event('input',{bubbles:true}));
  inputs[0].dispatchEvent(new Event('change',{bubbles:true}));
  return `triggered ${inputs.length} inputs, first id=${inputs[0].id || '(no id)'}`;
});
console.log('Readiness input trigger:', r);
console.log('Page errors:', errs.length);
errs.slice(0,5).forEach(e=>console.log('  ',e));
await b.close();
