const MAGIC = new TextEncoder().encode('PANVAS-ASSET-1\n');

export interface AssetEnvelopeMetadata {
  id: string;
  ownerId: string;
  fileName: string;
  mimeType: string;
  assetKind: 'pdf' | 'image' | 'audio';
  createdAt: number;
  userId: string | null;
}

export function encodeAssetEnvelope(metadata: AssetEnvelopeMetadata, bytes: Uint8Array): Uint8Array {
  const header = new TextEncoder().encode(JSON.stringify(metadata));
  const result = new Uint8Array(MAGIC.length + 4 + header.length + bytes.length);
  result.set(MAGIC, 0);
  new DataView(result.buffer).setUint32(MAGIC.length, header.length, false);
  result.set(header, MAGIC.length + 4);
  result.set(bytes, MAGIC.length + 4 + header.length);
  return result;
}

export function decodeAssetEnvelope(value: Uint8Array): { metadata: AssetEnvelopeMetadata; bytes: Uint8Array } | null {
  if (value.length < MAGIC.length + 4 || !MAGIC.every((byte, index) => value[index] === byte)) return null;
  const headerLength = new DataView(value.buffer, value.byteOffset, value.byteLength).getUint32(MAGIC.length, false);
  const headerStart = MAGIC.length + 4;
  if (headerLength < 2 || headerStart + headerLength > value.length) return null;
  try {
    const metadata = JSON.parse(new TextDecoder().decode(value.subarray(headerStart, headerStart + headerLength))) as AssetEnvelopeMetadata;
    if (!metadata || metadata.id.length === 0 || metadata.ownerId.length === 0 || !['pdf', 'image', 'audio'].includes(metadata.assetKind)) return null;
    return { metadata, bytes: value.subarray(headerStart + headerLength) };
  } catch {
    return null;
  }
}
