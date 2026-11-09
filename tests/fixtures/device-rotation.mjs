import {buildPages} from '../../src/web/diagram/index.mjs';
export function rotationProject(){
 const project={name:'Fictional rotation lab',stencils:{box:{id:'box',name:'Fictional lab panel',width:240,height:80,dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5F8AAAAASUVORK5CYII=',native:{paths:[{commands:[['M',0,0],['L',1,0],['L',1,1],['L',0,1],['Z']],fill:'#ccddee',stroke:'#123456',weight:.003}],texts:[{x:.5,y:.35,w:.7,size:.06,angle:0,text:'LAB PANEL',color:'#123456'}]},anchors:{p1:[.25,.5]}}},devices:['a','b'].map(id=>({id,name:'LAB-'+id,kind:'switch',stencilId:'box',ports:[{name:'p1'}]})),links:[{a:'a',ap:'p1',b:'b',bp:'p1',media:'copper'}]};
 const page=buildPages(project)[0];project.layout={drawingEdits:Object.fromEntries(page.items.filter(i=>i.type==='device'&&['a','b'].includes(i.sourceId)).map((i,n)=>[i.editKey,{x:500,y:300+n*650,w:240,h:80}]))};return project;
}
