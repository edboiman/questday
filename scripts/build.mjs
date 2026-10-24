// Production build: bundle → dist/, then generate index.html, the web app
// manifest and a service worker that precaches exactly the files in dist/.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { config, CSP_META, esbuildOptions, manifest, renderHtml, root } from './shared.mjs';

// `node scripts/build.mjs`            → dist/           public web build, no admin tools
// `node scripts/build.mjs --personal` → dist-personal/  your own testing copy, with the admin panel
// `node scripts/build.mjs --android`  → dist-android/   web assets for the Capacitor Android app (Google Play),
//                                                       with RevenueCat billing; needs REVENUECAT_ANDROID_KEY
const personal = process.argv.includes('--personal');
const android = process.argv.includes('--android');
if (personal && android) throw new Error('Choose --personal or --android, not both: the Play Store app never has admin tools.');
const out = join(root, android ? 'dist-android' : personal ? 'dist-personal' : 'dist');
const name = personal ? `${config.name} (personal)` : config.name;

// RevenueCat *public* SDK key (Android keys start with "goog_"). It is designed to ship inside apps;
// it can only be used to make purchases through Google Play, never to read or grant anything.
const rcKey = android ? (process.env.REVENUECAT_ANDROID_KEY ?? '') : '';
if (android && !/^goog_[A-Za-z0-9]{10,}$/.test(rcKey)) {
  console.warn('\n  ! REVENUECAT_ANDROID_KEY is missing or not a RevenueCat Android public key (goog_…).\n    The app will build, but the paywall will say purchases are unavailable.\n');
}
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const result = await build({
  ...esbuildOptions,
  outdir: out, // flat on purpose: no sub-folders, so dist/ can be uploaded from a phone
  entryNames: '[name]-[hash]',
  minify: true,
  sourcemap: false, // no source maps are published
  legalComments: 'eof',
  metafile: true,
  define: { 'process.env.NODE_ENV': '"production"', __DEV__: 'false', __QA_ADMIN__: personal ? 'true' : 'false', __QA_TARGET__: JSON.stringify(android ? 'android' : 'web'), __QA_RC_KEY__: JSON.stringify(/^goog_[A-Za-z0-9]{10,}$/.test(rcKey) ? rcKey : '') },
});

const outputs = Object.keys(result.metafile.outputs).map((f) => relative(out, join(root, f)).replaceAll('\\', '/'));
const js = outputs.find((f) => f.endsWith('.js'));
const css = outputs.find((f) => f.endsWith('.css'));
if (!js || !css) throw new Error('Build did not produce both a script and a stylesheet');

await cp(join(root, 'public'), out, { recursive: true });
await writeFile(join(out, 'index.html'), renderHtml(await readFile(join(root, 'index.html'), 'utf8'), { css: `./${css}`, js: `./${js}`, csp: CSP_META, name }));
await writeFile(join(out, 'manifest.webmanifest'), JSON.stringify(manifest({ name, shortName: personal ? `${config.shortName}*` : config.shortName }), null, 2));

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])));
  return files.flat();
}

const files = (await walk(out)).map((f) => relative(out, f).replaceAll('\\', '/')).filter((f) => f !== 'sw.js').sort();
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(await readFile(join(out, f)));
const version = hash.digest('hex').slice(0, 16);

const sw = (await readFile(join(root, 'scripts/sw.template.js'), 'utf8'))
  .replace('__VERSION__', version)
  .replace('__ASSETS__', JSON.stringify(files.map((f) => `./${f}`)));
await writeFile(join(out, 'sw.js'), sw);

console.log(`\nBuilt ${files.length + 1} files into ${relative(root, out)}/ (version ${version}).`);
