"""Publish an explicitly requested, validated main-branch prerelease on GitHub Actions."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

REPO='TechSavage1989/NetworkDiagramStudio'
NAMES=('NetworkDiagramStudio.exe','NetworkDiagramStudio-web.zip','SHA256SUMS.txt')

def gh(*args,raw=False):
    result=subprocess.run(['gh',*args],capture_output=True,text=True,check=True).stdout
    return result if raw else json.loads(result)

def optional(endpoint):
    proc=subprocess.run(['gh','api',endpoint],capture_output=True,text=True)
    if proc.returncode == 0: return json.loads(proc.stdout)
    if 'HTTP 404' in proc.stderr: return None
    raise RuntimeError('GitHub lookup failed: '+proc.stderr)

def main():
    if os.getenv('GITHUB_REPOSITORY')!=REPO or os.getenv('GITHUB_REF')!='refs/heads/main':raise ValueError('Unexpected release destination or branch.')
    intent=json.loads(Path('docs/releases/intent.json').read_text());tag=intent['tag'];sha=os.environ['GITHUB_SHA'];version=intent['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+-preview\.\d+',version) or tag!='v'+version or intent['prerelease'] is not True: raise ValueError('Invalid preview intent.')
    if intent['notes']!='docs/releases/'+version+'.md': raise ValueError('Unexpected release-notes path.')
    commit=gh('api',f'repos/{REPO}/commits/{sha}'); parents=commit['parents'];
    if not parents: raise ValueError('Release needs a merged change on main.')
    changes=gh('api',f'repos/{REPO}/compare/{parents[0]["sha"]}...{sha}')['files']
    if not any(x['filename']=='docs/releases/intent.json' and x['status'] in ('added','modified') for x in changes): raise ValueError('This commit has no new release intent.')
    pulls=gh('api',f'repos/{REPO}/commits/{sha}/pulls')
    if not any(p.get('merged_at') and p['base']['ref']=='main' and p['merge_commit_sha']==sha for p in pulls): raise ValueError('The release commit must come from a merged PR to main.')
    root=Path('dist/release'); files={p.name:p for p in root.iterdir() if p.is_file()}
    if set(files)!=set(NAMES):raise ValueError('Unexpected release contents.')
    digest={n:hashlib.sha256(p.read_bytes()).hexdigest() for n,p in files.items()}
    expected=''.join(f'{digest[n]}  {n}\n' for n in NAMES[:2]);
    if files['SHA256SUMS.txt'].read_text()!=expected:raise ValueError('Release checksums do not match.')
    lookup=f'repos/{REPO}/git/ref/tags/{tag}'
    ref=optional(lookup)
    if ref and (ref['object']['type']!='commit' or ref['object']['sha']!=sha):raise ValueError('Refusing to replace an existing tag.')
    # List drafts as well as published releases; a failed upload can be resumed
    # only when all existing assets match this exact validated build.
    releases=gh('api',f'repos/{REPO}/releases?per_page=100'); release=next((r for r in releases if r['tag_name']==tag),None)
    if release and not ref:raise ValueError('A release exists without its verified tag.')
    if not ref:gh('api','--method','POST',f'repos/{REPO}/git/refs','-f',f'ref=refs/tags/{tag}','-f',f'sha={sha}')
    if not release:
        gh('release','create',tag,'--repo',REPO,'--verify-tag','--draft','--prerelease','--target',sha,'--title',f'NetworkDiagramStudio {version}','--notes-file',intent['notes'],raw=True)
    info=gh('release','view',tag,'--repo',REPO,'--json','isDraft,isPrerelease,assets')
    def verify_assets(data):
        seen=set()
        for asset in data['assets']:
            name=asset['name']
            if name not in digest or name in seen or asset.get('digest')!='sha256:'+digest[name] or asset['size']!=files[name].stat().st_size: raise ValueError('Existing release asset differs; refusing overwrite.')
            seen.add(name)
        return seen
    if not info['isPrerelease']:raise ValueError('Refusing to modify a stable release.')
    seen=verify_assets(info)
    if not info['isDraft']:
        if seen!=set(NAMES):raise ValueError('Published release is incomplete; refusing modification.')
        print('Verified previously published immutable release',tag);return
    for name in NAMES:
        if name not in seen:gh('release','upload',tag,str(files[name]),'--repo',REPO,raw=True)
    ready=gh('release','view',tag,'--repo',REPO,'--json','assets')
    if verify_assets(ready)!=set(NAMES):raise ValueError('Draft did not contain all verified assets.')
    gh('release','edit',tag,'--repo',REPO,'--draft=false','--prerelease','--latest=false',raw=True)
    published=gh('api',f'repos/{REPO}/releases/tags/{tag}')
    if published['draft'] or not published['prerelease'] or verify_assets(published)!=set(NAMES):raise ValueError('Publication verification failed.')
    print(published['html_url'])

if __name__=='__main__':main()
