// 17 Nov (owner asked): "بات ختم" on Reminder cards too (no WhatsApp on the number, or they said no).
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const now = Date.now(), D = 864e5;
  const seed = [
    { id: 'ChIJArabianNights1', n: 'Arabian Nights Public Kitchen', c: 'AE', phone: '058 911 6720', at: now - 5 * D, state: 'waiting' },
    { id: 'ChIJOtherShop00002', n: 'Other Shop', c: 'AE', phone: '050 111 2222', at: now - 5 * D, state: 'waiting' },
  ];
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.addInitScript(f => { if (!localStorage.getItem('mp_follow')) localStorage.setItem('mp_follow', f); }, JSON.stringify(seed));
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; let answer = true;
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => answer ? d.accept() : d.dismiss());
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(700);
  await p.evaluate(() => { document.getElementById('fuBox').open = true; document.getElementById('pipeBox').open = true; });
  const rem = n => p.locator('#fuList .lead').filter({ hasText: n });
  const st = id => p.evaluate(i => JSON.parse(localStorage.getItem('mp_follow')).find(f => f.id === i).state, id);
  ok('L1 every Reminder card has "بات ختم"', (await rem('Arabian').locator('[data-a="lost"]').count()) === 1 && (await rem('Other').locator('[data-a="lost"]').count()) === 1);
  answer = false; await rem('Other').locator('[data-a="lost"]').click(); await p.waitForTimeout(300);
  ok('L2 "No" on the question changes nothing', (await st('ChIJOtherShop00002')) === 'waiting');
  answer = true; await rem('Arabian').locator('[data-a="lost"]').click(); await p.waitForTimeout(400);
  ok('L3 confirmed: the card is finished and leaves the Reminder list', (await st('ChIJArabianNights1')) === 'lost' && (await rem('Arabian').count()) === 0);
  await p.reload(); await p.waitForTimeout(700); await p.evaluate(() => { document.getElementById('fuBox').open = true; });
  ok('L4 still finished after reopening, the other card untouched', (await st('ChIJArabianNights1')) === 'lost' && (await rem('Arabian').count()) === 0 && (await rem('Other').count()) === 1);
  ok('L5 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
