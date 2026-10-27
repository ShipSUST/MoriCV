import { anonymousTemplateProfile } from './anonymous-profile.js';
import test from "node:test";
import assert from "node:assert/strict";
import "../src/shared/matcher-core.js";
import { DEFAULT_PROFILE } from "../src/data/default-profile.js";

const core = globalThis.ResumeHelperCore;

test('Zhiye tenant detection isolates China Life from other tenants and host suffixes', () => {
  assert.equal(core.detectZhiyeTemplate('CHINALIFE.ZHIYE.COM'), 'chinalife');
  for (const host of ['zhiye.com','other.zhiye.com','chinalife.zhiye.com.example.org','example.com']) assert.equal(core.detectZhiyeTemplate(host), 'legacy');
});

test('Nanjing Securities is a separate exact Zhiye tenant', () => {
  assert.equal(core.detectZhiyeTemplate('NJZQ.ZHIYE.COM'), 'njzq');
  for (const host of ['other.zhiye.com', 'njzq.zhiye.com.attacker.invalid', 'www.njzq.zhiye.com']) assert.equal(core.detectZhiyeTemplate(host), 'legacy');
  assert.equal(core.detectZhiyeTemplate('chinalife.zhiye.com'), 'chinalife');
});

test('Seyond is an exact Zhiye tenant without matching suffixes or other companies', () => {
  assert.equal(core.detectZhiyeTemplate('SEYOND.ZHIYE.COM'),'seyond');
  for(const host of ['other.zhiye.com','seyond.zhiye.com.attacker.invalid','www.seyond.zhiye.com'])assert.equal(core.detectZhiyeTemplate(host),'legacy');
});

test('Shanghai Bank is an exact Zhiye tenant without inheriting another tenant contract',()=>{
 assert.equal(core.detectZhiyeTemplate('BOSC.ZHIYE.COM'),'bosc');
 for(const host of ['other.zhiye.com','bosc.zhiye.com.attacker.invalid','www.bosc.zhiye.com'])assert.equal(core.detectZhiyeTemplate(host),'legacy');
});

test('CMB recruitment detection is restricted to the observed host', () => {
  assert.equal(core.detectSite('career.cmbchina.com'), 'cmbchina');
  assert.equal(core.detectSite('CAREER.CMBCHINA.COM'), 'cmbchina');
  for (const host of ['www.cmbchina.com', 'career.cmbchina.com.example.org', 'cmbchina.com']) assert.equal(core.detectSite(host), 'generic');
});

test("normalizes Chinese form labels", () => {
  assert.equal(core.normalize("  手机号码（必填）："), "手机号码必填");
  assert.equal(core.normalize("甲省 / 乙市"), "甲省乙市");
});

test("scores exact and contained aliases as high confidence", () => {
  assert.equal(core.scoreAlias("姓名", "姓名"), 100);
  assert.ok(core.scoreAlias("请输入您的电子邮箱（必填）", "电子邮箱") >= 94);
});

test("does not match unrelated fields", () => {
  assert.equal(core.scoreAlias("期望工作城市", "身份证号"), 0);
});

test("ranks a specific emergency phone above general contact fields", () => {
  const entries = [
    { id: "phone", label: "手机号", value: "1", aliases: ["手机号", "联系电话"] },
    { id: "emergency", label: "紧急联系人电话", value: "2", aliases: ["紧急联系人电话", "紧急联系电话"] }
  ];
  const ranked = core.rankEntries("紧急联系人电话（必填）", entries);
  assert.equal(ranked[0].entry.id, "emergency");
});

test("detects supported recruiting platforms", () => {
  assert.equal(core.detectSite("app.mokahr.com"), "mokahr");
  assert.equal(core.detectSite("woanhome.zhiye.com"), "zhiye");
  assert.equal(core.detectSite("zhiye.com"), "zhiye");
  assert.equal(core.detectSite("qcraft.jobs.feishu.cn"), "feishu");
  // MokaHR 白标：域名不是 mokahr.com，但表单是同一套。
  assert.equal(core.detectSite("apply.careers.dji.com"), "mokahr");
  assert.equal(core.detectSite("APPLY.CAREERS.DJI.COM"), "mokahr");
  assert.equal(core.detectSite("example.com"), "generic");
});

