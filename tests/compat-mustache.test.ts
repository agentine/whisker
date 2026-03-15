import { describe, it, expect, beforeEach } from 'vitest';
import Mustache from '../src/compat/mustache.js';

describe('Mustache compat', () => {
  beforeEach(() => {
    Mustache.clearCache();
  });

  it('Mustache.render basic', () => {
    expect(Mustache.render('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
  });

  it('Mustache.render with partials', () => {
    expect(
      Mustache.render('{{> greeting}} {{name}}', { name: 'World' }, { greeting: 'Hello' }),
    ).toBe('Hello World');
  });

  it('Mustache.render with sections', () => {
    expect(
      Mustache.render('{{#show}}visible{{/show}}', { show: true }),
    ).toBe('visible');
  });

  it('Mustache.render with inverted sections', () => {
    expect(
      Mustache.render('{{^items}}empty{{/items}}', { items: [] }),
    ).toBe('empty');
  });

  it('Mustache.render with arrays', () => {
    expect(
      Mustache.render('{{#items}}{{.}} {{/items}}', { items: ['a', 'b', 'c'] }),
    ).toBe('a b c ');
  });

  it('Mustache.render escapes HTML', () => {
    expect(
      Mustache.render('{{html}}', { html: '<b>bold</b>' }),
    ).toBe('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('Mustache.render triple mustache unescaped', () => {
    expect(
      Mustache.render('{{{html}}}', { html: '<b>bold</b>' }),
    ).toBe('<b>bold</b>');
  });

  it('Mustache.parse returns tokens', () => {
    const tokens = Mustache.parse('Hello {{name}}!');
    expect(tokens).toHaveLength(3);
    expect(tokens[0][0]).toBe('text');
    expect(tokens[1][0]).toBe('name');
    expect(tokens[2][0]).toBe('text');
  });

  it('Mustache.escape works', () => {
    expect(Mustache.escape('<&>"')).toBe('&lt;&amp;&gt;&quot;');
  });

  it('Mustache.clearCache does not throw', () => {
    Mustache.render('test', {});
    expect(() => Mustache.clearCache()).not.toThrow();
  });

  it('Mustache.tags defaults', () => {
    expect(Mustache.tags).toEqual(['{{', '}}']);
  });

  it('Mustache.render with custom tags config', () => {
    expect(
      Mustache.render('<% name %>', { name: 'test' }, undefined, { tags: ['<%', '%>'] }),
    ).toBe('test');
  });

  it('Mustache.render with function partials', () => {
    const partials = (name: string) => {
      if (name === 'greet') return 'Hello';
      return undefined;
    };
    expect(
      Mustache.render('{{> greet}} {{name}}', { name: 'World' }, partials),
    ).toBe('Hello World');
  });

  it('Mustache.Writer class exists', () => {
    const writer = new Mustache.Writer();
    expect(writer.clearCache).toBeDefined();
    expect(writer.parse).toBeDefined();
    expect(writer.render).toBeDefined();
  });
});
