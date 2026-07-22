'use strict';
const $=id=>document.getElementById(id), scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,300);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputEncoding=THREE.sRGBEncoding;document.body.appendChild(renderer.domElement);
const C={grass:0x78a956,grass2:0x4f7e3c,dirt:0xa97b4a,wood:0x85552e,dark:0x3f2a1c,red:0xb94b32,cream:0xf4e5bf,roof:0x4b5256,metal:0x737b7d,yellow:0xf2bd3d,blue:0x4c8fc7,white:0xfaf6e8};
const M=(c,r=.82,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m,flatShading:true});
const add=(g,geo,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1,shadow=true)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=shadow;o.receiveShadow=shadow;g.add(o);return o};
const box=(g,x,y,z,sx,sy,sz,c)=>add(g,new THREE.BoxGeometry(1,1,1),M(c),x,y,z,sx,sy,sz);
const cyl=(g,x,y,z,r,h,c,seg=12)=>add(g,new THREE.CylinderGeometry(r,r,h,seg),M(c),x,y,z);
const sph=(g,x,y,z,sx,sy,sz,c)=>add(g,new THREE.SphereGeometry(1,16,12),M(c),x,y,z,sx,sy,sz);
const sceneObjects=new THREE.Group();scene.add(sceneObjects);
// terrain, chemins et clôtures
box(sceneObjects,0,-.3,0,62,.6,48,C.grass);
const pathMat=M(C.dirt);box(sceneObjects,4,.02,8,6,.12,30,C.dirt);box(sceneObjects,14,.03,-5,24,.12,5,C.dirt);
for(let i=-29;i<=29;i+=3){box(sceneObjects,i,.65,-23,.18,1.3,.18,C.wood);box(sceneObjects,i,.65,23,.18,1.3,.18,C.wood)}for(let z=-23;z<=23;z+=3){box(sceneObjects,-30,.65,z,.18,1.3,.18,C.wood);box(sceneObjects,30,.65,z,.18,1.3,.18,C.wood)}box(sceneObjects,0,1.05,-23,60,.13,.13,C.wood);box(sceneObjects,0,.45,-23,60,.13,.13,C.wood);box(sceneObjects,0,1.05,23,60,.13,.13,C.wood);box(sceneObjects,0,.45,23,60,.13,.13,C.wood);
// arbres et fleurs
function tree(x,z,s=1){const g=new THREE.Group();cyl(g,0,1.2,0,.28,2.4,0x704525,9);sph(g,0,3,0,1.45,1.6,1.35,0x4f813d);sph(g,.8,2.8,.2,.9,1.1,.9,0x689d4a);g.position.set(x,0,z);g.scale.setScalar(s);sceneObjects.add(g)}
[[-25,-17,1.2],[-25,16,1.1],[-19,-19,.9],[25,18,1.25],[27,-18,1]].forEach(a=>tree(...a));
for(let i=0;i<45;i++){const g=new THREE.Group(),x=-27+Math.random()*54,z=-21+Math.random()*42;if(Math.abs(x)<18&&Math.abs(z)<15)continue;cyl(g,0,.08,0,.025,.16,0x4e8b38,5);sph(g,0,.2,0,.08,.08,.08,[0xf8d85b,0xe97c9d,0xf7f2e2][i%3],7);g.position.set(x,0,z);sceneObjects.add(g)}
