import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|css)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}
const files = sources(new URL('.', import.meta.url).pathname).map((path) => ({ path, text: readFileSync(path, 'utf8') }));
const none = (pattern: RegExp, why: string) => {
  for (const f of files) assert.ok(!pattern.test(f.text), `${why}: ${f.path}`);
};

test('source: no HTML injection or dynamic code execution APIs', () => {
  assert.ok(files.length > 10);
  none(/dangerouslySetInnerHTML|\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write/, 'HTML injection API');
  none(/\beval\s*\(|new Function\s*\(|setTimeout\s*\(\s*['"`]|setInterval\s*\(\s*['"`]/, 'dynamic code execution');
});

test('source: no network, tracking or remote resources', () => {
  none(/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts/, 'network API');
  none(/https?:\/\/(?!www\.w3\.org\/)/, 'remote URL');
  none(/@import\s+url|url\(\s*['"]?https?:/, 'remote stylesheet or font');
});

test('source: personal data is not kept in localStorage or logged', () => {
  none(/document\.cookie/, 'cookies');
  // Web storage holds only these non-personal UI flags. Game data lives in IndexedDB.
  const ALLOWED = new Set(['theme', 'qa-opened', 'qa-shelf', 'qa-admin-day-offset']);
  for (const f of files) {
    for (const m of f.text.matchAll(/(?:local|session)Storage\.(?:setItem|getItem|removeItem)\(\s*(['"`])([^'"`]*)\1/g)) {
      assert.ok(ALLOWED.has(m[2]!), `unexpected web storage key "${m[2]}" in ${f.path}`);
    }
    assert.doesNotMatch(f.text, /(?:local|session)Storage\.(?:setItem|getItem)\(\s*[^'"`\s]/, `web storage key must be a literal: ${f.path}`);
  }
  none(/console\.(log|debug|info|table)\s*\(/, 'console output');
});
