"""Build the two public portable assets and verify the tag, PE header and hashes."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct
import subprocess
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def prepare(executable, output):
    intent = json.loads((ROOT / 'docs/releases/intent.json').read_text(encoding='utf-8'))
    version = ET.parse(ROOT / 'desktop/NetworkDiagramStudio.csproj').findtext('.//Version')
    if not re.fullmatch(r'\d+\.\d+\.\d+-preview\.\d+', version or '') or intent['version'] != version or intent['tag'] != 'v' + version or intent['prerelease'] is not True:
        raise ValueError('Release intent and Windows application version must match.')
    body = executable.read_bytes()
    pe = struct.unpack_from('<I', body, 60)[0]
    if body[:2] != b'MZ' or body[pe:pe+6] != b'PE\0\0\x64\x86':
        raise ValueError('Expected a Windows x64 PE asset.')
    output.mkdir(parents=True, exist_ok=True)
    html = output.parent / 'NetworkDiagramStudio.html'
    subprocess.run(['node', str(ROOT / 'scripts/build-web.mjs'), str(html)], cwd=ROOT, check=True)
    web = output / 'NetworkDiagramStudio-web.zip'
    with zipfile.ZipFile(web, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(html, 'NetworkDiagramStudio.html')
        archive.write(ROOT / 'src/web/assets/app-icon.svg', 'NetworkDiagramStudio-icon.svg')
        for path in (ROOT/'scripts/convert-stencil.ps1', ROOT/'LICENSE', ROOT/'THIRD_PARTY_NOTICES.md', ROOT/'docs/THIRD_PARTY_NOTICES.md'):
            if path.is_file(): archive.write(path, path.name)
        netbox = ROOT/'src/web/imports/NETBOX-LICENSE.txt'
        if netbox.is_file(): archive.write(netbox,'notices/NETBOX-LICENSE.txt')
        for path in sorted((ROOT/'src/web/vendor').rglob('*')):
            if path.is_file() and any(k in path.name.lower() for k in ('license','notice','copying')):
                archive.write(path, 'notices/'+str(path.relative_to(ROOT/'src/web/vendor')).replace('\\','/'))
    exe = output / 'NetworkDiagramStudio.exe'
    if executable.resolve() != exe.resolve(): shutil.copyfile(executable, exe)
    sums = output / 'SHA256SUMS.txt'
    sums.write_text(''.join(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n' for path in (exe,web)),encoding='utf-8')
    with zipfile.ZipFile(web) as archive:
        if archive.testzip() is not None or 'NetworkDiagramStudio.html' not in archive.namelist(): raise ValueError('Invalid web release archive.')
    print('Prepared '+intent['tag']+' for Windows x64 and web.')

if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--exe',type=Path,default=ROOT/'dist/windows/NetworkDiagramStudio.exe')
    p.add_argument('--out',type=Path,default=ROOT/'dist/release')
    args=p.parse_args();prepare(args.exe,args.out)
