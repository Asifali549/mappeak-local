// Reply book: ready answers in Client Follow-up, filled with the client's name, price and language; general book with placeholders.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const now = Date.now();
  const follows = [
    { id: 'a', n: 'Lake Country Pets (Ellen)', c: 'CA', contact: 'hello@example.ca', manual: true, at: now - 3e8, state: 'replied', next: now },
    { id: 'b', n: 'Faizan Restaurant', c: 'AE', phone: '+971 56 000 0000', urd: true, at: now - 3e8, state: 'replied', next: now },
    { id: 'c', n: 'Bravura Build', c: 'SA', phone: '+966 50 000 0000', urd: false, at: now - 3e8, state: 'quoted', next: now + 864e5 },
    { id: 'd', n: 'Alhamdulillah Solar (Meer Taqi)', c: 'PK', phone: '03001234567', manual: true, at: now - 3e8, state: 'replied', next: now },
    { id: 'x', n: '<img src=x onerror=alert(1)> (Bob)', c: 'US', contact: 'x@example.com', manual: true, at: now - 3e8, state: 'replied', next: now },
  ];
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await ctx.addInitScript(f => { if (!localStorage.getItem('mp_follow')) localStorage.setItem('mp_follow', f); }, JSON.stringify(follows));
  const p = await ctx.newPage(); const errs = []; let alerted = false;
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { if (d.type() === 'alert') alerted = true; d.accept(); });
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(600);
  await p.evaluate(() => { document.getElementById('pipeBox').open = true; document.getElementById('myName').value = 'Asif'; document.getElementById('useSig').checked = false; });
  const card = name => p.locator('#pipeList .lead').filter({ has: p.locator('.name', { hasText: name }) });
  const open = async (name, key) => { const c = card(name); if (!(await c.locator('[data-a="bookbox"] [data-k]').count())) await c.locator('[data-a="book"]').click(); await c.locator('[data-k="' + key + '"]').click(); return c; };
  const text = async c => (await c.locator('.bookpre').first().textContent());
  ok('B0 every client card has the book button', (await p.$$('#pipeList [data-a="book"]')).length === 5);
  let c = await open('Lake Country', 'price'); let t = await text(c);
  ok('B1 email client: English first, "Hi Ellen," and $49', /^Hi Ellen,/.test(t) && /\$49/.test(t) && /Best regards,\nAsif\nMapPeak Local$/.test(t) && !/prefer not to hear/.test(t), t.slice(0, 60));
  await c.locator('button', { hasText: 'English کاپی کریں' }).click(); await p.waitForTimeout(300);
  ok('B2 copy puts exactly that text on the clipboard', (await p.evaluate(() => navigator.clipboard.readText())) === t);
  c = await open('Faizan', 'price'); t = await text(c);
  ok('B3 Urdu-speaking UAE client: Urdu first, 199 AED', /بھائی/.test(t) && /199 AED/.test(t) && !/Hi /.test(t), t.slice(0, 60));
  ok('B3b other language one tap away', (await c.locator('button', { hasText: 'English میں دیکھیں' }).count()) === 1);
  c = await open('Bravura', 'cheap'); t = await text(c);
  ok('B4 Saudi English client: English, smaller job 149 SAR', /^Hi Bravura Build team,/.test(t) && /149 SAR/.test(t), t.slice(0, 70));
  c = await open('Alhamdulillah', 'price'); t = await text(c);
  ok('B5 Pakistan: Urdu, person name, 5,000 روپے', /^Meer بھائی/.test(t) && /5,000 روپے/.test(t), t.slice(0, 40));
  // stage buttons inside the book
  c = await open('Faizan', 'price'); await c.locator('[data-act="quoted"]').click(); await p.waitForTimeout(200);
  let saved = await p.evaluate(() => JSON.parse(localStorage.getItem('mp_follow')));
  ok('B6 "Price بتا دی" from the book moves the client to quoted', saved.find(f => f.id === 'b').state === 'quoted');
  c = await open('Lake Country', 'later'); await c.locator('[data-act="week"]').click(); await p.waitForTimeout(200);
  saved = await p.evaluate(() => JSON.parse(localStorage.getItem('mp_follow')));
  const nx = saved.find(f => f.id === 'a').next;
  ok('B7 "later" sets a reminder one week ahead', nx - Date.now() > 6.9 * 864e5 && nx - Date.now() < 7.1 * 864e5);
  // a hostile name stays text
  c = await open('Bob', 'yes'); t = await text(c);
  ok('B8 a business name never becomes code', !alerted && (await p.$$('#pipeList img')).length === 0 && /^Hi Bob,/.test(t), alerted + ' ' + (await p.$$('#pipeList img')).length + ' ' + t.slice(0,40));
  // general book
  await p.evaluate(() => { document.getElementById('bookBox').open = true; });
  await p.waitForTimeout(200); await p.click('#bookAll [data-k="trust"]');
  const all = await p.$$eval('#bookAll .bookpre', ps => ps.map(x => x.textContent));
  ok('B9 general book: both languages with placeholders', all.length === 2 && /\[نام\] بھائی/.test(all[0]) && /^Hi \[Name\],/.test(all[1]));
  ok('B9b all nine situations listed', (await p.$$('#bookAll [data-k]')).length === 9);
  ok('B10 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
