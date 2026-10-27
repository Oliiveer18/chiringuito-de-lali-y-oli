import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire('/tmp/refactor-deps/package.json');
const {parse}=require('@babel/parser');
const traverse=require('@babel/traverse').default;
const types=require('@babel/types');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const report={version:1,workflowCommit:process.env.GITHUB_SHA,files:{}};
function group(kind,name){
  if(kind==='sim'){
    if(/^(newSeason|difficultyProfile|difficultyRush|RANDOM_EVENTS)$/.test(name))return 'season';
    if(/^(spawnCustomer|regularOutcome|scheduleRegulars|leaveQueue)$/.test(name))return 'customers';
    if(/^(pendingIdx|chooseSubstitute|announceSub)$/.test(name))return 'orders';
    if(/^(buyStock|charge|addSat)$/.test(name))return 'economy';
    if(/floor|slot|serve|clean|complete|payAnd|prepTime|startPart|finishSlot|giveUp/i.test(name))return 'service';
    return 'day';
  }
  if(name==='render')return 'frame';
  if(/person|customer|worker|character/i.test(name))return 'characters';
  if(/bubble|mood|identity|stationLabels|STATION_ZONE/i.test(name))return 'identity';
  if(/table|hamaca/i.test(name))return 'tables';
  if(/stationProps|stationWork|item|tray|held|drink|food/i.test(name))return 'items';
  if(/light|particle|floater|effect/i.test(name))return 'effects';
  if(/netStatus|pendingBadge|hud/i.test(name))return 'hud';
  return 'scene';
}
const normalized=n=>JSON.stringify(n,(k,v)=>['start','end','loc','extra','leadingComments','trailingComments','innerComments'].includes(k)?undefined:v);
for(const kind of ['sim','render']){
  assert(!fs.existsSync(kind),kind+' directory already exists; refusing overwrite');
  const filename=kind+'.js',source=fs.readFileSync(filename,'utf8'),ast=parse(source,{sourceType:'module'});
  let program;traverse(ast,{Program(p){program=p;p.scope.crawl();p.stop();}});
  const imports=[],records=[],publicNames=[];
  function names(node){
    if(node.type==='FunctionDeclaration'){assert(node.id);return [node.id.name];}
    assert.equal(node.type,'VariableDeclaration','Unsupported top-level declaration: '+node.type);
    return node.declarations.flatMap(d=>Object.keys(types.getBindingIdentifiers(d.id)));
  }
  for(const statement of ast.program.body){
    if(statement.type==='ImportDeclaration'){imports.push(statement);continue;}
    if(statement.type==='EmptyStatement')continue;
    let declaration=statement;
    if(statement.type==='ExportNamedDeclaration'){
      assert(!statement.source,'External reexports require manual review');
      if(!statement.declaration){for(const s of statement.specifiers)publicNames.push({local:s.local.name,exported:s.exported.name});continue;}
      declaration=statement.declaration;
      for(const name of names(declaration))publicNames.push({local:name,exported:name});
    }
    const ids=names(declaration);assert(ids.length,'Anonymous declaration requires review');
    const groups=new Set(ids.map(n=>group(kind,n)));assert.equal(groups.size,1,'Mixed responsibilities in a declaration: '+ids);
    records.push({node:declaration,names:ids,group:[...groups][0],text:source.slice(declaration.start,declaration.end)});
  }
  const owners=new Map(records.flatMap(r=>r.names.map(n=>[n,r])));
  const moduleFiles={};
  for(const r of records){
    const needed=[];
    for(const [name,binding] of Object.entries(program.scope.bindings)){
      const locations=[...binding.referencePaths,...binding.constantViolations];
      if(!locations.some(p=>p.node.start>=r.node.start&&p.node.end<=r.node.end))continue;
      if(owners.get(name)===r)continue;
      needed.push(name);
      if(owners.has(name)&&owners.get(name).group!==r.group){
        assert(!binding.constantViolations.some(p=>p.node.start>=r.node.start&&p.node.end<=r.node.end),'Cross-module assignment requires manual review: '+name);
      }
    }
    r.needed=needed;
  }
  fs.mkdirSync(kind);
  for(const name of new Set(records.map(r=>r.group))){
    const own=records.filter(r=>r.group===name),needed=new Set(own.flatMap(r=>r.needed));
    const lines=['/* Mechanical extraction from '+filename+'; declaration bodies are unchanged. */'];
    for(const imp of imports){
      const url=imp.source.value.startsWith('./')?'../'+imp.source.value.slice(2):imp.source.value;
      for(const s of imp.specifiers){
        if(!needed.has(s.local.name))continue;
        let spec;
        if(s.type==='ImportNamespaceSpecifier')spec='* as '+s.local.name;
        else if(s.type==='ImportDefaultSpecifier')spec=s.local.name;
        else spec='{ '+(s.imported.name||JSON.stringify(s.imported.value))+(s.imported.name===s.local.name?'':' as '+s.local.name)+' }';
        lines.push('import '+spec+' from '+JSON.stringify(url)+';');
        needed.delete(s.local.name);
      }
    }
    for(const dependency of [...needed].sort()){
      const owner=owners.get(dependency);assert(owner,'Unresolved binding: '+dependency);
      if(owner.group!==name)lines.push('import { '+dependency+' } from '+JSON.stringify('./'+owner.group+'.js?v=27.1')+';');
    }
    const output=lines.join('\n')+'\n\n'+own.map(r=>'export '+r.text).join('\n\n')+'\n';
    const parsed=parse(output,{sourceType:'module'});
    const emitted=parsed.program.body.filter(n=>n.type==='ExportNamedDeclaration').map(n=>n.declaration);
    assert.equal(emitted.length,own.length);
    own.forEach((r,i)=>assert.equal(normalized(emitted[i]),normalized(r.node),'Declaration changed: '+r.names));
    const target=kind+'/'+name+'.js';fs.writeFileSync(target,output);moduleFiles[target]=hash(output);
  }
  const exports=publicNames.map(e=>{const r=owners.get(e.local);assert(r,'Missing public binding: '+e.local);return 'export { '+e.local+(e.local===e.exported?'':' as '+e.exported)+' } from '+JSON.stringify('./'+r.group+'.js?v=27.1')+';';}).join('\n')+'\n';
  fs.writeFileSync(kind+'/index.js',exports);
  const facade='/* Compatibility entry: preserve original dependency evaluation order and public exports. */\n'+imports.map(i=>'import '+JSON.stringify(i.source.value)+';').join('\n')+'\nexport { '+publicNames.map(e=>e.exported).join(', ')+' } from '+JSON.stringify('./'+kind+'/index.js?v=27.1')+';\n';
  fs.writeFileSync(filename,facade);
  report.files[filename]={beforeSha256:hash(source),afterSha256:hash(facade),exports:publicNames.map(e=>e.exported).sort(),modules:moduleFiles,declarations:records.map(r=>({names:r.names,module:kind+'/'+r.group+'.js',sha256:hash(r.text)}))};
}
fs.mkdirSync('diagnostics',{recursive:true});
fs.writeFileSync('diagnostics/modular-refactor.json',JSON.stringify(report,null,2)+'\n');
