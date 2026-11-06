import importlib.util
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as E
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('package_check', ROOT / 'scripts/check-visio-package.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ExportPackageChecks(unittest.TestCase):
    @staticmethod
    def line_weight(parts, name='visio/pages/page1.xml', **attributes):
        root = E.fromstring(parts[name])
        cell = next(c for c in root.iter(module.V+'Cell') if c.get('N') == 'LineWeight')
        for key, value in attributes.items():
            if value is None:
                cell.attrib.pop(key, None)
            else:
                cell.set(key, value)
        parts[name] = E.tostring(root)

    def damaged(self, transform):
        source = ROOT / '.artifacts/visio/bitmap-art.vsdx'
        with ZipFile(source) as archive:
            parts = {name: archive.read(name) for name in archive.namelist()}
        transform(parts)
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'damaged.vsdx'
            with ZipFile(target, 'w') as archive:
                for name, content in parts.items():
                    archive.writestr(name, content)
            module.check(target)

    def test_missing_picture_is_rejected(self):
        def remove(parts):
            del parts[next(name for name in parts if name.startswith('visio/media/'))]
        with self.assertRaisesRegex(ValueError, 'missing part|missing relationship target'):
            self.damaged(remove)

    def test_unbound_relationship_is_rejected(self):
        def change(parts):
            key = 'visio/pages/pages.xml'
            parts[key] = parts[key].replace(b'r:id="rId1"', b'r:id="rId999"', 1)
        with self.assertRaisesRegex(ValueError, 'unbound relationship'):
            self.damaged(change)

    def test_missing_inherited_shape_is_rejected(self):
        def change(parts):
            key = 'visio/pages/page1.xml'
            parts[key] = parts[key].replace(b'MasterShape="6"', b'MasterShape="999999"', 1)
        with self.assertRaisesRegex(ValueError, 'invalid inherited child shape'):
            self.damaged(change)

    def test_line_weight_units_are_required_in_every_part(self):
        for name in ('visio/document.xml', 'visio/masters/master1.xml', 'visio/pages/page1.xml'):
            for units in (None, 'IN'):
                with self.subTest(part=name, units=units), self.assertRaisesRegex(ValueError, 'LineWeight.*PT units'):
                    self.damaged(lambda parts: self.line_weight(parts, name, U=units))

    def test_line_weight_requires_a_numeric_points_formula(self):
        for formula in (None, '2.25', '0.75 in', 'nan pt', 'inf pt', 'width*0.01'):
            with self.subTest(formula=formula), self.assertRaisesRegex(ValueError, 'LineWeight.*pt formula'):
                self.damaged(lambda parts: self.line_weight(parts, F=formula))

    def test_line_weight_rejects_invalid_or_mismatched_values(self):
        for attributes, message in (
            ({'V': 'nan'}, 'finite and nonnegative'),
            ({'V': 'inf'}, 'finite and nonnegative'),
            ({'V': '-0.01042', 'F': '-0.75 pt'}, 'finite and nonnegative'),
            ({'V': '0.03125', 'F': '0.03125 pt'}, 'does not match cached inches'),
            ({'V': '0.03125', 'F': '0.75 pt'}, 'does not match cached inches'),
            ({'V': '0.03125', 'F': '1e999 pt'}, 'finite and nonnegative'),
        ):
            with self.subTest(attributes=attributes), self.assertRaisesRegex(ValueError, 'LineWeight.*'+message):
                self.damaged(lambda parts: self.line_weight(parts, **attributes))

    def test_line_weight_accepts_disabled_strokes_and_rounding(self):
        for attributes in ({'V': '0', 'F': '0 pt'}, {'V': '0.00284', 'F': '0.20412 pt'}):
            with self.subTest(attributes=attributes):
                self.damaged(lambda parts: self.line_weight(parts, **attributes))

if __name__ == '__main__':
    unittest.main()
