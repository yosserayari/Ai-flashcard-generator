const CHARS_PER_TOKEN_ESTIMATE = 4;

export const SAFE_CHUNK_CHAR_THRESHOLD = 6000; // ~1500 tokens per chunk

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

export function needsChunking(text: string): boolean {
  return text.length > SAFE_CHUNK_CHAR_THRESHOLD;
}