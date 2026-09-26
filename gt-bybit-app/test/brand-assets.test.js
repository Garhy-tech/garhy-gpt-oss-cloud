import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('GT CRYPTO APIs permits only the approved character and watermark images',()=>{
  const result=spawnSync(process.execPath,[new URL('../scripts/check.mjs',import.meta.url).pathname],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr || result.stdout);
});
