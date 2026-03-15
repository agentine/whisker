import { describe, it, expect, beforeEach } from 'vitest';
import Mustache from '../src/compat/mustache.js';
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
  tests: SpecTest[];
}

function loadSpec(name: string): SpecFile {
  return JSON.parse(readFileSync(join(__dirname, 'spec', `${name}.json`), 'utf-8'));
}

beforeEach(() => {
  Mustache.clearCache();
});

const specs = ['interpolation', 'sections', 'inverted', 'comments', 'partials', 'delimiters'];

for (const specName of specs) {
  const spec = loadSpec(specName);
  describe(`Mustache Compat Spec: ${specName}`, () => {
    for (const test of spec.tests) {
      it(`${test.name}: ${test.desc}`, () => {
        const result = Mustache.render(test.template, test.data, test.partials);
        expect(result).toBe(test.expected);
      });
    }
  });
}
