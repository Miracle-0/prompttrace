export class JsonlStreamDecoder {
  private readonly decoder = new TextDecoder("utf-8", { fatal: false });
  private buffer = "";
  private lineNo = 0;
  private seenFirstChunk = false;

  push(chunk: Uint8Array): unknown[] {
    let text = this.decoder.decode(chunk, { stream: true });
    if (!this.seenFirstChunk) {
      this.seenFirstChunk = true;
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    }
    this.buffer += text;
    return this.drainCompleteLines();
  }

  flush(): unknown[] {
    const tail = this.decoder.decode();
    if (tail) this.buffer += tail;
    if (this.buffer.length === 0) return [];
    // Treat remaining buffer as one final line (no trailing newline).
    const results: unknown[] = [];
    const trimmed = this.buffer.trim();
    this.buffer = "";
    if (trimmed.length > 0) {
      this.lineNo += 1;
      results.push(this.parseLine(trimmed, this.lineNo));
    }
    return results;
  }

  private drainCompleteLines(): unknown[] {
    const results: unknown[] = [];
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) !== -1) {
      const raw = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);
      this.lineNo += 1;
      const trimmed = raw.trim();
      if (trimmed.length === 0) continue;
      results.push(this.parseLine(trimmed, this.lineNo));
    }
    return results;
  }

  private parseLine(line: string, no: number): unknown {
    try {
      return JSON.parse(line);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Invalid JSON on line ${no}: ${msg}`);
    }
  }
}
