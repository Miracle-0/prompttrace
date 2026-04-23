#!/usr/bin/env node
import { build, context } from "esbuild";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const DIST = path.resolve("dist");
const watch = process.argv.includes("--watch");

async function writeManifest() {
  const mod = await import(pathToFileURL(path.resolve("src/manifest.ts")).href)
    .catch(async () => {
      // esbuild TS -> we transpile on demand for manifest
      const { transform } = await import("esbuild");
      const { readFile } = await import("node:fs/promises");
      const src = await readFile("src/manifest.ts", "utf8");
      const out = await transform(src, { loader: "ts", format: "esm" });
      const dataUrl =
        "data:text/javascript;base64," + Buffer.from(out.code).toString("base64");
      return await import(dataUrl);
    });
  await writeFile(
    path.join(DIST, "manifest.json"),
    JSON.stringify(mod.manifest, null, 2) + "\n",
  );
}

async function run() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const opts = {
    entryPoints: ["src/content.ts"],
    bundle: true,
    format: "iife",
    target: "chrome114",
    outfile: path.join(DIST, "content.js"),
    sourcemap: watch ? "inline" : false,
    minify: !watch,
    legalComments: "none",
    logLevel: "info",
  };

  if (watch) {
    const ctx = await context(opts);
    await ctx.watch();
    await writeManifest();
    console.log("watching…");
  } else {
    await build(opts);
    await writeManifest();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
