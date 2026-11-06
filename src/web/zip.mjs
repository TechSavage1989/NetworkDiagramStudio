// Bounded in-memory reader for ordinary ZIP-based Office documents. No disk extraction.
const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const utf8 = new TextDecoder('utf-8', { fatal: true });
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  for (let j = 0; j < 8; j++) i = (i & 1) ? 0xedb88320 ^ (i >>> 1) : i >>> 1;
  return i >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ crcTable[(value ^ byte) & 255];
  return (value ^ 0xffffffff) >>> 0;
}
async function inflate(data, size) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const bytes = new Uint8Array(size);
  let offset = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.length > size) throw new Error('Expanded ZIP entry exceeds its declared size.');
      bytes.set(value, offset);
      offset += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (offset !== size) throw new Error('Truncated ZIP entry.');
  return bytes;
}
export async function unzip(input, { maxBytes = 160 * 1024 * 1024, maxEntries = 5000 } = {}) {
  if ((input.size ?? input.byteLength) > maxBytes) throw new Error('ZIP file exceeds the import limit.');
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input.arrayBuffer ? await input.arrayBuffer() : input);
  if (bytes.length < 22 || bytes.length > maxBytes) throw new Error('Invalid ZIP size.');
  const v = view(bytes);
  const u16 = n => v.getUint16(n, true);
  const u32 = n => v.getUint32(n, true);
  let end = bytes.length - 22;
  const floor = Math.max(0, end - 65535);
  while (end >= floor && !(u32(end) === 0x06054b50 && end + 22 + u16(end + 20) === bytes.length)) end--;
  if (end < floor || u16(end + 4) || u16(end + 6)) throw new Error('Unsupported or incomplete ZIP archive.');
  const count = u16(end + 10);
  let pos = u32(end + 16), total = 0;
  if (count !== u16(end + 8) || count > maxEntries || pos + u32(end + 12) !== end) throw new Error('Invalid ZIP directory.');
  const result = new Map();
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || u32(pos) !== 0x02014b50) throw new Error('Malformed ZIP entry.');
    const flags = u16(pos + 8), method = u16(pos + 10), crc = u32(pos + 16);
    const packed = u32(pos + 20), size = u32(pos + 24), length = u16(pos + 28);
    const local = u32(pos + 42);
    const next = pos + 46 + length + u16(pos + 30) + u16(pos + 32);
    if (next > end || local + 30 > bytes.length || u32(local) !== 0x04034b50 || (flags & 1) ||
        ![0, 8].includes(method) || u16(local + 8) !== method) throw new Error('Unsupported ZIP entry.');
    const name = utf8.decode(bytes.subarray(pos + 46, pos + 46 + length));
    if (!name || /^[\\/]|^[a-z]:/i.test(name) || /[\\\x00-\x1f]/.test(name) ||
        name.split('/').some(s => s === '.' || s === '..') || result.has(name)) throw new Error('Unsafe or duplicate ZIP path.');
    const data = local + 30 + u16(local + 26) + u16(local + 28);
    total += size;
    if (total > maxBytes || data + packed > u32(end + 16)) throw new Error('ZIP size limit exceeded.');
    if (!name.endsWith('/')) {
      const block = bytes.subarray(data, data + packed);
      const content = method === 0 ? block : await inflate(block, size);
      if (content.length !== size || crc32(content) !== crc) throw new Error('ZIP integrity check failed for ' + name);
      result.set(name, content);
    }
    pos = next;
  }
  if (pos !== end) throw new Error('Unexpected ZIP directory data.');
  return result;
}
