// 17 Nov (owner asked): a client card opens the business on Google Maps and makes its review QR card, with no new search.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const now = Date.now(), D = 864e5;
  const seed = [
    { id: 'ChIJMazaya000001', n: 'Dar Al Mazaya Auto Maintenance Workshop', c: 'AE', phone: '050 515 1056', maps: 'https://maps.google.com/?cid=1234567890', at: now - 5 * D, state: 'waiting' },
    { id: 'ChIJLaziz0000002', n: 'Pakistani Laziz Restaurant', c: 'SA', phone: '+966 59 375 2163', at: now - 6 * D, la: now, next: now - 1000, state: 'replied', urd: true },
    { id: 'm_1700000000000', n: 'Manual Bad Link', c: 'US', contact: 'a@b.example', link: 'javascript:alert(1)', manual: true, at: now - 9 * D, la: now, next: now - 1000, state: 'replied' },
    { id: 'm_1700000000001', n: 'Manual Maps Link', c: 'PK', contact: '0300 1234567', link: 'https://maps.app.goo.gl/abc123', manual: true, at: now - 9 * D, la: now, next: now - 1000, state: 'replied' },
    { id: 'ChIJEvilMaps0003', n: 'Evil Maps', c: 'AE', phone: '050 111 2222', maps: 'https://evil.example/maps?x', at: now - 6 * D, la: now, next: now - 1000, state: 'replied' },
  ];
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.addInitScript(f => { if (!localStorage.getItem('mp_follow')) localStorage.setItem('mp_follow', f); }, JSON.stringify(seed));
  const reqs = []; ctx.on('request', r => reqs.push(r.url()));
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const p = await ctx.newPage();
  ctx.on('page', pg => setTimeout(() => pg.close().catch(() => {}), 200)); const errs = []; let alerted = false;
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { if (d.type() === 'alert') alerted = true; d.accept(); });
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(700);
  await p.evaluate(() => { document.getElementById('fuBox').open = true; document.getElementById('pipeBox').open = true; });
  const card = n => p.locator('#fuList .lead, #pipeList .lead').filter({ hasText: n });
  const href = async n => { const a = card(n).locator('[data-a="fmaps"]'); return (await a.count()) ? a.getAttribute('href') : ''; };
  ok('M1 reminder card: Maps button opens the saved Google Maps link', (await href('Mazaya')) === 'https://maps.google.com/?cid=1234567890', await href('Mazaya'));
  ok('M2 card without a saved link: Maps button built from the place id', (await href('Laziz')) === 'https://www.google.com/maps/place/?q=place_id:ChIJLaziz0000002', await href('Laziz'));
  ok('M3 manual card with a Google Maps link uses it; no QR (no place id)', (await href('Manual Maps')) === 'https://maps.app.goo.gl/abc123' && (await card('Manual Maps').locator('[data-a="fqr"]').count()) === 0);
  ok('M4 a bad or non-Google link never becomes a Maps button', (await href('Manual Bad')) === '' && (await href('Evil Maps')) === 'https://www.google.com/maps/place/?q=place_id:ChIJEvilMaps0003');
  ok('M5 cards with a Google place id get the QR card button', (await card('Mazaya').locator('[data-a="fqr"]').count()) === 1 && (await card('Laziz').locator('[data-a="fqr"]').count()) === 1 && (await card('Manual Bad').locator('[data-a="fqr"]').count()) === 0);
  await card('Laziz').locator('[data-a="fqr"]').click(); await p.waitForSelector('.ov a[download]', { timeout: 5000 }); await p.waitForTimeout(300);
  const dl = await p.locator('.ov a[download]').getAttribute('download').catch(() => 'none');
  ok('M6 the QR card opens with download, ready to send', (await p.locator('.ov img').count()) === 1 && dl === 'Review_QR_Pakistani_Laziz_Restaurant.png', (await p.locator('.ov img').count()) + ' ' + dl);
  await p.locator('.ov [data-a="test"]').click(); await p.waitForTimeout(400);
  ok('M7 the card\'s link is the business\'s own review page', reqs.some(u => u === 'https://search.google.com/local/writereview?placeid=ChIJLaziz0000002'), reqs.filter(u => /writereview/.test(u)).join(' '));
  await p.locator('.ov [data-a="close"]').click();
  await p.fill('#fuFind', 'mazaya'); await p.waitForTimeout(400);
  ok('M8 found with the client search box, the buttons are there', (await card('Mazaya').locator('[data-a="fmaps"]').count()) === 1 && await card('Mazaya').isVisible());
  ok('M9 no page errors, no page code', !errs.length && !alerted, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
