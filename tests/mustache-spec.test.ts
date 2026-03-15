import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface SpecTest {
  name: string;
  desc: string;
  data: Record<string, unknown>;
  template: string;
  expected: string;
  partials?: Record<string, string>;
}

interface SpecFile {
  overview: string;
  tests: SpecTest[];
}

function loadSpec(name: string): SpecFile {
  const path = join(__dirname, 'spec', `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

const specs = [
  'interpolation',
  'sections',
  'inverted',
  'comments',
  'partials',
  'delimiters',
];

for (const specName of specs) {
  const spec = loadSpec(specName);
  describe(`Mustache Spec: ${specName}`, () => {
    for (const test of spec.tests) {
      it(`${test.name}: ${test.desc}`, () => {
        const result = render(test.template, test.data, test.partials);
        expect(result).toBe(test.expected);
      });
    }
  });
}
