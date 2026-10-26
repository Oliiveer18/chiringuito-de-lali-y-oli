import { scheduleViewportResize, view } from './canvas.js';
import { W, H } from './config.js';
const css=document.createElement('style');
css.textContent=`
:root{--game-safe-left:env(safe-area-inset-left,0px);--game-safe-right:env(safe-area-inset-right,0px)}
.panel,.sheet,.sheet-head,.cash,.row>div,.ctrl,.up,.join-row,.hud-group{min-width:0}
.screen{overflow-x:hidden;scroll-padding-bottom:24px}
.screen.center{align-items:safe center}
.sheet-foot{position:static;bottom:auto;background:#fffdf8;flex-wrap:wrap;flex-shrink:0;margin-top:12px;box-shadow:none;padding:16px 20px}
.sheet-foot .btn{max-width:100%;white-space:normal;min-height:48px;line-height:1.3;padding-top:10px;padding-bottom:10px}
#plan .sheet-foot{justify-content:stretch}
#plan .sheet-foot #btn-open{width:100%;border-radius:12px;background:#0b676c;color:#fff;border-color:#09575b;box-shadow:0 2px 6px #0b676c22}
#plan .sheet-foot #btn-open.waiting{background:#e4eeeb;color:#24494a;border-color:#afc5bd}
.row{grid-template-columns:48px minmax(0,1fr) auto}
.name,.sub,.cash-note,.team-note,.guest-info,.save-row{overflow-wrap:anywhere}
.ctrl{max-width:100%;gap:8px}
.ctrl .btn{min-height:44px;color:#2a2118;white-space:normal;line-height:1.3;padding:8px 12px}
.ctrl .btn.primary,.ctrl .btn.teal{color:#fff}
.price{flex-shrink:0}.price button{width:44px;height:44px}
.up-grid{grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))}
.up h4{gap:8px;flex-wrap:wrap}.up .foot{flex-wrap:wrap}
.title-card .btn.primary{background:#e8603c;color:#fff}
.title-actions .btn{width:100%;white-space:normal;padding:12px 18px;min-height:50px}
.title-card{padding-top:30px;padding-bottom:20px}
#hud{flex-wrap:wrap;gap:6px}
.hud-actions{flex-wrap:wrap;gap:6px}.hud-spacer{min-width:0}
.hud-role{white-space:normal}.speed button{min-width:36px;min-height:36px}
.stockbar{top:calc(var(--game-top) + var(--game-height));bottom:auto;transform:translateY(-100%);flex-wrap:nowrap;justify-content:flex-start;overflow-x:auto}
.stock{flex-shrink:0}
.hint{bottom:auto;top:calc(var(--game-top) + var(--game-height) - var(--bottom-ui,52px) - 8px);transform:translate(-50%,-100%);border-radius:12px;font-size:12px;max-width:90%;padding:8px 12px}
.toasts{top:calc(var(--game-top) + var(--top-ui,52px) + 8px)}
.modal{overflow:auto;padding:calc(16px + var(--st)) calc(16px + var(--sr)) calc(16px + var(--sb)) calc(16px + var(--sl))}
.modal.show{align-items:safe center}.netmsg-card{max-width:100%;margin:auto}
.save-browser{left:var(--game-left)!important;top:var(--game-top)!important;right:auto!important;bottom:auto!important;width:var(--game-width);height:var(--game-height);padding:calc(22px + var(--st)) calc(16px + var(--sr)) calc(20px + var(--sb)) calc(16px + var(--sl))!important;overflow-x:hidden}
.save-sheet{min-width:0}.save-action{max-width:100%;white-space:normal}.save-actions{align-items:stretch}
@media(max-width:640px){
.sheet-head{gap:10px;padding:16px;align-items:stretch}.sheet-head h2{font-size:24px}.cash{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;text-align:left}.cash-note{flex-basis:100%;max-width:none}.cash .v{font-size:25px}
.forecast{padding:12px 16px;gap:8px}.fc{width:190px}.tabs{padding:0 8px}.tab{padding:0 12px;min-height:46px}.tab-body{padding:12px 16px}
.row{grid-template-columns:40px minmax(0,1fr);gap:10px;padding:14px 0}.row .ctrl{grid-column:1/-1;justify-content:flex-start}.ctrl .btn{flex:1 1 auto}
.sheet-foot{padding:14px 16px}.save-state{margin:10px 16px}.title-card h1{font-size:clamp(32px,9vw,48px)}
.hud-weather{display:none}.hud-group{padding:4px 7px}.hud-rep{font-size:12px}.hud-role{font-size:11px}.hud-actions{margin-left:auto}.hud-btn{min-height:36px}.hud-btn span{display:none}
.stats{grid-template-columns:minmax(0,1fr) auto;font-size:12px;gap:0 10px;padding:4px 10px}.stats .total{font-size:15px}.kpis{gap:6px}.kpi{padding:8px 4px}.kpi .k{letter-spacing:0;font-size:10px}
}
@media(orientation:landscape) and (max-height:520px){
.screen{padding-top:calc(10px + var(--st));padding-bottom:calc(10px + var(--sb))}.sheet-head{padding:12px 16px}.sheet-foot{padding:10px 16px}.title-card{padding-top:22px}.title-card h1{font-size:32px}.title-actions{flex-direction:row;gap:10px}.title-actions .btn{width:auto;flex:1}.brand-mark{width:40px;height:40px}.save-sheet{padding:16px}.hud-btn.warn span{display:none}
}
/* ===== v9: zonas reservadas, vertical y horizontal ===== */
:root{--scene-top:0px;--scene-bottom:0px;--scene-w:100vw}
.ver-line{margin:0;padding:6px 16px 10px;text-align:center;font:700 11px/1.3 system-ui,-apple-system,sans-serif;color:#6b5c48;opacity:.8}
.title-card .ver-line{padding:0;margin:6px 0 0;color:rgba(255,255,255,.62);opacity:1}
#errbox{max-height:26vh!important;font-size:11px!important;left:calc(8px + var(--sl))!important;right:calc(8px + var(--sr))!important;bottom:calc(8px + var(--sb))!important}
#errbox::before{content:'Toca para cerrar este aviso';display:block;margin-bottom:4px;font-weight:700;opacity:.7}
.stockbar>.stock:first-child{margin-left:auto}.stockbar>.stock:last-child{margin-right:auto}
.hint{max-width:min(90%,var(--scene-w));font-size:11.5px;line-height:1.3}
.toasts{width:min(92%,var(--scene-w),380px)}
.toast{padding:8px 12px;font-size:12px}
.toast:not(:nth-last-child(-n+2)){display:none}
body.portrait .rotate-pill{display:none}
body.portrait.playing .rotate-pill{display:flex;animation:none;opacity:1;visibility:visible;bottom:auto;top:calc(var(--game-top) + var(--game-height) - var(--bottom-ui,0px) - 10px);transform:translate(-50%,-100%);font-size:12px;padding:8px 14px;max-width:calc(100% - 24px)}
body.portrait .hint{top:calc(var(--game-top) + var(--scene-bottom) + 10px);transform:translateX(-50%);max-width:calc(100% - 24px);font-size:12.5px}
body.portrait .toasts{width:min(calc(100% - 24px),420px);top:calc(var(--game-top) + var(--top-ui,52px) + 6px);height:max(0px,calc(var(--scene-top) - var(--top-ui,52px) - 12px));justify-content:flex-end;overflow:hidden}
body.portrait #hud{gap:6px 8px;padding-left:calc(10px + var(--sl));padding-right:calc(10px + var(--sr))}
body.portrait .hud-spacer{flex:0 0 100%;height:0}
body.portrait .hud-actions{margin-left:auto}
body.portrait .hud-btn.warn span{display:inline}
body.portrait .stockbar{flex-wrap:wrap;justify-content:center;overflow:visible;gap:6px}
body.portrait .stockbar>.stock{margin:0}
`;document.head.append(css);
const root=document.documentElement;
function measure(){for(const [id,key]of [['hud','--top-ui'],['stockbar','--bottom-ui']]){const e=document.getElementById(id);root.style.setProperty(key,(e&&e.getClientRects().length?e.getBoundingClientRect().height:0)+'px');}scheduleViewportResize();requestAnimationFrame(()=>requestAnimationFrame(place));}
let lastScene='';
function place(){const d=view.dpr||1,s=view.s/d,top=view.oy/d,k=[top,H*s,W*s].map(v=>Math.round(v)).join('|');if(k===lastScene)return;lastScene=k;root.style.setProperty('--scene-top',top+'px');root.style.setProperty('--scene-bottom',(top+H*s)+'px');root.style.setProperty('--scene-w',(W*s)+'px');}
if(window.ResizeObserver){const observer=new ResizeObserver(measure);for(const id of ['hud','stockbar'])observer.observe(document.getElementById(id));}
window.addEventListener('resize',measure);window.addEventListener('orientationchange',measure);measure();setInterval(place,400);
const hud=document.getElementById('hud');
if(hud){const sync=()=>document.body.classList.toggle('playing',!hud.classList.contains('hidden'));new MutationObserver(sync).observe(hud,{attributes:true,attributeFilter:['class']});sync();}
const eb=document.getElementById('errbox');
if(eb)eb.addEventListener('click',()=>{eb.style.display='none';eb.textContent='';});
