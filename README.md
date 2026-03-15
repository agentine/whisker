# @agentine/whisker

Drop-in template engine replacing **mustache.js** and **handlebars** with a single, fast, zero-dependency implementation.

- Full [Mustache spec](https://github.com/mustache/spec) compliance (136/136 spec tests)
- Handlebars extensions: helpers, block helpers, `@data` variables, whitespace control, subexpressions
- Drop-in compat layers for both mustache.js and handlebars
- TypeScript-first with ESM + CJS dual package
- Streaming render support
- Template precompilation CLI

## Install

```bash
npm install @agentine/whisker
```

## Quick start

```ts
import { render } from '@agentine/whisker';

render('Hello {{name}}!', { name: 'World' });
// => "Hello World!"

render('{{#items}}{{name}} {{/items}}', {
  items: [{ name: 'Alice' }, { name: 'Bob' }],
});
// => "Alice Bob "
```

## Mustache features

All standard Mustache features are supported:

```ts
// Variables (HTML-escaped by default)
render('{{name}}', { name: '<b>World</b>' });
// => "&lt;b&gt;World&lt;/b&gt;"

// Unescaped
render('{{{name}}}', { name: '<b>World</b>' });
// => "<b>World</b>"

// Sections
render('{{#show}}Visible{{/show}}', { show: true });

// Inverted sections
render('{{^items}}No items{{/items}}', { items: [] });

// Partials
render('{{> header}}', { title: 'Hi' }, { header: '<h1>{{title}}</h1>' });

// Comments
render('{{! this is ignored }}Hello');

// Custom delimiters
render('{{=<% %>=}}<%name%>', { name: 'World' });
```

## Handlebars extensions

```ts
import { render, HelperRegistry, SafeString } from '@agentine/whisker';

const helpers = new HelperRegistry();

// Simple helper
helpers.register('uppercase', (args) => String(args[0]).toUpperCase());

render('{{uppercase name}}', { name: 'world' }, undefined, { helpers });
// => "WORLD"

// Block helper
helpers.register('bold', (args, options) => {
  return new SafeString(`<b>${options.fn(options.context)}</b>`);
});

// Built-in helpers: if, unless, each, with, lookup, log
render('{{#each items}}{{@index}}: {{this}}\n{{/each}}', {
  items: ['a', 'b', 'c'],
});
// => "0: a\n1: b\n2: c\n"
```

## Streaming

```ts
import { renderStream } from '@agentine/whisker/stream';

const stream = renderStream('Hello {{name}}!', { name: 'World' }, undefined, {
  chunkSize: 1024,
});
stream.pipe(process.stdout);
```

## Drop-in compat layers

### Replacing mustache.js

```ts
// Before:
// import Mustache from 'mustache';

// After:
import Mustache from '@agentine/whisker/compat/mustache';

Mustache.render('Hello {{name}}!', { name: 'World' });
```

### Replacing handlebars

```ts
// Before:
// import Handlebars from 'handlebars';

// After:
import Handlebars from '@agentine/whisker/compat/handlebars';

const template = Handlebars.compile('Hello {{name}}!');
template({ name: 'World' });

Handlebars.registerHelper('loud', (args) => String(args[0]).toUpperCase());
Handlebars.registerPartial('header', '<h1>{{title}}</h1>');
```

## CLI

Precompile templates to JSON AST:

```bash
whisker compile template.hbs
whisker compile template.hbs -o template.json
```

## Benchmarks

```bash
npm run bench
```

```
Simple interpolation                         639,674 ops/s
Section iteration (100 items)                 20,922 ops/s
HTML escaping                                511,901 ops/s
Nested sections                              369,423 ops/s
Partials (50 items)                           27,967 ops/s
```

## License

MIT
