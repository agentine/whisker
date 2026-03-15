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
export type { RenderFunction, CompileOptions } from './compiler.js';
export { Context, resolveValue, escapeHtml } from './runtime.js';
export { HelperRegistry, SafeString } from './helpers.js';
export type { HelperOptions, HelperFunction, DataScope } from './helpers.js';
export { PartialRegistry } from './partials.js';
export { parseExpression } from './expression.js';
export type {
  Expression,
  PathExpression,
  LiteralExpression,
  SubExpression,
  ExpressionNode,
  HashPair,
  ParsedExpression,
} from './expression.js';

import { tokenize } from './lexer.js';
import { parse } from './parser.js';
import { compile, RenderFunction, CompileOptions } from './compiler.js';
import { Context } from './runtime.js';
import { HelperRegistry } from './helpers.js';

export interface RenderOptions {
  helpers?: HelperRegistry;
  strict?: boolean;
}

/**
 * Render a template string with the given data and optional partials.
 */
export function render(
  template: string,
  data: Record<string, unknown>,
  partials?: Record<string, string | RenderFunction>,
  options?: RenderOptions,
): string {
  const compileOpts: CompileOptions = {
    helpers: options?.helpers,
    strict: options?.strict,
  };
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
    compileOpts,
  );
  return fn(new Context(data), partials);
}
