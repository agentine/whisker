// whisker — Drop-in template engine replacing mustache.js and handlebars

export { tokenize, TokenType } from './lexer.js';
export type { Token } from './lexer.js';
export { parse, NodeType } from './parser.js';
export type {
  RootNode,
  ASTNode,
  TextNode,
  VariableNode,
  UnescapedVariableNode,
  SectionNode,
  InvertedSectionNode,
  CommentNode,
  PartialNode,
} from './parser.js';
export { compile } from './compiler.js';
export type { RenderFunction } from './compiler.js';
export { Context, resolveValue, escapeHtml } from './runtime.js';
export { HelperRegistry } from './helpers.js';
export type { HelperOptions, HelperFunction } from './helpers.js';
export { PartialRegistry } from './partials.js';

import { tokenize } from './lexer.js';
import { parse } from './parser.js';
import { compile, RenderFunction } from './compiler.js';
import { Context } from './runtime.js';

/**
 * Render a template string with the given data and optional partials.
 */
export function render(
  template: string,
  data: Record<string, unknown>,
  partials?: Record<string, string | RenderFunction>,
): string {
  const tokens = tokenize(template);
  const ast = parse(tokens);
  const fn = compile(ast, (name) => {
    if (partials && typeof partials[name] === 'string') {
      const t = tokenize(partials[name] as string);
      return parse(t);
    }
    return undefined;
  });
  return fn(new Context(data), partials);
}
