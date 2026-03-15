// Lexer — tokenizes Mustache/Handlebars template strings

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
  indent?: string;
  /** For section open tags: raw source position after the tag ends (for lambda rawBlock extraction) */
  sourceEnd?: number;
  /** For section close tags: raw source position where the tag starts */
  sourceStart?: number;
  /** Active delimiters at this token (for lambda re-parsing) */
  delimiters?: [string, string];
}

const STANDALONE_TYPES = new Set([
  TokenType.SectionOpen,
  TokenType.SectionClose,
  TokenType.InvertedSectionOpen,
  TokenType.Comment,
  TokenType.Partial,
  TokenType.SetDelimiter,
]);

interface RawTag {
  type: TokenType;
  value: string;
  start: number;
  end: number;
  line: number;
  col: number;
  delimiters?: [string, string];
}

export function tokenize(
  template: string,
  openTag = '{{',
  closeTag = '}}',
): Token[] {
  // Phase 1: Extract raw tags
  const tags = extractTags(template, openTag, closeTag);

  // Phase 2: Build tokens with standalone line elimination
  return buildTokens(template, tags);
}

function extractTags(
  template: string,
  initOpen: string,
  initClose: string,
): RawTag[] {
  const tags: RawTag[] = [];
  let i = 0;
  let line = 1;
  let lineStart = 0;
  let currentOpen = initOpen;
  let currentClose = initClose;

  while (i < template.length) {
    // Track line numbers
    const tagStart = template.indexOf(currentOpen, i);
    if (tagStart === -1) break;

    // Count lines up to tagStart
    for (let j = i; j < tagStart; j++) {
      if (template[j] === '\n') {
        line++;
        lineStart = j + 1;
      }
    }

    const col = tagStart - lineStart + 1;

    // Triple mustache {{{...}}} for unescaped
    if (
      currentOpen === '{{' &&
      currentClose === '}}' &&
      tagStart + 2 < template.length &&
      template[tagStart + 2] === '{'
    ) {
      const tripleEnd = template.indexOf('}}}', tagStart + 3);
      if (tripleEnd !== -1) {
        const inner = template.slice(tagStart + 3, tripleEnd).trim();
        tags.push({
          type: TokenType.UnescapedVariable,
          value: inner,
          start: tagStart,
          end: tripleEnd + 3,
          line,
          col,
        });
        i = tripleEnd + 3;
        continue;
      }
    }

    const contentStart = tagStart + currentOpen.length;
    let tagEnd = template.indexOf(currentClose, contentStart);
    if (tagEnd === -1) break;

    let inner = template.slice(contentStart, tagEnd);
    const innerTrimmed = inner.trim();
    let type: TokenType;
    let value: string;

    if (innerTrimmed.length === 0) {
      i = tagEnd + currentClose.length;
      continue;
    }

    // Save old close delimiter length before switch may change it
    const closeLen = currentClose.length;

    const sigil = innerTrimmed[0];
    switch (sigil) {
      case '#':
        type = TokenType.SectionOpen;
        value = innerTrimmed.slice(1).trim();
        break;
      case '/':
        type = TokenType.SectionClose;
        value = innerTrimmed.slice(1).trim();
        break;
      case '^':
        type = TokenType.InvertedSectionOpen;
        value = innerTrimmed.slice(1).trim();
        break;
      case '!':
        type = TokenType.Comment;
        value = innerTrimmed.slice(1);
        break;
      case '>':
        type = TokenType.Partial;
        value = innerTrimmed.slice(1).trim();
        break;
      case '&':
        type = TokenType.UnescapedVariable;
        value = innerTrimmed.slice(1).trim();
        break;
      case '=': {
        // Set delimiter: {{=newOpen newClose=}}
        type = TokenType.SetDelimiter;
        let delimStr = innerTrimmed.slice(1);
        if (delimStr.endsWith('=')) delimStr = delimStr.slice(0, -1);
        delimStr = delimStr.trim();
        const parts = delimStr.split(/\s+/);
        value = delimStr;
        if (parts.length === 2) {
          currentOpen = parts[0];
          currentClose = parts[1];
        }
        break;
      }
      default:
        type = TokenType.Variable;
        value = innerTrimmed;
        break;
    }

    tags.push({
      type,
      value,
      start: tagStart,
      end: tagEnd + closeLen,
      line,
      col,
      delimiters: type === TokenType.SectionOpen ? [currentOpen, currentClose] : undefined,
    });

    i = tagEnd + closeLen;
  }

  return tags;
}

