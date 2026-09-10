import { cp, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'public');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const directory of ['gt-bybit','assets'])await cp(path.join(root,directory),path.join(output,directory),{recursive:true});
console.log('Built public application assets. Server modules and tests are excluded.');
