#!/usr/bin/env node
// whisker CLI — template precompilation

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { tokenize } from './lexer.js';
import { parse } from './parser.js';

const args = process.argv.slice(2);

function usage(): void {
  console.log(`Usage: whisker compile <template-file> [-o <output-file>]

Commands:
  compile    Precompile a template to a JSON AST

Options:
  -o, --output <file>  Output file (default: stdout)
  -h, --help           Show help

Examples:
  whisker compile template.hbs
  whisker compile template.hbs -o template.json
`);
}

if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  usage();
  process.exit(0);
}

const command = args[0];

if (command === 'compile') {
  const files: string[] = [];
  let outputFile: string | null = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '-o' || args[i] === '--output') {
      outputFile = args[++i];
    } else {
      files.push(args[i]);
    }
  }

  if (files.length === 0) {
    console.error('Error: No input files specified');
    process.exit(1);
  }

  for (const file of files) {
    const template = readFileSync(file, 'utf-8');
    const tokens = tokenize(template);
    const ast = parse(tokens, template);

    const output = JSON.stringify({
      compiler: '@agentine/whisker',
      version: '0.1.0',
      name: basename(file, extname(file)),
      ast,
    }, null, 2);

    if (outputFile) {
      writeFileSync(outputFile, output + '\n');
      console.log(`Compiled ${file} → ${outputFile}`);
    } else {
      console.log(output);
    }
  }
} else {
  console.error(`Unknown command: ${command}`);
  usage();
  process.exit(1);
}
