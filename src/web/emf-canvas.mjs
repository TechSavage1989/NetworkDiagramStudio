// Bounded Canvas playback for standard GDI records used in equipment faceplates.
// Coordinates stay in the metafile's original mapping space until paint time.
const utf16=new TextDecoder('utf-16le');
function paintColor(v){return 'rgb('+[v&255,(v>>>8)&255,(v>>>16)&255].join(',')+')';}
function fail(){throw Error('This EMF needs extended rendering support.');}
function dib(rec,off,infoSize,dataOffset,dataSize){
  if(off<8||infoSize<40||off+infoSize>rec.byteLength||dataOffset<8||dataOffset+dataSize>rec.byteLength)fail();
  const size=rec.getUint32(off,true),width=rec.getInt32(off+4,true),sy=rec.getInt32(off+8,true),height=Math.abs(sy),bpp=rec.getUint16(off+14,true);
  if(size<40||size>infoSize||width<1||!height||width*height>8e6||rec.getUint32(off+16,true)!==0||![1,4,8,24,32].includes(bpp))fail();
  const palette=bpp<=8?(rec.getUint32(off+32,true)||2**bpp):0;
  if(size+4*palette>infoSize)fail();
  const stride=Math.ceil(width*bpp/32)*4;if(stride*height>dataSize)fail();
  const raw=new Uint8Array(rec.buffer,rec.byteOffset,rec.byteLength),canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d'),im=ctx.createImageData(width,height);
  for(let y=0;y<height;y++){
    const line=dataOffset+(sy<0?y:height-1-y)*stride;
    for(let x=0;x<width;x++){
      let k;
      if(palette){
        const v=raw[line+Math.floor(x*bpp/8)],index=bpp===8?v:bpp===4?(v>>>(x%2?0:4))&15:(v>>>(7-x%8))&1;
        if(index>=palette)fail();k=off+size+index*4;
      }else k=line+x*bpp/8;
      const j=(y*width+x)*4;im.data[j]=raw[k+2];im.data[j+1]=raw[k+1];im.data[j+2]=raw[k];im.data[j+3]=255;
    }
  }
  ctx.putImageData(im,0,0);return canvas;
}
export function drawEmf(bytes){
  if(bytes.length<88||bytes.length>12*1024*1024)fail();
  const head=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),hi=i=>head.getInt32(i,true);
  if(hi(0)!==1||hi(40)!==0x464D4520)fail();
  // The physical frame is the intended image rectangle; GDI bounds may include
  // transparent padding or a stroke which protrudes past this image rectangle.
  const scaleX=hi(72)/(100*hi(80)),scaleY=hi(76)/(100*hi(84));
  const fw=(hi(32)-hi(24))*scaleX,fh=(hi(36)-hi(28))*scaleY;
  if(!Number.isFinite(fw+fh)||fw<=0||fh<=0)fail();
  const canvas=document.createElement('canvas'),scale=2400/Math.max(fw,fh);
  canvas.width=Math.max(1,Math.round(fw*scale));canvas.height=Math.max(1,Math.round(fh*scale));
  const ctx=canvas.getContext('2d'),frame=new DOMMatrix().scale(canvas.width/fw,canvas.height/fh).translate(-hi(24)*scaleX,-hi(28)*scaleY);
  const objects=new Map(),saved=[];let state={world:new DOMMatrix(),wx:0,wy:0,ww:1,wh:1,vx:0,vy:0,vw:1,vh:1,pen:{kind:'pen',color:'#000',w:1},brush:{kind:'brush',color:'#fff'},font:{height:12,angle:0,face:'Arial',weight:400},text:'#000',align:0,fill:'evenodd',pos:[0,0]};
  let active=false,path=new Path2D(),paints=0,nRecords=0;
  function transform(){
    if(!state.ww||!state.wh)fail();
    const m=frame.translate(state.vx,state.vy).scale(state.vw/state.ww,state.vh/state.wh).translate(-state.wx,-state.wy).multiply(state.world);
    if([m.a,m.b,m.c,m.d,m.e,m.f].some(v=>!Number.isFinite(v)||Math.abs(v)>1e9))fail();
    ctx.setTransform(m);return m;
  }
  function paint(p,fill,stroke){
    transform();
    if(fill&&state.brush.color){ctx.fillStyle=state.brush.color;ctx.fill(p,state.fill);paints++;}
    if(stroke&&state.pen.color){ctx.strokeStyle=state.pen.color;const m=ctx.getTransform();ctx.lineWidth=state.pen.w>0?state.pen.w:1/Math.max(.001,Math.hypot(m.a,m.b));ctx.lineJoin='round';ctx.stroke(p);paints++;}
  }
  function select(handle){
    let item=objects.get(handle);
    if(handle>=0x80000000){
      const stock=handle-0x80000000;
      if(stock<=5)item={kind:'brush',color:['#fff','#bfbfbf','#808080','#404040','#000',null][stock]};
      else if(stock<=8)item={kind:'pen',color:['#fff','#000',null][stock-6],w:0};
      else if(stock>=10&&stock<=17)item={kind:'font',height:12,weight:400,angle:0,face:'Arial'};
    }
    if(item)state[item.kind]=item;
  }
  const mapped=(m,x,y)=>m?[m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f]:[x,y];
  let foundEnd=false;
  for(let off=0;off+8<=bytes.length;){
    const type=head.getUint32(off,true),len=head.getUint32(off+4,true);
    if(len<8||len%4!==0||off+len>bytes.length||++nRecords>120000)fail();
    const r=new DataView(bytes.buffer,bytes.byteOffset+off,len);off+=len;
    const i=n=>r.getInt32(n,true),u=n=>r.getUint32(n,true),f=n=>r.getFloat32(n,true),w=n=>r.getUint16(n,true);
    const mat=()=>new DOMMatrix([8,12,16,20,24,28].map(f));
    const str=(at,n)=>{if(at<0||n<0||at+n*2>len)fail();return utf16.decode(new Uint8Array(r.buffer,r.byteOffset+at,n*2)).split('\0')[0];};
    if(type===14){foundEnd=true;break;}
    if(type===33){if(saved.length>=128)fail();saved.push({...state});ctx.save();continue;}
    if(type===34){const level=i(8)<0?saved.length+i(8):i(8)-1;if(level<0||level>=saved.length)fail();while(saved.length>level){ctx.restore();state=saved.pop();}continue;}
    if(type===35||type===36){if(type===35)state.world=mat();else{const mode=u(32);state.world=mode===1?new DOMMatrix():mode===2?mat().multiply(state.world):mode===3?state.world.multiply(mat()):mat();}continue;}
    if(type===9||type===10||type===11||type===12){
      const [x,y]=type===9?['ww','wh']:type===10?['wx','wy']:type===11?['vw','vh']:['vx','vy'];state[x]=i(8);state[y]=i(12);continue;
    }
    if(type===17){if(![1,7,8].includes(i(8)))fail();continue;}
    if(type===32||type===31){const [x,y]=type===32?['ww','wh']:['vw','vh'];if(!i(12)||!i(20))fail();state[x]*=i(8)/i(12);state[y]*=i(16)/i(20);continue;}
    if(type===37){select(u(8));continue;}
    if(type===40){objects.delete(u(8));continue;}
    if(type===38||type===95){const pos=type===38?12:28,style=u(pos)&15;objects.set(u(8),{kind:'pen',w:Math.abs(i(pos+4)),color:style===5?null:paintColor(u(type===38?24:40))});continue;}
    if(type===39){objects.set(u(8),{kind:'brush',color:u(12)===1?null:paintColor(u(16))});continue;}
    if(type===82){objects.set(u(8),{kind:'font',height:Math.abs(i(12))||12,angle:i(20)*Math.PI/1800,face:str(40,32)||'Arial',weight:Math.max(100,Math.min(900,i(28)||400))});continue;}
    if(type===24){state.text=paintColor(u(8));continue;}
    if(type===22){state.align=u(8);continue;}
    if(type===19){state.fill=u(8)===2?'nonzero':'evenodd';continue;}
    if(type===59){path=new Path2D();active=true;continue;}
    if(type===60){active=false;continue;}
    if(type===61){path.closePath();continue;}
    if(type===62||type===63||type===64){const local=new Path2D();local.addPath(path,transform().inverse());paint(local,type!==64,type!==62);path=new Path2D();continue;}
    if(type===67){if(i(8)!==1)fail();ctx.resetTransform();ctx.clip(path,state.fill);path=new Path2D();continue;}
    if(type===30){transform();ctx.beginPath();ctx.rect(i(8),i(12),i(16)-i(8),i(20)-i(12));ctx.clip();continue;}
    if(type===27||type===54){const x=i(8),y=i(12);if(active){const pt=mapped(transform(),x,y);if(type===27)path.moveTo(...pt);else path.lineTo(...pt);}else if(type===54){const p=new Path2D();p.moveTo(...state.pos);p.lineTo(x,y);paint(p,false,true);}state.pos=[x,y];continue;}
    if(type===42||type===43){const x=i(8),y=i(12),ww=i(16)-x,hh=i(20)-y,p=new Path2D();if(type===42)p.ellipse(x+ww/2,y+hh/2,Math.abs(ww/2),Math.abs(hh/2),0,0,Math.PI*2);else p.rect(x,y,ww,hh);if(active)path.addPath(p,transform());else paint(p,true,true);continue;}
    if((type>=2&&type<=8)||(type>=85&&type<=91)){
      const k=type>=85?type-83:type,sz=type>=85?4:8,poly=k===7||k===8,bezier=k===2||k===5,chain=k===5||k===6,closed=k===3||k===8;
      const cnt=u(24);if(cnt>200000)fail();const n=poly?u(28):cnt;let at=poly?32+cnt*4:28;if(n>200000||at+n*sz>len)fail();
      const matrix=active?transform():null;let rawPoint=state.pos;
      const pt=()=>{const v=sz===4?[r.getInt16(at,true),r.getInt16(at+2,true)]:[i(at),i(at+4)];at+=sz;rawPoint=v;return mapped(matrix,...v);};
      const p=active?path:new Path2D();
      for(let block=0;block<(poly?cnt:1);block++){
        let available=poly?u(32+block*4):n;if(available>n)fail();if(!available)continue;
        if(!chain){const a=pt();p.moveTo(...a);available--;}else if(!active)p.moveTo(...state.pos);
        if(bezier){if(available%3)fail();for(let j=0;j<available;j+=3){const a=pt(),b=pt(),c=pt();p.bezierCurveTo(...a,...b,...c);if(chain)state.pos=rawPoint;}}
        else for(let j=0;j<available;j++){const a=pt();p.lineTo(...a);if(chain)state.pos=rawPoint;}
        if(closed)p.closePath();
      }
      if(!active)paint(p,closed,true);continue;
    }
    if(type===84){
      const n=u(44),s=str(u(48),n);if(!s)continue;
      transform();ctx.save();ctx.translate(i(36),i(40));ctx.rotate(-state.font.angle);
      ctx.font=state.font.weight+' '+state.font.height+'px '+JSON.stringify(state.font.face);ctx.fillStyle=state.text;
      ctx.textBaseline=(state.align&24)===24?'alphabetic':state.align&8?'bottom':'top';ctx.textAlign=state.align&6?(state.align&6)===6?'center':'right':'left';
      ctx.fillText(s,0,0);ctx.restore();paints++;continue;
    }
    if(type===81){
      const img=dib(r,u(48),u(52),u(56),u(60));transform();ctx.save();
      const rop=u(68);ctx.globalCompositeOperation=rop===0x8800C6?'multiply':rop===0xEE0086?'screen':'source-over';
      if(![0xCC0020,0x8800C6,0xEE0086].includes(rop))fail();
      ctx.drawImage(img,i(32),i(36),i(40),i(44),i(24),i(28),i(72),i(76));ctx.restore();paints++;continue;
    }
    if(type===76&&u(40)===0x00AA0029)continue; // DSTCOPY leaves destination intact.
    if(type===75&&u(8)===0)continue;
    if([1,18,20,21,25,48,49,50,51,52,57,58,70,98,115].includes(type))continue;
    fail();
  }
  if(!foundEnd||!paints)fail();
  return canvas;
}
