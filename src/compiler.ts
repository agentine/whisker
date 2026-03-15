// Compiler — compiles AST to render functions

import { tokenize } from './lexer.js';
import {
  ASTNode,
  NodeType,
  RootNode,
  SectionNode,
  InvertedSectionNode,
  parse,
} from './parser.js';
import { Context, resolveValue, escapeHtml } from './runtime.js';
import { parseExpression, ExpressionNode, PathExpression } from './expression.js';
import { HelperRegistry, HelperOptions, SafeString, DataScope } from './helpers.js';

export type RenderFunction = (
  context: Context,
  partials?: Record<string, string | RenderFunction>,
  data?: DataScope,
) => string;

export interface CompileOptions {
  helpers?: HelperRegistry;
  strict?: boolean;
  knownHelpers?: Record<string, boolean>;
  knownHelpersOnly?: boolean;
}

export function compile(
  ast: RootNode,
  partialResolver?: (name: string) => RootNode | undefined,
  options?: CompileOptions,
): RenderFunction {
  const helpers = options?.helpers;
  const renderNodes = compileNodes(ast.children, partialResolver, helpers);
  return (context, partials, data) => renderNodes(context, partials, data);
}

type NodeFn = (
  context: Context,
  partials?: Record<string, string | RenderFunction>,
  data?: DataScope,
) => string;

function compileNodes(
  nodes: ASTNode[],
  partialResolver?: (name: string) => RootNode | undefined,
  helpers?: HelperRegistry,
): NodeFn {
  const fns = nodes.map((node) => compileNode(node, partialResolver, helpers));
  return (context, partials, data) => {
    let result = '';
    for (const fn of fns) {
      result += fn(context, partials, data);
    }
    return result;
  };
}

function compileNode(
  node: ASTNode,
  partialResolver?: (name: string) => RootNode | undefined,
  helpers?: HelperRegistry,
): NodeFn {
  switch (node.type) {
    case NodeType.Text:
      return () => node.value;

    case NodeType.Variable:
      return compileVariableNode(node.name, true, partialResolver, helpers);

    case NodeType.UnescapedVariable:
      return compileVariableNode(node.name, false, partialResolver, helpers);

    case NodeType.Section:
      return compileSectionNode(node, partialResolver, helpers);

    case NodeType.InvertedSection:
      return compileInvertedSectionNode(node, partialResolver, helpers);

    case NodeType.Comment:
      return () => '';

    case NodeType.Partial:
      return compilePartialNode(node, partialResolver, helpers);
  }
}

function compileVariableNode(
  name: string,
  escape: boolean,
  partialResolver?: (name: string) => RootNode | undefined,
  helpers?: HelperRegistry,
): NodeFn {
  // Check if this is a helper call (has params or is a known helper)
  const hasParams = /\s/.test(name.trim());

  if (hasParams && helpers) {
    const expr = parseExpression(name);
    const helperName = expr.path.original;
    return (context, partials, data) => {
      const helper = helpers.get(helperName);
      if (helper) {
        const params = expr.params.map((p) => resolveExpr(p, context, data));
        const hash = resolveHash(expr.hash, context, data);
        const options: HelperOptions = {
          fn: () => '',
          inverse: () => '',
          hash,
          data,
          name: helperName,
        };
        const result = helper.call(context.top(), ...params, options);
        return formatResult(result, escape);
      }
      // Fall through to variable resolution
      const val = resolveValue(context, helperName);
      if (val == null) return '';
      return escape ? escapeHtml(String(val)) : String(val);
    };
  }

  return (context, partials, data) => {
    // Check for @data variables
    if (name.startsWith('@') && data) {
      const dataKey = name.slice(1);
      const val = data[dataKey];
      if (val != null) return escape ? escapeHtml(String(val)) : String(val);
      return '';
    }

    // Check if it's a helper with no params
    if (helpers?.has(name)) {
      const helper = helpers.get(name)!;
      const options: HelperOptions = {
        fn: () => '',
        inverse: () => '',
        hash: {},
        data,
        name,
      };
      const result = helper.call(context.top(), options);
      return formatResult(result, escape);
    }

    const val = resolveValue(context, name);
    if (val == null) return '';
    if (typeof val === 'function') {
      // Lambda: call, re-parse, render
      const raw = String(val());
      const tokens = tokenize(raw);
      const ast = parse(tokens, raw);
      const fn = compile(ast, partialResolver);
      const rendered = fn(context, partials, data);
      return escape ? escapeHtml(rendered) : rendered;
    }
    return escape ? escapeHtml(String(val)) : String(val);
  };
}

