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

export type RenderFunction = (
  context: Context,
  partials?: Record<string, string | RenderFunction>,
) => string;

export function compile(
  ast: RootNode,
  partialResolver?: (name: string) => RootNode | undefined,
): RenderFunction {
  const renderNodes = compileNodes(ast.children, partialResolver);
  return (context, partials) => renderNodes(context, partials);
}

type NodeFn = (
  context: Context,
  partials?: Record<string, string | RenderFunction>,
) => string;

function compileNodes(
  nodes: ASTNode[],
  partialResolver?: (name: string) => RootNode | undefined,
): NodeFn {
  const fns = nodes.map((node) => compileNode(node, partialResolver));
  return (context, partials) => {
    let result = '';
    for (const fn of fns) {
      result += fn(context, partials);
    }
    return result;
  };
}

function compileNode(
  node: ASTNode,
  partialResolver?: (name: string) => RootNode | undefined,
): NodeFn {
  switch (node.type) {
    case NodeType.Text:
      return () => node.value;

    case NodeType.Variable:
      return (context, partials) => {
        const val = resolveValue(context, node.name);
        if (val == null) return '';
        if (typeof val === 'function') {
          // Lambda: call, re-parse, render, then escape
          const raw = String(val());
          const tokens = tokenize(raw);
          const ast = parse(tokens, raw);
          const fn = compile(ast, partialResolver);
          return escapeHtml(fn(context, partials));
        }
        return escapeHtml(String(val));
      };

    case NodeType.UnescapedVariable:
      return (context, partials) => {
        const val = resolveValue(context, node.name);
        if (val == null) return '';
        if (typeof val === 'function') {
          const raw = String(val());
          const tokens = tokenize(raw);
          const ast = parse(tokens, raw);
          const fn = compile(ast, partialResolver);
          return fn(context, partials);
        }
        return String(val);
      };

    case NodeType.Section:
      return compileSectionNode(node, partialResolver);

    case NodeType.InvertedSection:
      return compileInvertedSectionNode(node, partialResolver);

    case NodeType.Comment:
      return () => '';

    case NodeType.Partial:
      return compilePartialNode(node, partialResolver);
  }
}

function compileSectionNode(
  node: SectionNode,
  partialResolver?: (name: string) => RootNode | undefined,
): NodeFn {
  const renderChildren = compileNodes(node.children, partialResolver);
  return (context, partials) => {
    const val = resolveValue(context, node.name);

    // Lambda support for sections
    if (typeof val === 'function') {
      // Per Mustache spec: lambda receives the raw block text
      // and the result is rendered with the current context
      const rawBlock = node.rawBlock ?? '';
      const lambdaResult = val(rawBlock);
      if (lambdaResult == null) return '';
      // Re-parse and render the lambda result with current delimiters
      const resultStr = String(lambdaResult);
      const [openDelim, closeDelim] = node.delimiters ?? ['{{', '}}'];
      const tokens = tokenize(resultStr, openDelim, closeDelim);
      const ast = parse(tokens, resultStr);
      const fn = compile(ast, partialResolver);
      return fn(context, partials);
    }

    if (val == null || val === false) return '';
    if (val === 0 || val === '') return '';

    if (Array.isArray(val)) {
      if (val.length === 0) return '';
      let result = '';
      for (let i = 0; i < val.length; i++) {
        // Push item directly — Context.lookup('.') returns top of stack
        result += renderChildren(context.push(val[i]), partials);
      }
      return result;
    }

    if (typeof val === 'object') {
      return renderChildren(context.push(val as Record<string, unknown>), partials);
    }

    // Truthy primitive (true, non-zero number, non-empty string)
    // Per Mustache spec: push value onto context stack so {{.}} resolves
    return renderChildren(context.push(val), partials);
  };
}

function compileInvertedSectionNode(
  node: InvertedSectionNode,
  partialResolver?: (name: string) => RootNode | undefined,
): NodeFn {
  const renderChildren = compileNodes(node.children, partialResolver);
  return (context, partials) => {
    const val = resolveValue(context, node.name);
    if (val == null || val === false || val === 0 || val === '') {
      return renderChildren(context, partials);
    }
    if (Array.isArray(val) && val.length === 0) {
      return renderChildren(context, partials);
    }
    return '';
  };
}

function compilePartialNode(
  node: { name: string; indent: string },
  partialResolver?: (name: string) => RootNode | undefined,
): NodeFn {
  return (context, partials) => {
    let partialTemplate: string | undefined;

    // Check runtime partials first
    if (partials && partials[node.name]) {
      const partial = partials[node.name];
      if (typeof partial === 'function') {
        let result = partial(context, partials);
        if (node.indent) result = indentPartial(result, node.indent);
        return result;
      }
      partialTemplate = partial;
    }

    // Try static partial resolver
    if (partialTemplate == null && partialResolver) {
      const partialAst = partialResolver(node.name);
      if (partialAst) {
        const fn = compile(partialAst, partialResolver);
        let result = fn(context, partials);
        if (node.indent) result = indentPartial(result, node.indent);
        return result;
      }
    }

    if (partialTemplate != null) {
      // Indent the partial template before parsing (per spec)
      let tpl = partialTemplate;
      if (node.indent) {
        tpl = indentPartialTemplate(tpl, node.indent);
      }
      const tokens = tokenize(tpl);
      const ast = parse(tokens, tpl);
      const fn = compile(ast, partialResolver);
      return fn(context, partials);
    }

    return '';
  };
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
  // Per Mustache spec: each line of the partial should be indented
  const lines = template.split('\n');
  return lines
    .map((line, i) => {
      if (i === 0) return indent + line;
      if (i === lines.length - 1 && line === '') return line;
      return indent + line;
    })
    .join('\n');
}
