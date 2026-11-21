import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, buildZip } from '../../public/js/application/zip.js';

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('buildZip writes stored entries with a valid central directory', () => {
  const a = new TextEncoder().encode('hello');
  const b = new Uint8Array([1, 2, 3, 4]);
  const zip = buildZip([{ name: 'a.txt', bytes: a }, { name: 'b.bin', bytes: b }], new Date(2026, 10, 21, 10, 0, 0));
  const dv = new DataView(zip.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50, 'local header signature');
  const end = zip.length - 22;
  assert.equal(dv.getUint32(end, true), 0x06054b50, 'end of central directory');
  assert.equal(dv.getUint16(end + 10, true), 2, 'two entries');
  const cdStart = dv.getUint32(end + 16, true);
  assert.equal(dv.getUint32(cdStart, true), 0x02014b50, 'central directory signature');
  assert.equal(dv.getUint32(cdStart + 16, true), crc32(a));
  assert.equal(dv.getUint32(0 + 18, true), 5, 'compressed size equals stored size');
  assert.equal(new TextDecoder().decode(zip.subarray(30 + 5, 30 + 5 + 5)), 'hello');
});
