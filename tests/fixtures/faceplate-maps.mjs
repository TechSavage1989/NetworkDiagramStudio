// Tests of the faceplate-artwork port maps opt into that map style without
// changing the project they pass. The default port map is the switchport
// builder sheet (see portmap-sheets).
export function withFaceplateMaps(build){
 return (project,...rest)=>build(project&&typeof project==='object'&&project.layout?.portMap?.mapStyle==null?{...project,layout:{...(project.layout||{}),portMap:{...(project.layout?.portMap||{}),mapStyle:'faceplate'}}}:project,...rest);
}
