// Helpers engine — Handlebars-compatible helper registration and invocation

export interface HelperOptions {
  fn: (context: unknown, options?: { data?: DataScope }) => string;
  inverse: (context: unknown, options?: { data?: DataScope }) => string;
  hash: Record<string, unknown>;
  data?: DataScope;
  name: string;
}

export type HelperFunction = (
  this: unknown,
  ...args: unknown[]
) => unknown;

export interface DataScope {
  index?: number;
  key?: string | number;
  first?: boolean;
  last?: boolean;
  root?: unknown;
  [key: string]: unknown;
}

export class HelperRegistry {
  private helpers = new Map<string, HelperFunction>();

  constructor() {
    // Register built-in helpers
    this.registerBuiltins();
  }

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

  private registerBuiltins(): void {
    // {{#if condition}}...{{else}}...{{/if}}
    this.helpers.set('if', function (this: unknown, conditional: unknown, options: HelperOptions) {
      const val = conditional;
      if (
        val === false ||
        val == null ||
        val === '' ||
        val === 0 ||
        (Array.isArray(val) && val.length === 0)
      ) {
        return options.inverse(this);
      }
      return options.fn(this);
    } as HelperFunction);

    // {{#unless condition}}...{{/unless}}
    this.helpers.set('unless', function (this: unknown, conditional: unknown, options: HelperOptions) {
      const val = conditional;
      if (
        val === false ||
        val == null ||
        val === '' ||
        val === 0 ||
        (Array.isArray(val) && val.length === 0)
      ) {
        return options.fn(this);
      }
      return options.inverse(this);
    } as HelperFunction);

    // {{#each array}}...{{/each}}
    this.helpers.set('each', function (this: unknown, context: unknown, options: HelperOptions) {
      if (context == null) return options.inverse(this);

      let result = '';
      const data = options.data ? { ...options.data } : {};

      if (Array.isArray(context)) {
        if (context.length === 0) return options.inverse(this);
        for (let i = 0; i < context.length; i++) {
          const itemData: DataScope = {
            ...data,
            index: i,
            key: i,
            first: i === 0,
            last: i === context.length - 1,
          };
          result += options.fn(context[i], { data: itemData });
        }
      } else if (typeof context === 'object') {
        const keys = Object.keys(context as Record<string, unknown>);
        if (keys.length === 0) return options.inverse(this);
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const itemData: DataScope = {
            ...data,
            key,
            index: i,
            first: i === 0,
            last: i === keys.length - 1,
          };
          result += options.fn((context as Record<string, unknown>)[key], { data: itemData });
        }
      } else {
        return options.inverse(this);
      }

      return result;
    } as HelperFunction);

    // {{#with context}}...{{/with}}
    this.helpers.set('with', function (this: unknown, context: unknown, options: HelperOptions) {
      if (context == null || context === false) {
        return options.inverse(this);
      }
      return options.fn(context);
    } as HelperFunction);

    // {{lookup obj key}}
    this.helpers.set('lookup', function (_obj: unknown, key: unknown) {
      if (_obj == null) return undefined;
      if (typeof _obj === 'object') {
        return (_obj as Record<string, unknown>)[String(key)];
      }
      return undefined;
    } as HelperFunction);

    // {{log ...args}}
    this.helpers.set('log', function (...args: unknown[]) {
      // Remove the options argument
      args.pop();
      console.log(...args);
      return '';
    } as HelperFunction);
  }
}

export class SafeString {
  private value: string;
  constructor(value: string) {
    this.value = value;
  }
  toString(): string {
    return this.value;
  }
  toHTML(): string {
    return this.value;
  }
}
