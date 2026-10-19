const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const QRCode = require('qrcode');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');
const source = fs.readFileSync(path.join(__dirname, '../components/team-works/operations/TeamWorksPortalShare.tsx'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', code)(name => name === 'qrcode' ? { default: QRCode } : {}, mod, mod.exports);
(async () => {
  for (const portal of mod.exports.TEAM_WORKS_PORTALS) {
    const png = PNG.sync.read(await QRCode.toBuffer(portal.url, { width: 640, margin: 4, errorCorrectionLevel: 'M' }));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    assert.equal(decoded?.data, `https://app.mikke-os.com/apps/team-works/portal/${portal.role}`);
    console.log(`PASS ${portal.role} QR decodes to the official portal URL`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
