// Streaming render — renders templates to a Readable stream for large outputs

import { Readable, ReadableOptions } from 'node:stream';
import { tokenize } from './lexer.js';
import { parse } from './parser.js';
import { compile, RenderFunction, CompileOptions } from './compiler.js';
import { Context } from './runtime.js';

export class RenderStream extends Readable {
  private result: string | null = null;
  private offset = 0;
  private chunkSize: number;

  constructor(
    template: string,
    data: Record<string, unknown>,
    partials?: Record<string, string | RenderFunction>,
    options?: CompileOptions & { chunkSize?: number } & ReadableOptions,
  ) {
    super(options);
    this.chunkSize = options?.chunkSize ?? 16384; // 16KB chunks

    try {
      const tokens = tokenize(template);
      const ast = parse(tokens, template);
      const fn = compile(
        ast,
        (name) => {
          if (partials && typeof partials[name] === 'string') {
            const p = partials[name] as string;
            const t = tokenize(p);
            return parse(t, p);
          }
          return undefined;
        },
        options,
      );
      this.result = fn(new Context(data), partials);
    } catch (err) {
      // Defer error to stream
      process.nextTick(() => this.destroy(err as Error));
    }
  }

  _read(): void {
    if (this.result === null) return;

    if (this.offset >= this.result.length) {
      this.push(null);
      return;
    }

    const end = Math.min(this.offset + this.chunkSize, this.result.length);
    const chunk = this.result.slice(this.offset, end);
    this.offset = end;
    this.push(chunk);
  }
}

export function renderStream(
  template: string,
  data: Record<string, unknown>,
  partials?: Record<string, string | RenderFunction>,
  options?: CompileOptions & { chunkSize?: number },
): RenderStream {
  return new RenderStream(template, data, partials, options);
}
