/** 原生 CompressionStream gzip */

export async function gzipText(text: string) {
  if (typeof CompressionStream === "undefined") {
    return { rawBytes: text.length, gzipBytes: text.length, ratio: 1, supported: false };
  }
  const raw = new TextEncoder().encode(text);
  const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream("gzip"));
  const gzip = new Uint8Array(await new Response(stream).arrayBuffer());
  return {
    rawBytes: raw.byteLength,
    gzipBytes: gzip.byteLength,
    ratio: gzip.byteLength / raw.byteLength,
    supported: true,
    gzip,
  };
}

export async function gunzipText(gzip: Uint8Array) {
  const stream = new Blob([gzip]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}
