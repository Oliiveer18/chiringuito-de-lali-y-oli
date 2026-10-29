/* Host-side movement validation, independent of Three.js and the transport. */
import { service3D, createPlayers3D, serviceRunning } from './service-3d-model.mjs';
export const PLAYER_SPEED_3D=6.4;
export function playerPoses3D(game){
  const s=service3D(game);
  return s.players||(s.players=createPlayers3D());
}
export function acceptGuestMovement3D(game,packet,budget,now,blocked=()=>false){
  if(game.mode!=='service'||!game.floor?.id||packet.serviceId!==game.floor.id)return false;
  const target=playerPoses3D(game).p2,pose=packet.pose;
  if(!Number.isSafeInteger(packet.seq)||packet.seq<=target.seq||packet.seq<1)return false;
  const reject=()=>{target.seq=packet.seq;target.correctionSeq=packet.seq;return false;};
  if(!serviceRunning(game)||!pose||![pose.x,pose.z,pose.heading,now].every(Number.isFinite))return reject();
  if(pose.x < -9.2||pose.x>14.5||pose.z < -4.8||pose.z>5.8)return reject();
  if(budget.serviceId!==game.floor.id){
    Object.assign(budget,{serviceId:game.floor.id,at:now,balance:1.1});
  }
  const elapsed=Math.max(0,(now-budget.at)/1000);
  budget.balance=Math.min(PLAYER_SPEED_3D*.6+.35,budget.balance+elapsed*PLAYER_SPEED_3D*game.speed);
  budget.at=now;
  const dx=pose.x-target.x,dz=pose.z-target.z,distance=Math.hypot(dx,dz);
  if(distance>budget.balance+.001)return reject();
  const samples=Math.max(1,Math.ceil(distance/.1));
  for(let i=1;i<=samples;i++){
    if(blocked(target.x+dx*i/samples,target.z+dz*i/samples,.32))return reject();
  }
  budget.balance=Math.max(0,budget.balance-distance);
  Object.assign(target,{x:pose.x,z:pose.z,heading:Math.atan2(Math.sin(pose.heading),Math.cos(pose.heading)),seq:packet.seq});
  return true;
}
