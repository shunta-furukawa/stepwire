import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

// Explicitly pinned: upgrading the analysis engine is a reviewed source change.
const revision = 'f71d3ed952e99caaba6279e546e20b8e2029b6a5';
const checkout = process.argv[2];
if (!checkout) throw new Error('Usage: node scripts/sync-step-analyzer.mjs /path/to/step-analyzer');
const names = ['chart', 'timing', 'transform', 'edit', 'arrowShape', 'arrowCanvas', 'footScene', 'clap'];
const source = mkdtempSync(path.resolve('.step-analyzer-core-'));
const destination = path.resolve('lib/vendor/step-analyzer');
try {
  mkdirSync(destination, { recursive: true });
  for (const name of names) {
    writeFileSync(path.join(source, `${name}.ts`), execFileSync('git', ['-C', checkout, 'show', `${revision}:lib/${name}.ts`]));
  }
  const program = ts.createProgram(names.map((name) => path.join(source, `${name}.ts`)), {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler, declaration: true,
    outDir: destination, skipLibCheck: true, strict: false, types: [],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (name) => name, getCurrentDirectory: () => source, getNewLine: () => '\n',
  }));
  if (program.emit().emitSkipped) throw new Error('Step Analyzer core emission failed');
  for (const name of names) {
    const file = path.join(destination, `${name}.js`);
    writeFileSync(file, '// Generated from shunta-furukawa/step-analyzer; see README.md.\n' +
      readFileSync(file, 'utf8').replace(/from "\.\/(\w+)"/g, 'from "./$1.js"'));
  }
} finally {
  rmSync(source, { recursive: true, force: true });
}
