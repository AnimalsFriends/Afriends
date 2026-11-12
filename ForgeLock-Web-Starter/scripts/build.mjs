import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve('.'); const dist=resolve(root,'dist');
await rm(dist,{recursive:true,force:true}); await mkdir(dist,{recursive:true});
await cp(resolve(root,'index.html'),resolve(dist,'index.html'));
await cp(resolve(root,'src/styles'),resolve(dist,'src/styles'),{recursive:true});
await cp(resolve(root,'public'),resolve(dist,'public'),{recursive:true});
console.log('Build de demostración generado en dist/. No publicar sin configurar el cliente.');
