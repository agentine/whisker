// Runtime — context resolution, HTML escaping, lambda support

export class Context {
  private readonly stack: unknown[];

  constructor(data: unknown) {
    this.stack = [data];
  }

  push(data: unknown): Context {
    const ctx = new Context(null);
    ctx.stack.length = 0;
    ctx.stack.push(...this.stack, data);
    return ctx;
  }

  lookup(name: string): unknown {
    // Dot means current context (top of stack)
    if (name === '.') {
      return this.stack[this.stack.length - 1];
    }

    const parts = name.split('.');

    // Walk stack from top to bottom for the first part
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];

      // Only objects can have named properties
      if (frame == null || typeof frame !== 'object') continue;
      if (Array.isArray(frame)) continue;

      const obj = frame as Record<string, unknown>;
      if (!(parts[0] in obj)) continue;

      let val: unknown = obj[parts[0]];
      // Resolve remaining dot-notation parts
      for (let p = 1; p < parts.length; p++) {
        if (val == null || typeof val !== 'object') return undefined;
        val = (val as Record<string, unknown>)[parts[p]];
      }
      return val;
    }

    return undefined;
  }

  /** Return the top of the context stack */
  top(): unknown {
    return this.stack[this.stack.length - 1];
  }

  /** Lookup a name at a specific parent depth (for ../ references) */
  lookupAtDepth(name: string, depth: number): unknown {
    const targetIdx = this.stack.length - 1 - depth;
    if (targetIdx < 0) return undefined;

    if (name === '.') {
      return this.stack[targetIdx];
    }

    const parts = name.split('.');
    const frame = this.stack[targetIdx];
    if (frame == null || typeof frame !== 'object' || Array.isArray(frame)) return undefined;

    const obj = frame as Record<string, unknown>;
    if (!(parts[0] in obj)) return undefined;

    let val: unknown = obj[parts[0]];
    for (let p = 1; p < parts.length; p++) {
      if (val == null || typeof val !== 'object') return undefined;
      val = (val as Record<string, unknown>)[parts[p]];
    }
    return val;
  }
}

export function resolveValue(context: Context, name: string): unknown {
  return context.lookup(name);
}

const escapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`=]/g, (ch) => escapeMap[ch]);
}