function compileSectionNode(
  node: SectionNode,
  partialResolver?: (name: string) => RootNode | undefined,
  helpers?: HelperRegistry,
): NodeFn {
  const renderChildren = compileNodes(node.children, partialResolver, helpers);

  // Check if this is a helper call
  const hasParams = /\s/.test(node.name.trim());
  let expr: ReturnType<typeof parseExpression> | null = null;
  if (hasParams) {
    expr = parseExpression(node.name);
  }

  return (context, partials, data) => {
    const helperName = expr?.path.original ?? node.name;

    // Check for block helper
    if (helpers?.has(helperName)) {
      const helper = helpers.get(helperName)!;
      const params = expr
        ? expr.params.map((p) => resolveExpr(p, context, data))
        : [];
      const hash = expr ? resolveHash(expr.hash, context, data) : {};

      // Note: for block helpers with no params (e.g. {{#bold}}), params stays empty.
      // The helper receives only the options object.

      const options: HelperOptions = {
        fn: (ctx: unknown, opts?: { data?: DataScope }) => {
          const childCtx =
            ctx === context.top() || ctx == null
              ? context
              : context.push(ctx as Record<string, unknown>);
          return renderChildren(childCtx, partials, opts?.data ?? data);
        },
        inverse: () => '',
        hash,
        data,
        name: helperName,
      };
      const result = helper.call(context.top(), ...params, options);
      return result == null ? '' : String(result);
    }

    // Standard Mustache section behavior
    // If the name has params (e.g. "each people"), resolve using just the first word
    const sectionName = expr ? expr.path.original : node.name;
    const val = resolveValue(context, sectionName);

    // Lambda support for sections
    if (typeof val === 'function') {
      const rawBlock = node.rawBlock ?? '';
      const lambdaResult = val(rawBlock);
      if (lambdaResult == null) return '';
      const resultStr = String(lambdaResult);
      const [openDelim, closeDelim] = node.delimiters ?? ['{{', '}}'];
      const tokens = tokenize(resultStr, openDelim, closeDelim);
      const ast = parse(tokens, resultStr);
      const fn = compile(ast, partialResolver);
      return fn(context, partials, data);
    }

    if (val == null || val === false) return '';
    if (val === 0 || val === '') return '';

    if (Array.isArray(val)) {
      if (val.length === 0) return '';
      let result = '';
      for (let i = 0; i < val.length; i++) {
        const itemData: DataScope = {
          ...data,
          index: i,
          key: i,
          first: i === 0,
          last: i === val.length - 1,
        };
        result += renderChildren(context.push(val[i]), partials, itemData);
      }
      return result;
    }

    if (typeof val === 'object') {
      return renderChildren(context.push(val as Record<string, unknown>), partials, data);
    }

    // Truthy primitive
    return renderChildren(context.push(val), partials, data);
  };
}

function compileInvertedSectionNode(
  node: InvertedSectionNode,
  partialResolver?: (name: string) => RootNode | undefined,
  helpers?: HelperRegistry,
): NodeFn {
  const renderChildren = compileNodes(node.children, partialResolver, helpers);
  return (context, partials, data) => {
    // Check for block helper inverse (e.g., {{^each}})
    if (helpers?.has(node.name)) {
      const val = resolveValue(context, node.name);
      if (val == null || val === false || (Array.isArray(val) && val.length === 0)) {
        return renderChildren(context, partials, data);
      }
      return '';
    }

    const val = resolveValue(context, node.name);
    if (val == null || val === false || val === 0 || val === '') {
      return renderChildren(context, partials, data);
    }
    if (Array.isArray(val) && val.length === 0) {
      return renderChildren(context, partials, data);
    }
    return '';
  };
}

function compilePartialNode(
  node: { name: string; indent: string },
  partialResolver?: (name: string) => RootNode | undefined,
  helpers?: HelperRegistry,
): NodeFn {
  return (context, partials, data) => {
    let partialTemplate: string | undefined;

    if (partials && partials[node.name]) {
      const partial = partials[node.name];
      if (typeof partial === 'function') {
        let result = partial(context, partials, data);
        if (node.indent) result = indentPartial(result, node.indent);
        return result;
      }
      partialTemplate = partial;
    }

    if (partialTemplate == null && partialResolver) {
      const partialAst = partialResolver(node.name);
      if (partialAst) {
        const fn = compile(partialAst, partialResolver, { helpers });
        let result = fn(context, partials, data);
        if (node.indent) result = indentPartial(result, node.indent);
        return result;
      }
    }

    if (partialTemplate != null) {
      let tpl = partialTemplate;
      if (node.indent) {
        tpl = indentPartialTemplate(tpl, node.indent);
      }
      const tokens = tokenize(tpl);
      const ast = parse(tokens, tpl);
      const fn = compile(ast, partialResolver, { helpers });
      return fn(context, partials, data);
    }

    return '';
  };
}

function resolveExpr(expr: ExpressionNode, context: Context, data?: DataScope): unknown {
  switch (expr.type) {
    case 'literal':
      return expr.value;
    case 'path':
      return resolvePath(expr, context, data);
    case 'subexpression':
      // Subexpressions are not fully supported in this pass
      return resolvePath(expr.path, context, data);
  }
}

function resolvePath(path: PathExpression, context: Context, data?: DataScope): unknown {
  // @data variable
  if (path.original.startsWith('@') && data) {
    const key = path.parts[0]?.slice(1) ?? path.original.slice(1);
    return data[key];
  }

  // Handle ../ (parent scope)
  if (path.depth > 0) {
    return context.lookupAtDepth(path.parts.join('.'), path.depth);
  }

  return resolveValue(context, path.parts.join('.'));
}

function resolveHash(
  hashPairs: { key: string; value: ExpressionNode }[],
  context: Context,
  data?: DataScope,
): Record<string, unknown> {
  const hash: Record<string, unknown> = {};
  for (const pair of hashPairs) {
    hash[pair.key] = resolveExpr(pair.value, context, data);
  }
  return hash;
}

function formatResult(result: unknown, escape: boolean): string {
  if (result == null) return '';
  if (result instanceof SafeString) return result.toString();
  const str = String(result);
  return escape ? escapeHtml(str) : str;
}

function indentPartial(output: string, indent: string): string {
  if (!indent) return output;
  const lines = output.split('\n');
  return lines
    .map((line, i) => {
      if (i === 0) return line;
      if (i === lines.length - 1 && line === '') return line;
      return indent + line;
    })
    .join('\n');
}

function indentPartialTemplate(template: string, indent: string): string {
  if (!indent) return template;
  const lines = template.split('\n');
  return lines
    .map((line, i) => {
      if (i === 0) return indent + line;
      if (i === lines.length - 1 && line === '') return line;
      return indent + line;
    })
    .join('\n');
}
