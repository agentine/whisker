import { describe, it, expect, beforeEach } from 'vitest';
import Handlebars from '../src/compat/handlebars.js';

describe('Handlebars compat', () => {
  beforeEach(() => {
    // Reset any registered helpers/partials
    Handlebars.partials.clear();
  });

  it('Handlebars.compile basic', () => {
    const template = Handlebars.compile('Hello {{name}}!');
    expect(template({ name: 'World' })).toBe('Hello World!');
  });

  it('Handlebars.compile escapes HTML', () => {
    const template = Handlebars.compile('{{html}}');
    expect(template({ html: '<b>bold</b>' })).toBe('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('Handlebars.compile unescaped triple', () => {
    const template = Handlebars.compile('{{{html}}}');
    expect(template({ html: '<b>bold</b>' })).toBe('<b>bold</b>');
  });

  it('Handlebars.registerHelper and use', () => {
    Handlebars.registerHelper('shout', function (text: unknown) {
      return String(text).toUpperCase();
    });
    const template = Handlebars.compile('{{shout name}}');
    expect(template({ name: 'hello' })).toBe('HELLO');
    Handlebars.unregisterHelper('shout');
  });

  it('Handlebars.registerHelper with object', () => {
    Handlebars.registerHelper({
      upper: (text: unknown) => String(text).toUpperCase(),
      lower: (text: unknown) => String(text).toLowerCase(),
    });
    const template = Handlebars.compile('{{upper name}} {{lower name}}');
    expect(template({ name: 'Hello' })).toBe('HELLO hello');
    Handlebars.unregisterHelper('upper');
    Handlebars.unregisterHelper('lower');
  });

  it('Handlebars.registerPartial and use', () => {
    Handlebars.registerPartial('greeting', 'Hello');
    const template = Handlebars.compile('{{> greeting}} {{name}}');
    expect(template({ name: 'World' })).toBe('Hello World');
  });

  it('Handlebars.registerPartial with object', () => {
    Handlebars.registerPartial({
      header: '<h1>{{title}}</h1>',
      footer: '<footer>{{copyright}}</footer>',
    });
    const template = Handlebars.compile('{{> header}}{{> footer}}');
    expect(template({ title: 'Test', copyright: '2024' })).toBe(
      '<h1>Test</h1><footer>2024</footer>',
    );
  });

  it('Handlebars.SafeString', () => {
    Handlebars.registerHelper('raw', function () {
      return new Handlebars.SafeString('<b>bold</b>');
    });
    const template = Handlebars.compile('{{raw}}');
    expect(template({})).toBe('<b>bold</b>');
    Handlebars.unregisterHelper('raw');
  });

  it('Handlebars.Utils.escapeExpression', () => {
    expect(Handlebars.Utils.escapeExpression('<&>"')).toBe('&lt;&amp;&gt;&quot;');
  });

  it('Handlebars.Utils.isEmpty', () => {
    expect(Handlebars.Utils.isEmpty(null)).toBe(true);
    expect(Handlebars.Utils.isEmpty(undefined)).toBe(true);
    expect(Handlebars.Utils.isEmpty(false)).toBe(true);
    expect(Handlebars.Utils.isEmpty('')).toBe(true);
    expect(Handlebars.Utils.isEmpty(0)).toBe(true);
    expect(Handlebars.Utils.isEmpty([])).toBe(true);
    expect(Handlebars.Utils.isEmpty('hello')).toBe(false);
    expect(Handlebars.Utils.isEmpty(42)).toBe(false);
    expect(Handlebars.Utils.isEmpty([1])).toBe(false);
  });

  it('Handlebars.compile with #if helper', () => {
    const template = Handlebars.compile('{{#if show}}visible{{/if}}');
    expect(template({ show: true })).toBe('visible');
    expect(template({ show: false })).toBe('');
  });

  it('Handlebars.compile with #each helper', () => {
    const template = Handlebars.compile('{{#each items}}{{.}} {{/each}}');
    expect(template({ items: ['a', 'b', 'c'] })).toBe('a b c ');
  });

  it('Handlebars.compile with #each @data', () => {
    const template = Handlebars.compile('{{#each items}}{{@index}}:{{.}} {{/each}}');
    expect(template({ items: ['a', 'b', 'c'] })).toBe('0:a 1:b 2:c ');
  });

  it('Handlebars.compile with #with helper', () => {
    const template = Handlebars.compile('{{#with person}}{{name}}{{/with}}');
    expect(template({ person: { name: 'Alice' } })).toBe('Alice');
  });

  it('Handlebars.precompile returns string', () => {
    const result = Handlebars.precompile('Hello {{name}}');
    expect(typeof result).toBe('string');
  });

  it('Handlebars.template from precompile', () => {
    const spec = JSON.parse(Handlebars.precompile('Hello {{name}}'));
    const template = Handlebars.template(spec);
    expect(template({ name: 'World' })).toBe('Hello World');
  });

  it('Handlebars.VERSION exists', () => {
    expect(Handlebars.VERSION).toBeDefined();
  });
});
