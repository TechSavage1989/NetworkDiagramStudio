// Tests of the faceplate-artwork port maps state that style explicitly
// without changing the project they pass (it is also the default).
export function withFaceplateMaps(build){
 return (project,...rest)=>build(project&&typeof project==='object'&&project.layout?.portMap?.mapStyle==null?{...project,layout:{...(project.layout||{}),portMap:{...(project.layout?.portMap||{}),mapStyle:'faceplate'}}}:project,...rest);
}
