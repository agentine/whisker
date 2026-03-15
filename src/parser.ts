// Parser — builds AST from token stream

import { Token, TokenType } from './lexer.js';

export enum NodeType {
  Root = 'root',
  Text = 'text',
  Variable = 'variable',
  UnescapedVariable = 'unescaped_variable',
  Section = 'section',
  InvertedSection = 'inverted_section',
  Comment = 'comment',
  Partial = 'partial',
}

export interface TextNode {
  type: NodeType.Text;
  value: string;
}

export interface VariableNode {
  type: NodeType.Variable;
  name: string;
}

export interface UnescapedVariableNode {
  type: NodeType.UnescapedVariable;
  name: string;
}

export interface SectionNode {
  type: NodeType.Section;
  name: string;
  children: ASTNode[];
}

export interface InvertedSectionNode {
  type: NodeType.InvertedSection;
  name: string;
  children: ASTNode[];
}

export interface CommentNode {
  type: NodeType.Comment;
  value: string;
}

export interface PartialNode {
  type: NodeType.Partial;
  name: string;
  indent: string;
}

export interface RootNode {
  type: NodeType.Root;
  children: ASTNode[];
}

export type ASTNode =
  | TextNode
  | VariableNode
  | UnescapedVariableNode
  | SectionNode
  | InvertedSectionNode
  | CommentNode
  | PartialNode;

export function parse(tokens: Token[]): RootNode {
  const root: RootNode = { type: NodeType.Root, children: [] };
  const stack: { node: SectionNode | InvertedSectionNode; name: string }[] = [];
  let current: ASTNode[] = root.children;

  for (const token of tokens) {
    switch (token.type) {
      case TokenType.Text:
        current.push({ type: NodeType.Text, value: token.value });
        break;

      case TokenType.Variable:
        current.push({ type: NodeType.Variable, name: token.value });
        break;

      case TokenType.UnescapedVariable:
        current.push({ type: NodeType.UnescapedVariable, name: token.value });
        break;

      case TokenType.SectionOpen: {
        const node: SectionNode = {
          type: NodeType.Section,
          name: token.value,
          children: [],
        };
        current.push(node);
        stack.push({ node, name: token.value });
        current = node.children;
        break;
      }

      case TokenType.InvertedSectionOpen: {
        const node: InvertedSectionNode = {
          type: NodeType.InvertedSection,
          name: token.value,
          children: [],
        };
        current.push(node);
        stack.push({ node, name: token.value });
        current = node.children;
        break;
      }

      case TokenType.SectionClose: {
        if (stack.length === 0) {
          throw new Error(`Unexpected closing tag: ${token.value}`);
        }
        const top = stack[stack.length - 1];
        if (top.name !== token.value) {
          throw new Error(
            `Mismatched section tags: opened "${top.name}" but closed "${token.value}"`,
          );
        }
        stack.pop();
        current =
          stack.length > 0
            ? stack[stack.length - 1].node.children
            : root.children;
        break;
      }

      case TokenType.Comment:
        current.push({ type: NodeType.Comment, value: token.value });
        break;

      case TokenType.Partial:
        current.push({
          type: NodeType.Partial,
          name: token.value,
          indent: token.indent ?? '',
        });
        break;

      case TokenType.SetDelimiter:
        // Already handled by lexer
        break;
    }
  }

  if (stack.length > 0) {
    throw new Error(`Unclosed section: "${stack[stack.length - 1].name}"`);
  }

  return root;
}
