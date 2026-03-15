import { describe, it, expect } from 'vitest';
import { render, HelperRegistry, SafeString } from '../src/index.js';

describe('Handlebars extensions', () => {
  describe('whitespace control', () => {
    it('strips whitespace before with ~', () => {
      const result = render('  hello  {{~ name }}', { name: 'world' });
      expect(result).toBe('  helloworld');
    });

    it('strips whitespace after with ~', () => {
      const result = render('{{ name ~}}  world  ', { name: 'hello' });
      expect(result).toBe('helloworld  ');
    });

    it('strips both sides', () => {
      const result = render('  {{~ name ~}}  ', { name: 'hello' });
      expect(result).toBe('hello');
    });

    it('strips around sections', () => {
      const result = render(
        '  {{~# items ~}} {{.}} {{~/ items ~}}  ',
        { items: ['a', 'b'] },
      );
      expect(result).toBe('ab');
    });

    it('strips around inverted sections', () => {
      const result = render(
        '  {{~^ items ~}} none {{~/ items ~}}  ',
        { items: [] },
      );
      expect(result).toBe('none');
    });
  });

  describe('helpers', () => {
    const helpers = new HelperRegistry();

    it('calls simple helper', () => {
      helpers.register('loud', function (text: unknown) {
        return String(text).toUpperCase();
      });
      const result = render('{{loud name}}', { name: 'hello' }, undefined, { helpers });
      expect(result).toBe('HELLO');
    });

    it('calls helper with multiple params', () => {
      helpers.register('join', function (a: unknown, b: unknown, sep: unknown) {
        // Last arg is options
        if (typeof sep === 'object') {
          return `${a} ${b}`;
        }
        return `${a}${sep}${b}`;
      });
      const result = render('{{join first last}}', { first: 'John', last: 'Doe' }, undefined, { helpers });
      expect(result).toBe('John Doe');
    });

    it('escapes helper output by default', () => {
      helpers.register('html', function () {
        return '<b>bold</b>';
      });
      const result = render('{{html}}', {}, undefined, { helpers });
      expect(result).toBe('&lt;b&gt;bold&lt;/b&gt;');
    });

    it('SafeString bypasses escaping', () => {
      helpers.register('safeHtml', function () {
        return new SafeString('<b>bold</b>');
      });
      const result = render('{{safeHtml}}', {}, undefined, { helpers });
      expect(result).toBe('<b>bold</b>');
    });

    it('calls helper with hash arguments', () => {
      helpers.register('link', function (this: unknown, ...args: unknown[]) {
        const options = args[args.length - 1] as { hash: Record<string, unknown> };
        const text = args[0];
        return new SafeString(`<a href="${options.hash.href}">${text}</a>`);
      });
      const result = render(
        '{{link "Click" href="/page"}}',
        {},
        undefined,
        { helpers },
      );
      expect(result).toBe('<a href="/page">Click</a>');
    });
  });

  describe('block helpers', () => {
    const helpers = new HelperRegistry();

    it('#if renders block when truthy', () => {
      const result = render(
        '{{#if show}}visible{{/if}}',
        { show: true },
        undefined,
        { helpers },
      );
      expect(result).toBe('visible');
    });

    it('#if skips block when falsy', () => {
      const result = render(
        '{{#if show}}visible{{/if}}',
        { show: false },
        undefined,
        { helpers },
      );
      expect(result).toBe('');
    });

    it('#unless renders block when falsy', () => {
      const result = render(
        '{{#unless show}}hidden{{/unless}}',
        { show: false },
        undefined,
        { helpers },
      );
      expect(result).toBe('hidden');
    });

    it('#each iterates arrays with @data', () => {
      const result = render(
        '{{#each items}}{{@index}}:{{.}} {{/each}}',
        { items: ['a', 'b', 'c'] },
        undefined,
        { helpers },
      );
      expect(result).toBe('0:a 1:b 2:c ');
    });

    it('#each iterates objects with @key', () => {
      const result = render(
        '{{#each obj}}{{@key}}={{.}} {{/each}}',
        { obj: { x: 1, y: 2 } },
        undefined,
        { helpers },
      );
      expect(result).toBe('x=1 y=2 ');
    });

    it('#each provides @first and @last', () => {
      const result = render(
        '{{#each items}}{{#if @first}}[{{/if}}{{.}}{{#if @last}}]{{/if}}{{/each}}',
        { items: ['a', 'b', 'c'] },
        undefined,
        { helpers },
      );
      expect(result).toBe('[abc]');
    });

    it('#with changes context', () => {
      const result = render(
        '{{#with person}}{{name}} is {{age}}{{/with}}',
        { person: { name: 'Alice', age: 30 } },
        undefined,
        { helpers },
      );
      expect(result).toBe('Alice is 30');
    });

    it('custom block helper', () => {
      helpers.register('bold', function (this: unknown, options: { fn: (ctx: unknown) => string }) {
        return '<b>' + options.fn(this) + '</b>';
      });
      const result = render(
        '{{#bold}}Hello {{name}}{{/bold}}',
        { name: 'World' },
        undefined,
        { helpers },
      );
      expect(result).toBe('<b>Hello World</b>');
    });
  });

  describe('@data variables', () => {
    it('@index in array iteration', () => {
      const helpers = new HelperRegistry();
      const result = render(
        '{{#each items}}{{@index}}{{/each}}',
        { items: ['a', 'b', 'c'] },
        undefined,
        { helpers },
      );
      expect(result).toBe('012');
    });
  });

  describe('expression parser', () => {
    it('parses string literal params', () => {
      const helpers = new HelperRegistry();
      helpers.register('echo', function (text: unknown) {
        return String(text);
      });
      const result = render('{{echo "hello world"}}', {}, undefined, { helpers });
      expect(result).toBe('hello world');
    });

    it('parses number literal params', () => {
      const helpers = new HelperRegistry();
      helpers.register('double', function (n: unknown) {
        return String(Number(n) * 2);
      });
      const result = render('{{double 21}}', {}, undefined, { helpers });
      expect(result).toBe('42');
    });

    it('parses boolean literal params', () => {
      const helpers = new HelperRegistry();
      helpers.register('not', function (val: unknown) {
        return String(!val);
      });
      const result = render('{{not true}}', {}, undefined, { helpers });
      expect(result).toBe('false');
    });
  });

  describe('partials', () => {
    it('renders string partials', () => {
      const result = render(
        '{{> greeting}} {{name}}',
        { name: 'World' },
        { greeting: 'Hello' },
      );
      expect(result).toBe('Hello World');
    });

    it('renders partials with context', () => {
      const helpers = new HelperRegistry();
      const result = render(
        '{{#each people}}{{> personPartial}}{{/each}}',
        { people: [{ name: 'Alice' }, { name: 'Bob' }] },
        { personPartial: '{{name}} ' },
        { helpers },
      );
      expect(result).toBe('Alice Bob ');
    });
  });
});
