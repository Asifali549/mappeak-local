const { chromium } = require('playwright');
const SYNC='https://script.google.com/macros/s/TEST/exec'; let cloud={};
(async () => {
  const b = await chromium.launch(); const res=[]; const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
  const places=[{id:'pk1',displayName:{text:'Alhamdulillah Solar Jampur'},formattedAddress:'Jampur, Rajanpur, Pakistan',rating:4,userRatingCount:3,primaryTypeDisplayName:{text:'Solar energy company'},businessStatus:'OPERATIONAL'}];
  const mk = async (seed) => { const ctx = await b.newContext({viewport:{width:400,height:900}, permissions:['clipboard-read','clipboard-write']}); await ctx.clock.install({ time: new Date('2026-11-04T05:00:00Z') });   // a Wednesday
    await ctx.route(/^https?:\/\/(?!localhost)/, async r=>{ const u=r.request().url(); const j=o=>r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
      if(u.startsWith(SYNC)){ if(r.request().method()==='POST'){ cloud=JSON.parse(r.request().postData()); return j({ok:1}); } return j(cloud); }
      if(/places:searchText/.test(u)) return j({places}); return r.abort(); });
    if(seed) await ctx.addInitScript(s=>{ if(!localStorage.getItem('seeded')){ for(const k in s) localStorage.setItem(k,s[k]); localStorage.setItem('seeded','1'); } }, seed);
    const p = await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('dialog',d=>d.accept()); await p.goto((process.env.BASE||'http://localhost:8765')+'/finder.html'); await p.waitForTimeout(800); return p; };
  const old = Date.now()-6*864e5;
  const seed = { mp_follow: JSON.stringify([
    {id:'m1',n:'InfoTank (Avery Sellers)',c:'US',contact:'sales@infotank.example',at:old,la:old,state:'waiting',manual:true,src:'Google Community'},
    {id:'m2',n:'Blue Sky Childcare Bellevue',c:'US',contact:'',at:old,la:old,state:'waiting',manual:true}]), mp_myEmail:'mappeak.local@gmail.com' };
  const p = await mk(seed); await p.evaluate(()=>document.getElementById('fuBox').open=true);
  const info = p.locator('#fuList .lead',{hasText:'InfoTank'}), blue = p.locator('#fuList .lead',{hasText:'Blue Sky'});
  const it = await info.textContent();
  ok('1 reminder card shows email address', /sales@infotank\.example/.test(it));
  ok('2 Gmail "first email" button', !!(await info.locator('a[href*="mail.google.com"][href*="infotank"]').count()));
  ok('3 Reply hint shown when due', /Reply دبائیں/.test(it));
  await info.locator('[data-a="copy"]').click(); await p.waitForTimeout(200);
  const txt = await p.evaluate(()=>navigator.clipboard.readText());
  ok('4 reminder text: no subject line, greets Avery, business name clean', !/Subject/.test(txt) && /^Hi Avery,/.test(txt) && /InfoTank's Google Business Profile/.test(txt) && /free look/.test(txt), txt.split('\n')[0]+' | '+txt.split('\n')[2]);
  ok('5 forum-only lead: no reminder, marked forum', /صرف فورم والا/.test(await blue.textContent()) && !(await blue.locator('[data-a="copy"]').count()));
  ok('6 due count ignores forum-only', (await p.textContent('#fuDue')).trim()==='1');
  // date change reduces today's count
  await p.evaluate(()=>{ document.getElementById('pipeBox').open=true; document.querySelectorAll('#pipeBox details').forEach(d=>d.open=true); });
  const s0 = +(await p.textContent('#sentToday'));
  await p.fill('#mName','Pizzazz'); await p.fill('#mContact','info@pizzazz.example'); await p.click('#mAdd'); await p.waitForTimeout(300);
  const s1 = +(await p.textContent('#sentToday'));
  const mon = await p.evaluate(()=>{ const d=new Date(Date.now()+2*864e5); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); });
  const pc = p.locator('#fuList .lead',{hasText:'Pizzazz'}); await pc.locator('[data-a="date"]').click(); await pc.locator('input[type=date]').fill(mon); await pc.locator('[data-a="datesave"]').click(); await p.waitForTimeout(300);
  ok('7 moving date to Monday takes back today\'s count', s1===s0+1 && +(await p.textContent('#sentToday'))===s0, s0+'->'+s1+'->'+(await p.textContent('#sentToday')));
  // counters across devices
  const A = await mk(); const B = await mk();
  for (const x of [A,B]) { await x.evaluate(s=>{document.getElementById('setBox').open=true; document.getElementById('syncUrl').value=s;}, SYNC); await x.click('#saveSet'); await x.waitForTimeout(1200); }
  const forumBtn = x => x.locator('#todayList .task', {hasText:'فورم'}).locator('button');
  await forumBtn(A).click(); await forumBtn(A).click(); await A.waitForTimeout(3500);
  await forumBtn(B).click(); await B.waitForTimeout(3500); await A.click('#syncNow'); await A.waitForTimeout(1500);
  const fa = (await A.textContent('#todayList')).match(/فورم پر جواب اور پیغام:\s*(\d+)/)[1], fb = (await B.textContent('#todayList')).match(/فورم پر جواب اور پیغام:\s*(\d+)/)[1];
  ok('8 forum counter adds up across phone + PC', fa==='3' && fb==='3', fa+'/'+fb);
  // forget seen: B has old seen list, A clears; B's list must not come back
  await B.evaluate(()=>{ localStorage.setItem('mp_seen', JSON.stringify(['x1','x2'])); localStorage.setItem('mp_ts_mp_seen', String(Date.now()-60000)); });
  await B.click('#syncNow'); await B.waitForTimeout(1500); await A.click('#syncNow'); await A.waitForTimeout(1500);
  await A.click('#clearSeen'); await A.waitForTimeout(3500); await B.click('#syncNow'); await B.waitForTimeout(1500); await A.click('#syncNow'); await A.waitForTimeout(1500);
  ok('9 "forget seen" sticks across devices', (await A.evaluate(()=>localStorage.getItem('mp_seen')))==='[]' && (await B.evaluate(()=>localStorage.getItem('mp_seen')))==='[]');
  // hide + unhide synced
  await A.fill('#hideName','Test Hidden Co'); await A.click('#hideBtn'); await A.waitForTimeout(3500); await B.click('#syncNow'); await B.waitForTimeout(1500);
  await B.locator('#hiddenList button').first().click(); await B.waitForTimeout(3500); await A.click('#syncNow'); await A.waitForTimeout(1500);
  ok('10 un-hide a name, stays un-hidden after sync', (await A.evaluate(()=>localStorage.getItem('mp_hideNames')))==='[]');
  // name search -> watch
  await A.evaluate(()=>{ document.getElementById('apiKey').value='AIzaTEST'; }); await A.selectOption('#country','PK'); await A.fill('#byName','Alhamdulillah Solar Jampur'); await A.click('#goName'); await A.waitForTimeout(1500);
  ok('11 name search adds business to suspension monitor', /pk1/.test(await A.evaluate(()=>localStorage.getItem('mp_watch')||'')));
  res.push('errors: '+JSON.stringify([...p.errs,...A.errs,...B.errs]));
  console.log(res.join('\n')); await b.close();
})();
