/**
 * @license Apache-2.0
 * Pure TypeScript deterministic ZIP archive generator (PKZip 2.0 format).
 * Generates valid standard zip files compatible with OS unarchivers,
 * standard command-line unzip, Python zipfile, and PCB fab uploaders.
 */

import type { GerberFileSet } from "./types.js";

// Standard CRC32 table
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Creates a standard PKZip 2.0 uncompressed archive from a map of filename -> content.
 */
export function createZipFromFiles(files: Record<string, string | Uint8Array>): Uint8Array {
  const textEncoder = new TextEncoder();
  const entries: Array<{
    nameBytes: Uint8Array;
    dataBytes: Uint8Array;
    crc: number;
    offset: number;
  }> = [];

  let totalSize = 0;
  // Fixed deterministic MS-DOS timestamp: 2026-10-11 12:00:00
  // Year: 2026 - 1980 = 46 (bits 9..15), Month: 10 (bits 5..8), Day: 11 (bits 0..4)
  const dosDate = (46 << 9) | (10 << 5) | 11;
  const dosTime = 12 << 11; // 12:00:00

  // Measure and encode files in deterministic sorted order
  const sortedFilenames = Object.keys(files).sort();

  for (const filename of sortedFilenames) {
    const content = files[filename];
    if (content === undefined) continue;
    const nameBytes = textEncoder.encode(filename);
    const dataBytes = typeof content === "string" ? textEncoder.encode(content) : content;
    const crc = crc32(dataBytes);
    entries.push({
      nameBytes,
      dataBytes,
      crc,
      offset: totalSize,
    });
    // Local header: 30 bytes + name length + data length
    totalSize += 30 + nameBytes.length + dataBytes.length;
  }

  const centralDirStartOffset = totalSize;
  let centralDirSize = 0;
  for (const entry of entries) {
    // Central directory header: 46 bytes + name length
    centralDirSize += 46 + entry.nameBytes.length;
  }

  // End of Central Directory: 22 bytes
  totalSize += centralDirSize + 22;

  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);
  let pos = 0;

  // 1. Write Local File Headers + File Data
  for (const entry of entries) {
    view.setUint32(pos, 0x04034b50, true); // Local header signature 'PK\x03\x04'
    view.setUint16(pos + 4, 20, true); // Version needed (2.0)
    view.setUint16(pos + 6, 0x0800, true); // General purpose bit flag: UTF-8
    view.setUint16(pos + 8, 0, true); // Compression method: 0 (STORE)
    view.setUint16(pos + 10, dosTime, true); // File last mod time
    view.setUint16(pos + 12, dosDate, true); // File last mod date
    view.setUint32(pos + 14, entry.crc, true); // CRC-32
    view.setUint32(pos + 18, entry.dataBytes.length, true); // Compressed size
    view.setUint32(pos + 22, entry.dataBytes.length, true); // Uncompressed size
    view.setUint16(pos + 26, entry.nameBytes.length, true); // File name length
    view.setUint16(pos + 28, 0, true); // Extra field length
    pos += 30;

    out.set(entry.nameBytes, pos);
    pos += entry.nameBytes.length;

    out.set(entry.dataBytes, pos);
    pos += entry.dataBytes.length;
  }

  // 2. Write Central Directory Headers
  for (const entry of entries) {
    view.setUint32(pos, 0x02014b50, true); // Central header signature 'PK\x01\x02'
    view.setUint16(pos + 4, 20, true); // Version made by (2.0)
    view.setUint16(pos + 6, 20, true); // Version needed to extract (2.0)
    view.setUint16(pos + 8, 0x0800, true); // UTF-8 filename
    view.setUint16(pos + 10, 0, true); // Compression method: 0 (STORE)
    view.setUint16(pos + 12, dosTime, true); // Last mod time
    view.setUint16(pos + 14, dosDate, true); // Last mod date
    view.setUint32(pos + 16, entry.crc, true); // CRC-32
    view.setUint32(pos + 20, entry.dataBytes.length, true); // Compressed size
    view.setUint32(pos + 24, entry.dataBytes.length, true); // Uncompressed size
    view.setUint16(pos + 28, entry.nameBytes.length, true); // File name length
    view.setUint16(pos + 30, 0, true); // Extra field length
    view.setUint16(pos + 32, 0, true); // File comment length
    view.setUint16(pos + 34, 0, true); // Disk number start
    view.setUint16(pos + 36, 0, true); // Internal file attributes
    view.setUint32(pos + 38, 0, true); // External file attributes
    view.setUint32(pos + 42, entry.offset, true); // Relative offset of local header
    pos += 46;

    out.set(entry.nameBytes, pos);
    pos += entry.nameBytes.length;
  }

  // 3. Write End of Central Directory Record (EOCD)
  view.setUint32(pos, 0x06054b50, true); // EOCD signature 'PK\x05\x06'
  view.setUint16(pos + 4, 0, true); // Number of this disk
  view.setUint16(pos + 6, 0, true); // Disk where central directory starts
  view.setUint16(pos + 8, entries.length, true); // Number of central dir records on this disk
  view.setUint16(pos + 10, entries.length, true); // Total number of central dir records
  view.setUint32(pos + 12, centralDirSize, true); // Size of central directory
  view.setUint32(pos + 16, centralDirStartOffset, true); // Offset of start of central directory
  view.setUint16(pos + 20, 0, true); // ZIP comment length
  pos += 22;

  return out;
}

/**
 * Packs a GerberFileSet into a downloadable ZIP archive containing all 8 Gerber and drill files.
 */
export function createGerberZip(fileSet: GerberFileSet): Uint8Array {
  return createZipFromFiles(fileSet.files);
}
