import { readFile } from "node:fs/promises";
import path from "node:path";
import { previewProfileMigration, validateProfile } from "../src/shared/storage.js";

if (process.argv.includes("--write")) {
  console.error("--write 已停用。请在设置页审阅迁移预览，经原始 JSON 备份和关联文件版本校验后显式保存。");
  process.exit(1);
}

const input = process.argv[2];
if (!input) throw new Error("用法：npm run migrate:profile -- <资料 JSON 路径>");

const profilePath = path.resolve(input);
try {
  const parsed = JSON.parse(await readFile(profilePath, "utf8"));
  validateProfile(parsed);
  const { profile, report } = previewProfileMigration(parsed);
  validateProfile(profile);
  console.log(`Validated migration to schema v${profile.schemaVersion}; source file unchanged. 请在设置页审阅预览、备份原始 JSON 并校验文件版本后保存。`);
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error("迁移预览失败；源文件未改动。请检查 JSON 格式、资料结构和文件读取权限。");
  process.exitCode = 1;
}
