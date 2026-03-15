// Helpers engine — Handlebars-compatible helper registration and invocation
// Placeholder for Phase 3

export interface HelperOptions {
  fn: (context: unknown) => string;
  inverse: (context: unknown) => string;
  hash: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export type HelperFunction = (
  ...args: [...unknown[], HelperOptions]
) => string;

export class HelperRegistry {
  private helpers = new Map<string, HelperFunction>();

  register(name: string, fn: HelperFunction): void {
    this.helpers.set(name, fn);
  }

  unregister(name: string): void {
    this.helpers.delete(name);
  }

  get(name: string): HelperFunction | undefined {
    return this.helpers.get(name);
  }

  has(name: string): boolean {
    return this.helpers.has(name);
  }
}
