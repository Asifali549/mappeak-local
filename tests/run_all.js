// Runs every *.test.js against a local copy of the tool (fake Google services, nothing real is touched).
// Usage (from the repo folder):  node tests/run_all.js      Needs Node and Playwright with Chromium.
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const root = path.join(__dirname, '..'), port = 8765;
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.webmanifest':'application/manifest+json' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split(/[?#]/)[0]));
  if(!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
server.listen(port, async () => {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
  let pass = 0, fail = 0;
  for(const f of files){
    const out = await new Promise(done => { let o = ''; const c = spawn(process.execPath, [path.join(__dirname, f)], { env: { ...process.env, BASE: 'http://localhost:' + port } });
      c.stdout.on('data', d => o += d); c.stderr.on('data', d => o += d); c.on('close', () => done(o)); });
    const p = (out.match(/^PASS /gm) || []).length, x = (out.match(/^FAIL /gm) || []).length + (/Error/.test(out) && !p ? 1 : 0);
    pass += p; fail += x;
    console.log('== ' + f + ': ' + p + ' pass, ' + x + ' fail'); out.split('\n').filter(l => /^FAIL|Error/.test(l)).forEach(l => console.log('   ' + l));
  }
  console.log('\nTOTAL: ' + pass + ' pass, ' + fail + ' fail'); server.close(); process.exit(fail ? 1 : 0);
});
