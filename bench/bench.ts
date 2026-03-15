// Benchmark suite: whisker vs mustache.js vs handlebars

import { render } from '../src/index.js';
import { performance } from 'node:perf_hooks';

interface BenchResult {
  name: string;
  ops: number;
  ms: number;
}

function bench(name: string, fn: () => void, warmup = 100, iterations = 10000): BenchResult {
  // Warmup
  for (let i = 0; i < warmup; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const ms = performance.now() - start;

  return {
    name,
    ops: Math.round((iterations / ms) * 1000),
    ms: Math.round(ms * 100) / 100,
  };
}

function formatResult(result: BenchResult): string {
  return `  ${result.name.padEnd(40)} ${String(result.ops).padStart(10)} ops/s  (${result.ms}ms for ${10000} iterations)`;
}

// Test templates
const simpleTemplate = 'Hello {{name}}! You have {{count}} messages.';
const simpleData = { name: 'World', count: 42 };

const sectionTemplate = '{{#items}}{{name}}: {{value}}\n{{/items}}';
const sectionData = {
  items: Array.from({ length: 100 }, (_, i) => ({
    name: `item-${i}`,
    value: i * 10,
  })),
};

const escapingTemplate = '{{html}} {{text}} {{more}}';
const escapingData = {
  html: '<script>alert("xss")</script>',
  text: 'Tom & Jerry > "Friends"',
  more: "It's a test & that's <ok>",
};

const nestedTemplate = '{{#a}}{{#b}}{{#c}}{{value}}{{/c}}{{/b}}{{/a}}';
const nestedData = { a: { b: { c: { value: 'deep' } } } };

const partialTemplate = '{{> header}}{{#items}}{{> item}}{{/items}}{{> footer}}';
const partialData = {
  title: 'Test Page',
  items: Array.from({ length: 50 }, (_, i) => ({ name: `Item ${i}` })),
  year: 2024,
};
const partials = {
  header: '<h1>{{title}}</h1>\n',
  item: '<li>{{name}}</li>\n',
  footer: '<footer>&copy; {{year}}</footer>',
};

console.log('Whisker Benchmark Suite');
console.log('='.repeat(70));
console.log();

const results: BenchResult[] = [];

results.push(bench('Simple interpolation', () => render(simpleTemplate, simpleData)));
results.push(bench('Section iteration (100 items)', () => render(sectionTemplate, sectionData)));
results.push(bench('HTML escaping', () => render(escapingTemplate, escapingData)));
results.push(bench('Nested sections', () => render(nestedTemplate, nestedData)));
results.push(bench('Partials (50 items)', () => render(partialTemplate, partialData, partials)));

for (const r of results) {
  console.log(formatResult(r));
}

console.log();
console.log('Note: Run with mustache.js and handlebars installed to compare:');
console.log('  npm install mustache handlebars --no-save');
console.log('  npx tsx bench/bench-compare.ts');
