// Generic editable symbols describe a device role, never a physical port layout.
// Verified hardware and user-assigned stencils take precedence over these shapes.
const palette={body:'#E8EFF2',paper:'#FFFFFF',ink:'#536B78',dark:'#16364A',teal:'#2F7D89',pale:'#C5D8DE'};
const builders={
 router(a){
  rect(a,'Router enclosure',.02,.14,.96,.72,palette.body);
  rect(a,'Router top accent',.04,.17,.92,.08,palette.teal,'none');
  rect(a,'Routing horizontal symbol',.28,.45,.44,.10,palette.dark,'none');
  rect(a,'Routing left vertical symbol',.28,.33,.05,.34,palette.dark,'none');
  rect(a,'Routing right vertical symbol',.67,.33,.05,.34,palette.dark,'none');
 },
 server(a){
  rect(a,'Server chassis',.02,.08,.96,.84,palette.body);
  rect(a,'Server left accent',.045,.13,.025,.74,palette.teal,'none');
  for(let i=0;i<3;i++)rect(a,'Server drive bay '+(i+1),.11+i*.235,.27,.20,.46,palette.pale);
  rect(a,'Server status indicator',.88,.35,.035,.12,palette.teal,'none');
  rect(a,'Server power indicator',.88,.57,.035,.12,palette.dark,'none');
 },
 hypervisor(a){
  rect(a,'Hypervisor host enclosure',.03,.08,.94,.84,palette.body);
  rect(a,'Hypervisor platform band',.11,.69,.78,.12,palette.dark,'none');
  for(let i=0;i<3;i++){
   rect(a,'Hypervisor virtual workload '+(i+1),.12+i*.27,.23,.22,.33,palette.pale);
   rect(a,'Hypervisor workload accent '+(i+1),.15+i*.27,.29,.16,.06,palette.teal,'none');
  }
 },
 'virtual-machine'(a){
  rect(a,'Virtual machine rear frame',.18,.08,.73,.74,palette.pale);
  rect(a,'Virtual machine foreground frame',.07,.21,.73,.74,palette.body);
  rect(a,'Virtual machine screen',.16,.33,.54,.37,palette.dark);
  rect(a,'Virtual machine screen accent',.24,.43,.38,.06,palette.teal,'none');
  rect(a,'Virtual machine lower detail',.27,.79,.32,.05,palette.ink,'none');
 },
 hci(a){
  rect(a,'HCI cluster enclosure',.02,.08,.96,.84,palette.body);
  rect(a,'HCI shared platform band',.10,.74,.80,.08,palette.dark,'none');
  for(let i=0;i<3;i++){
   rect(a,'HCI node '+(i+1),.11+i*.28,.22,.23,.42,palette.pale);
   rect(a,'HCI node status detail '+(i+1),.15+i*.28,.31,.15,.06,palette.teal,'none');
   rect(a,'HCI node lower detail '+(i+1),.15+i*.28,.48,.15,.05,palette.ink,'none');
  }
 },
 phone(a){
  rect(a,'Phone base',.08,.05,.84,.90,palette.body);
  rect(a,'Phone receiver upper',.13,.13,.16,.21,palette.dark,'none');
  rect(a,'Phone receiver grip',.17,.28,.08,.40,palette.dark,'none');
  rect(a,'Phone receiver lower',.13,.64,.16,.21,palette.dark,'none');
  rect(a,'Phone display',.38,.15,.42,.21,palette.pale);
  for(let row=0;row<3;row++)for(let col=0;col<3;col++)rect(a,'Phone key '+(row*3+col+1),.40+col*.14,.47+row*.13,.09,.075,palette.ink,'none');
 },
 workstation(a){
  rect(a,'Computer display enclosure',.08,.04,.84,.64,palette.dark);
  rect(a,'Computer screen',.13,.09,.74,.52,palette.pale,'none');
  rect(a,'Computer display stand',.46,.68,.08,.15,palette.ink,'none');
  rect(a,'Computer stand base',.30,.81,.40,.05,palette.ink,'none');
  rect(a,'Computer keyboard',.12,.91,.76,.06,palette.body);
 },
 printer(a){
  rect(a,'Printer paper',.24,.04,.52,.35,palette.paper);
  rect(a,'Printer enclosure',.08,.30,.84,.55,palette.body);
  rect(a,'Printer output slot',.23,.54,.54,.09,palette.dark,'none');
  rect(a,'Printer output sheet',.27,.63,.46,.31,palette.paper);
  rect(a,'Printer status indicator',.78,.41,.045,.07,palette.teal,'none');
 },
 storage(a){
  rect(a,'Storage enclosure',.10,.04,.80,.92,palette.body);
  for(let row=0;row<3;row++){
   rect(a,'Storage drawer '+(row+1),.18,.15+row*.25,.64,.19,palette.pale);
   rect(a,'Storage drawer handle '+(row+1),.29,.22+row*.25,.31,.045,palette.ink,'none');
   rect(a,'Storage status indicator '+(row+1),.74,.22+row*.25,.025,.045,palette.teal,'none');
  }
 },
 camera(a){
  rect(a,'Camera body',.06,.15,.65,.53,palette.body);
  rect(a,'Camera lens housing',.71,.23,.21,.37,palette.ink);
  rect(a,'Camera lens',.77,.28,.10,.27,palette.dark,'none');
  rect(a,'Camera support',.31,.68,.07,.20,palette.ink,'none');
  rect(a,'Camera mounting base',.20,.86,.30,.07,palette.ink,'none');
 },
 controller(a){
  rect(a,'Controller enclosure',.03,.10,.94,.80,palette.body);
  rect(a,'Controller display',.12,.23,.45,.49,palette.dark);
  rect(a,'Controller display detail',.17,.32,.35,.08,palette.teal,'none');
  rect(a,'Controller display detail lower',.17,.48,.27,.05,palette.pale,'none');
  for(let row=0;row<3;row++)rect(a,'Controller status indicator '+(row+1),.73,.26+row*.17,.08,.07,row===0?palette.teal:palette.ink,'none');
 },
 ups(a){
  rect(a,'UPS enclosure',.18,.04,.64,.92,palette.body);
  rect(a,'UPS display',.31,.16,.38,.19,palette.dark);
  rect(a,'UPS battery body',.36,.49,.28,.29,palette.pale);
  rect(a,'UPS battery terminal',.45,.44,.10,.05,palette.ink,'none');
  rect(a,'UPS battery charge',.41,.55,.18,.17,palette.teal,'none');
  rect(a,'UPS lower accent',.26,.87,.48,.025,palette.ink,'none');
 },
 'patch-panel'(a){
  rect(a,'Patch panel schematic enclosure',.02,.15,.96,.70,palette.body);
  rect(a,'Patch panel label strip',.10,.28,.80,.18,palette.paper);
  rect(a,'Patch panel schematic connection band',.10,.55,.80,.13,palette.ink,'none');
  rect(a,'Patch panel left mounting strip',.035,.23,.025,.54,palette.teal,'none');
  rect(a,'Patch panel right mounting strip',.94,.23,.025,.54,palette.teal,'none');
 },
 iot(a){
  rect(a,'IoT chip enclosure',.22,.22,.56,.56,palette.body);
  rect(a,'IoT chip core',.36,.36,.28,.28,palette.teal,'none');
  for(let i=0;i<3;i++)for(const side of ['top','bottom','left','right']){
   const p=.30+i*.17;
   rect(a,'IoT schematic '+side+' pin '+(i+1),side==='left'?.07:side==='right'?.78:p,side==='top'?.07:side==='bottom'?.78:p,side==='left'||side==='right'?.15:.05,side==='top'||side==='bottom'?.15:.05,palette.ink,'none');
  }
 },
 cloud(a){
  rect(a,'Cloud lower silhouette',.04,.41,.92,.43,palette.body,'none');
  rect(a,'Cloud left rise',.13,.28,.29,.31,palette.body,'none');
  rect(a,'Cloud upper rise',.31,.12,.38,.49,palette.body,'none');
  rect(a,'Cloud right rise',.64,.31,.22,.30,palette.body,'none');
  rect(a,'Cloud service accent',.22,.61,.56,.07,palette.teal,'none');
 },
 other(a){
  rect(a,'Generic device enclosure',.08,.08,.84,.84,palette.body);
  rect(a,'Generic device upper accent',.16,.19,.68,.09,palette.teal,'none');
  rect(a,'Generic device center',.31,.40,.38,.32,palette.pale);
 }
};
const ratios={router:4,server:4.8,hypervisor:3.8,'virtual-machine':1.5,hci:3.8,phone:1.3,workstation:1.4,printer:1.6,storage:1.15,camera:2,controller:2.7,ups:.85,'patch-panel':5.8,iot:1,cloud:2,other:1.5};
function rect(children,name,x,y,w,h,fill,stroke=palette.ink,weight=.8){children.push({type:'rect',name,x,y,w,h,fill,stroke,weight});}
export function genericDeviceSymbol(kind){
 const build=Object.hasOwn(builders,kind)?builders[kind]:null;if(!build)return null;
 const children=[];build(children);return {ratio:ratios[kind],children,generic:true};
}
