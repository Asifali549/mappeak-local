// First-contact date: up to 7 days ahead for scheduled emails, and editable on a reminder card.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res=[]; const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
  const ctx = await b.newContext({viewport:{width:400,height:900}}); await ctx.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  await ctx.clock.install({ time: new Date('2026-10-31T06:00:00Z') });   // Saturday 11:00 PKT
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(600);
  await p.evaluate(()=>{ document.getElementById('pipeBox').open=true; document.querySelectorAll('#pipeBox details').forEach(d=>d.open=true); document.getElementById('fuBox').open=true; });
  ok('D1 calendar allows 7 days ahead', (await p.getAttribute('#mDate','max'))==='2026-11-07');
  await p.fill('#mName','Pizzazz'); await p.fill('#mContact','info@pizzazz.example'); await p.fill('#mDate','2026-11-02'); await p.click('#mAdd'); await p.waitForTimeout(300);
  const card = (await p.locator('#fuList .lead',{hasText:'Pizzazz'}).textContent()).replace(/\s+/g,' ');
  ok('D2 scheduled email shown as "goes in 2 days"', /Schedule ہے، 2 دن بعد/.test(card), card.slice(0,90));
  ok('D3 future date does not count in today\'s sent', (await p.textContent('#sentToday')).trim()==='0');
  await p.fill('#mName','Today Co'); await p.fill('#mContact','t@example.com'); await p.click('#mAdd'); await p.waitForTimeout(300);
  ok('D4 email sent today counts', (await p.textContent('#sentToday')).trim()==='1');
  const c = p.locator('#fuList .lead',{hasText:'Today Co'}); await c.locator('[data-a="date"]').click(); await c.locator('input[type=date]').fill('2026-11-02'); await c.locator('[data-a="datesave"]').click(); await p.waitForTimeout(300);
  ok('D5 changing date to Monday takes today\'s count back', (await p.textContent('#sentToday')).trim()==='0');
  ok('D6 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
