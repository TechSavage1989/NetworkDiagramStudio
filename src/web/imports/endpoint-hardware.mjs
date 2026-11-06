// Family recognition only. Physical NIC/HBA sockets require installed inventory
// or a verified stencil; none are inferred from a server or storage family.
const guidance={
 server:'NIC, HBA, mezzanine and management ports vary with the installed chassis and adapters. Use imported port records and a matching stencil, then map the actual sockets.',
 storage:'Controller, host-interface, expansion and management ports vary by model and installed modules. Use the installed inventory and a matching stencil; verify each socket before mapping it.',
 hci:'Node chassis and installed NICs vary. Keep management, VM, storage and cluster networks distinct using actual inventory; map sockets on the selected node stencil.',
 hypervisor:'This is a software platform, not a physical faceplate. Use the host chassis and installed NIC inventory for physical sockets; virtual switches, bridges and virtual NICs are separate logical interfaces.'
};
const sources={
 dellServer:'https://www.dell.com/support/kbdoc/en-us/000203855/poweredge-rack-and-tower-servers-hardware-and-software-portfolio-documentation-videos',
 dellStorage:'https://www.dell.com/en-us/shop/scc/sc/storage-products',
 vxrail:'https://www.dell.com/support/manuals/en-ai/vxrail-p-series-nodes/vxrail_architecture_guide_8/array-based-storage?guid=guid-df9ace6e-97a5-498b-889f-6b96de17f2d5&lang=en-us',
 hpeServer:'https://www.hpe.com/us/en/products/compute.html',
 synergy:'https://www.hpe.com/psnow/doc/a00043968enw',
 apollo:'https://support.hpe.com/hpesc/public/docDisplay?docId=sd00004590en_us',
 hpeStorage:'https://developer.hpe.com/platform/hpe-storage/home/',
 lenovo:'https://lenovopress.lenovo.com/lp1553-lenovo-servers-and-storage-portfolio-guide',
 cisco:'https://www.cisco.com/c/en/us/support/servers-unified-computing/category.html',
 supermicro:'https://www.supermicro.com/en/products/superblade',
 netapp:'https://docs.netapp.com/us-en/ontap-systems/',
 pure:'https://support-be.purestorage.com/bundle/AB-220301-v04-StorageArchitectureForAI/raw/resource/enus/AB-220301-v04-StorageArchitectureForAI.pdf',
 ibm:'https://www.ibm.com/products/flashsystem/resources',
 synology:'https://www.synology.com/en-us/products',
 qnap:'https://www.qnap.com/en/product/',
 truenas:'https://www.truenas.com/docs/hardware/',
 scale:'https://docs.scalecomputing.com/articles/sc-hypercore-user-guide/registration/',
 nutanix:'https://www.nutanix.com/products/nx-platforms',
 ahv:'https://www.nutanix.com/products/ahv',
 vmware:'https://knowledge.broadcom.com/external/article/343872/verifying-network-links-for-esxi-hosts.html',
 microsoft:'https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/overview',
 proxmox:'https://proxmox.com/en/products/proxmox-virtual-environment/features',
 xcp:'https://docs.xcp-ng.org/',
 xenserver:'https://docs.xenserver.com/us/en/xenserver/9/technical-overview.html',
 kvm:'https://www.linux-kvm.org/page/Main_Page'
};
const records=[
 ['dell-poweredge-r','PowerEdge R rack servers','Dell','server','Physical server',['PowerEdge R','Dell R740','Dell R750'],sources.dellServer],
 ['dell-poweredge-t','PowerEdge T tower servers','Dell','server','Physical server',['PowerEdge T','Dell T350','Dell T550'],sources.dellServer],
 ['dell-poweredge-m','PowerEdge M blade servers','Dell','server','Physical server',['PowerEdge M','Dell M630','Dell M640'],sources.dellServer],
 ['dell-poweredge-mx','PowerEdge MX modular systems','Dell','server','Physical server',['PowerEdge MX','Dell MX7000','Dell MX750c'],sources.dellServer],
 ['dell-poweredge-xe','PowerEdge XE accelerated servers','Dell','server','Physical server',['PowerEdge XE','Dell XE9680'],sources.dellServer],
 ['dell-poweredge','PowerEdge servers','Dell','server','Physical server',['PowerEdge'],sources.dellServer],
 ['hpe-proliant','ProLiant servers','HPE','server','Physical server',['ProLiant','HPE DL380','HP DL360','HPE ML350','HPE BL460c','HPE MicroServer'],sources.hpeServer],
 ['hpe-synergy','Synergy composable systems','HPE','server','Composable infrastructure',['HPE Synergy','Synergy 480','Synergy 660','Synergy 12000'],sources.synergy],
 ['hpe-apollo','Apollo systems','HPE','server','Physical server',['HPE Apollo','HP Apollo'],sources.apollo],
 ['lenovo-thinksystem','ThinkSystem servers','Lenovo','server','Physical server',['ThinkSystem server','Lenovo SR650','Lenovo ST250'],sources.lenovo],
 ['cisco-ucs','UCS servers','Cisco','server','Physical server',['UCS server','UCS C Series','UCS B Series','UCS X Series','Cisco C240','Cisco B200'],sources.cisco],
 ['supermicro-server','Supermicro servers','Supermicro','server','Physical server',['SuperServer','SuperBlade','MicroBlade','MicroCloud','Supermicro server'],sources.supermicro],
 ['dell-powerstore','PowerStore','Dell','storage','Storage array',['PowerStore'],sources.dellStorage],
 ['dell-powervault','PowerVault','Dell','storage','Storage array',['PowerVault'],sources.dellStorage],
 ['dell-unity','Unity / Unity XT','Dell EMC','storage','Unified storage',['Dell Unity','EMC Unity','Unity XT'],sources.dellStorage],
 ['dell-powerscale','PowerScale / Isilon','Dell','storage','Scale-out NAS',['PowerScale','Isilon'],sources.dellStorage],
 ['netapp-aff','AFF storage','NetApp','storage','ONTAP storage',['NetApp AFF','AFF A Series','AFF C Series'],sources.netapp],
 ['netapp-asa','ASA storage','NetApp','storage','ONTAP block storage',['NetApp ASA','ASA r2'],sources.netapp],
 ['netapp-fas','FAS storage','NetApp','storage','ONTAP storage',['NetApp FAS','FAS Series'],sources.netapp],
 ['pure-flasharray','FlashArray','Pure Storage','storage','Flash storage',['FlashArray','Flash Array'],sources.pure],
 ['pure-flashblade','FlashBlade','Pure Storage','storage','File and object storage',['FlashBlade','Flash Blade'],sources.pure],
 ['hpe-nimble','Nimble Storage','HPE','storage','Storage array',['Nimble','Nimble Storage'],sources.hpeStorage],
 ['hpe-alletra','Alletra Storage','HPE','storage','Storage systems',['Alletra'],sources.hpeStorage],
 ['hpe-msa','MSA Storage','HPE','storage','Storage array',['HPE MSA','HP MSA','MSA Storage'],sources.hpeStorage],
 ['hpe-3par','3PAR / StoreServ','HPE','storage','Storage array',['3PAR','StoreServ'],sources.hpeStorage],
 ['ibm-flashsystem','FlashSystem','IBM','storage','Storage array',['FlashSystem','Flash System'],sources.ibm],
 ['lenovo-dm','ThinkSystem DM storage','Lenovo','storage','Unified storage',['ThinkSystem DM','Lenovo DM','DM Series Storage'],sources.lenovo],
 ['lenovo-de','ThinkSystem DE storage','Lenovo','storage','Storage array',['ThinkSystem DE','Lenovo DE','DE Series Storage'],sources.lenovo],
 ['synology-storage','Synology NAS / SAN','Synology','storage','NAS / SAN',['Synology NAS','DiskStation','RackStation','Synology SA','Synology FS','Synology UC'],sources.synology],
 ['qnap-storage','QNAP NAS','QNAP','storage','NAS',['QNAP NAS','QuTS hero','QNAP QTS'],sources.qnap],
 ['truenas-storage','TrueNAS storage','iXsystems','storage','TrueNAS',['TrueNAS','FreeNAS'],sources.truenas],
 ['dell-vxrail','VxRail','Dell','hci','VxRail',['VxRail'],sources.vxrail],
 ['lenovo-thinkagile','ThinkAgile HCI','Lenovo','hci','ThinkAgile',['ThinkAgile'],sources.lenovo],
 ['scale-hypercore','Scale Computing HyperCore','Scale Computing','hci','SC//HyperCore',['Scale Computing HyperCore','SC HyperCore','HyperCore','Scale Computing HC3','HC3'],sources.scale],
 ['nutanix-hci','Nutanix HCI / NX','Nutanix','hci','Nutanix HCI',['Nutanix NX','Nutanix HCI','Nutanix AOS','Nutanix Cloud Platform'],sources.nutanix],
 ['vmware-esxi','VMware ESXi / vSphere','VMware','hypervisor','VMware ESXi / vSphere',['ESXi','VMware ESX','VMware vSphere','vSphere host'],sources.vmware],
 ['microsoft-hyperv','Microsoft Hyper-V','Microsoft','hypervisor','Microsoft Hyper-V',['Hyper V','HyperV'],sources.microsoft],
 ['microsoft-windows-server','Microsoft Windows Server','Microsoft','server','Microsoft Windows Server',['Windows Server'],sources.microsoft],
 ['proxmox-ve','Proxmox VE','Proxmox','hypervisor','Proxmox VE',['Proxmox VE','Proxmox Virtual Environment','Proxmox'],sources.proxmox],
 ['nutanix-ahv','Nutanix AHV','Nutanix','hypervisor','Nutanix AHV',['Nutanix AHV','AHV'],sources.ahv],
 ['xcp-ng','XCP-ng','Vates','hypervisor','XCP-ng',['XCP ng','XCPng'],sources.xcp],
 ['xenserver','XenServer','XenServer','hypervisor','XenServer',['XenServer','Citrix Hypervisor'],sources.xenserver],
 ['linux-kvm','Linux KVM','Linux KVM','hypervisor','KVM',['Linux KVM','Kernel based Virtual Machine','KVM hypervisor'],sources.kvm]
];
export const endpointHardwareCatalog=Object.freeze(records.map(([id,family,vendor,kind,technology,aliases,officialSource])=>Object.freeze({id,family,vendor,kind,technology,aliases:Object.freeze(aliases),officialSource,moduleGuidance:guidance[kind]||guidance.server,portLayout:'inventory'})));
const text=value=>typeof value==='string'?value.slice(0,4096).toLowerCase().replace(/[^a-z0-9+]/g,' ').replace(/ +/g,' ').trim():'';
const patterns={
 'dell-poweredge-r':/\b(?:poweredge\s+r\d{3,4}[a-z0-9]*|dell(?: emc)?\s+r\d{3,4}[a-z0-9]*)\b|^r\d{3,4}[a-z0-9]*$/,
 'dell-poweredge-t':/\b(?:poweredge\s+t\d{3,4}[a-z0-9]*|dell(?: emc)?\s+t\d{3,4}[a-z0-9]*)\b|^t\d{3,4}[a-z0-9]*$/,
 'dell-poweredge-m':/\b(?:poweredge\s+m\d{3,4}[a-z0-9]*|dell(?: emc)?\s+m\d{3,4}[a-z0-9]*)\b|^m\d{3,4}[a-z0-9]*$/,
 'dell-poweredge-mx':/\b(?:poweredge\s+mx\d{3,4}[a-z0-9]*|dell(?: emc)?\s+mx\d{3,4}[a-z0-9]*)\b|^mx\d{3,4}[a-z0-9]*$/,
 'dell-poweredge-xe':/\b(?:poweredge\s+xe\d{3,4}[a-z0-9]*|dell(?: emc)?\s+xe\d{3,4}[a-z0-9]*)\b|^xe\d{3,4}[a-z0-9]*$/,
 'hpe-proliant':/\b(?:hpe?|hewlett packard(?: enterprise)?)\s+(?:(?:dl|ml|bl|xl)\d{2,4}[a-z0-9]*|microserver)\b|^(?:dl|ml|bl)\d{2,4}[a-z0-9]*(?: gen\s*\d+)?$/,
 'hpe-synergy':/\b(?:hpe? )?synergy\s+(?:\d{3,5}|compute|frame)\b/,
 'lenovo-thinksystem':/\b(?:thinksystem|lenovo)\s+(?:sr|st|sd|se|sn|sc|hr)\d{2,4}[a-z0-9]*\b|^(?:sr|st|sd|se|sn|sc)\d{3}[a-z0-9]*(?: v\d)?$/,
 'cisco-ucs':/\bucs[bcxs]\s+[bcxs]\d{3,4}\b|\bucs\s*(?:(?:c|b|x|s)\d{3,4}[a-z0-9]*|[bcxs] series|[bcxs] server)\b|\bcisco\s+[bc]\d{3}[a-z0-9]*\b/,
 'supermicro-server':/\b(?:sys|as|sbi|sbe)\s+\d{3,5}[a-z0-9]*\b/,
 'dell-powervault':/^(?:dell(?: emc)?\s+)?(?:me|md)\d{3,4}[a-z0-9]*$/,
 'dell-unity':/\bunity\s+\d{3,4}[a-z]?\b/,
 'netapp-aff':/\baff\s*[ac]\s*\d{2,4}[a-z0-9]*\b|^aff\d{3,4}[a-z0-9]*$/,
 'netapp-asa':/\basa\s+[ac]\s*\d{2,4}[a-z0-9]*\b/,
 'netapp-fas':/\bfas\s*\d{3,4}[a-z0-9]*\b/,
 'hpe-nimble':/^(?:(?:hpe? )?nimble(?: storage)? )?(?:cs|af|hf)\d{2,4}[a-z0-9]*$/,
 'hpe-msa':/\bmsa\s*\d{3,4}[a-z0-9]*\b/,
 'lenovo-dm':/\bdm\s*\d{3,4}[fh]?\b/,
 'lenovo-de':/\bde\s*\d{3,4}[fh]?\b/,
 'synology-storage':/^(?:synology\s+)?(?:ds|rs|sa|fs|uc|hd|pas)\d{3,5}[a-z0-9+ ]*$/,
 'qnap-storage':/^(?:qnap\s+)?(?:ts|tvs|tes|tbs|es|hs)\s+(?:h?\d{3,6})[a-z0-9+ ]*$/,
 'nutanix-hci':/\bnutanix\s+nx\s*\d{3,5}[a-z0-9]*\b|^nx\s+\d{3,5}[a-z0-9 ]*$/,
 'scale-hypercore':/\bsc\s+hypercore\b|\bscale computing\s+(?:hc|he|hc3)\s*\d*[a-z0-9]*\b/,
 'vmware-esxi':/\bvmware\s+esx(?:i)?\b/,
 'linux-kvm':/^kvm(?:\s+\d+(?: \d+)*)?$/
};
const matchers=endpointHardwareCatalog.map(entry=>({entry,aliases:[entry.family,...entry.aliases].map(a=>' '+text(a)+' '),pattern:patterns[entry.id]}));
export function matchEndpointHardware(value,description=''){
 for(const input of [value,description]){
  const label=text(input);if(!label)continue;
  for(const {entry,aliases,pattern} of matchers){
   if(entry.id==='linux-kvm'&&/\bkvm\s+(?:switch|console|extender|over|ip)\b/.test(label))continue;
   if(pattern?.test(label)||aliases.some(alias=>(' '+label+' ').includes(alias)))return entry;
  }
 }
 return null;
}
