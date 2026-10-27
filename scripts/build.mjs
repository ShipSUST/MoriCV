import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeCategoryRuntime } from './category-runtime.mjs';

await writeCategoryRuntime();

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(projectRoot, "src");
const destination = path.join(projectRoot, "dist");

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });

const topLevel = await readdir(destination);
if (!topLevel.includes("manifest.json")) throw new Error("构建失败：dist/manifest.json 不存在。");
console.log(`Built ${topLevel.length} top-level items into ${destination}`);