test("uses dedicated MokaHR aliases while other sites stay generic", () => {
  const entries = [{
    id: "major",
    label: "最高学历专业",
    value: "软件工程",
    aliases: ["最高学历专业"],
    siteAliases: { mokahr: ["专业"] }
  }];
  assert.ok(core.rankEntries("专业", entries, "mokahr")[0].score >= 90);
  assert.equal(core.rankEntries("完全不相关字段", entries, "generic").length, 0);
});

test("prefers specific split-name aliases over generic name", () => {
  const entries = [
    { id: "full", label: "姓名", value: "张三", aliases: ["name", "full name"] },
    { id: "given", label: "First Name", value: "Alex", aliases: ["first name", "given name", "legal first name"] },
    { id: "family", label: "Last Name", value: "Chen", aliases: ["last name", "family name", "surname"] }
  ];
  assert.equal(core.rankEntries("First Name | given-name", entries)[0].entry.id, "given");
  assert.equal(core.rankEntries("What is your legal first name?", entries)[0].entry.id, "given");
  assert.equal(core.rankEntries("Last Name | family-name", entries)[0].entry.id, "family");
});

test("formats telephone and date values", () => {
  assert.equal(core.formatValue({ value: "+86 13800000000" }, "tel"), "13800000000");
  assert.equal(core.formatValue({ value: "2027-06" }, "date"), "2027-06-01");
  assert.equal(core.formatValue({ value: "2027-06-30" }, "month"), "2027-06");
});

test("fixed salary uses the single explicit expected-salary identity", () => {
  const salaryEntries = anonymousTemplateProfile().entries
    .filter(entry => entry.id === 'career.expected_salary').map(entry=>({...entry,value:'面议'}));
  assert.equal(salaryEntries.length, 1);
  assert.equal(core.rankEntries("期望月薪", salaryEntries)[0].entry.id, "career.expected_salary");
});

test("token overlap scores are continuous below the old 70 floor", () => {
  const partial = core.scoreAlias("工作所在单位", "工作单位");
  assert.ok(partial >= 40 && partial < 70, String(partial));
  assert.equal(core.scoreAlias("工作单位", "工作单位"), 100);
  assert.ok(core.scoreAlias("工作单位", "工作单位") > partial);
});

test("resolveMatch returns the best winner, alternates above threshold, and honors rejections", () => {
  const ranked = [
    { entry: { id: "a", label: "A" }, score: 95, specificity: 4, alias: "a" },
    { entry: { id: "b", label: "B" }, score: 80, specificity: 3, alias: "b" },
    { entry: { id: "c", label: "C" }, score: 50, specificity: 2, alias: "c" }
  ];
  const match = core.resolveMatch(ranked, "姓名", { threshold: 60 });
  assert.equal(match.entry.id, "a");
  assert.equal(match.ambiguous, false);
  assert.deepEqual(match.alternates.map((item) => item.entryId), ["b"]);

  const rejected = core.resolveMatch(ranked, "姓名", { threshold: 60, rejected: [core.rejectionKey("姓名", "a")] });
  assert.equal(rejected.entry.id, "b");
  assert.equal(core.resolveMatch(ranked, "其他字段", { threshold: 60, rejected: [core.rejectionKey("姓名", "a")] }).entry.id, "a");

  const tied = core.resolveMatch([ranked[0], { ...ranked[1], score: 95, specificity: 4 }], "姓名", { threshold: 60 });
  assert.equal(tied.ambiguous, true);
  assert.equal(core.resolveMatch([], "姓名", {}), null);
});

 test('51job detection is restricted to the observed host',()=>{assert.equal(core.detectSite('xyz.51job.com'),'job51');assert.equal(core.detectSite('XYZ.51JOB.COM'),'job51');for(const host of ['51job.com','www.51job.com','xyz.51job.com.example.org'])assert.equal(core.detectSite(host),'generic');});
