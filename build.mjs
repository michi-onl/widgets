import { build } from "esbuild";
import { copyFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const metadata = `// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: chart-line;`;

await build({
  entryPoints: ["src/index.js"],
  bundle: true,
  format: "cjs",
  platform: "neutral",
  target: "es2020",
  outfile: "Mosaic.js",
  banner: { js: metadata },
  logLevel: "info",
});

// Install the bundle where Scriptable picks it up, so a build is all it takes
// to update the widget on every device. Skipped where there is no such folder.
const scriptable =
  process.env.SCRIPTABLE_DIR ??
  join(
    homedir(),
    "Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents",
  );
if (await stat(scriptable).catch(() => null)) {
  await copyFile("Mosaic.js", join(scriptable, "Mosaic.js"));
  console.log(`  Installed in ${scriptable}`);
} else {
  console.log(`  Not installed: no Scriptable folder at ${scriptable}`);
}
