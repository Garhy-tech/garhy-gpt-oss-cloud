import {readFile,readdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);

for(const directory of ['api','lib','gt-bybit','scripts']) {
  for(const name of await readdir(new URL(directory+'/',root))) {
    if(/\.(m?js)$/.test(name)) execFileSync(process.execPath,['--check',new URL(directory+'/'+name,root).pathname],{stdio:'pipe'});
  }
}

const config=JSON.parse(await readFile(new URL('vercel.json',root),'utf8'));
const manifest=JSON.parse(await readFile(new URL('gt-bybit/manifest.webmanifest',root),'utf8'));
const html=await readFile(new URL('gt-bybit/index.html',root),'utf8');
const p2pHtml=await readFile(new URL('gt-bybit/p2p.html',root),'utf8');
const worker=await readFile(new URL('gt-bybit/sw.js',root),'utf8');

assert.match(html,/<html lang="ar" dir="rtl">/);
assert.match(html,/id="secureApp"[^>]*hidden/);

for(const page of [html,p2pHtml]) {
  const ids=[...page.matchAll(/\bid="([^"]+)"/g)].map((m)=>m[1]);
  assert.equal(ids.length,new Set(ids).size,'Duplicate HTML IDs');
  assert.doesNotMatch(page,/<script(?![^>]*\bsrc=)[^>]*>/i,'Inline scripts violate the production CSP');
  for(const match of page.matchAll(/(?:src|href)="(\/[^"?#]+)(?:\?[^"#]*)?"/g)) {
    await stat(new URL(match[1].slice(1),root));
  }
}

assert.ok(!('icons' in manifest),'Manifest must not request an image icon');

assert.equal(manifest.start_url,'/');
assert.equal(manifest.scope,'/');
assert.equal(manifest.display,'standalone');
assert.equal(config.rewrites.find((r)=>r.source==='/').destination,'/gt-bybit/index.html');
assert.equal(config.outputDirectory,'public');

for(const dependency of ['preferences-bootstrap.js','preferences.js','receipts.js','p2p-console.js','demo-state.js']) {
  assert.ok(worker.includes(dependency),`Service worker must include ${dependency}`);
}
assert.doesNotMatch(worker,/\.(?:png|jpe?g|webp|gif|avif|bmp|ico|svg|tiff?)(?:\b|\?)/i);

const imageExtension=/\.(?:png|jpe?g|webp|gif|avif|bmp|ico|svg|tiff?)$/i;
async function scan(url,prefix='') {
  for(const entry of await readdir(url,{withFileTypes:true})) {
    const relative=prefix ? `${prefix}/${entry.name}` : entry.name;
    // Build output is checked separately after build; tests may contain negative assertions.
    if(relative==='public' || relative==='test')continue;
    if(entry.isDirectory()){await scan(new URL(`${entry.name}/`,url),relative);continue;}
    assert.ok(!imageExtension.test(entry.name),`Image file in GT CRYPTO APIs: ${relative}`);
    if(!/\.(?:html|css|m?js|json|webmanifest|txt)$/.test(entry.name) || relative==='scripts/check.mjs')continue;
    const source=await readFile(new URL(entry.name,url),'utf8');
    assert.doesNotMatch(source,/<(?:img|picture|source)\b|data:image|apple-touch-icon|(?:image\/(?:png|jpeg|webp|svg\+xml))|(?:\.)(?:png|jpe?g|webp|gif|avif|bmp|ico|svg|tiff?)(?:\b|\?)/i,`Image reference: ${relative}`);
    assert.doesNotMatch(source,/(?:createElement\(['"]img['"]\)|new Image\s*\(|createObjectURL\([^)]*image|<canvas\b|\.getContext\(['"]2d)/i,`Image generator: ${relative}`);
    if(entry.name.endsWith('.css'))assert.doesNotMatch(source,/(?:url\s*\(|image-set\s*\(|border-image\s*:|content\s*:\s*url\s*\()/i,`CSS image URL: ${relative}`);
  }
}
await scan(root);

console.log('Syntax, HTML/CSP, local assets, PWA, receipt shell, and zero-image inventory passed.');
