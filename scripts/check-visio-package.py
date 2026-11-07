"""Check generated OPC relationships, Visio IDs, stroke units and port glue independently."""
from pathlib import Path, PurePosixPath
import math
import posixpath
import re
import sys
import xml.etree.ElementTree as E
from zipfile import ZipFile

V = '{http://schemas.microsoft.com/office/visio/2012/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
P = '{http://schemas.openxmlformats.org/package/2006/relationships}'
CT = '{http://schemas.openxmlformats.org/package/2006/content-types}'
VR = 'http://schemas.microsoft.com/visio/2010/relationships/'

def check(path):
    def require(ok, message):
        if not ok:
            raise ValueError(f'{path.name}: {message}')
    with ZipFile(path) as archive:
        names = archive.namelist()
        require(len(names) == len(set(names)), 'duplicate ZIP entry')
        require(archive.testzip() is None, 'ZIP integrity failure')
        require(names[0] == '[Content_Types].xml', 'content types must precede document parts')
        xml = {}
        for name in names:
            require(not name.startswith('/') and '..' not in PurePosixPath(name).parts, 'unsafe part URI')
            if name.endswith(('.xml', '.rels')):
                data = archive.read(name)
                require(b'<!DOCTYPE' not in data.upper() and b'<!ENTITY' not in data.upper(), 'external XML declaration')
                xml[name] = E.fromstring(data)
        require('[Content_Types].xml' in xml, 'missing content types')
        types = xml['[Content_Types].xml']
        require(types.tag == CT+'Types', 'invalid content type root')
        defaults = {x.get('Extension'): x.get('ContentType') for x in types.findall(CT+'Default')}
        overrides = {x.get('PartName').lstrip('/'): x.get('ContentType') for x in types.findall(CT+'Override')}
        require(len(overrides) == len(types.findall(CT+'Override')), 'duplicate content type override')
        require(set(overrides) <= set(names), 'content type targets a missing part')
        for name in names:
            if name != '[Content_Types].xml':
                require(name in overrides or name.rsplit('.', 1)[-1] in defaults, 'part has no content type: '+name)
        relationships = {}
        for name, root in xml.items():
            if not name.endswith('.rels'):
                continue
            require(root.tag == P+'Relationships', 'invalid relationship root')
            source = '' if name == '_rels/.rels' else str(PurePosixPath(name).parent.parent / PurePosixPath(name).name[:-5])
            entries = {}
            for rel in root:
                key = rel.get('Id')
                require(key and key not in entries and rel.get('TargetMode') is None, 'invalid/duplicate/external relationship')
                target = posixpath.normpath(posixpath.join(posixpath.dirname(source), rel.get('Target', ''))).lstrip('/')
                require(target in names, 'missing relationship target: '+target)
                entries[key] = (rel.get('Type'), target)
            relationships[source] = entries
        require(any(t == VR+'document' and n == 'visio/document.xml' for t, n in relationships.get('', {}).values()), 'missing document relationship')
        require('visio/document.xml' in xml and 'visio/pages/pages.xml' in xml, 'missing document or page index')
        for name, root in xml.items():
            for rel in root.iter(V+'Rel'):
                require(rel.get(R+'id') in relationships.get(name, {}), 'unbound relationship in '+name)
            for cell in root.iter(V+'Cell'):
                if cell.get('N') != 'LineWeight':
                    continue
                require(cell.get('U') == 'PT', 'LineWeight must declare PT units in '+name)
                if re.fullmatch(r'Sheet\.\d+!LineWeight', cell.get('F', '')) and root.tag == V+'PageContents':
                    continue  # Resolved against the legend style below.
                formula = re.fullmatch(r'([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?) pt', cell.get('F', ''))
                require(formula is not None, 'LineWeight must have a numeric pt formula in '+name)
                points = float(formula[1])
                try:
                    inches = float(cell.get('V', ''))
                except ValueError:
                    inches = math.nan
                require(math.isfinite(points) and math.isfinite(inches) and points >= 0 and inches >= 0,
                        'LineWeight must be finite and nonnegative in '+name)
                # Both the point formula and cached inch value are rounded to five decimals.
                require(math.isclose(inches, points / 72, rel_tol=0, abs_tol=5.1e-6),
                        'LineWeight formula does not match cached inches in '+name)
        master_parts = {}
        index = xml.get('visio/masters/masters.xml')
        if index is not None:
            for master in index:
                key = master.get('ID')
                require(key is not None and key not in master_parts and int(key) > 0, 'invalid master ID')
                ref = master.find(V+'Rel').get(R+'id')
                master_parts[key] = relationships['visio/masters/masters.xml'][ref][1]
        master_ids = {key: {s.get('ID') for s in xml[name].iter(V+'Shape')} for key, name in master_parts.items()}
        styles = {style.get('ID'): style for style in xml['visio/document.xml'].iter(V+'StyleSheet')}
        font_names = {f.get('NameU') for f in xml['visio/document.xml'].iter(V+'FaceName')}
        for name, root in xml.items():
            if not name.startswith(('visio/pages/page', 'visio/masters/master')) or root.tag not in (V+'PageContents', V+'MasterContents'):
                continue
            shapes = list(root.iter(V+'Shape'))
            ids = {s.get('ID') for s in shapes}
            require(len(ids) == len(shapes) and None not in ids, 'duplicate/missing shape ID in '+name)
            for element in root.iter():
                cells = element.findall(V+'Cell')
                require(len({c.get('N') for c in cells}) == len(cells), 'duplicate ShapeSheet cell in '+name)
                for cell in cells:
                    if cell.get('N') == 'Font':
                        require(cell.get('V') in font_names, 'undeclared font')
                    if cell.get('N') in {'PinX','PinY','Width','Height','LocPinX','LocPinY','Size','Angle','LineWeight'}:
                        require(math.isfinite(float(cell.get('V'))), 'nonfinite shape dimension')
            def inheritance(shape, inherited=None):
                owner = shape.get('Master', inherited)
                if shape.get('Master') is not None:
                    require(owner in master_parts, 'shape uses an absent master')
                    require(any(t == VR+'master' and n == master_parts[owner] for t, n in relationships.get(name, {}).values()), 'page has no relationship to its master')
                if shape.get('MasterShape') is not None:
                    require(owner in master_ids and shape.get('MasterShape') in master_ids[owner], 'invalid inherited child shape')
                for child in shape.findall(V+'Shapes/'+V+'Shape'):
                    inheritance(child, owner)
            if root.tag == V+'PageContents':
                for shape in root.findall(V+'Shapes/'+V+'Shape'):
                    inheritance(shape)
                by_id = {s.get('ID'): s for s in shapes}
                for shape in shapes:
                    style_id = shape.get('LineStyle')
                    require(style_id is None or style_id in styles, 'absent line style in '+name)
                    for cell in shape.findall(V+'Cell'):
                        prop = cell.get('N')
                        reference = re.fullmatch(r'Sheet\.(\d+)!(LineWeight|LinePattern|LineColor|LineColorTrans)', cell.get('F', ''))
                        if not reference:
                            continue
                        target = by_id.get(reference[1])
                        require(target is not None and target.get('NameU', '').startswith('CableLegend.'), 'line style reference must target a cable legend')
                        require(prop == reference[2] and target.get('LineStyle') == style_id, 'line and legend must share a line style')
                        style_cell = styles[style_id].find(V+"Cell[@N='"+prop+"']")
                        require(style_cell is not None and cell.get('V') == style_cell.get('V'), 'line cache differs from its legend style')
                for connect in root.iter(V+'Connect'):
                    require(connect.get('FromSheet') in ids and connect.get('ToSheet') in ids, 'connection references an absent shape')
                    match = re.fullmatch(r'Connections.X(\d+)', connect.get('ToCell', ''))
                    require(match is not None, 'connection is not glued to a physical port')
                    target = by_id[connect.get('ToSheet')]
                    require(any(row.get('IX') == str(int(match[1])-1) for row in target.findall(V+"Section[@N='Connection']/"+V+'Row')), 'missing connection-point row')
        pages = xml['visio/pages/pages.xml'].findall(V+'Page')
        if pages:
            require('visio/windows.xml' in xml, 'missing drawing window settings')
            require(xml['visio/windows.xml'].find(V+'Window').get('Page') in {p.get('ID') for p in pages}, 'drawing window references an absent page')
        require('docProps/custom.xml' in xml and any(p.get('name') == 'RecalcDocument' for p in xml['docProps/custom.xml']), 'missing recalculation instruction')
    return len(names), len(pages), len(master_parts)

if __name__ == '__main__':
    for argument in sys.argv[1:]:
        target = Path(argument)
        files = sorted(target.glob('*.vs*x')) if target.is_dir() else [target]
        if not files:
            raise SystemExit('No Visio packages to validate.')
        for path in files:
            parts, pages, masters = check(path)
            print(f'{path.name}: {parts} valid parts, {pages} pages, {masters} masters; relationships, stroke units, shapes and glued ports checked.')
