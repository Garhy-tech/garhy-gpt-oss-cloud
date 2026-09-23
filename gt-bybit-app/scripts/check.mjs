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

for(const icon of manifest.icons) {
  const bytes=await readFile(new URL(icon.src.slice(1),root));
  assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  assert.equal(icon.sizes,`${width}x${height}`);
}

assert.equal(manifest.start_url,'/');
assert.equal(manifest.scope,'/');
assert.equal(manifest.display,'standalone');
assert.equal(config.rewrites.find((r)=>r.source==='/').destination,'/gt-bybit/index.html');
assert.equal(config.outputDirectory,'public');

for(const dependency of ['preferences-bootstrap.js','preferences.js','receipts.js','p2p-console.js','demo-state.js','gt-logo.png','gt-watermark.webp']) {
  assert.ok(worker.includes(dependency),`Service worker must include ${dependency}`);
}
assert.doesNotMatch(worker,/icon-(?:180|192|512)|gt-profile|gt-primary|gt-app-mark|garhy-tech-signature/);

async function collectImages(url,prefix='') {
  const result=[];
  for(const entry of await readdir(url,{withFileTypes:true})) {
    const rel=prefix ? prefix+'/'+entry.name : entry.name;
    if(entry.isDirectory()) result.push(...await collectImages(new URL(entry.name+'/',url),rel));
    else if(/\.(?:png|jpe?g|webp|gif|avif|svg)$/i.test(entry.name)) result.push(rel);
  }
  return result;
}
const images=(await collectImages(new URL('assets/gt-bybit/',root))).sort();
assert.deepEqual(images,['brand/gt-logo.png','brand/gt-watermark.webp']);

console.log('Syntax, HTML/CSP, local assets, PWA, receipt shell, and strict image inventory passed.');
