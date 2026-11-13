// Metres: X right, Y up, Z towards the front. Estimated from the user's sketch.
export const start = [-5, .4, 3.5];
export const gates = [
  {id:'02',center:[-5,1.5,1.2],normal:[0,0,-1],label:'垂直圓環',radius:.7},
  {id:'03',center:[-5,.45,-1],normal:[0,0,-1],label:'拱門',radius:.85,arch:true},
  {id:'04',center:[-5,1.9,-3.4],normal:[0,0,-1],label:'垂直圓環',radius:.7},
  {id:'05-L',stage:'05',center:[-2,1.9,-3.4],normal:[0,1,0],label:'左・水平環',radius:.7},
  {id:'05-C',stage:'05',center:[-.8,2.35,-3.4],normal:[1,0,0],label:'中・垂直環',radius:.7},
  {id:'05-R',stage:'05',center:[.4,1.9,-3.4],normal:[0,-1,0],label:'右・水平環',radius:.7},
];
export const flags = [-3.5,-1.3,.9].map((z,i)=>({center:[3,1.2,z],width:.8,height:2.4,side:i%2===0?-1:1}));
export const tunnel={center:[3.1,0,3],rotationY:Math.PI/2,halfLength:1.2,radius:.95,legHeight:.55};
export const finish=[tunnel.center[0],.85,tunnel.center[2]+tunnel.halfLength+.5];
export const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
export const length=points=>points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);
// Local offsets stay in the gate plane for X-, Y-, and Z-normal gates.
export function gateCenter(g,[u,v]) {return g.center.map((x,j)=>x+(j===(g.normal[0]?2:0)?u:0)+(j===(g.normal[1]?2:1)?v:0));}
export function slalom(radius){
 const result=[[3,1.2,-4.3]];
 for(const f of flags){const x=f.center[0]+f.side*(f.width/2+radius+.15);
  result.push([x,1.2,f.center[2]-.4],[x,1.2,f.center[2]+.4]);}
 result.push([3,1.2,1.8]);return result;
}
// Sample at <= 8 cm; a 4.5 cm buffer covers the gaps between samples.
function clearsGroup(points,radius){
 const rings=gates.filter(g=>g.stage==='05');
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],steps=Math.ceil(distance(a,b)/.08);
  for(let k=0;k<=steps;k++)for(const g of rings){
   const d=a.map((v,j)=>v+(b[j]-v)*k/steps-g.center[j]);
   const axial=d.reduce((sum,v,j)=>sum+v*g.normal[j],0);
   const radial=Math.sqrt(Math.max(0,d.reduce((sum,v)=>sum+v*v,0)-axial*axial));
   if(Math.hypot(axial,radial-g.radius)<radius+.055+.045)return false;
  }
 }return true;
}
export const gateLead=.6;
export function plan(radius=.3){
 if(!Number.isFinite(radius)||radius<=0||gates.some(g=>radius>=g.radius-.05))throw new Error('安全半徑超過環的可用開口');
 const offsets=gates.map(()=>[0,0]);
 const tunnelPoints=[[tunnel.center[0],.85,tunnel.center[2]-tunnel.halfLength-.5],finish];
 const tail=[...slalom(radius),...tunnelPoints];
 const points=()=>[start,...gates.flatMap((g,i)=>{
  const c=gateCenter(g,offsets[i]);return [-1,1].map(s=>c.map((x,j)=>x+s*g.normal[j]*gateLead));
 }),...tail];
 const baseline=length(points());
 for(const step of [.16,.06,.02,.006,.002])for(let iter=0;iter<70;iter++){
  let improved=false;
  for(let i=0;i<gates.length;i++)for(let axis=0;axis<2;axis++){
   const old=offsets[i][axis];let best=length(points()),value=old;
   for(const sign of [-1,1]){offsets[i][axis]=old+sign*step;
    const g=gates[i],c=gateCenter(g,offsets[i]);
    if(Math.hypot(...offsets[i])<=g.radius-radius-.05 && c[1]>=radius+.08 && (!g.arch||offsets[i][1]>=0)){
     const cost=length(points());if(cost<best-1e-9 && clearsGroup(points(),radius)){best=cost;value=offsets[i][axis];improved=true;}
    }
   }offsets[i][axis]=value;
  }if(!improved)break;
 }
 const outbound=points();
 const loop=[...outbound,[tunnel.center[0],.85,5.3],[-5,.85,5.3],start];
 return {outbound,loop,baseline,total:length(outbound),loopLength:length(loop),returnLength:length(loop)-length(outbound),slalom:slalom(radius),tunnelPoints};
}
