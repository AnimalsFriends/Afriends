import {readFile} from 'node:fs/promises';
const html=await readFile('index.html','utf8');
const required=['<!doctype html>','lang="es"','<main','<h1','name="viewport"','name="robots"'];
const missing=required.filter(s=>!html.toLowerCase().includes(s.toLowerCase()));
if(missing.length){console.error('Faltan elementos:',missing.join(', '));process.exit(1)}
console.log('Chequeos estructurales básicos OK. Requiere revisión manual de SEO, responsive y accesibilidad.');
