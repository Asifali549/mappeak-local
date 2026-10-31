const { chromium } = require('playwright');
const SYNC = 'https://script.google.com/macros/s/TEST/exec';
let cloud = {};                       // fake Google Apps Script storage
const calls = {search:0, details:0, psi:0};
const places = [
  {id:'p1',displayName:{text:'Lone Star Plumbing Co'},formattedAddress:'100 Main St, Abilene, TX 79601, USA',rating:3.9,userRatingCount:8,websiteUri:'https://lonestar.example/',nationalPhoneNumber:'(325) 555-0101',googleMapsUri:'https://maps.google.com/?cid=1',primaryType:'plumber',primaryTypeDisplayName:{text:'Plumber'},businessStatus:'OPERATIONAL',reviews:[{publishTime:new Date(Date.now()-200*864e5).toISOString(),rating:5}]},
  {id:'p2',displayName:{text:'Air-Tech Plumbing'},formattedAddress:'200 Oak St, Abilene, TX 79605, USA',rating:4.6,userRatingCount:120,websiteUri:'https://airtech.example/',nationalPhoneNumber:'(325) 555-0102',primaryType:'plumber',primaryTypeDisplayName:{text:'Plumber'},businessStatus:'OPERATIONAL'},
  {id:'p3',displayName:{text:'Big Country Drain'},formattedAddress:'300 Elm St, Abilene, TX 79603, USA',rating:4.2,userRatingCount:15,websiteUri:'https://bigcountry.example/',nationalPhoneNumber:'(325) 555-0103',primaryType:'plumber',primaryTypeDisplayName:{text:'Plumber'},businessStatus:'OPERATIONAL'}];
const psiFor = u => ({lighthouseResult:{finalDisplayedUrl:u,categories:{performance:{score:0.42}},audits:{
  'is-on-https':{score:1},'http-status-code':{score:1},'is-crawlable':{score:1},'meta-description':{score:0},'document-title':{score:1},'viewport':{score:1},
  'network-requests':{details:{items: /lonestar/.test(u) ? [{url:u},{url:'https://www.googletagmanager.com/gtag/js?id=AW-123456'},{url:'https://connect.facebook.net/en_US/fbevents.js'}] : [{url:u},{url:'https://www.googletagmanager.com/gtag/js?id=G-XYZ'}]}}}}});
