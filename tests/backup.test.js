// Weekly backup reminder appears when the client list was not downloaded for 7 days, and goes away after download.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res=[]; const ok=(n,c,d='')=>res.push((c?'PASS ':'FAIL ')+n+(d?' ('+d+')':''));
  const ctx = await b.newContext({acceptDownloads:true}); await ctx.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
  await ctx.addInitScript(()=>{ if(!localStorage.getItem('seeded')){ localStorage.setItem('mp_follow', JSON.stringify([{id:'1',n:'A Client',c:'US',contact:'a@b.c',at:Date.now(),state:'waiting',manual:true}])); localStorage.setItem('seeded','1'); } });
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(600);
  ok('B1 backup reminder shown', /ہفتہ وار بیک اپ/.test(await p.textContent('#todayList')));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#todayList .task', {hasText:'بیک اپ'}).locator('button').click()]);
  ok('B2 button downloads the client list', /mappeak_clients_/.test(dl.suggestedFilename()));
  await p.waitForTimeout(300);
  ok('B3 reminder gone after download', !/ہفتہ وار بیک اپ/.test(await p.textContent('#todayList')));
  ok('B4 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
