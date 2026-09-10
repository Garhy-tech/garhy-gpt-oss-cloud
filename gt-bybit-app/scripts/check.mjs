import {readFile, readdir, stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
for(const directory of ['api','lib','gt-bybit','scripts'])for(const name of await readdir(new URL(directory+'/',root)))if(/\.(m?js)$/.test(name))execFileSync(process.execPath,['--check',new URL(directory+'/'+name,root).pathname],{stdio:'pipe'});
const config=JSON.parse(await readFile(new URL('vercel.json',root),'utf8'));
const manifest=JSON.parse(await readFile(new URL('gt-bybit/manifest.webmanifest',root),'utf8'));
const html=await readFile(new URL('gt-bybit/index.html',root),'utf8');
assert.match(html,/<html lang="ar" dir="rtl">/);assert.match(html,/id="secureApp"[^>]*hidden/);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map((m)=>m[1]);assert.equal(ids.length,new Set(ids).size,'Duplicate HTML IDs');
for(const match of html.matchAll(/(?:src|href)="(\/[^"?#]+)(?:\?[^"#]*)?"/g))await stat(new URL(match[1].slice(1),root));
for(const icon of manifest.icons){const bytes=await readFile(new URL(icon.src.slice(1),root));assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);assert.equal(icon.sizes,`${width}x${height}`);}
assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');
assert.equal(config.rewrites.find((r)=>r.source==='/').destination,'/gt-bybit/index.html');
assert.equal(config.outputDirectory,'public');
console.log('Syntax, HTML IDs, local asset references, manifest dimensions, and routing configuration passed.');
