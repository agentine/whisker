# Changelog

## 0.1.0 (2026-03-16)

Initial release.

### Features

- Full Mustache spec compliance (136/136 official spec tests passing)
- Handlebars-compatible extensions: helpers, block helpers, hash arguments, subexpressions
- `@data` variables (`@index`, `@key`, `@first`, `@last`)
- Whitespace control (`{{~` / `~}}`)
- Inline partials and partial blocks
- Drop-in compatibility layers for both mustache.js and handlebars APIs
- Template precompilation CLI (`whisker compile`)
- Streaming render via `RenderStream` (Node.js Readable)
- TypeScript-first with strict types
- ESM + CJS dual package (exports map)
- Zero dependencies
