// 24 Nov (owner asked): (1) the client search box finds a card by its lead number (588 or #588) and every Reminder /
// Client Follow-up card shows its #number; (2) a card whose one reminder went out over 7 days ago with no reply moves into a
// closed "no reply" box (nothing deleted; "جواب آ گیا" brings it back), and the copy for Claude leaves those out.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const NOW = new Date('2026-11-24T09:00:00Z').getTime(), D = 864e5;
  const seed = [
    { id: 'ChIJSaffa000000000001', n: 'SAFFA SIALKOT RESTAURANT', c: 'SA', urd: true, phone: '058 322 1759', at: NOW - 1 * D, state: 'waiting' },
    { id: 'ChIJShamal00000000002', n: 'سطحه شمال الرياض', c: 'SA', phone: '054 855 8132', at: NOW - 5 * D, state: 'replied', la: NOW - D, next: NOW - 1000 },
    { id: 'ChIJOldQuiet000000003', n: 'Kerala Workshop', c: 'SA', phone: '056 753 1320', at: NOW - 10 * D, state: 'followed', fat: NOW - 8 * D },
    { id: 'ChIJRecentFol00000004', n: 'Dar Al Mazaya', c: 'AE', phone: '050 515 1056', at: NOW - 7 * D, state: 'followed', fat: NOW - 1 * D },
    { id: 'ChIJNoFat000000000005', n: 'Old Shop Without Date', c: 'SA', phone: '055 000 1111', at: NOW - 20 * D, la: NOW - 15 * D, state: 'followed' },
    { id: 'ChIJBox3519000000006', n: 'Mehran 3519 Restaurant', c: 'SA', urd: true, phone: '056 635 5610', at: NOW - 13 * D, state: 'replied', la: NOW - 8 * D, next: NOW + D },
  ];
  const leadsSeed = { leads: [
    { id: 'ChIJSaffa000000000001', no: 588, name: 'SAFFA SIALKOT RESTAURANT', country: 'SA', issues: [], reviews: 62 },
    { id: 'ChIJShamal00000000002', no: 233, name: 'سطحه شمال الرياض', country: 'SA', issues: [], reviews: 8 },
    { id: 'ChIJOldQuiet000000003', no: 47, name: 'Kerala Workshop', country: 'SA', issues: [], reviews: 9 },
    { id: 'ChIJBox3519000000006', no: 78, name: 'Mehran 3519 Restaurant', country: 'SA', issues: [], reviews: 99 }], noMax: 588 };
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.clock.install({ time: NOW });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await ctx.addInitScript(([f, l]) => { if (!localStorage.getItem('mp_follow')) { localStorage.setItem('mp_follow', f); localStorage.setItem('mp_leads', l); } }, [JSON.stringify(seed), JSON.stringify(leadsSeed)]);
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(800);
  await p.evaluate(() => { document.getElementById('fuBox').open = true; document.getElementById('pipeBox').open = true; });
  const vis = sel => p.$$eval(sel + ' .lead', ls => ls.filter(l => l.offsetParent !== null).map(l => l.querySelector('.name').textContent.trim()));
  const find = async q => { await p.fill('#fuFind', q); await p.waitForTimeout(500); };

  ok('N1 Reminder card shows its lead number', (await vis('#fuList')).some(n => /^#588 SAFFA/.test(n)), (await vis('#fuList')).join(' / '));
  ok('N2 Client Follow-up card shows its lead number', (await vis('#pipeList')).some(n => /^#233 /.test(n)));
  await find('588');
  ok('N3 typing 588 finds that card (Reminder list) and the info line names it', (await vis('#fuList')).length === 1 && /SAFFA/.test((await vis('#fuList'))[0]) && /#588/.test(await p.textContent('#fuFindInfo')));
  await find('#233');
  ok('N4 "#233" finds the Follow-up card by number only', (await vis('#pipeList')).length === 1 && /شمال/.test((await vis('#pipeList'))[0]) && (await vis('#fuList')).length === 0);
  await find('3519');
  ok('N5 a number that is not a lead number still matches names as before', (await vis('#pipeList')).some(n => /Mehran/.test(n)));
  await find('999');
  ok('N6 an unknown number says not in the list', /نہیں ہے/.test(await p.textContent('#fuFindInfo')));
  await find('583221759');
  ok('N7 phone search still works', (await vis('#fuList')).length === 1);
  await find('');

  // quiet box
  const quietNames = await p.$$eval('#quietBox .lead .name', ns => ns.map(n => n.textContent));
  const mainNames = await p.$$eval('#pipeList > .lead .name', ns => ns.map(n => n.textContent));
  ok('Q1 reminder sent 8 days ago, no reply: in the closed no-reply box', quietNames.some(n => /Kerala/.test(n)) && !mainNames.some(n => /Kerala/.test(n)), quietNames.join(' / '));
  ok('Q2 old card without a reminder date (last change 15 days ago) also goes there', quietNames.some(n => /Old Shop/.test(n)));
  ok('Q3 reminder sent yesterday stays in the main list; replied cards stay', mainNames.some(n => /Dar Al Mazaya/.test(n)) && mainNames.some(n => /شمال/.test(n)));
  ok('Q4 the box is closed and shows the count', await p.evaluate(() => { const q = document.getElementById('quietBox'); return !q.open && /\(2\)/.test(q.querySelector('summary').textContent); }));
  await find('Kerala');
  ok('Q5 searching a name inside the box opens it', await p.evaluate(() => document.getElementById('quietBox').open));
  await find('');
  await p.evaluate(() => { const q = document.getElementById('quietBox'); q.open = true; [...q.querySelectorAll('.lead')].find(l => /Kerala/.test(l.textContent)).querySelector('[data-a="rep"]').click(); });
  await p.waitForTimeout(400);
  const after = await p.$$eval('#pipeList > .lead .name', ns => ns.map(n => n.textContent));
  ok('Q6 "جواب آ گیا" inside the box brings the card back to the main list as replied', after.some(n => /Kerala/.test(n)) && await p.evaluate(() => JSON.parse(localStorage.getItem('mp_follow')).find(f => f.id === 'ChIJOldQuiet000000003').state === 'replied'));
  await p.click('#copyPipe'); await p.waitForTimeout(300);
  const t = await p.evaluate(() => navigator.clipboard.readText());
  ok('Q7 copy for Claude leaves out the no-reply cards and counts them', !/Old Shop/.test(t) && /1 more with no reply 7\+ days/.test(t) && /#233 /.test(t), t.split('\n')[0]);
  ok('Q8 nothing was deleted', await p.evaluate(() => JSON.parse(localStorage.getItem('mp_follow')).length === 6));
  ok('Q9 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
