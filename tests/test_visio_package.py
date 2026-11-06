import importlib.util
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('package_check', ROOT / 'scripts/check-visio-package.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ExportPackageChecks(unittest.TestCase):
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

if __name__ == '__main__':
    unittest.main()
