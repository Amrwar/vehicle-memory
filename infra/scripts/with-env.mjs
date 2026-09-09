/**
 * Runs a command with variables loaded from an env file.
 *
 *   node infra/scripts/with-env.mjs <env-file> <command> [args...]
 *
 * Exists because connection strings contain `&`, which a POSIX shell treats as
 * a job-control operator when sourcing a file. `. ./neon.env` silently
 * truncates the URL at the first `&` and produces a confusing authentication
 * error rather than an obvious parse failure.
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [envFile, command, ...args] = process.argv.slice(2);

if (!envFile || !command) {
  console.error('usage: node infra/scripts/with-env.mjs <env-file> <command> [args...]');
  process.exit(1);
}

const parsed = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    // Split on the first `=` only: everything after it is the value, `&` included.
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
);

const names = Object.keys(parsed).join(', ');
console.info(`Loaded ${Object.keys(parsed).length} variable(s) from ${envFile}: ${names}`);

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ...parsed },
});

child.on('exit', (code) => process.exit(code ?? 1));
