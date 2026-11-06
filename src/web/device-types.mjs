// Inventory roles describe a device, not its installed connectors or capacity.
// Physical sockets still require a documented model or a user-mapped stencil.
export const deviceKindOptions=Object.freeze([
 ['switch','Switch'],['firewall','Firewall'],['ap','Wireless access point'],
 ['router','Router'],['server','Server'],['hypervisor','Hypervisor host'],
 ['virtual-machine','Virtual machine'],['hci','Hyperconverged node'],
 ['storage','Storage (NAS / SAN)'],['phone','Phone'],
 ['workstation','Computer / workstation'],['printer','Printer'],
 ['camera','Camera'],['controller','Network controller'],['ups','UPS'],
 ['patch-panel','Patch panel'],['iot','IoT device'],['cloud','Cloud / service'],
 ['other','Other device'],['handoff','Site handoff'],['unknown','Unknown']
].map(option=>Object.freeze(option)));
export const deviceKinds=Object.freeze(deviceKindOptions.map(([value])=>value));
const labels=new Map(deviceKindOptions);
export const deviceKindLabel=kind=>labels.get(kind)||labels.get('unknown');

// Auvik's declared Type field is useful for endpoint inventory as well as
// infrastructure. Deliberately do not classify arbitrary host/model names here.
export function classifyDeviceKind(value){
 const type=String(value??'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
 if(!type)return 'unknown';
 if(/\b(?:wireless|wlan|network) controller\b|\b(?:wlc|controller)\b/.test(type))return 'controller';
 if(/\baccess ?point\b|\bwireless ap\b|^ap$/.test(type))return 'ap';
 if(/\bfirewall\b/.test(type))return 'firewall';
 if(/\bswitch(?:es)?\b/.test(type))return 'switch';
 if(/\brouter\b|\brouting appliance\b/.test(type))return 'router';
 if(/\bhyperconverged(?: infrastructure| node| system)?\b|\bhyper converged(?: infrastructure| node| system)?\b|^hci(?: node| system)?$/.test(type))return 'hci';
 if(/\bvirtual machine\b|^vm$|\bvirtual guest\b/.test(type))return 'virtual-machine';
 if(/\bhypervisor(?: host)?\b|\bvirtuali[sz]ation host\b/.test(type))return 'hypervisor';
 if(/\bstorage\b|\bnas\b|\bsan\b/.test(type))return 'storage';
 if(/\bserver\b|\bcompute node\b/.test(type))return 'server';
 if(/\b(?:ip |voip )?phone\b|\btelephone\b|\bsmartphone\b/.test(type))return 'phone';
 if(/\bworkstation\b|\bdesktop\b|\blaptop\b|\bcomputer\b|^pc$/.test(type))return 'workstation';
 if(/\bprinter\b|\bmultifunction(?: device| printer)?\b/.test(type))return 'printer';
 if(/\b(?:ip )?camera\b|\bwebcam\b|\bcctv\b/.test(type))return 'camera';
 if(/\bups\b|\buninterruptible power supply\b|\bbattery backup\b/.test(type))return 'ups';
 if(/\bpatch ?panel\b/.test(type))return 'patch-panel';
 if(/\biot\b|\binternet of things\b|\bsensor\b|\bbuilding automation\b/.test(type))return 'iot';
 if(/\bcloud\b|\bcloud service\b/.test(type))return 'cloud';
 if(/\bhandoff\b/.test(type))return 'handoff';
 if(type==='other'||type==='other device')return 'other';
 return 'unknown';
}
