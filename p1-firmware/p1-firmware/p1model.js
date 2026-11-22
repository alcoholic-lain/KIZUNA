/* P1 smart plug 3D model, shared by /room and /produit. Units: cm (body 4.4 x 8.6). Front = +z, wall pins = -z.
   Geometry follows the components model (composants.html): shells, 16 A 2P+T plug, power PCB, relay, PSU, MOV, TFT, side buttons, QR. */
(function(w){
function build(THREE){
 var G={},group=new THREE.Group(),all=[],shell=[],caps=[],BR=0xd4a53a,SV=0xcfd3d6,MT={metalness:.9,roughness:.3},BM={metalness:.6,roughness:.3};
 function sm(c,o){return new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.5,metalness:0},o||{}))}
 function bx(w,h,d,c,x,y,z,g,o){var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),sm(c,o));m.position.set(x,y,z);g.add(m);return m}
 function cy(r,l,c,x,y,z,g,o){var m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,l,24),sm(c,o));m.rotation.x=Math.PI/2;m.position.set(x,y,z);g.add(m);return m}
 function rrp(p,w,h,r,cx,cy2){var x=cx-w/2,y=cy2-h/2;p.moveTo(x+r,y);p.lineTo(x+w-r,y);p.quadraticCurveTo(x+w,y,x+w,y+r);p.lineTo(x+w,y+h-r);p.quadraticCurveTo(x+w,y+h,x+w-r,y+h);p.lineTo(x+r,y+h);p.quadraticCurveTo(x,y+h,x,y+h-r);p.lineTo(x,y+r);p.quadraticCurveTo(x,y,x+r,y);return p}
 function ext(s,d,c,z,g,o){var ge=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:20});ge.translate(0,0,-d/2);var m=new THREE.Mesh(ge,sm(c,o));m.position.z=z;g.add(m);return m}
 function mkTex(W,H,fn){var c=document.createElement('canvas');c.width=W|0;c.height=H|0;var g=c.getContext('2d');fn(g,c.width,c.height);var t=new THREE.CanvasTexture(c);t.anisotropy=8;return t}
 function dec(t,w,h,x,y,z,g,ry){var m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,transparent:true,roughness:.6,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));m.position.set(x,y,z);if(ry)m.rotation.y=ry;g.add(m);return m}
 function lbl(w,h,rows,bg,fg){return mkTex(w,h,function(g){if(bg){g.fillStyle=bg;g.fillRect(0,0,w,h)}rows.forEach(function(r){g.fillStyle=r[4]||fg;g.font=r[3];g.fillText(r[0],r[1],r[2])})})}
 function part(id,x,y,z,dx,dy,dz,fn){var g=new THREE.Group();fn(g);g.position.set(x,y,z);g.userData={home:new THREE.Vector3(x,y,z),dir:new THREE.Vector3(dx,dy,dz)};group.add(g);G[id]=g;g.traverse(function(m){if(m.isMesh){m.userData.pid=id;all.push(m)}})}
 function pcb(wd,h,tag,x,y,z,dz,id,extra){part(id,x,y,z,0,0,dz,function(g){bx(wd,h,.16,0x15683a,0,0,0,g,{roughness:.45});
  dec(mkTex(wd*120,h*120,function(c,W,H){c.fillStyle='#15683a';c.fillRect(0,0,W,H);c.strokeStyle='#23804b';c.lineWidth=4;c.lineCap='round';
   for(var i=0;i<46;i++){var a=(i*37)%W,b=(i*91)%H;c.beginPath();c.moveTo(a,b);c.lineTo((a+110)%W,b);c.lineTo((a+110)%W,(b+60)%H);c.stroke()}
   c.fillStyle='#f2f2ee';c.font='600 '+(W*.05|0)+'px system-ui';c.fillText(tag,W*.12,H*.97)}),wd,h,0,0,.082,g);if(extra)extra(g)})}
 /* male plug 2P+T */
 part('plug',0,0,-3.25,0,0,-6,function(g){ext(rrp(new THREE.Shape(),4.34,4.4,.2,0,0),.4,0xf1f3f4,.95,g);cy(1.8,1.5,0xf1f3f4,0,0,0,g);
  cy(.4,.03,BR,0,1.15,-.76,g,BM);cy(.3,.035,0x14181c,0,1.15,-.765,g);
  [-.95,.95].forEach(function(x){cy(.3,.7,0xf1f3f4,x,0,-1.1,g);bx(.5,.14,1.3,0xf1f3f4,x,-.3,-1.4,g);cy(.24,1.4,BR,x,0,-1.45,g,BM);
   var t=new THREE.Mesh(new THREE.SphereGeometry(.24,20,12),sm(BR,BM));t.position.set(x,0,-2.15);g.add(t)})});
 /* back shell + gasket */
 part('back',0,0,-.95,0,0,-4,function(g){var s=rrp(new THREE.Shape(),4.4,8.6,.45,0,0);s.holes.push(rrp(new THREE.Path(),4,8.2,.3,0,0));ext(s,2.3,0xeef1f3,0,g,{roughness:.35});
  ext(rrp(new THREE.Shape(),4.4,8.6,.45,0,0),.2,0xeef1f3,-1.05,g,{roughness:.35});
  var j=rrp(new THREE.Shape(),4.28,8.48,.4,0,0);j.holes.push(rrp(new THREE.Path(),3.9,8.1,.25,0,0));ext(j,.5,0x8f989f,1.15,g)});
 part('screws',0,0,-1.4,0,0,-5.5,function(g){[[-1.8,2.7],[1.8,2.7],[-1.8,-2.7],[1.8,-2.7]].forEach(function(p){cy(.15,1.4,SV,p[0],p[1],0,g,BM);cy(.3,.2,SV,p[0],p[1],-.8,g,BM)})});
 /* power PCB with relay, PSU, MOV, fuse, shunt */
 pcb(3.8,8,'P1-PWR  REV C',0,0,-1.4,-2.8,'pcbp',function(g){bx(.12,.9,.2,0x101010,0,-1,0,g)});
 part('relay',0,0,-.535,0,0,-2.465,function(g){bx(2.9,1.3,1.57,0x1b1d20,0,0,0,g,{roughness:.55});
  dec(lbl(290,130,[['HF115F/005-1HS3',14,38,'700 24px system-ui'],['16A 250VAC  15A 125VAC',14,66,'500 15px system-ui'],['HONGFA',200,118,'800 17px system-ui','#e5484d']],null,'#f1f1f1'),2.5,1.1,0,0,.787,g)});
 part('psu',0,3,-.57,0,0,-2.43,function(g){bx(3.4,2,1.5,0x15171a,0,0,0,g,{roughness:.6});
  dec(lbl(340,200,[['HLK-PM01',20,50,'800 36px system-ui'],['AC-DC Power Module',20,86,'500 17px system-ui'],['OUT : 5V  600mA  3W',20,150,'600 18px system-ui']],'#e9e9e6','#111'),3,1.7,0,0,.756,g)});
 part('mov',0,1.25,-1.07,0,0,-2.13,function(g){cy(.7,.45,0x1f5fbf,0,0,0,g,{roughness:.35});[-.25,.25].forEach(function(x){cy(.04,.6,0xd5d9dc,x,-.3,-.45,g,MT)})});
 part('fuse',-1.35,1.3,-1.15,0,0,-2.15,function(g){var m=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.9,16),sm(0xb9bec2,{metalness:.9,roughness:.35}));m.rotation.z=Math.PI/2;g.add(m)});
 part('shunt',1.55,-.95,-1.22,0,0,-2.18,function(g){bx(.9,.28,.12,0xc9803f,0,0,.08,g,{metalness:1,roughness:.3})});
 /* socket (lower) */
 part('contacts',0,-2.05,.95,0,0,-1.95,function(g){cy(1.9,.12,0xf1f3f4,0,0,0,g);
  var fl=new THREE.Mesh(new THREE.CircleGeometry(1.9,64),new THREE.MeshStandardMaterial({map:mkTex(256,256,function(c){c.fillStyle='#f3f5f6';c.fillRect(0,0,256,256);c.fillStyle='rgba(150,158,166,.85)';c.font='700 24px system-ui';c.textAlign='center';c.fillText('16A 250V',128,60)}),roughness:.5}));fl.position.z=.065;fl.rotation.z=Math.PI;g.add(fl);
  [-.95,.95].forEach(function(x){cy(.27,.02,0x14181c,x,0,.07,g);bx(.5,.9,1.2,BR,x,0,-.65,g,BM)});bx(2.4,.3,.15,BR,0,0,-1.3,g,BM);cy(.23,.55,SV,0,.97,.33,g,BM);cy(.23,.3,BR,0,.97,.72,g,BM)});
 /* interface PCB + ESP32 */
 pcb(3.9,4,'P1-UI  REV B',0,2.2,1.4,1.2,'pcbu');
 part('esp',0,1.9,1.2,0,0,.7,function(g){bx(1.32,1.66,.08,0xb9bec2,0,0,0,g,{metalness:.8,roughness:.4});bx(1.32,.5,.06,0x141a14,0,1.05,0,g)});
 /* TFT screen */
 var tc=document.createElement('canvas');tc.width=760;tc.height=610;var tg=tc.getContext('2d'),ttex=new THREE.CanvasTexture(tc);ttex.anisotropy=8;
 part('tft',0,2.65,1.9,0,0,2,function(g){var m=new THREE.Mesh(new THREE.PlaneGeometry(3.8,3.05),new THREE.MeshBasicMaterial({map:ttex}));g.add(m)});
 /* front shell: TFT window, socket opening, buzzer hole */
 part('front',0,0,1,0,0,5,function(g){var s=rrp(new THREE.Shape(),4.4,8.6,.45,0,0);s.holes.push(rrp(new THREE.Path(),3.9,3.05,.15,0,2.65));
  var c=new THREE.Path();c.absarc(0,-2.05,1.95,0,Math.PI*2,true);s.holes.push(c);var b=new THREE.Path();b.absarc(0,.65,.38,0,Math.PI*2,true);s.holes.push(b);
  ext(s,.3,0xeef1f3,.95,g);var wl=rrp(new THREE.Shape(),4.4,8.6,.45,0,0);wl.holes.push(rrp(new THREE.Path(),4,8.2,.3,0,0));ext(wl,1.58,0xeef1f3,0,g);
  var t=new THREE.Shape();t.absarc(0,0,2,0,Math.PI*2,false);var th=new THREE.Path();th.absarc(0,0,1.95,0,Math.PI*2,true);t.holes.push(th);ext(t,.8,0xeef1f3,.4,g).position.y=-2.05;
  var f=rrp(new THREE.Shape(),4.1,4,.35,0,2.2);f.holes.push(rrp(new THREE.Path(),3.9,3.05,.15,0,2.65));var fb=new THREE.Path();fb.absarc(0,.65,.38,0,Math.PI*2,true);f.holes.push(fb);ext(f,.06,0x1b2228,1.13,g,{roughness:.4})});
 /* status LED (next to the buzzer hole) */
 var ledMat=new THREE.MeshBasicMaterial({color:0x55606a});
 part('led',0,.65,1,0,0,5,function(g){var m=new THREE.Mesh(new THREE.SphereGeometry(.16,16,12),ledMat);m.position.set(1.3,0,1.16);g.add(m);cy(.34,.1,0x0b0e11,0,0,.9,g)});
 /* right face: 4 push buttons + QR label */
 part('btn',2.1,3.2,-.9,3.1,0,0,function(g){bx(.1,1.4,2,0x15683a,-.15,0,0,g);bx(.06,1.5,2.2,0x1b2228,.12,0,0,g);
  [[.25,.5,0xc92a2a,'1'],[.25,-.5,0xc92a2a,'2'],[-.25,.5,0xdfe3e6,'SET'],[-.25,-.5,0xdfe3e6,'WiFi']].forEach(function(b){
   bx(.18,.34,.46,0xaeb4b9,0,b[0],b[1],g,MT);var cap=bx(.2,.34,.7,b[2],.3,b[0],b[1],g,{roughness:.45});cap.userData.cap=b[3];cap.userData.x0=.3;caps.push(cap)})});
 var QRM="1111111,1000001,1011101,1011101,1011101,1000001,1111111".split(',');
 part('qr',2.21,-.8,-.9,3.2,0,0,function(g){bx(.02,2,2,0xffffff,0,0,0,g,{roughness:.8});
  var m=dec(mkTex(210,210,function(c){c.fillStyle='#fff';c.fillRect(0,0,210,210);c.fillStyle='#000';for(var y=0;y<7;y++)for(var x=0;x<7;x++)if(QRM[y].charAt(x)==='1')c.fillRect(30+x*20,16+y*20,20,20);c.font='600 22px system-ui';c.textAlign='center';c.fillText('P1-0042',105,196)}),1.96,1.96,.012,0,0,g,Math.PI/2)});
 /* shell materials (for the ghost effect when exploded) */
 ['back','front'].forEach(function(id){G[id].traverse(function(m){if(m.isMesh&&m.material.color.getHex()===0xeef1f3)shell.push(m.material)})});
 /* live TFT */
 var T=null,blink=true,drawn='';
 function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
 function paint(){
  var t=T||{state:'OFF',relay:0,power_w:0,current_a:0,voltage_v:230,energy_wh:0,temp_c:24},trip=t.state.indexOf('TRIP')===0,on=!!t.relay&&!trip,
   key=[t.state,Math.round(t.power_w),t.current_a.toFixed(2),Math.round(t.voltage_v),(t.energy_wh/1000).toFixed(3),Math.round(t.temp_c),trip&&blink].join('|');
  if(key===drawn)return;drawn=key;var g=tg,F='ui-monospace,Consolas,monospace',S='system-ui,Segoe UI,sans-serif';
  g.fillStyle='#000';rr(g,0,0,760,610,26);g.fill();g.strokeStyle='#1d252b';g.lineWidth=4;g.stroke();g.textBaseline='alphabetic';
  g.fillStyle='#8b98a3';g.font='600 26px '+S;g.textAlign='left';g.fillText('PRISE P1-0042',30,58);
  g.fillStyle=trip?(blink?'#f43f5e':'#4a1520'):on?'#4ade80':'#55606a';g.beginPath();g.arc(715,46,13,0,6.3);g.fill();
  g.fillStyle='#f4f6f7';g.font='800 150px '+F;g.fillText(String(Math.round(t.power_w)),30,200);var wv=g.measureText(String(Math.round(t.power_w))).width;g.font='700 44px '+F;g.fillText('W',40+wv,200);
  g.font='700 60px '+F;g.fillStyle=trip?'#f43f5e':'#ff8a5e';g.fillText(t.current_a.toFixed(2)+' A',30,282);
  g.textAlign='right';g.fillStyle=trip?'#f43f5e':on?'#4ade80':'#8b98a3';g.font='700 44px '+F;g.fillText(trip?'DEFAUT':on?'ON':'OFF',730,282);g.textAlign='left';
  g.fillStyle='#1d252b';g.fillRect(30,306,700,2);
  g.fillStyle='#4ade80';g.font='800 80px '+F;g.fillText(Math.round(t.voltage_v)+' V',30,396);
  g.fillStyle='#4aa8ff';g.font='800 62px '+F;g.fillText((t.energy_wh/1000).toFixed(3)+' kWh',30,480);
  g.fillStyle=t.temp_c>60?'#f43f5e':'#8b98a3';g.font='600 34px '+S;g.fillText(t.temp_c.toFixed(0)+' °C',30,540);
  g.fillStyle='#5b6872';g.font='500 22px '+S;g.fillText(trip?(t.state==='TRIP_THERMAL'?'Surchauffe : coupure':'Surcharge : coupure'):'SET · page 1/3 · mesures',30,582);
  ttex.needsUpdate=true;
 }
 paint();
 function setExplode(k){Object.keys(G).forEach(function(id){var u=G[id].userData;G[id].position.copy(u.home).addScaledVector(u.dir,k)});
  var o=1-Math.min(1,k*1.6)*.75;shell.forEach(function(m){m.transparent=o<1;m.opacity=o;m.depthWrite=o>=1;m.needsUpdate=true})}
 return {group:group,parts:G,all:all,caps:caps,setExplode:setExplode,
  setTelem:function(t){T=t;paint()},
  tick:function(now){var b=Math.floor(now*2)%2===0;if(b!==blink){blink=b;paint()}
   var tr=T&&T.state.indexOf('TRIP')===0;ledMat.color.set(tr?(blink?0xf43f5e:0x3a1018):(T&&T.relay?0x34d399:0x55606a))},
  press:function(cap,d){caps.forEach(function(c){if(c.userData.cap===cap)c.position.x=c.userData.x0-d})},
  socket:new THREE.Vector3(0,-2.05,2.2),
  NAMES:{front:'Coque avant',back:'Coque arrière',plug:'Fiche mâle 16 A (2P+T)',screws:'Vis Torx ×4',pcbp:'PCB de puissance',relay:'Relais HF115F 16 A',psu:'Alimentation HLK-PM01',mov:'Varistance 14D471K',fuse:'Fusible thermique 192 °C',shunt:'Shunt manganin 1 mΩ',contacts:'Prise de sortie 2P+T',pcbu:'PCB d’interface',esp:'ESP32-C3-MINI-1',tft:'Écran TFT ST7789',led:'LED d’état + buzzer',btn:'Boutons 1 / 2 / SET / Wi-Fi',qr:'Étiquette QR P1-0042'}};
}
w.P1={build:build};
})(window);
