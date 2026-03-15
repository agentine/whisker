import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface LambdaSpec {
  overview: string;
  tests: Array<{
    name: string;
    desc: string;
    data: Record<string, unknown>;
    template: string;
    expected: string;
    partials?: Record<string, string>;
  }>;
}

const spec: LambdaSpec = JSON.parse(
  readFileSync(join(__dirname, 'spec', 'lambdas.json'), 'utf-8'),
);

// Lambda tests require constructing actual functions from the spec's lambda descriptions
// The spec uses a special format, so we manually map them
const lambdaTests: Record<string, () => Record<string, unknown>> = {
  'Interpolation': () => ({
    lambda: () => 'world',
  }),
  'Interpolation - Expansion': () => ({
    planet: 'world',
    lambda: () => '{{planet}}',
  }),
  'Interpolation - Alternate Delimiters': () => ({
    planet: 'world',
    lambda: () => '|planet| => {{planet}}',
  }),
  'Interpolation - Multiple Calls': () => {
    let count = 0;
    return {
      lambda: () => String(++count),
    };
  },
  'Escaping': () => ({
    lambda: () => '>',
  }),
  'Section': () => ({
    x: 'Error!',
    lambda: (text: string) => (text === '{{x}}' ? 'yes' : 'no'),
  }),
  'Section - Expansion': () => ({
    planet: 'Earth',
    lambda: (text: string) => text + '{{planet}}' + text,
  }),
  'Section - Alternate Delimiters': () => ({
    planet: 'Earth',
    lambda: (text: string) => text + '{{planet}} => |planet|' + text,
  }),
  'Section - Multiple Calls': () => ({
    lambda: (text: string) => '__' + text + '__',
  }),
  'Inverted Section': () => ({
    lambda: () => false,
    static: 'static',
  }),
};

describe('Mustache Spec: ~lambdas', () => {
  for (const test of spec.tests) {
    const dataBuilder = lambdaTests[test.name];
    if (!dataBuilder) {
      it.skip(`${test.name}: ${test.desc}`, () => {});
      continue;
    }
    it(`${test.name}: ${test.desc}`, () => {
      const data = dataBuilder();
      const result = render(test.template, data, test.partials);
      expect(result).toBe(test.expected);
    });
  }
});
