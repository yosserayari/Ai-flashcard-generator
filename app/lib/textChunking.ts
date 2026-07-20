const CHARS_PER_TOKEN_ESTIMATE = 4;

export const SAFE_CHUNK_CHAR_THRESHOLD = 6000; // ~1500 tokens per chunk

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE);
}

export function needsChunking(text: string): boolean {
  return text.length > SAFE_CHUNK_CHAR_THRESHOLD;
}

export function chunkText(text: string): string[] {
  if (!needsChunking(text)) return [text];

  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= SAFE_CHUNK_CHAR_THRESHOLD) {
      current = candidate;
      continue;
    }

    // Adding this paragraph would overflow the current chunk.
    if (current) {
      chunks.push(current);
      current = "";
    }

    if (paragraph.length <= SAFE_CHUNK_CHAR_THRESHOLD) {
      current = paragraph;
    } else {
      // A single paragraph is itself too long — fall back to splitting by
      // sentence within it, using the same accumulate-until-full approach.
      const sentences = paragraph.match(/[^.!?]+[.!?]+(\s|$)/g) || [paragraph];
      let sentenceChunk = "";

      for (const sentence of sentences) {
        const sentenceCandidate = sentenceChunk ? `${sentenceChunk}${sentence}` : sentence;

        if (sentenceCandidate.length <= SAFE_CHUNK_CHAR_THRESHOLD) {
          sentenceChunk = sentenceCandidate;
        } else {
          if (sentenceChunk) chunks.push(sentenceChunk);
          sentenceChunk = sentence;
        }
      }

      if (sentenceChunk) current = sentenceChunk;
    }
  }

  if (current) chunks.push(current);

  return chunks;
}