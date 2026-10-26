/* camera-beta: sensación de juego. */
import { Audio } from '../audio.js';
const FX=[];
const push=(x,y,k)=>FX.push({x,y,kind:k,t:0,life:.45});
export const fxServe=c=>{if(c){push(c.x,c.y-60,'serve');Audio._raw.start();}};
export const fxCharge=c=>{if(c){push(c.x,c.y-90,'charge');if(navigator.vibrate)try{navigator.vibrate(18);}catch(e){}}};
export const fxClean=t=>{if(t){push(t.x,t.y-40,'clean');if(navigator.vibrate)try{navigator.vibrate(12);}catch(e){}}};
export const fxTick=dt=>{for(const f of FX)f.t+=dt;while(FX.length&&FX[0].t>FX[0].life)FX.shift();};
export const fxDraw=ctx=>{for(const f of FX){const p=f.t/f.life;ctx.save();ctx.globalAlpha=1-p;ctx.strokeStyle=f.kind==='charge'?'#ffe066':f.kind==='clean'?'#bfefff':'#9ff0d0';ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y,18+p*34,0,Math.PI*2);ctx.stroke();ctx.restore();}};
