# whisker — Drop-in Template Engine for Node.js

## Overview

**Replaces:** mustache.js (9.3M weekly npm downloads, 5,563 dependents, single maintainer, 5 years no release, 80 open issues, 35 unmerged PRs) and handlebars (28.4M weekly downloads, 16,112 dependents, 3 years no release).

**Package:** `@agentine/whisker`

**Why:** mustache.js is effectively abandoned — 5 years without a release, maintainer actively seeking replacements, 80 open issues and 35 unmerged PRs piling up. Handlebars (a Mustache superset) is also stagnant at 3 years without release. Combined these serve ~37M weekly downloads with ~21K dependents. No maintained drop-in replacement exists — alternatives like EJS, Nunjucks, and Eta have completely different APIs. The Mustache spec is well-defined, making implementation precise and verifiable.

## Architecture

### Core Design

- TypeScript-first with strict types
- Zero dependencies
- ESM + CJS dual package (exports map)
- Streaming support for large templates
- Precompilation to JavaScript functions

### Modules

1. **Lexer** (`src/lexer.ts`) — Tokenizes template strings into token arrays. Handles custom delimiters, whitespace, standalone tag detection per Mustache spec.

2. **Parser** (`src/parser.ts`) — Builds AST from token stream. Section nesting, partial references, set-delimiter nodes.

3. **Compiler** (`src/compiler.ts`) — Compiles AST to optimized render functions. Supports AOT precompilation for production use.

4. **Runtime** (`src/runtime.ts`) — Context resolution (dot-notation, parent scope traversal), lambda support, HTML escaping, triple-mustache raw output.

5. **Helpers Engine** (`src/helpers.ts`) — Handlebars-compatible helper registration and invocation. Block helpers, hash arguments, subexpressions.

6. **Partials** (`src/partials.ts`) — Named partials, inline partials (Handlebars), dynamic partials, partial blocks.

7. **Compat: Mustache** (`src/compat/mustache.ts`) — Drop-in `mustache` API: `Mustache.render()`, `Mustache.parse()`, `Mustache.clearCache()`, `Mustache.escape`, `Mustache.tags`, `Mustache.Writer`.

8. **Compat: Handlebars** (`src/compat/handlebars.ts`) — Drop-in `handlebars` API: `Handlebars.compile()`, `Handlebars.precompile()`, `Handlebars.template()`, `Handlebars.registerHelper()`, `Handlebars.registerPartial()`, `Handlebars.SafeString`, `Handlebars.Utils.escapeExpression()`.

## Deliverables

### Phase 1: Mustache Core
- Full Mustache spec compliance (variables, sections, inverted sections, comments, partials, set delimiter, unescaped output, lambdas)
- Mustache spec test suite passing (official spec tests)
- Compat layer: `whisker/compat/mustache`
- TypeScript declarations
- ESM + CJS

### Phase 2: Handlebars Extensions
- Helpers (simple + block)
- Hash arguments and subexpressions
- Whitespace control (`{{~` / `~}}`)
- Inline partials and partial blocks
- `@data` variables (`@index`, `@key`, `@first`, `@last`)
- Strict mode and `knownHelpers`/`knownHelpersOnly`
- Compat layer: `whisker/compat/handlebars`

### Phase 3: Performance & Tooling
- Template precompilation CLI (`whisker compile`)
- Source maps for compiled templates
- Streaming render for large outputs
- Benchmark suite vs mustache.js and handlebars

## Verified Package Name

`@agentine/whisker` — confirmed available on npm.
