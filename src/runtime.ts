// Runtime — context resolution, HTML escaping, lambda support

export class Context {
  private readonly stack: Record<string, unknown>[];

  constructor(data: Record<string, unknown>) {
    this.stack = [data];
  }

  push(data: Record<string, unknown>): Context {
    const ctx = new Context({});
    ctx.stack.length = 0;
    ctx.stack.push(...this.stack, data);
    return ctx;
  }

  lookup(name: string): unknown {
    if (name === '.') {
      return this.stack[this.stack.length - 1];
    }

    const parts = name.split('.');

    // Walk stack from top to bottom for the first part
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      if (frame != null && typeof frame === 'object' && parts[0] in frame) {
        let val: unknown = (frame as Record<string, unknown>)[parts[0]];
        // Resolve remaining dot-notation parts
        for (let p = 1; p < parts.length; p++) {
          if (val == null || typeof val !== 'object') return undefined;
          val = (val as Record<string, unknown>)[parts[p]];
        }
        return val;
      }
    }

    return undefined;
  }
}

export function resolveValue(context: Context, name: string): unknown {
  const val = context.lookup(name);
  // Lambda support for variables
  if (typeof val === 'function') {
    return val();
  }
  return val;
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
