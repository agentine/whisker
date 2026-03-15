import { describe, it, expect } from 'vitest';
import { RenderStream, renderStream } from '../src/stream.js';

function collectStream(stream: RenderStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    stream.on('data', (chunk) => chunks.push(chunk.toString()));
    stream.on('end', () => resolve(chunks.join('')));
    stream.on('error', reject);
  });
}

describe('RenderStream', () => {
  it('renders a simple template', async () => {
    const stream = renderStream('Hello {{name}}!', { name: 'World' });
    const result = await collectStream(stream);
    expect(result).toBe('Hello World!');
  });

  it('renders sections', async () => {
    const stream = renderStream('{{#items}}{{.}} {{/items}}', {
      items: ['a', 'b', 'c'],
    });
    const result = await collectStream(stream);
    expect(result).toBe('a b c ');
  });

  it('renders with partials', async () => {
    const stream = renderStream(
      '{{> header}}Content{{> footer}}',
      { title: 'Test' },
      { header: '<h1>{{title}}</h1>\n', footer: '\n<footer/>' },
    );
    const result = await collectStream(stream);
    expect(result).toBe('<h1>Test</h1>\nContent\n<footer/>');
  });

  it('respects chunkSize option', async () => {
    const template = '{{content}}';
    const data = { content: 'A'.repeat(100) };
    const stream = renderStream(template, data, undefined, { chunkSize: 30 });
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk.toString());
    }
    expect(chunks.length).toBe(4); // 30+30+30+10
    expect(chunks.join('')).toBe('A'.repeat(100));
  });

  it('emits error for invalid template', async () => {
    const stream = renderStream('{{#unclosed}}', {});
    await expect(collectStream(stream)).rejects.toThrow();
  });
});
