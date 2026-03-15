// Lexer — tokenizes template strings

export enum TokenType {
  Text = 'text',
  Variable = 'variable',
  UnescapedVariable = 'unescaped_variable',
  SectionOpen = 'section_open',
  SectionClose = 'section_close',
  InvertedSectionOpen = 'inverted_section_open',
  Comment = 'comment',
  Partial = 'partial',
  SetDelimiter = 'set_delimiter',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
  standalone?: boolean;
  indent?: string;
}

export function tokenize(
  template: string,
  openTag = '{{',
  closeTag = '}}',
): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  let currentOpen = openTag;
  let currentClose = closeTag;

  while (i < template.length) {
    const tagStart = template.indexOf(currentOpen, i);
    if (tagStart === -1) {
      // Rest is text
      if (i < template.length) {
        tokens.push({
          type: TokenType.Text,
          value: template.slice(i),
          line,
          col,
        });
      }
      break;
    }

    // Text before tag
    if (tagStart > i) {
      const text = template.slice(i, tagStart);
      tokens.push({ type: TokenType.Text, value: text, line, col });
      for (const ch of text) {
        if (ch === '\n') {
          line++;
          col = 1;
        } else {
          col++;
        }
      }
    }

    const tagLine = line;
    const tagCol = col;
    col += currentOpen.length;

    let tagEnd = template.indexOf(currentClose, tagStart + currentOpen.length);
    if (tagEnd === -1) {
      // No close — treat rest as text
      tokens.push({
        type: TokenType.Text,
        value: template.slice(tagStart),
        line: tagLine,
        col: tagCol,
      });
      break;
    }

    let inner = template.slice(tagStart + currentOpen.length, tagEnd).trim();
    let type: TokenType;

    // Triple mustache {{{ }}} for unescaped
    if (
      currentOpen === '{{' &&
      currentClose === '}}' &&
      template[tagStart + 2] === '{'
    ) {
      const tripleEnd = template.indexOf('}}}', tagStart + 3);
      if (tripleEnd !== -1) {
        inner = template.slice(tagStart + 3, tripleEnd).trim();
        type = TokenType.UnescapedVariable;
        tagEnd = tripleEnd + 1; // will skip past }}}
        tokens.push({ type, value: inner, line: tagLine, col: tagCol });
        i = tripleEnd + 3;
        col += inner.length + 3;
        continue;
      }
    }

    const sigil = inner[0];
    switch (sigil) {
      case '#':
        type = TokenType.SectionOpen;
        inner = inner.slice(1).trim();
        break;
      case '/':
        type = TokenType.SectionClose;
        inner = inner.slice(1).trim();
        break;
      case '^':
        type = TokenType.InvertedSectionOpen;
        inner = inner.slice(1).trim();
        break;
      case '!':
        type = TokenType.Comment;
        inner = inner.slice(1).trim();
        break;
      case '>':
        type = TokenType.Partial;
        inner = inner.slice(1).trim();
        break;
      case '&':
        type = TokenType.UnescapedVariable;
        inner = inner.slice(1).trim();
        break;
      case '=':
        // Set delimiter: {{= newOpen newClose =}}
        type = TokenType.SetDelimiter;
        if (inner.endsWith('=')) {
          inner = inner.slice(1, -1).trim();
        } else {
          inner = inner.slice(1).trim();
        }
        {
          const parts = inner.split(/\s+/);
          if (parts.length === 2) {
            currentOpen = parts[0];
            currentClose = parts[1];
          }
        }
        break;
      default:
        type = TokenType.Variable;
        break;
    }

    tokens.push({ type, value: inner, line: tagLine, col: tagCol });
    i = tagEnd + currentClose.length;
    col += inner.length + currentClose.length;
  }

  markStandalone(tokens, template);
  return tokens;
}

function markStandalone(tokens: Token[], template: string): void {
  // A standalone tag is a tag that appears on a line by itself (possibly with whitespace)
  // Only section, inverted, close, comment, partial, and set-delimiter tags can be standalone
  const standaloneTypes = new Set([
    TokenType.SectionOpen,
    TokenType.SectionClose,
    TokenType.InvertedSectionOpen,
    TokenType.Comment,
    TokenType.Partial,
    TokenType.SetDelimiter,
  ]);

  // Split into lines to detect standalone tags
  const lines = template.split('\n');
  let tokenIdx = 0;
  let _charPos = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineContent = lines[lineIdx];
    const lineEnd = _charPos + lineContent.length + (lineIdx < lines.length - 1 ? 1 : 0);

    // Find tokens on this line
    const lineTokens: number[] = [];
    const savedIdx = tokenIdx;
    let hasText = false;

    while (tokenIdx < tokens.length && tokens[tokenIdx].line === lineIdx + 1) {
      if (tokens[tokenIdx].type === TokenType.Text) {
        // Check if text is only whitespace
        if (tokens[tokenIdx].value.replace(/\n/g, '').trim() !== '') {
          hasText = true;
        }
      }
      lineTokens.push(tokenIdx);
      tokenIdx++;
    }

    // If there's no non-whitespace text and at least one standalone-eligible tag
    if (!hasText) {
      let hasStandaloneTag = false;
      for (const ti of lineTokens) {
        if (standaloneTypes.has(tokens[ti].type)) {
          hasStandaloneTag = true;
          break;
        }
      }
      if (hasStandaloneTag) {
        for (const ti of lineTokens) {
          if (standaloneTypes.has(tokens[ti].type)) {
            tokens[ti].standalone = true;
            // Find indent (whitespace before the tag on the line)
            for (const ti2 of lineTokens) {
              if (ti2 < ti && tokens[ti2].type === TokenType.Text) {
                const textVal = tokens[ti2].value.replace(/\n/g, '');
                if (/^\s*$/.test(textVal)) {
                  tokens[ti].indent = textVal;
                }
              }
            }
          }
        }
      }
    }

    tokenIdx = savedIdx;
    while (tokenIdx < tokens.length && tokens[tokenIdx].line === lineIdx + 1) {
      tokenIdx++;
    }
    _charPos = lineEnd;
  }
}
