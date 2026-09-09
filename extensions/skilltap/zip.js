(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SkillTapZip = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  const CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    CRC_TABLE[n] = c >>> 0;
  }

  function crc32(data) {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i += 1) {
      c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function u16(n) {
    const b = new Uint8Array(2);
    b[0] = n & 0xff;
    b[1] = (n >>> 8) & 0xff;
    return b;
  }

  function u32(n) {
    const b = new Uint8Array(4);
    b[0] = n & 0xff;
    b[1] = (n >>> 8) & 0xff;
    b[2] = (n >>> 16) & 0xff;
    b[3] = (n >>> 24) & 0xff;
    return b;
  }

  function concat(parts) {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.length;
    }
    return out;
  }

  function dosStamp(date) {
    const d = date || new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const day = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, date: day };
  }

  function encodeUtf8(text) {
    return new TextEncoder().encode(text);
  }

  /**
   * Uncompressed (STORE) zip. `files` is [{ name, text }] or [{ name, bytes }].
   */
  function pack(files) {
    const stamp = dosStamp();
    const locals = [];
    const centrals = [];
    let offset = 0;

    for (const file of files) {
      const name = String(file.name).replace(/\\/g, "/");
      const nameBytes = encodeUtf8(name);
      const bytes = file.bytes instanceof Uint8Array ? file.bytes : encodeUtf8(file.text ?? "");
      const crc = crc32(bytes);
      const local = concat([
        u32(0x04034b50),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(stamp.time),
        u16(stamp.date),
        u32(crc),
        u32(bytes.length),
        u32(bytes.length),
        u16(nameBytes.length),
        u16(0),
        nameBytes,
        bytes,
      ]);
      const central = concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(stamp.time),
        u16(stamp.date),
        u32(crc),
        u32(bytes.length),
        u32(bytes.length),
        u16(nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBytes,
      ]);
      locals.push(local);
      centrals.push(central);
      offset += local.length;
    }

    const centralBlob = concat(centrals);
    const eocd = concat([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(files.length),
      u16(files.length),
      u32(centralBlob.length),
      u32(offset),
      u16(0),
    ]);

    return concat([...locals, centralBlob, eocd]);
  }

  return { pack, crc32 };
});
