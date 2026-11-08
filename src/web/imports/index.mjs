import {empty, mergeModels} from './model.mjs';
import {parseConfig} from './config.mjs';
import {parseTable,readCSV,workbookTables} from './tables.mjs';
import {isOperational,parseOperational} from './operational.mjs';
import {routerosBackupMagic,decodeRouterosBackup,routerosSnapshotModel} from './routeros-backup.mjs';

export {deviceId,mergeModels} from './model.mjs';
export {findDeviceIdentity} from './identity.mjs';
export {identify,hardwareCatalog} from './hardware.mjs';
export {parseConfig} from './config.mjs';
export {parseTable,readCSV,workbookTables} from './tables.mjs';
export {isOperational,parseOperational} from './operational.mjs';

export async function importFiles(files){
  const configs=[],reports=[],errors=empty();
  for(const file of Array.from(files||[])){
    const name=file.name||'input.txt';
    try {
      if(Number(file.size)>48*1024*1024)throw new Error('File exceeds the 48 MiB limit.');
      if(/\.xlsx$/i.test(name)){
        const tables=await workbookTables(file);
        if(!tables.length)errors.warnings.push(name+': no Devices, Interfaces or Routes worksheets found.');
        for(const table of tables)reports.push(parseTable(table.rows,name+' / '+table.name));
      }else if(/\.csv$/i.test(name))reports.push(parseTable(readCSV(await file.text()),name));
      else if(/\.(txt|cfg|conf|config|log|rsc|cli|xml|exp|backup)$/i.test(name)||!name.includes('.')){
        if(/\.backup$/i.test(name)&&file.arrayBuffer){const bytes=new Uint8Array(await file.arrayBuffer()),magic=routerosBackupMagic(bytes);if([0xb1a1ac88,0x7291a8ef,0x7391a8ef].includes(magic)){configs.push(routerosSnapshotModel(decodeRouterosBackup(bytes),name));continue;}}
        const text=await file.text();configs.push(isOperational(text)?parseOperational(text,name):parseConfig(text,name));
      }
      else errors.warnings.push(name+': unsupported format. Use a text configuration, Auvik XLSX or CSV.');
    }catch(error){errors.warnings.push(name+': '+error.message+' Use a supported clear-text export or Auvik CSV, or add the device manually.');}
  }
  return mergeModels([...configs,...reports,errors]);
}
