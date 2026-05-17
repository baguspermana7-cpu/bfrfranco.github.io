import puppeteer from 'puppeteer';
const pages=process.argv.slice(2);
const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
for(const pg of pages){
  const p=await b.newPage();
  let synt=0, other=0;
  p.on('pageerror',e=>{ if(/SyntaxError/.test(String(e))) synt++; else other++; });
  try{ await p.goto(`http://127.0.0.1:8081/${pg}`,{waitUntil:'networkidle2',timeout:25000}); }
  catch{}
  await new Promise(r=>setTimeout(r,700));
  console.log(`${synt>0?'SYNTAX_BROKEN':'no-syntax-err'}  syntaxErr=${synt} otherPageErr=${other}  ${pg}`);
  await p.close();
}
await b.close();
