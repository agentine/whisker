// Expression parser for Handlebars-style expressions
// Handles: helper calls, arguments, hash pairs, subexpressions, string/number literals

export interface Expression {
  type: 'path' | 'literal' | 'subexpression';
}

export interface PathExpression extends Expression {
  type: 'path';
  original: string;
  parts: string[];
  depth: number; // Number of ../ segments
}

export interface LiteralExpression extends Expression {
  type: 'literal';
  value: string | number | boolean | null;
}

export interface SubExpression extends Expression {
  type: 'subexpression';
  path: PathExpression;
  params: ExpressionNode[];
  hash: HashPair[];
}

export type ExpressionNode = PathExpression | LiteralExpression | SubExpression;

export interface HashPair {
  key: string;
  value: ExpressionNode;
}

export interface ParsedExpression {
  path: PathExpression;
  params: ExpressionNode[];
  hash: HashPair[];
}

export function parseExpression(input: string): ParsedExpression {
  const parser = new ExpressionParser(input);
  return parser.parse();
}

class ExpressionParser {
  private input: string;
  private pos: number;

  constructor(input: string) {
    this.input = input;
    this.pos = 0;
  }

  parse(): ParsedExpression {
    this.skipWhitespace();
    const path = this.parsePath();
    const params: ExpressionNode[] = [];
    const hash: HashPair[] = [];

    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      // Check for hash pair (key=value)
      const saved = this.pos;
      const maybeKey = this.tryParseId();
      if (maybeKey && this.pos < this.input.length && this.input[this.pos] === '=') {
        this.pos++; // skip =
        const value = this.parseParam();
        hash.push({ key: maybeKey, value });
        continue;
      }
      this.pos = saved;

      // Parse as positional param
      const param = this.parseParam();
      params.push(param);
    }

    return { path, params, hash };
  }

  private parseParam(): ExpressionNode {
    this.skipWhitespace();
    if (this.pos >= this.input.length) {
      throw new Error('Unexpected end of expression');
    }

    const ch = this.input[this.pos];

    // Subexpression
    if (ch === '(') {
      return this.parseSubExpression();
    }

    // String literal
    if (ch === '"' || ch === "'") {
      return this.parseStringLiteral();
    }

    // Number literal
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      const numResult = this.tryParseNumber();
      if (numResult !== null) return numResult;
    }

    // Boolean/null literals
    const word = this.peekWord();
    if (word === 'true') {
      this.pos += 4;
      return { type: 'literal', value: true };
    }
    if (word === 'false') {
      this.pos += 5;
      return { type: 'literal', value: false };
    }
    if (word === 'null') {
      this.pos += 4;
      return { type: 'literal', value: null };
    }
    if (word === 'undefined') {
      this.pos += 9;
      return { type: 'literal', value: null };
    }

    // Path
    return this.parsePath();
  }

  private parseSubExpression(): SubExpression {
    this.pos++; // skip (
    this.skipWhitespace();
    const path = this.parsePath();
    const params: ExpressionNode[] = [];
    const hash: HashPair[] = [];

    while (this.pos < this.input.length && this.input[this.pos] !== ')') {
      this.skipWhitespace();
      if (this.pos >= this.input.length || this.input[this.pos] === ')') break;

      const saved = this.pos;
      const maybeKey = this.tryParseId();
      if (maybeKey && this.pos < this.input.length && this.input[this.pos] === '=') {
        this.pos++;
        const value = this.parseParam();
        hash.push({ key: maybeKey, value });
        continue;
      }
      this.pos = saved;

      params.push(this.parseParam());
    }

    if (this.pos < this.input.length && this.input[this.pos] === ')') {
      this.pos++;
    }

    return { type: 'subexpression', path, params, hash };
  }

  private parsePath(): PathExpression {
    let depth = 0;
    const start = this.pos;

    // Handle ../ prefix
    while (
      this.pos + 2 < this.input.length &&
      this.input[this.pos] === '.' &&
      this.input[this.pos + 1] === '.' &&
      this.input[this.pos + 2] === '/'
    ) {
      depth++;
      this.pos += 3;
    }

    // Handle @data variables
    const parts: string[] = [];
    let part = '';

    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === '.' || ch === '/') {
        if (part) parts.push(part);
        part = '';
        this.pos++;
      } else if (ch === ' ' || ch === '\t' || ch === ')' || ch === '=') {
        break;
      } else {
        part += ch;
        this.pos++;
      }
    }
    if (part) parts.push(part);

    const original = this.input.slice(start, this.pos);
    return { type: 'path', original, parts, depth };
  }

  private parseStringLiteral(): LiteralExpression {
    const quote = this.input[this.pos];
    this.pos++;
    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== quote) {
      if (this.input[this.pos] === '\\') {
        this.pos++;
        if (this.pos < this.input.length) {
          value += this.input[this.pos];
          this.pos++;
        }
      } else {
        value += this.input[this.pos];
        this.pos++;
      }
    }
    if (this.pos < this.input.length) this.pos++; // skip closing quote
    return { type: 'literal', value };
  }

  private tryParseNumber(): LiteralExpression | null {
    const start = this.pos;
    if (this.input[this.pos] === '-') this.pos++;
    if (this.pos >= this.input.length || this.input[this.pos] < '0' || this.input[this.pos] > '9') {
      this.pos = start;
      return null;
    }
    while (this.pos < this.input.length && this.input[this.pos] >= '0' && this.input[this.pos] <= '9') {
      this.pos++;
    }
    if (this.pos < this.input.length && this.input[this.pos] === '.') {
      this.pos++;
      while (this.pos < this.input.length && this.input[this.pos] >= '0' && this.input[this.pos] <= '9') {
        this.pos++;
      }
    }
    const numStr = this.input.slice(start, this.pos);
    return { type: 'literal', value: Number(numStr) };
  }

  private tryParseId(): string | null {
    const start = this.pos;
    let id = '';
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (/[a-zA-Z0-9_$@-]/.test(ch)) {
        id += ch;
        this.pos++;
      } else {
        break;
      }
    }
    if (id && this.pos < this.input.length && this.input[this.pos] === '=') {
      return id;
    }
    this.pos = start;
    return null;
  }

  private peekWord(): string {
    let end = this.pos;
    while (end < this.input.length && /[a-zA-Z]/.test(this.input[end])) {
      end++;
    }
    return this.input.slice(this.pos, end);
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && (this.input[this.pos] === ' ' || this.input[this.pos] === '\t')) {
      this.pos++;
    }
  }
}