async function mock(ctx){
  await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
    const u = r.request().url(), m = r.request().method();
    const json = (o,s=200) => r.fulfill({status:s, contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body:JSON.stringify(o)});
    if(u.startsWith(SYNC)){ if(m==='POST'){ cloud = JSON.parse(r.request().postData()); return json({ok:1}); } return json(cloud); }
    if(/places:searchText/.test(u)){ calls.search++; return json({places}); }
    if(/places\.googleapis\.com\/v1\/places\//.test(u)){ calls.details++; return /p3$/.test(u.split('?')[0]) ? json({error:{code:404}},404) : json({id:'x'}); }
    if(/pagespeedonline/.test(u)){ calls.psi++; return json(psiFor(decodeURIComponent(u.match(/url=([^&]+)/)[1]))); }
    if(/dns\.google|cloudflare-dns|quad9/.test(u)){ return json(/_dmarc/.test(u)?{Answer:[]}:(/type=MX/.test(u)?{Answer:[{type:15,data:'10 mx.example.'}]}:{Answer:[]})); }
    if(/rdap/.test(u)) return json({events:[{eventAction:'expiration',eventDate:new Date(Date.now()+20*864e5).toISOString()}]});
    if(/webrisk/.test(u)) return json({});
    return r.abort();
  });
}
(async () => {
  const b = await chromium.launch(); const res=[]; const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
  const mk = async () => { const ctx = await b.newContext({viewport:{width:400,height:900}}); await mock(ctx); const p = await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('dialog',d=>d.accept()); return [ctx,p]; };
  const URL=(process.env.BASE||'http://localhost:8765')+'/finder.html';
  // PHONE
  const [c1, phone] = await mk(); await phone.goto(URL); await phone.waitForTimeout(600);
  await phone.evaluate(()=>document.getElementById('setBox').open=true);
  await phone.fill('#apiKey','AIzaTESTKEY'); await phone.fill('#syncUrl', SYNC); await phone.click('#saveSet'); await phone.waitForTimeout(1500);
  ok('1 phone settings saved + first sync', !!cloud.mp_apiKey && cloud.mp_apiKey.v==='AIzaTESTKEY');
  await phone.selectOption('#country','US'); await phone.uncheck('#urgentOnly'); await phone.uncheck('#needWeb');
  await phone.fill('#trade','plumber'); await phone.fill('#towns','Abilene, TX'); await phone.fill('#target','30'); await phone.fill('#minReviews','0');
  await phone.click('#go'); await phone.waitForTimeout(6000);
  const names = await phone.$$eval('.lead .name', e=>e.map(x=>x.textContent));
  ok('2 Places search -> leads shown', names.length>=2, names.join(', '));
  const firstCard = await phone.textContent('.lead');
  ok('3 PageSpeed -> ad-tag badges on the right lead', /گوگل اشتہار کا کوڈ/.test(firstCard) && /فیس بک اشتہار کا کوڈ/.test(firstCard) && /Lone Star/.test(firstCard));
  ok('4 ad spender sorted first', names[0]==='Lone Star Plumbing Co', names[0]);
  ok('5 competitor picked from same search', /Air-Tech Plumbing/.test(firstCard));
  ok('6 domain expiry + email checks ran', /ای میل کی مہر: نہیں/.test(firstCard) && /ڈومین|پتہ جلد ختم/.test(firstCard));
  ok('7 Google Ads Transparency button', !!(await phone.$('.lead a[href*="adstransparency.google.com"][href*="lonestar.example"]')));
  await phone.click('.lead [data-a="sent"]'); await phone.waitForTimeout(3500);
  ok('8 "email sent" -> follow-up -> synced to cloud', /Lone Star/.test((cloud.mp_follow||{}).v||''));
  // PC (fresh device, only sync link)
  const [c2, pc] = await mk(); await pc.goto(URL); await pc.waitForTimeout(500);
  await pc.evaluate(()=>document.getElementById('setBox').open=true);
  await pc.fill('#syncUrl', SYNC); await pc.click('#saveSet'); await pc.waitForTimeout(2000);
  ok('9 PC gets the API key from sync', (await pc.inputValue('#apiKey'))==='AIzaTESTKEY');
  ok('10 PC sees phone follow-up', /Lone Star/.test(await pc.textContent('#fuList')));
  ok('11 PC sees phone leads', (await pc.$$('.lead .name')).length>=2);
  // PC: lead replied -> phone sees it
  await pc.evaluate(()=>document.getElementById('fuBox').open=true);
  await pc.click('#fuList [data-a="reply"]'); await pc.waitForTimeout(3500);
  await phone.click('#syncNow'); await phone.waitForTimeout(1500);
  ok('12 PC "replied" reaches phone pipeline', /Lone Star/.test(await phone.textContent('#pipeList')));
  // conflict: phone still shows old card? set quote on phone, PC sets lost later... rank test: phone quoted vs PC stays replied
  await phone.evaluate(()=>document.getElementById('pipeBox').open=true);
  await phone.click('#pipeList [data-a="quote"]'); await phone.waitForTimeout(3500);
  await pc.click('#syncNow'); await pc.waitForTimeout(1500);
  ok('13 later stage wins on both devices', /Price بتا دی/.test(await pc.textContent('#pipeList')));
  // empty key box on PC must not wipe key
  await pc.fill('#apiKey',''); await pc.click('#saveSet'); await pc.waitForTimeout(2500);
  ok('14 empty key on one device does not erase cloud key', cloud.mp_apiKey && cloud.mp_apiKey.v==='AIzaTESTKEY');
  // personal link -> brand-new device
  await phone.click('#myLink'); await phone.waitForTimeout(400);
  const link = await phone.inputValue('#myLinkOut');
  const [c3, nd] = await mk(); await nd.goto(link.replace(/^.*finder\.html/, URL)); await nd.waitForTimeout(1200);
  ok('15 personal link restores key + sync on new device', (await nd.inputValue('#apiKey'))==='AIzaTESTKEY' && (await nd.inputValue('#syncUrl'))===SYNC);
  // suspended monitor
  await phone.evaluate(()=>document.getElementById('watchBox').open=true);
  const before = await phone.textContent('#watchCount');
  await phone.click('#watchGo'); await phone.waitForTimeout(3000);
  ok('16 monitor finds the vanished listing', /Big Country/.test(await phone.textContent('#goneList')), 'watched '+before);
  ok('17 no page errors', !phone.errs.length && !pc.errs.length && !nd.errs.length, [...phone.errs,...pc.errs,...nd.errs].join(' | '));
  res.push('API calls (fake): searches='+calls.search+' detail checks='+calls.details+' speed tests='+calls.psi);
  console.log(res.join('\n')); await b.close();
})();
