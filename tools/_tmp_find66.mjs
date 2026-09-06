import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({headless:'new',args:['--no-sandbox']});
for (let attempt=0; attempt<6; attempt++){
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8123/datahallAI.html', {waitUntil:'networkidle2', timeout:30000});
  await new Promise(r=>setTimeout(r,1200));
  for (let i=1;i<3;i++){
    await page.reload({waitUntil:'networkidle2', timeout:30000});
    await new Promise(r=>setTimeout(r,1200));
  }
  const html = await page.content();
  const re = /\b66\s*kW\b/g;
  let m; let n=0;
  while((m = re.exec(html)) && n<5){
    console.log('attempt',attempt,'---match at', m.index, '---');
    console.log(html.slice(Math.max(0,m.index-200), m.index+200));
    n++;
  }
  if(n===0) console.log('attempt',attempt,'no match, rack-pos count', (html.match(/rack-pos/g)||[]).length);
  await page.close();
}
await browser.close();
