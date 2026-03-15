// Mustache compat layer — drop-in API for mustache.js
// API: Mustache.render(), Mustache.parse(), Mustache.clearCache(), Mustache.escape, Mustache.tags, Mustache.Writer

import { tokenize } from '../lexer.js';
import { parse as parseAST, NodeType, ASTNode, RootNode } from '../parser.js';
import { compile, RenderFunction } from '../compiler.js';
import { Context, escapeHtml } from '../runtime.js';

type MustacheToken = [string, string, number, number, (MustacheToken[] | undefined)?, number?];

const cache = new Map<string, { ast: RootNode; parsed: MustacheToken[] }>();

function getCached(template: string, tags?: [string, string]) {
  const key = template + (tags ? tags.join('') : '');
  let entry = cache.get(key);
  if (!entry) {
    const [openTag, closeTag] = tags ?? ['{{', '}}'];
    const tokens = tokenize(template, openTag, closeTag);
    const ast = parseAST(tokens, template);
    const parsed = astToMustacheTokens(ast.children, template);
    entry = { ast, parsed };
    cache.set(key, entry);
  }
  return entry;
}

function astToMustacheTokens(nodes: ASTNode[], _template: string): MustacheToken[] {
  const result: MustacheToken[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case NodeType.Text:
        result.push(['text', node.value, 0, node.value.length]);
        break;
      case NodeType.Variable:
        result.push(['name', node.name, 0, 0]);
        break;
      case NodeType.UnescapedVariable:
        result.push(['&', node.name, 0, 0]);
        break;
      case NodeType.Section: {
        const children = astToMustacheTokens(node.children, _template);
        result.push(['#', node.name, 0, 0, children]);
        break;
      }
      case NodeType.InvertedSection: {
        const children = astToMustacheTokens(node.children, _template);
        result.push(['^', node.name, 0, 0, children]);
        break;
      }
      case NodeType.Comment:
        result.push(['!', node.value, 0, 0]);
        break;
      case NodeType.Partial:
        result.push(['>', node.name, 0, 0]);
        break;
    }
  }
  return result;
}

class Writer {
  private _cache = new Map<string, RenderFunction>();

  clearCache(): void {
    this._cache.clear();
  }

  parse(template: string, tags?: [string, string]): MustacheToken[] {
    return getCached(template, tags).parsed;
  }

  render(
    template: string,
    view: unknown,
    partials?: Record<string, string> | ((name: string) => string | undefined),
    config?: { tags?: [string, string] } | string,
  ): string {
    const tags = typeof config === 'string'
      ? undefined
      : config?.tags;
    const entry = getCached(template, tags);

    const resolvedPartials: Record<string, string> = {};
    if (typeof partials === 'function') {
      // Lazy partial resolver — we'll handle in the partial resolver
    } else if (partials) {
      Object.assign(resolvedPartials, partials);
    }

    const partialResolver = (name: string) => {
      let tpl: string | undefined;
      if (typeof partials === 'function') {
        tpl = partials(name);
      } else if (partials) {
        tpl = partials[name];
      }
      if (tpl != null) {
        const e = getCached(tpl);
        return e.ast;
      }
      return undefined;
    };

    const fn = compile(entry.ast, partialResolver);
    return fn(new Context(view ?? {}), resolvedPartials);
  }
}

const defaultWriter = new Writer();

const Mustache = {
  name: 'mustache.js' as const,
  version: '4.2.0' as const,
  tags: ['{{', '}}'] as [string, string],

  escape: escapeHtml,

  clearCache(): void {
    cache.clear();
    defaultWriter.clearCache();
  },

  parse(template: string, tags?: [string, string]): MustacheToken[] {
    return getCached(template, tags ?? (Mustache.tags as [string, string])).parsed;
  },

  render(
    template: string,
    view: unknown,
    partials?: Record<string, string> | ((name: string) => string | undefined),
    config?: { tags?: [string, string] } | string,
  ): string {
    return defaultWriter.render(template, view, partials, config);
  },

  Scanner: class {},
  Context: Context,
  Writer,
};

export default Mustache;
export { Mustache };
