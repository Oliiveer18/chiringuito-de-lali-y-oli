/* Optional sandbox preview adapter. Never used by the GitHub Pages game.
   Copies runtime assets; storage becomes in-memory and fullscreen is disabled.
   Usage: node tools/build-service-preview.mjs /absolute/output/folder */
import { readdir, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(process.argv[2]||path.join(root,'test-artifacts','preview'));
if(output===root)throw Error('Preview output must not be the source folder');
await mkdir(output,{recursive:true});
function adapt(text){
  return text.replace(/\blocalStorage\b/g,'previewStorage')
    .replace(/\bsessionStorage\b/g,'previewSessionStorage')
    .replace(/\b(fullscreenEnabled|fullscreenElement|requestFullscreen|exitFullscreen|fullscreenchange)\b/g,
      name=>'preview'+name[0].toUpperCase()+name.slice(1));
}
async function copyRuntime(source,dest){
  await mkdir(dest,{recursive:true});
  for(const item of await readdir(source,{withFileTypes:true})){
    if(item.isDirectory())continue;
    if(!/\.(js|mjs|css|html|svg|webmanifest)$/.test(item.name)||/\.test\.mjs$/.test(item.name)||item.name==='serve.js')continue;
    const src=path.join(source,item.name),out=path.join(dest,item.name);
    if(/\.(js|mjs)$/.test(item.name))await writeFile(out,adapt(await readFile(src,'utf8')));
    else await copyFile(src,out);
  }
}
await copyRuntime(root,output);
for(const folder of ['lib','render','sim'])await copyRuntime(path.join(root,folder),path.join(output,folder));
await copyFile(path.join(root,'tools','preview-runtime.js'),path.join(output,'preview-runtime.js'));
const entry=path.join(output,'index.html');
const html=await readFile(entry,'utf8');
if(!html.includes('<script type="module"'))throw Error('Module entry point not found');
await writeFile(entry,html.replace('<script type="module"',
  '<script src="./preview-runtime.js"></script>\n<script type="module"'));
console.log('Preview runtime copied to',output);
