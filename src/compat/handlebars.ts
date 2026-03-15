// Handlebars compat layer — drop-in API for handlebars
// API: Handlebars.compile(), Handlebars.precompile(), Handlebars.template(),
// Handlebars.registerHelper(), Handlebars.registerPartial(),
// Handlebars.SafeString, Handlebars.Utils.escapeExpression()

import { tokenize } from '../lexer.js';
import { parse } from '../parser.js';
import { compile as compileAST, RenderFunction, CompileOptions } from '../compiler.js';
import { Context, escapeHtml } from '../runtime.js';
import { HelperRegistry, SafeString, HelperFunction, DataScope } from '../helpers.js';
import { PartialRegistry } from '../partials.js';

const globalHelpers = new HelperRegistry();
const globalPartials = new PartialRegistry();

interface HandlebarsCompileOptions {
  strict?: boolean;
  knownHelpers?: Record<string, boolean>;
  knownHelpersOnly?: boolean;
  data?: boolean;
  noEscape?: boolean;
}

function compileTemplate(
  template: string,
  options?: HandlebarsCompileOptions,
): (context: unknown, runtimeOptions?: RuntimeOptions) => string {
  const tokens = tokenize(template);
  const ast = parse(tokens, template);

  const compileOpts: CompileOptions = {
    helpers: globalHelpers,
    strict: options?.strict,
    knownHelpers: options?.knownHelpers,
    knownHelpersOnly: options?.knownHelpersOnly,
  };

  const partialResolver = (name: string) => {
    const tpl = globalPartials.get(name);
    if (tpl != null) {
      const t = tokenize(tpl);
      return parse(t, tpl);
    }
    return undefined;
  };

  const fn = compileAST(ast, partialResolver, compileOpts);

  return (context: unknown, runtimeOptions?: RuntimeOptions) => {
    const ctx = new Context(context ?? {});

    // Merge runtime partials
    const runtimePartials: Record<string, string | RenderFunction> = {};
    const allPartials = globalPartials.getAll();
    for (const [k, v] of Object.entries(allPartials)) {
      runtimePartials[k] = v;
    }
    if (runtimeOptions?.partials) {
      for (const [k, v] of Object.entries(runtimeOptions.partials)) {
        runtimePartials[k] = v;
      }
    }

    const dataScope: DataScope | undefined = runtimeOptions?.data
      ? { root: context, ...runtimeOptions.data }
      : { root: context };

    return fn(ctx, runtimePartials, dataScope);
  };
}

interface RuntimeOptions {
  partials?: Record<string, string>;
  helpers?: Record<string, HelperFunction>;
  data?: Record<string, unknown>;
}

const Handlebars = {
  VERSION: '4.7.8' as const,

  compile: compileTemplate,

  precompile(template: string, _options?: HandlebarsCompileOptions): string {
    // Return a serialized form — for now, just return the template
    // Real precompilation would emit JS code
    return JSON.stringify({ template });
  },

  template(spec: unknown): (context: unknown) => string {
    if (typeof spec === 'object' && spec !== null && 'template' in spec) {
      return compileTemplate((spec as { template: string }).template);
    }
    throw new Error('Invalid precompiled template');
  },

  registerHelper(name: string | Record<string, HelperFunction>, fn?: HelperFunction): void {
    if (typeof name === 'object') {
      for (const [k, v] of Object.entries(name)) {
        globalHelpers.register(k, v);
      }
    } else if (fn) {
      globalHelpers.register(name, fn);
    }
  },

  unregisterHelper(name: string): void {
    globalHelpers.unregister(name);
  },

  registerPartial(name: string | Record<string, string>, template?: string): void {
    if (typeof name === 'object') {
      for (const [k, v] of Object.entries(name)) {
        globalPartials.register(k, v);
      }
    } else if (template != null) {
      globalPartials.register(name, template);
    }
  },

  unregisterPartial(name: string): void {
    globalPartials.unregister(name);
  },

  SafeString,

  Utils: {
    escapeExpression: escapeHtml,
    isEmpty(value: unknown): boolean {
      if (value == null) return true;
      if (typeof value === 'boolean') return !value;
      if (typeof value === 'number') return value === 0;
      if (typeof value === 'string') return value === '';
      if (Array.isArray(value)) return value.length === 0;
      return false;
    },
    extend<T extends object>(obj: T, ...sources: object[]): T {
      for (const source of sources) {
        Object.assign(obj, source);
      }
      return obj;
    },
    toString(value: unknown): string {
      if (value == null) return '';
      return String(value);
    },
    isArray: Array.isArray,
    isFunction(value: unknown): value is Function {
      return typeof value === 'function';
    },
  },

  create(): Record<string, unknown> {
    // Create an isolated instance — simplified for now
    return { ...Handlebars } as Record<string, unknown>;
  },

  // Expose internal helpers/partials for testing
  helpers: globalHelpers,
  partials: globalPartials,
};

export default Handlebars;
export { Handlebars };