function buildTokens(template: string, tags: RawTag[]): Token[] {
  // Determine which tags are standalone.
  // A standalone tag: the line(s) it occupies contain only whitespace outside the tag.
  // For single-line tags: the line has only whitespace + standalone-eligible tags.
  // For multiline tags: before-text on start line and after-text on end line are whitespace-only.
  const standalone = new Set<number>();

  for (let ti = 0; ti < tags.length; ti++) {
    const tag = tags[ti];
    if (!STANDALONE_TYPES.has(tag.type)) continue;

    // Find start of the line containing tag.start
    let lineStart = tag.start;
    while (lineStart > 0 && template[lineStart - 1] !== '\n') {
      lineStart--;
    }

    // Find end of the line containing tag.end (or tag.end - 1 for multiline)
    let lineEnd = tag.end;
    while (lineEnd < template.length && template[lineEnd] !== '\n' && template[lineEnd] !== '\r') {
      lineEnd++;
    }
    // Include the line ending
    if (lineEnd < template.length) {
      if (template[lineEnd] === '\r' && lineEnd + 1 < template.length && template[lineEnd + 1] === '\n') {
        lineEnd += 2;
      } else {
        lineEnd += 1;
      }
    }

    // Check: text before tag on its start line must be whitespace only
    const textBefore = template.slice(lineStart, tag.start);
    if (!/^[ \t]*$/.test(textBefore)) continue;

    // Check: text after tag on its end line must be whitespace only (+ optional newline)
    const textAfter = template.slice(tag.end, lineEnd);
    let afterContent: string;
    if (textAfter.endsWith('\r\n')) {
      afterContent = textAfter.slice(0, -2);
    } else if (textAfter.endsWith('\n')) {
      afterContent = textAfter.slice(0, -1);
    } else {
      // Last line of template (no trailing newline) — still standalone
      afterContent = textAfter;
    }
    if (!/^[ \t]*$/.test(afterContent)) continue;

    // Check no other non-standalone tags share this line span
    let otherTagConflict = false;
    for (let oi = 0; oi < tags.length; oi++) {
      if (oi === ti) continue;
      const other = tags[oi];
      // Check if other tag overlaps the line span [lineStart, lineEnd)
      if (other.start >= lineStart && other.start < lineEnd) {
        if (!STANDALONE_TYPES.has(other.type)) {
          otherTagConflict = true;
          break;
        }
      }
    }
    if (otherTagConflict) continue;

    standalone.add(ti);
  }

  // Build final token list
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  for (let ti = 0; ti < tags.length; ti++) {
    const tag = tags[ti];
    const isStandalone = standalone.has(ti);

    if (isStandalone) {
      // Find the start of this standalone line
      let lineStart = tag.start;
      while (lineStart > pos && template[lineStart - 1] !== '\n') {
        lineStart--;
      }

      // Emit text before the standalone line
      if (lineStart > pos) {
        const text = template.slice(pos, lineStart);
        if (text.length > 0) {
          tokens.push({ type: TokenType.Text, value: text, line, col });
          advancePos(text);
        }
      }

      // Get indent for this tag (whitespace before it on the line)
      const indent = template.slice(lineStart, tag.start);

      // Emit the tag
      tokens.push({
        type: tag.type,
        value: tag.value,
        line: tag.line,
        col: tag.col,
        indent: tag.type === TokenType.Partial ? indent : undefined,
        sourceEnd: tag.type === TokenType.SectionOpen ? tag.end : undefined,
        sourceStart: tag.type === TokenType.SectionClose ? tag.start : undefined,
        delimiters: tag.delimiters,
      });

      // Skip past the entire standalone line (up to and including the newline)
      let lineEnd = tag.end;
      // Skip remaining standalone tags on the SAME line
      while (
        ti + 1 < tags.length &&
        standalone.has(ti + 1) &&
        tags[ti + 1].line === tag.line
      ) {
        ti++;
        lineEnd = tags[ti].end;
        tokens.push({
          type: tags[ti].type,
          value: tags[ti].value,
          line: tags[ti].line,
          col: tags[ti].col,
          indent:
            tags[ti].type === TokenType.Partial
              ? template.slice(lineStart, tags[ti].start)
              : undefined,
        });
      }
      // Skip trailing whitespace and newline
      while (lineEnd < template.length && (template[lineEnd] === ' ' || template[lineEnd] === '\t')) {
        lineEnd++;
      }
      if (lineEnd < template.length && template[lineEnd] === '\n') {
        lineEnd++;
      } else if (lineEnd < template.length && template[lineEnd] === '\r') {
        lineEnd++;
        if (lineEnd < template.length && template[lineEnd] === '\n') {
          lineEnd++;
        }
      }

      // Advance tracking
      for (let j = pos; j < lineEnd; j++) {
        if (template[j] === '\n') {
          line++;
          col = 1;
        } else {
          col++;
        }
      }
      pos = lineEnd;
    } else {
      // Non-standalone tag: emit text before it, then the tag
      if (tag.start > pos) {
        const text = template.slice(pos, tag.start);
        tokens.push({ type: TokenType.Text, value: text, line, col });
        advancePos(text);
      }

      tokens.push({
        type: tag.type,
        value: tag.value,
        line: tag.line,
        col: tag.col,
        sourceEnd: tag.type === TokenType.SectionOpen || tag.type === TokenType.InvertedSectionOpen ? tag.end : undefined,
        sourceStart: tag.type === TokenType.SectionClose ? tag.start : undefined,
        delimiters: tag.delimiters,
      });

      advancePos(template.slice(pos, tag.end));
      pos = tag.end;
    }
  }

  // Trailing text
  if (pos < template.length) {
    tokens.push({
      type: TokenType.Text,
      value: template.slice(pos),
      line,
      col,
    });
  }

  return tokens;

  function advancePos(text: string): void {
    for (const ch of text) {
      if (ch === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
    }
  }
}

