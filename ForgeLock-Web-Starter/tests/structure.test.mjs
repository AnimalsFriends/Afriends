import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('existen instrucciones y brief',async()=>{for(const p of ['AGENTS.md','client/brief.md','client/brand.md'])assert.ok((await readFile(p,'utf8')).length>100)});
test('el ejemplo permanece noindex',async()=>{const h=await readFile('index.html','utf8');assert.match(h,/noindex,nofollow/)});
