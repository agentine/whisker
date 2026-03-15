import { describe, it, expect } from 'vitest';
import { render, tokenize, parse, compile, Context } from '../src/index.js';

describe('render', () => {
  it('renders simple variables', () => {
    expect(render('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
  });

  it('escapes HTML by default', () => {
    expect(render('{{html}}', { html: '<b>bold</b>' })).toBe(
      '&lt;b&gt;bold&lt;/b&gt;',
    );
  });

  it('renders unescaped with triple mustache', () => {
    expect(render('{{{html}}}', { html: '<b>bold</b>' })).toBe('<b>bold</b>');
  });

  it('renders unescaped with ampersand', () => {
    expect(render('{{&html}}', { html: '<b>bold</b>' })).toBe('<b>bold</b>');
  });

  it('renders sections with truthy values', () => {
    expect(render('{{#show}}yes{{/show}}', { show: true })).toBe('yes');
  });

  it('skips sections with falsy values', () => {
    expect(render('{{#show}}yes{{/show}}', { show: false })).toBe('');
  });

  it('iterates arrays', () => {
    expect(
      render('{{#items}}{{.}} {{/items}}', { items: ['a', 'b', 'c'] }),
    ).toBe('a b c ');
  });

  it('renders inverted sections', () => {
    expect(render('{{^items}}empty{{/items}}', { items: [] })).toBe('empty');
  });

  it('skips inverted sections when truthy', () => {
    expect(render('{{^items}}empty{{/items}}', { items: [1] })).toBe('');
  });

  it('renders dot notation', () => {
    expect(render('{{person.name}}', { person: { name: 'Alice' } })).toBe(
      'Alice',
    );
  });

  it('renders comments as empty', () => {
    expect(render('before{{! comment }}after', {})).toBe('beforeafter');
  });

  it('handles missing variables', () => {
    expect(render('{{missing}}', {})).toBe('');
  });

  it('renders partials', () => {
    expect(
      render('{{>greeting}} {{name}}', { name: 'World' }, { greeting: 'Hello' }),
    ).toBe('Hello World');
  });

  it('renders nested sections', () => {
    const template = '{{#a}}{{#b}}{{c}}{{/b}}{{/a}}';
    const data = { a: { b: { c: 'deep' } } };
    expect(render(template, data)).toBe('deep');
  });
});

describe('tokenize', () => {
  it('tokenizes simple template', () => {
    const tokens = tokenize('Hello {{name}}!');
    expect(tokens).toHaveLength(3);
    expect(tokens[0].type).toBe('text');
    expect(tokens[1].type).toBe('variable');
    expect(tokens[2].type).toBe('text');
  });
});

describe('parse', () => {
  it('builds AST from tokens', () => {
    const tokens = tokenize('{{#section}}content{{/section}}');
    const ast = parse(tokens);
    expect(ast.children).toHaveLength(1);
    expect(ast.children[0].type).toBe('section');
  });

  it('throws on mismatched sections', () => {
    const tokens = tokenize('{{#a}}{{/b}}');
    expect(() => parse(tokens)).toThrow('Mismatched');
  });

  it('throws on unclosed sections', () => {
    const tokens = tokenize('{{#a}}content');
    expect(() => parse(tokens)).toThrow('Unclosed');
  });
});

describe('Context', () => {
  it('looks up simple values', () => {
    const ctx = new Context({ name: 'Alice' });
    expect(ctx.lookup('name')).toBe('Alice');
  });

  it('looks up dot notation', () => {
    const ctx = new Context({ a: { b: 'value' } });
    expect(ctx.lookup('a.b')).toBe('value');
  });

  it('returns undefined for missing values', () => {
    const ctx = new Context({});
    expect(ctx.lookup('missing')).toBeUndefined();
  });

  it('traverses parent scopes', () => {
    const ctx = new Context({ name: 'parent' }).push({ other: 'child' });
    expect(ctx.lookup('name')).toBe('parent');
  });
});
