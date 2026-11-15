// 15 Nov (owner asked): one search box above the Reminder list and Client Follow-up.
// Finds a card by part of the name (any script), a phone number in any format, an email, or a word from the note.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const now = Date.now(), D = 864e5;
  const seed = [
    { id: 'r1', n: 'InfoTank (Avery Sellers)', c: 'US', contact: 'avery@example.com', manual: true, at: now - 8 * D, state: 'waiting' },
    { id: 'w1', n: 'Khyber Restaurant - Dammam مطعم خيبر', c: 'SA', contact: '+966 54 237 6462', phone: '+966 54 237 6462', at: now - 5 * D, state: 'waiting' },
    { id: 'p1', n: 'Pakistani Laziz Restaurant', c: 'SA', contact: '+966593752163', town: 'Jeddah', note: 'QR card sent, bot passing to owner', at: now - 6 * D, la: now, next: now - 1000, state: 'replied' },
    { id: 'p2', n: 'Al Rahili Radiators', c: 'SA', contact: '+966 55 000 1111', at: now - 6 * D, la: now, next: now + 3 * D, state: 'quoted' },
    { id: 'l1', n: 'Attock Solar House', c: 'PK', contact: '+92 300 1234567', at: now - 9 * D, la: now - D, state: 'lost' },
    { id: 'x1', n: '<img src=x onerror=alert(1)> Evil Shop', c: 'US', contact: 'evil@example.com', at: now - 8 * D, state: 'waiting', manual: true },
  ];
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.addInitScript(f => { if (!localStorage.getItem('mp_follow')) localStorage.setItem('mp_follow', f); }, JSON.stringify(seed));
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; let alerted = false;
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { if (d.type() === 'alert') alerted = true; d.accept(); });
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(700);
  const shown = () => p.evaluate(() => [...document.querySelectorAll('#fuList .lead, #pipeList .lead, #pipeList details .task')]
    .filter(e => e.style.display !== 'none').map(e => (e.querySelector('.name, .tx') || e).textContent.trim()));
  const find = async q => { await p.fill('#fuFind', q); await p.waitForTimeout(400); return { s: await shown(), info: await p.textContent('#fuFindInfo'), open: await p.evaluate(() => document.getElementById('fuBox').open && document.getElementById('pipeBox').open) }; };
  const all = (await shown()).length;
  let r = await find('laziz');
  ok('S1 part of the name (any case) shows only that card, both lists open', r.s.length === 1 && /Laziz/.test(r.s[0]) && r.open && /1/.test(r.info), JSON.stringify(r.s));
  r = await find('+966 59 375 2163');
  ok('S2 a phone number pasted from WhatsApp (with spaces) finds it', r.s.length === 1 && /Laziz/.test(r.s[0]), JSON.stringify(r.s));
  r = await find('059 375 2163');
  ok('S3 the local format (0 instead of +966) finds it too', r.s.length === 1 && /Laziz/.test(r.s[0]), JSON.stringify(r.s));
  r = await find('966 54 237 6462');
  ok('S4 a reminder card is found by its number', r.s.length === 1 && /Khyber/.test(r.s[0]), JSON.stringify(r.s));
  r = await find('avery@example');
  ok('S5 part of an email address', r.s.length === 1 && /InfoTank/.test(r.s[0]), JSON.stringify(r.s));
  r = await find('خيبر');
  ok('S6 Arabic/Urdu part of the name', r.s.length === 1 && /Khyber/.test(r.s[0]), JSON.stringify(r.s));
  r = await find('bot passing');
  ok('S7 a word from the note', r.s.length === 1 && /Laziz/.test(r.s[0]), JSON.stringify(r.s));
  r = await find('attock');
  ok('S8 a finished ("بات ختم") contact is found and named as finished', /Attock/.test(r.info) && /بات ختم/.test(r.info) && r.s.some(t => /Attock/.test(t)), r.info);
  r = await find('nobody shop 123');
  ok('S9 not in the list: a clear "not in the list" line', /لسٹ میں نہیں/.test(r.info) && r.s.length === 0, r.info);
  r = await find('0300');
  ok('S10 a short number piece does not match everything by mistake', r.s.length <= 1, JSON.stringify(r.s));
  r = await find('');
  ok('S11 clearing the box brings every card back and hides the info line', r.s.length === all && await p.evaluate(() => document.getElementById('fuFindInfo').style.display === 'none'), r.s.length + ' / ' + all);
  r = await find('evil');
  ok('S12 a name with page code stays text', !alerted && !(await p.$('#fuFindInfo img')) && !(await p.$('#fuList img')) && r.s.length === 1);
  // counts on top stay the full counts while searching
  await p.fill('#fuFind', 'laziz'); await p.waitForTimeout(400);
  const dueSearch = await p.textContent('#pipeDue'); await p.fill('#fuFind', ''); await p.waitForTimeout(400);
  ok('S13 the "to contact today" count is not changed by the search', dueSearch === await p.textContent('#pipeDue'), dueSearch);
  // a button on a found card still works and the search stays
  await p.fill('#fuFind', 'laziz'); await p.waitForTimeout(400);
  await p.locator('#pipeList .lead').filter({ hasText: 'Laziz' }).locator('[data-a="touch"]').click(); await p.waitForTimeout(300);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('mp_follow')).find(f => f.id === 'p1'));
  ok('S14 "آج رابطہ کر لیا" on a found card works and the search stays', st.next > Date.now() && (await shown()).length === 1, JSON.stringify(await shown()));
  ok('S15 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
