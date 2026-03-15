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
  partialResolver?: (
    name: string,
  ) => RootNode | undefined,
): RenderFunction {
  const renderNodes = compileNodes(ast.children, partialResolver);
  return (context: Context, partials?: Record<string, string | RenderFunction>) => {
    return renderNodes(context, partials);
  };
}

function compileNodes(
  nodes: ASTNode[],
  partialResolver?: (name: string) => RootNode | undefined,
): (context: Context, partials?: Record<string, string | RenderFunction>) => string {
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
): (context: Context, partials?: Record<string, string | RenderFunction>) => string {
  switch (node.type) {
    case NodeType.Text:
      return () => node.value;

    case NodeType.Variable:
      return (context) => {
        const val = resolveValue(context, node.name);
        if (val == null) return '';
        return escapeHtml(String(val));
      };

    case NodeType.UnescapedVariable:
      return (context) => {
        const val = resolveValue(context, node.name);
        if (val == null) return '';
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
): (context: Context, partials?: Record<string, string | RenderFunction>) => string {
  const renderChildren = compileNodes(node.children, partialResolver);
  return (context, partials) => {
    const val = resolveValue(context, node.name);

    // Lambda support
    if (typeof val === 'function') {
      // For sections, the lambda receives the raw block text
      // We pass the rendered children for now (simplified)
      const result = val(renderChildren(context, partials));
      return result == null ? '' : String(result);
    }

    if (val == null || val === false) return '';
    if (val === true || typeof val === 'number' || typeof val === 'string') {
      return renderChildren(context, partials);
    }

    if (Array.isArray(val)) {
      let result = '';
      for (let i = 0; i < val.length; i++) {
        result += renderChildren(context.push(val[i]), partials);
      }
      return result;
    }

    if (typeof val === 'object') {
      return renderChildren(context.push(val as Record<string, unknown>), partials);
    }

    return renderChildren(context, partials);
  };
}

function compileInvertedSectionNode(
  node: InvertedSectionNode,
  partialResolver?: (name: string) => RootNode | undefined,
): (context: Context, partials?: Record<string, string | RenderFunction>) => string {
  const renderChildren = compileNodes(node.children, partialResolver);
  return (context, partials) => {
    const val = resolveValue(context, node.name);
    if (!val || (Array.isArray(val) && val.length === 0)) {
      return renderChildren(context, partials);
    }
    return '';
  };
}

function compilePartialNode(
  node: { name: string; indent: string },
  partialResolver?: (name: string) => RootNode | undefined,
): (context: Context, partials?: Record<string, string | RenderFunction>) => string {
  return (context, partials) => {
    // Check runtime partials first
    if (partials && partials[node.name]) {
      const partial = partials[node.name];
      if (typeof partial === 'function') {
        let result = partial(context, partials);
        if (node.indent) {
          result = indentPartial(result, node.indent);
        }
        return result;
      }
      // String partial — need to compile
      const tokens = tokenize(partial);
      const ast = parse(tokens);
      const fn = compile(ast, partialResolver);
      let result = fn(context, partials);
      if (node.indent) {
        result = indentPartial(result, node.indent);
      }
      return result;
    }

    // Try static partial resolver
    if (partialResolver) {
      const partialAst = partialResolver(node.name);
      if (partialAst) {
        const fn = compile(partialAst, partialResolver);
        let result = fn(context, partials);
        if (node.indent) {
          result = indentPartial(result, node.indent);
        }
        return result;
      }
    }

    return '';
  };
}

function indentPartial(output: string, indent: string): string {
  if (!indent) return output;
  // Indent each line of partial output (except the last if it's empty)
  const lines = output.split('\n');
  return lines
    .map((line, i) => {
      if (i === 0) return line;
      if (i === lines.length - 1 && line === '') return line;
      return indent + line;
    })
    .join('\n');
}
