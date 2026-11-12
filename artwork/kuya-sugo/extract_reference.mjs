/** Read the selected HTML's actual model and procedural walk in a restricted VM. */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
const THREE=require('./vendor/three-r128.min.cjs');
const smoothTHREE={...THREE,
 CylinderGeometry:function(a,b,c,_radial=8,h=1,open=false,start=0,length=Math.PI*2){return new THREE.CylinderGeometry(a,b,c,64,Math.max(4,h),open,start,length);},
 OctahedronGeometry:function(radius,detail=0){return new THREE.OctahedronGeometry(radius,Math.max(2,detail));},
 DodecahedronGeometry:function(radius,detail=0){return new THREE.DodecahedronGeometry(radius,Math.max(2,detail));},
 IcosahedronGeometry:function(radius,detail=0){return new THREE.IcosahedronGeometry(radius,Math.max(3,detail));}
};
const html=await fs.readFile(path.join(dir,'reference/pink_express_athletic_delivery_rider.html'),'utf8');
const start=html.indexOf('const materials = {');
const end=html.indexOf('// --- 9. MOVING TREADMILL');
const motionStart=html.indexOf('// 1. LOWER BODY STRIDE');
const motionEnd=html.indexOf('// 5. SCROLLING ROAD');
if([start,end,motionStart,motionEnd].some(i=>i<0)) throw Error('Reference source markers changed');
// Only the inspected geometry and transform math are evaluated, not the HTML,
// CDN loading, renderer, DOM events, camera UI or arbitrary browser callbacks.
const program=`
const scene=new THREE.Scene();
${html.slice(start,end)}
backpackGroup.visible=true;
hatGroup.visible=false;
const names={riderRoot,pelvisGroup,spineGroup,chestGroup,neckGroup,headGroup,hatGroup,brimGroup,backpackGroup,deliveryBoxGroup,
leftShoulder:leftArm.shoulderGroup,leftElbow:leftArm.elbowGroup,leftHand:leftArm.handGroup,
rightShoulder:rightArm.shoulderGroup,rightElbow:rightArm.elbowGroup,rightHand:rightArm.handGroup,
leftHip:leftLeg.hipGroup,leftKnee:leftLeg.kneeGroup,leftAnkle:leftLeg.ankleGroup,
rightHip:rightLeg.hipGroup,rightKnee:rightLeg.kneeGroup,rightAnkle:rightLeg.ankleGroup};
for(const [name,obj] of Object.entries(names))obj.name=name;
for(const [name,mat] of Object.entries(materials)){mat.name=name;mat.flatShading=false;}
let serial=0;scene.traverse(obj=>{if(obj.isMesh)obj.name=(obj.parent.name||'part')+'_'+obj.material.name+'_'+serial++;});
scene.updateMatrixWorld(true);
const objects=[];scene.traverse(obj=>{if(obj===scene)return;objects.push({id:obj.uuid,name:obj.name,parent:obj.parent===scene?null:obj.parent.uuid,
 type:obj.isMesh?'MESH':'GROUP',visible:obj.visible,local:obj.matrix.toArray(),world:obj.matrixWorld.toArray(),
 ...(obj.isMesh?{positions:Array.from(obj.geometry.attributes.position.array),indices:obj.geometry.index?Array.from(obj.geometry.index.array):null,
 geometryType:obj.geometry.type,parameters:obj.geometry.parameters,material:obj.material.name}:{} )});});
function applyPose(sec,speed=1.15){
 const swag=1, walkPhase=sec*speed*5.2, moveFactor=Math.min(1,speed/.5), breathePhase=sec*2.2;
 const animConfig={carryMode:'dual'};
 ${html.slice(motionStart,motionEnd)}
 // Preserve the requested front view, without the reference's torso yaw.
 pelvisGroup.rotation.y=spineGroup.rotation.y=chestGroup.rotation.y=headGroup.rotation.y=0;
 scene.updateMatrixWorld(true);
 return Object.fromEntries(Object.values(names).filter(o=>o!==hatGroup&&o!==brimGroup).map(o=>[o.uuid,o.matrixWorld.toArray()]));
}
const samples=Array.from({length:241},(_,i)=>applyPose(i/24));
const idle=applyPose(0,0);
globalThis.result={objects,samples,idle,materials:Object.fromEntries(Object.entries(materials).map(([n,m])=>[n,{color:'#'+m.color.getHexString(),roughness:m.roughness,metalness:m.metalness}])),root:riderRoot.uuid};
`;
const context=vm.createContext({THREE:smoothTHREE,Math});
new vm.Script(program,{filename:'selected-model-extraction.js'}).runInContext(context,{timeout:20000});
const result={...context.result,source:'C:/Users/Capstone/Downloads/pink_express_athletic_delivery_rider.html',sourceSha256:crypto.createHash('sha256').update(html).digest('hex'),carryMode:'Pack + Box',fps:24,durationMs:10000};
await fs.writeFile(path.join(dir,'reference/model-pack-box.json'),JSON.stringify(result));
console.log(JSON.stringify({source:result.source,objects:result.objects.length,frames:result.samples.length,carryMode:result.carryMode}));
