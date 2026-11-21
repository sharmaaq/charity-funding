// A minimal ZIP writer (method 0, "stored", no compression) for the "Download application package" button.
// PURE MODULE: no DOM. entries: [{ name: string, bytes: Uint8Array }]. Returns a Uint8Array.
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function buildZip(entries, date = new Date()) {
  const enc = new TextEncoder();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate = (Math.max(0, date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const chunks = [];
  const central = [];
  let offset = 0;
  const push = (u8) => { chunks.push(u8); offset += u8.length; };
  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.bytes);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
    local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true); local.setUint32(14, crc, true);
    local.setUint32(18, e.bytes.length, true); local.setUint32(22, e.bytes.length, true); local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
    const start = offset;
    push(new Uint8Array(local.buffer)); push(name); push(e.bytes);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true);
    c.setUint32(20, e.bytes.length, true); c.setUint32(24, e.bytes.length, true); c.setUint16(28, name.length, true);
    c.setUint32(42, start, true);
    central.push(new Uint8Array(c.buffer), name);
  }
  const centralStart = offset;
  for (const u8 of central) push(u8);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, offset - centralStart, true); end.setUint32(16, centralStart, true);
  push(new Uint8Array(end.buffer));
  const out = new Uint8Array(offset);
  let p = 0;
  for (const u8 of chunks) { out.set(u8, p); p += u8.length; }
  return out;
}
