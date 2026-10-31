// Reminders wait for the lead's working day and show the Pakistan send time for that day; Reddit handles get no reminder.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res=[]; const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
  const ctx = await b.newContext({viewport:{width:400,height:900}}); await ctx.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  await ctx.clock.install({ time: new Date('2026-10-31T07:00:00Z') });   // Saturday 12:00 PKT
  const old = new Date('2026-10-26T07:00:00Z').getTime();
  await ctx.addInitScript(o=>{ if(!localStorage.getItem('seeded')){ localStorage.setItem('mp_follow', JSON.stringify([
    {id:'a',n:'AP Black Car Service',c:'US',contact:'res@ap.example',at:o,la:o,state:'waiting',manual:true},
    {id:'k',n:'Klusservice',c:'NL',contact:'info@k.example',at:o,la:o,state:'waiting',manual:true},
    {id:'s',n:'Saudi Lead',c:'SA',contact:'+966500000000',at:o,la:o,state:'waiting',manual:true},
    {id:'r',n:'Equivalent_Win_1038',c:'US',contact:'u/Equivalent_Win_1038',at:o,la:o,state:'waiting',manual:true},
    {id:'p',n:'Alhamdulillah Solar',c:'PK',contact:'03001234567',at:o,la:o,state:'waiting',manual:true}])); localStorage.setItem('seeded','1'); } }, old);
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(700); await p.evaluate(()=>document.getElementById('fuBox').open=true);
  const pills = async n => (await p.locator('#fuList .lead',{hasText:n}).locator('.pill').allTextContents()).join(' | ');
  const us = await pills('AP Black'), nl = await pills('Klusservice'), sa = await pills('Saudi Lead'), rd = await pills('Equivalent'), pk = await pills('Alhamdulillah');
  ok('W1 US held to Monday with Monday times (after the clock change)', /پیر کو/.test(us) && /شام سات بجے/.test(us) && /رات دس بجے/.test(us), us);
  ok('W2 Netherlands held to Monday, 1 PM PKT', /پیر کو/.test(nl) && /دوپہر ایک بجے/.test(nl), nl);
  ok('W3 Saudi: reminder day moved past Fri/Sat to Sunday (tomorrow)', /Reminder 1 دن بعد/.test(sa), sa);
  ok('W4 Pakistan works on Saturday -> due today', /آج Reminder بھیجیں/.test(pk), pk);
  ok('W5 Reddit handle -> forum-only, no reminder', /صرف فورم والا/.test(rd), rd);
  ok('W6 due count only counts Pakistan', (await p.textContent('#fuDue')).trim()==='1');
  ok('W7 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
