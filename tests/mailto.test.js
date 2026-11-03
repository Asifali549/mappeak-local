// "جی میل میں Reminder تیار کھولیں": a mailto link with the address, subject, reminder text and full signature; one tap marks it sent (with undo).
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const now = Date.now();
  const seed = [
    { id: 'm1', n: 'InfoTank (Avery Sellers)', c: 'US', contact: 'avery@example.com', manual: true, at: now - 8 * 864e5, state: 'waiting' },
    { id: 'm2', n: 'Plain Lead', c: 'US', phone: '(555) 111-2222', w: 'https://plain.example/', subj: 'Quick question about Plain Lead on Google Maps', at: now - 8 * 864e5, state: 'waiting' },
    { id: 'm3', n: 'Sneaky Co', c: 'US', contact: 'x@y.com?bcc=evil@z.com', manual: true, at: now - 8 * 864e5, state: 'waiting' },
  ];
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await ctx.addInitScript(f => { if (!localStorage.getItem('mp_follow')) localStorage.setItem('mp_follow', f); localStorage.setItem('mp_useSig', '1'); localStorage.setItem('mp_myName', 'Asif'); localStorage.setItem('mp_myAddr', 'Jampur, Pakistan'); }, JSON.stringify(seed));
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(600);
  await p.evaluate(() => { document.getElementById('fuBox').open = true; document.addEventListener('click', e => { if (e.target.closest('a[href^="mailto:"]')) e.preventDefault(); }); });
  const card = n => p.locator('#fuList .lead').filter({ hasText: n });
  const href = await card('InfoTank').locator('[data-a="mail"]').getAttribute('href');
  const u = new URL(href), body = u.searchParams.get('body') || '';
  ok('M1 one button holds the whole reminder', u.protocol === 'mailto:' && u.pathname === 'avery@example.com' && u.searchParams.get('subject') === 'Following up: InfoTank' && /^Hi Avery,/.test(body), href.slice(0, 80));
  ok('M2 no second signature in the text (Gmail adds his own)', !/Best regards/.test(body) && !/\[Your/.test(body) && /no problem at all\.$/.test(body), JSON.stringify(body.slice(-60)));
  // like his phone: Gmail-signature box unticked, name and address empty
  await p.evaluate(() => { document.getElementById('useSig').checked = false; document.getElementById('myName').value = ''; document.getElementById('myAddr').value = ''; document.getElementById('fuBox').open = false; document.getElementById('fuBox').open = true; });
  await p.evaluate(() => document.getElementById('useSig').dispatchEvent(new Event('change')));
  await p.reload(); await p.waitForTimeout(500);
  await p.evaluate(() => { document.getElementById('useSig').checked = false; document.getElementById('myName').value = ''; document.getElementById('myAddr').value = ''; });
  await p.evaluate(() => { document.getElementById('fuBox').open = true; document.addEventListener('click', e => { if (e.target.closest('a[href^="mailto:"]')) e.preventDefault(); }); });
  await p.locator('#fuList .lead').filter({ hasText: 'Plain Lead' }).locator('[data-a="copy"]').click(); await p.waitForTimeout(300);
  const copied = await p.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  ok('M2b never "[Your name]" or "[Your mailing address]" in a reminder', !/\[Your/.test(copied || 'x') || copied === '', (copied || '').slice(-80));
  await p.click('#undoBtn').catch(() => {}); await p.waitForTimeout(300);
  ok('M3 no address on file: no button, the old Gmail search stays', (await card('Plain Lead').locator('[data-a="mail"]').count()) === 0 && (await card('Plain Lead').locator('[data-a="gmail"]').count()) === 1);
  ok('M4 an address with tricks gets no mail button', (await card('Sneaky').locator('[data-a="mail"]').count()) === 0);
  await card('InfoTank').locator('[data-a="mail"]').click(); await p.waitForTimeout(600);
  let st = await p.evaluate(() => JSON.parse(localStorage.getItem('mp_follow')).find(f => f.id === 'm1').state);
  ok('M5 tapping it marks the reminder sent, with undo', st === 'followed' && !(await p.$eval('#undoBar', e => e.hidden)));
  ok('M5b the card stays with a tick (no second mail button)', /✓ Reminder/.test(await card('InfoTank').textContent()) && (await card('InfoTank').locator('[data-a="mail"]').count()) === 0);
  await p.click('#undoBtn'); await p.waitForTimeout(400);
  st = await p.evaluate(() => JSON.parse(localStorage.getItem('mp_follow')).find(f => f.id === 'm1').state);
  ok('M6 undo brings it back', st === 'waiting' && (await card('InfoTank').locator('[data-a="mail"]').count()) === 1);
  ok('M7 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
