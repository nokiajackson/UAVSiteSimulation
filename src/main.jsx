import React, {useRef,useState,useMemo,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {OrbitControls,Line,Html,ContactShadows} from '@react-three/drei';
import {Vector3} from 'three';
import {Play,Pause,RotateCcw,Layers,Navigation,Move3D,ArrowUpRight,Settings2,Maximize} from 'lucide-react';
import {gates,flags,tunnel,start,plan,distance,length} from './planner';
import './style.css';
function Box({position,scale,color='#b4b6ad',...props}){return <mesh position={position} receiveShadow castShadow {...props}><boxGeometry args={scale}/><meshStandardMaterial color={color} roughness={.85}/></mesh>}
function Gate({gate:g}){const horizontal=!!g.normal[1];return <group position={g.center}>
  <mesh rotation={horizontal?[Math.PI/2,0,0]:g.normal[0]?[0,Math.PI/2,0]:[0,0,0]} castShadow><torusGeometry args={[g.radius,.055,16,72,g.arch?Math.PI:Math.PI*2]}/><meshStandardMaterial color={g.arch?'#e0ac58':'#28b6db'} metalness={.3} roughness={.4}/></mesh>
  {[-1,1].map(side=><Box key={side} position={[g.normal[0]?0:side*(g.arch?g.radius:g.radius+.12),-g.center[1]/2,g.normal[0]?side*(g.radius+.12):0]} scale={[.035,g.center[1],.035]} color="#3b4548"/>)}
  <Html position={[0,g.radius+.35,0]} center distanceFactor={13}><span className="gate-tag">{g.id} <b>{g.label}</b></span></Html>
</group>}
function Flags(){return <group>{flags.map((f,i)=><group key={i} position={[f.center[0],0,f.center[2]]}>
 <Box position={[-f.width/2,f.height/2,0]} scale={[.035,f.height,.035]} color="#394e49"/>
 <Box position={[0,f.height*.64,0]} scale={[f.width,f.height*.68,.035]} color={i%2?'#efc264':'#249fba'}/>
 <Box position={[-f.width/2,.04,0]} scale={[.5,.08,.5]} color="#455953"/>
 <Html position={[0,f.height+.25,0]} center distanceFactor={13}><span className="gate-tag">06-{i+1} <b>{f.side<0?'左繞':'右繞'}</b></span></Html>
 </group>)}</group>}
function Tunnel(){const {center,radius:r,legHeight:h,halfLength:l}=tunnel;return <group position={center} rotation={[0,tunnel.rotationY,0]}>
 {[-1,1].map(side=><Box key={side} position={[0,h/2,side*r]} scale={[l*2,h,.045]} color="#339eb2"/>)}
 {Array.from({length:24},(_,i)=>{const a=(i+.5)*Math.PI/24;return <Box key={i} position={[0,h+r*Math.sin(a),r*Math.cos(a)]} rotation={[-a-Math.PI/2,0,0]} scale={[l*2,.045,r*Math.PI/24+.012]} color={i%4===0?'#d1e8de':'#339eb2'}/>;})}
 <Html position={[0,h+r+.35,0]} center distanceFactor={13}><span className="gate-tag">07 <b>隧道</b></span></Html>
 </group>}
function Pad({position,label}){return <group position={[position[0],.035,position[2]]}><mesh receiveShadow><cylinderGeometry args={[.7,.7,.02,64]}/><meshStandardMaterial color="#168cb5"/></mesh><Html position={[0,.07,0]} center distanceFactor={12}><strong className="pad">H</strong></Html><Html position={[0,.1,1]} center distanceFactor={15}><span className="pad-name">{label}</span></Html></group>}
function Drone({route,running,speed,reset,onProgress}){
 const ref=useRef(), travel=useRef(0),report=useRef(0); const prev=useRef(reset);
 const lengths=useMemo(()=>route.slice(1).map((p,i)=>distance(route[i],p)),[route]); const total=length(route);
 useFrame((_,dt)=>{if(prev.current!==reset){travel.current=0;prev.current=reset;} if(running)travel.current=(travel.current+Math.min(dt,.1)*speed)%total;
 let d=travel.current,i=0;while(i<lengths.length-1&&d>lengths[i]){d-=lengths[i++];}
 const a=new Vector3(...route[i]),b=new Vector3(...route[i+1]);ref.current.position.copy(a.lerp(b,d/lengths[i]));
 const dir=new Vector3(...route[i+1]).sub(new Vector3(...route[i]));ref.current.rotation.y=Math.atan2(dir.x,dir.z);
 if((report.current+=dt)>.15){onProgress(travel.current/total);report.current=0;}});
 return <group ref={ref} scale={.7}><Box scale={[.25,.08,.32]} color="#f4ba53"/>{[-1,1].flatMap(x=>[-1,1].map(z=><group key={`${x}${z}`} position={[x*.19,0,z*.19]}><Box scale={[.25,.025,.025]} color="#202b32"/><mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.095,.115,24]}/><meshStandardMaterial color="#25343b" side={2}/></mesh></group>))}<pointLight color="#a8f3d4" intensity={.6} distance={1}/></group>
}
function Camera({view,controls}){const {camera}=useThree();React.useEffect(()=>{const positions={perspective:[1,15,18],top:[0,22,.01],front:[0,5,20]};camera.position.set(...positions[view.mode]);controls.current?.target.set(0,1,0);controls.current?.update();},[view]);return null;}
function Scene({view,route,showPath,showRoom,running,speed,reset,onProgress}){const controls=useRef();return <><color attach="background" args={['#e7ebe7']}/><fog attach="fog" args={['#e7ebe7',24,55]}/><ambientLight intensity={1.3}/><directionalLight position={[2,12,5]} intensity={2.2} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={10} shadow-camera-bottom={-10}/>
<Box position={[0,-.12,0]} scale={[17,.24,12]} color="#a5ada8"/>
<gridHelper args={[17,34,'#82928b','#96a29a']} position={[0,.012,0]}/>
{showRoom&&<><Box position={[0,2.2,-6]} scale={[17,4.4,.15]} color="#d9ddd6"/><Box position={[-8.5,2.2,0]} scale={[.15,4.4,12]} color="#d0d6cf"/>{[-5,-2,1,4].map(x=><group key={x}><Box position={[x,2.4,-5.9]} scale={[2.2,1.9,.04]} color="#728b90"/><Box position={[x,2.4,-5.84]} scale={[.04,1.9,.04]} color="#d1d8d3"/></group>)}</>}
{gates.map(g=><Gate key={g.id} gate={g}/>)}<Flags/><Tunnel/><Pad position={start} label="01 起點 / 循環返回"/>
{showPath&&<><Line points={route.outbound} color="#008b75" lineWidth={3}/><Line points={[route.outbound.at(-1),...route.loop.slice(route.outbound.length)]} color="#86958f" lineWidth={1.5} dashed dashSize={.16} gapSize={.12}/></>}
<Drone route={route.loop} running={running} speed={speed} reset={reset} onProgress={onProgress}/><ContactShadows position={[0,.02,0]} opacity={.3} scale={24} blur={2} far={5}/>
<OrbitControls ref={controls} makeDefault minDistance={3} maxDistance={30} maxPolarAngle={Math.PI/2-.02} target={[0,1,0]}/><Camera view={view} controls={controls}/></>}
function App(){const [running,setRunning]=useState(false),[speed,setSpeed]=useState(1.2),[radius,setRadius]=useState(.3),[showPath,setShowPath]=useState(true),[showRoom,setShowRoom]=useState(true),[view,setView]=useState({mode:'perspective'}),[reset,setReset]=useState(0),[progress,setProgress]=useState(0);const route=useMemo(()=>plan(radius),[radius]);const changeView=mode=>setView({mode});return <div className="app">
<header><a className="brand" href="./"><span className="brand-icon"><Navigation size={21}/></span>FIELD<span className="brand-divider"/> <small>UAV SIMULATION</small></a><div className="header-right"><span className="status-dot"/>3D 場地工作室 <span className="version">PROTOTYPE 02</span></div></header>
<aside><div className="eyebrow">WORKSPACE / 01</div><h1>室內飛行場地<span>Indoor flight environment</span></h1><div className="project-note"><span className="status-dot"/>場地示意模型 · 公尺制</div>
<section><div className="section-heading"><h2>賽道配置</h2><Layers size={16}/></div><div className="course"><div className="course-row"><i className="start-dot"/><div>H 起飛區<small>START POINT</small></div><span>01</span></div>{gates.filter(g=>!g.stage).map(g=><div className="course-row" key={g.id}><i className={g.normal[1]?'ring horizontal':'ring'}/><div>{g.label}<small>{g.arch?'ARCH':g.normal[1]?'HORIZONTAL':'VERTICAL'} GATE</small></div><span>{g.id}</span></div>)}<div className="course-row"><i className="ring horizontal"/><div>三環組：水平・垂直・水平<small>LEFT → CENTER → RIGHT</small></div><span>05</span></div><div className="course-row"><i className="ring"/><div>三旗 S 型繞行<small>SLALOM · 左 → 右 → 左</small></div><span>06</span></div><div className="course-row"><i className="ring"/><div>隧道 → 返回 01<small>TUNNEL / RETURN TO START</small></div><span>07</span></div></div></section>
<section><div className="section-heading"><h2>路徑規劃</h2><Settings2 size={16}/></div><div className="metric"><span>01 → 07 路線長度</span><strong>{route.total.toFixed(2)} <small>m</small></strong></div><div className="comparison">較中心穿越基準縮短 <b>{((1-route.total/route.baseline)*100).toFixed(1)}%</b></div><label className="slider-label">安全半徑 <b>{radius.toFixed(2)} m</b><input aria-label="安全半徑" type="range" min=".30" max=".35" step=".01" value={radius} onChange={e=>{setRadius(+e.target.value);setReset(x=>x+1);}}/></label><p className="hint">依序通過 02～04、05 左中右三環、三旗 S 型繞行與 07 隧道，再返回 01。旗子預設左 → 右 → 左繞行。</p></section>
<div className="sidebar-bottom"><span>模型說明</span><p>依照片概念重建，未加入鏡中反射。尺寸與位置為估計值，路線為幾何近似，未包含完整碰撞與飛行動力學。</p></div></aside>
<main><div className="viewport-header"><div><span className="eyebrow">LIVE VIEWPORT</span><h2>場地全覽 <span>/ 3D</span></h2></div><span className="local-badge"><span className="status-dot"/>本地示意場景</span></div>
<div className="canvas-wrap"><Suspense fallback={<div className="loading">正在建立場景…</div>}><Canvas shadows camera={{position:[1,15,18],fov:45}} gl={{antialias:true}}><Scene {...{view,route,showPath,showRoom,running,speed,reset,onProgress:setProgress}}/></Canvas></Suspense>
<div className="view-tabs">{[['perspective','透視'],['top','俯視'],['front','正視']].map(([mode,label])=><button key={mode} className={view.mode===mode?'active':''} onClick={()=>changeView(mode)}>{label}</button>)}</div>
<div className="view-tools"><button title="重設視角" onClick={()=>changeView('perspective')}><Maximize size={18}/></button><button title="顯示路線" className={showPath?'selected':''} onClick={()=>setShowPath(!showPath)}><Navigation size={18}/></button><button title="顯示牆面" className={showRoom?'selected':''} onClick={()=>setShowRoom(!showRoom)}><Layers size={18}/></button></div>
<div className="scene-legend"><span><i/>01 → 07</span><span><i className="return"/>循環返航</span><span><i className="gate"/>賽道障礙</span></div><div className="axis"><b>Y</b><span>Z └ X</span></div></div>
<div className="playback"><button className="play" onClick={()=>setRunning(!running)}>{running?<Pause size={17}/>:<Play size={17}/>} {running?'暫停模擬':'開始模擬'}</button><button className="reset" title="重設飛行" onClick={()=>{setReset(x=>x+1);setRunning(false);}}><RotateCcw size={17}/></button><div className="timeline"><div className="timeline-label"><span>{running?'循環飛行中':'飛行預覽'}</span><span>{Math.round(progress*100)}%</span></div><div className="track"><div style={{width:`${progress*100}%`}}/></div></div><label className="speed">速度<select aria-label="飛行速度" value={speed} onChange={e=>setSpeed(+e.target.value)}><option value={.6}>0.6 m/s</option><option value={1.2}>1.2 m/s</option><option value={2.4}>2.4 m/s</option></select></label></div>
<footer><span><Move3D size={14}/>拖曳旋轉 <em>·</em> 滾輪縮放 <em>·</em> 右鍵平移</span><span>R3F / THREE.JS <ArrowUpRight size={13}/></span></footer></main></div>}
createRoot(document.getElementById('root')).render(<App/>);
