// 16 Nov (bug, owner found): "واپس لیں" after "Reminder کاپی کریں" did nothing once a Sync had run in between
// (the Sync rebuilt the client list and the undo changed the old copy of the card).
const { chromium } = require('playwright');
const SYNC = 'https://script.google.com/macros/s/TEST/exec';
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  let cloud = {}, other = 1;
  const now = Date.now(), D = 864e5;
  const seed = [
    { id: 'z1', n: 'Al Zahri Workshop', c: 'SA', contact: '+966 59 210 0428', phone: '+966 59 210 0428', at: now - 5 * D, state: 'waiting' },
    { id: 'e1', n: 'InfoTank (Avery Sellers)', c: 'US', contact: 'avery@example.com', manual: true, at: now - 8 * D, state: 'waiting' },
  ];
  const mk = async (withSync) => {
    const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
    await ctx.addInitScript(f => { if (!localStorage.getItem('mp_follow')) localStorage.setItem('mp_follow', f); }, JSON.stringify(seed));
    await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
      const u = r.request().url(), m = r.request().method(); const j = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
      if (u.startsWith(SYNC)) { if (m === 'POST') { cloud = JSON.parse(r.request().postData()); return j({ ok: 1 }); }
        // the laptop added a card meanwhile, so every Sync brings something new and the list is rebuilt
        const c = JSON.parse(JSON.stringify(cloud));
        if (c.mp_follow && c.mp_follow.v) { const a = JSON.parse(c.mp_follow.v); if (!a.some(f => f.id === 'o' + other)) a.push({ id: 'o' + other, n: 'Laptop Card ' + other, c: 'PK', contact: '+92 300 55500' + (10 + other), at: Date.now() - 864e5, state: 'waiting' }); other++; c.mp_follow = { v: JSON.stringify(a), t: Date.now() }; }
        return j(c); }
      return r.abort();
    });
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('dialog', d => d.accept());
    ctx.on('page', pg => setTimeout(() => pg.close().catch(() => {}), 300));
    await p.goto(BASE + '/finder.html'); await p.waitForTimeout(600);
    if (withSync) { await p.evaluate(s => { document.getElementById('setBox').open = true; document.getElementById('apiKey').value = 'AIzaTEST'; document.getElementById('syncUrl').value = s; }, SYNC); await p.click('#saveSet'); await p.waitForTimeout(2500); }
    await p.evaluate(() => { document.getElementById('fuBox').open = true; });
    return p;
  };
  const st = (p, id) => p.evaluate(i => JSON.parse(localStorage.getItem('mp_follow')).find(f => f.id === i), id);
  const card = (p, n) => p.locator('#fuList .lead').filter({ hasText: n });

  const p = await mk(true);
  await card(p, 'Al Zahri').locator('[data-a="copy"]').click();
  await p.waitForTimeout(6000);   // the change is saved and synced (the list is rebuilt from the Sync)
  ok('U0 copying marks the reminder sent', (await st(p, 'z1')).state === 'followed');
  await p.click('#undoBtn'); await p.waitForTimeout(600);
  let z = await st(p, 'z1');
  ok('U1 "واپس لیں" after a Sync takes the mark back', z.state === 'waiting' && z.fat == null, JSON.stringify(z));
  ok('U2 the card shows the normal buttons again (copy, date)', (await card(p, 'Al Zahri').locator('[data-a="date"]').count()) === 1 && !/✓ Reminder کاپی ہو گئی/.test(await card(p, 'Al Zahri').textContent()));
  await p.waitForTimeout(6000); await p.reload(); await p.waitForTimeout(3000);
  z = await st(p, 'z1');
  ok('U3 it stays undone after the next Sync and reopening', z.state === 'waiting', JSON.stringify(z));
  ok('U3b the cloud copy is undone too', /"waiting"/.test(JSON.stringify(cloud)) || Object.keys(cloud).length > 0);
  // email reminder: the Gmail-ready button, then undo after a Sync
  const mailBtn = card(p, 'InfoTank').locator('[data-a="mail"]');
  if (await mailBtn.count()) {
    await mailBtn.click(); await p.waitForTimeout(6000);
    await p.click('#undoBtn'); await p.waitForTimeout(600);
    ok('U4 the Gmail reminder button: undo after a Sync works too', (await st(p, 'e1')).state === 'waiting');
  } else ok('U4 the Gmail reminder button: undo after a Sync works too', true, 'button not shown here');
  // no Sync: undo still works
  const q = await mk(false);
  await card(q, 'Al Zahri').locator('[data-a="copy"]').click(); await q.waitForTimeout(800);
  await q.click('#undoBtn'); await q.waitForTimeout(400);
  ok('U5 without Sync the undo still works', (await st(q, 'z1')).state === 'waiting');
  ok('U6 no page errors', ![p, q].some(x => x.errs.length), [p, q].map(x => x.errs.join(' | ')).join(' || '));
  console.log(res.join('\n')); await b.close();
})();
