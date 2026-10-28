#!/usr/bin/env node
/* Kiosco Yeray · servidor de partidas, sin dependencias.
   Sirve el juego por HTTP y hace de relé WebSocket en /ws.
   Uso: node server.js   (puerto 8000 o variable PORT) */
'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=+process.env.PORT||8000,ROOT=__dirname,MAX_PAYLOAD=1<<20,MAX_ROOMS=500,ROOM_IDLE_MS=30*60*1000,PING_MS=25000;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
const PUBLIC=/^\/(index\.html|game\.js|style\.css|manifest\.webmanifest|icon\.svg|js\/[\w.-]+\.js)?$/;
const server=http.createServer((req,res)=>{
  const url=decodeURIComponent((req.url||'/').split('?')[0]);
  if(url==='/health'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('ok');}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
  if(!PUBLIC.test(url)){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('No encontrado');}
  const file=path.join(ROOT,url==='/'?'index.html':url);
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('No encontrado');}
    res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:data);
  });
});
const GUID='258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function frame(op,payload){const len=payload.length;let head;
  if(len<126)head=Buffer.from([0x80|op,len]);
  else if(len<65536){head=Buffer.alloc(4);head[0]=0x80|op;head[1]=126;head.writeUInt16BE(len,2);}
  else{head=Buffer.alloc(10);head[0]=0x80|op;head[1]=127;head.writeBigUInt64BE(BigInt(len),2);}
  return Buffer.concat([head,payload]);}
class Peer{
  constructor(socket){this.socket=socket;this.buf=Buffer.alloc(0);this.alive=true;this.closed=false;this.frags=[];this.fragLen=0;this.fragOp=0;this.room=null;this.role=null;this.onmessage=()=>{};this.onclose=()=>{};
    socket.on('data',d=>this.read(d));socket.on('close',()=>this.finish());socket.on('error',()=>this.finish());socket.setNoDelay(true);}
  send(t){if(!this.closed&&this.socket.writable)this.socket.write(frame(0x1,Buffer.from(t)));}
  close(code=1000){if(this.closed)return;const b=Buffer.alloc(2);b.writeUInt16BE(code);try{this.socket.write(frame(0x8,b));}catch(e){}this.socket.end();setTimeout(()=>this.socket.destroy(),1000).unref();this.finish();}
  finish(){if(this.closed)return;this.closed=true;this.onclose();}
  read(chunk){this.buf=Buffer.concat([this.buf,chunk]);
    for(;;){const b=this.buf;if(b.length<2)return;
      const fin=!!(b[0]&0x80),op=b[0]&0x0f,masked=!!(b[1]&0x80);let len=b[1]&0x7f,off=2;
      if(len===126){if(b.length<4)return;len=b.readUInt16BE(2);off=4;}
      else if(len===127){if(b.length<10)return;len=Number(b.readBigUInt64BE(2));off=10;}
      if(!masked||len>MAX_PAYLOAD)return this.close(1009);
      if(b.length<off+4+len)return;
      const mask=b.subarray(off,off+4),data=Buffer.from(b.subarray(off+4,off+4+len));
      for(let i=0;i<data.length;i++)data[i]^=mask[i&3];
      this.buf=b.subarray(off+4+len);
      if(op===0x8)return this.close(1000);
      if(op===0x9){this.socket.write(frame(0xA,data));continue;}
      if(op===0xA){this.alive=true;continue;}
      if(op===0x1||op===0x2){this.fragOp=op;this.frags=[data];this.fragLen=data.length;}
      else if(op===0x0){this.frags.push(data);this.fragLen+=data.length;if(this.fragLen>MAX_PAYLOAD)return this.close(1009);}
      else return this.close(1002);
      if(fin){const msg=Buffer.concat(this.frags);this.frags=[];this.fragLen=0;if(this.fragOp===0x1)this.onmessage(msg.toString('utf8'));}}}}
server.on('upgrade',(req,socket)=>{
  const url=(req.url||'').split('?')[0],key=req.headers['sec-websocket-key'];
  if(url!=='/ws'||!key||(req.headers.upgrade||'').toLowerCase()!=='websocket'){socket.destroy();return;}
  const accept=crypto.createHash('sha1').update(key+GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
  handle(new Peer(socket));});
const rooms=new Map(),LETTERS='ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode(){for(let n=0;n<200;n++){let c='';for(let i=0;i<4;i++)c+=LETTERS[crypto.randomInt(LETTERS.length)];if(!rooms.has(c))return c;}return null;}
const out=(p,o)=>{if(p)p.send(JSON.stringify(o));};
function leave(p){const c=p.room;if(!c)return;const r=rooms.get(c);p.room=null;if(!r)return;r.lastSeen=Date.now();
  if(p.role==='host'&&r.host===p){rooms.delete(c);out(r.guest,{t:'closed'});if(r.guest){r.guest.room=null;r.guest.role=null;}}
  else if(p.role==='guest'&&r.guest===p){r.guest=null;out(r.host,{t:'peer',on:false});}
  p.role=null;}
function handle(p){p.onclose=()=>leave(p);
  p.onmessage=text=>{let m;try{m=JSON.parse(text);}catch(e){return;}if(!m||typeof m.t!=='string')return;
    if(m.t==='create'){leave(p);if(rooms.size>=MAX_ROOMS)return out(p,{t:'error',msg:'El servidor está lleno. Inténtalo en unos minutos.'});
      const code=newCode();if(!code)return out(p,{t:'error',msg:'No se ha podido crear la sala.'});
      rooms.set(code,{host:p,guest:null,lastSeen:Date.now()});p.room=code;p.role='host';return out(p,{t:'created',code});}
    if(m.t==='join'){leave(p);const code=String(m.code||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,4),r=rooms.get(code);
      if(!r)return out(p,{t:'error',msg:'No existe ninguna partida con ese código.'});
      if(r.guest)return out(p,{t:'error',msg:'Esa partida ya tiene a dos jugadores.'});
      r.guest=p;p.room=code;p.role='guest';r.lastSeen=Date.now();out(p,{t:'joined',code});out(r.host,{t:'peer',on:true});out(p,{t:'peer',on:true});return;}
    const r=p.room&&rooms.get(p.room);if(!r)return;
    if(p.role==='host'&&m.t==='state')out(r.guest,m);
    else if(p.role==='guest'&&(m.t==='act'||m.t==='hello'))out(r.host,m);
    if(p.role==='host'&&m.t==='state')r.lastSeen=Date.now();};
  p.hb=setInterval(()=>{if(!p.alive){clearInterval(p.hb);return p.socket.destroy();}p.alive=false;try{p.socket.write(frame(0x9,Buffer.alloc(0)));}catch(e){}},PING_MS);
  p.hb.unref();const old=p.onclose;p.onclose=()=>{clearInterval(p.hb);old();};}
setInterval(()=>{const now=Date.now();for(const[c,r]of rooms)if(now-r.lastSeen>ROOM_IDLE_MS&&!r.guest){r.host&&r.host.close(1001);rooms.delete(c);}},60000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log('Kiosco Yeray escuchando en http://localhost:'+PORT));
module.exports=server;
