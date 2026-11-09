"""Regenerate tight caption ink metrics from the already bundled report fonts.
Requires fontTools only for this maintenance command, not builds or the app.
"""
import base64
import io
import json
import re
from pathlib import Path
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
source = (root / 'src/web/vendor/report-fonts.mjs').read_text()
fonts = dict(re.findall(r'(normal|bold):"([A-Za-z0-9+/=]+)"', source))
result = {}
for style in ('normal', 'bold'):
    font = TTFont(io.BytesIO(base64.b64decode(fonts[style])))
    assert font['head'].unitsPerEm == 2048
    cmap = font.getBestCmap()
    result[style] = {}
    for code in (*range(32, 127), *range(160, 256)):
        name = cmap.get(code)
        if not name:
            continue
        glyph = font['glyf'][name]
        bounds = [glyph.xMin, glyph.yMin, glyph.xMax, glyph.yMax] if glyph.numberOfContours else [0, 0, 0, 0]
        result[style][str(code)] = [font['hmtx'][name][0], *bounds]
(root / 'src/web/diagram/caption-font-metrics.mjs').write_text(
    '// Ink bounds and advances from the bundled DejaVu Sans normal/bold report fonts.\n'
    '// Units: 2048/em. See vendor/REPORT-FONTS-LICENSE.txt. Non-Latin text uses a conservative fallback.\n'
    'export const captionFontMetrics=' + json.dumps(result, separators=(',', ':')) + ';\n'
)
