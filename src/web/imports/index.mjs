import {empty, mergeModels} from './model.mjs';
import {parseConfig} from './config.mjs';
import {parseTable,readCSV,workbookTables} from './tables.mjs';
import {isOperational,parseOperational} from './operational.mjs';

export {deviceId,mergeModels} from './model.mjs';
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
      else if(/\.(txt|cfg|conf|config|log|rsc|cli|xml|exp)$/i.test(name)||!name.includes('.')){
        const text=await file.text();configs.push(isOperational(text)?parseOperational(text,name):parseConfig(text,name));
      }
      else errors.warnings.push(name+': unsupported format. Use a text configuration, Auvik XLSX or CSV.');
    }catch(error){errors.warnings.push(name+': '+error.message+' Use a supported clear-text export or Auvik CSV, or add the device manually.');}
  }
  return mergeModels([...configs,...reports,errors]);
}
