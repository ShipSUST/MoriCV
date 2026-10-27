// Anonymous DOM controls and the real content command listener, localhost only.
export async function runControls() {
  if (location.hostname !== "127.0.0.1") throw new Error("Control runner requires localhost");
  const checks = [], timings = [];
  const check = (name, ok) => { if (!ok) throw new Error(name); checks.push(name); };
  const settings = { overwriteExisting: false, confidenceThreshold: 78, rejectedMatches: [] };
  const run = (command, payload) => new Promise((resolve, reject) => {
    const started = performance.now();
    globalThis.__resumeHelperListener({ type: "RESUME_HELPER_COMMAND", command, payload }, null, (result) => {
      timings.push({ command, ms: Math.round(performance.now() - started) });
      result?.error ? reject(new Error(result.error)) : resolve(result);
    });
  });
  const host = document.createElement("fieldset"); host.id = "anonymous-controls"; document.body.prepend(host);
  const field = (name, html) => {
    const label = document.createElement("label"); label.textContent = name; label.insertAdjacentHTML("beforeend", html); host.append(label);
    return label.querySelector("input,select");
  };
  const renamed = field("别名测试框", "<input>");
  const entry = { id: "anonymous.alias", label: "不同词条名称", aliases: ["别名测试框"], category: "基本信息", value: "虚构值" };
  const flat = await run("fillFlatEntries", { profile: { entries: [entry], records: {} }, settings, resetTransaction: true });
  check("custom ordinary aliases have no automatic eligibility", flat.filled.length === 0 && !renamed.value);
  renamed.focus();const manualAlias=await run('fillTarget',{entry});
  check('custom manual values fill only the explicitly selected target',manualAlias.success&&renamed.value==='虚构值');
  check("manual field undo", (await run("undo", {})).failedCount === 0 && !renamed.value);
  const decimal = field("身高", '<input type="number" step="any">');
  decimal.focus();
  const decimalPayload = { entry: { id: "anonymous.decimal", label: "匿名小数测试", value: "1.25" }, forceOverwrite: true };
  check("supported numeric control keeps the decimal", (await run("fillTarget", decimalPayload)).success && decimal.value === "1.25");
  check("numeric control undo restores blank", (await run("undo", {})).failedCount === 0 && decimal.value === "");
  const stripDecimal = () => { decimal.value = decimal.value.replace('.', ''); };
  decimal.addEventListener("input", stripDecimal);
  decimal.focus();
  const rejectedDecimal = await run("fillTarget", decimalPayload);
  check("integer-only control refuses decimal without leaving altered digits", !rejectedDecimal.success && decimal.value === "");
  decimal.value = "42";
  decimal.focus();
  check("failed decimal overwrite preserves previous integer", !(await run("fillTarget", decimalPayload)).success && decimal.value === "42");
  decimal.removeEventListener("input", stripDecimal);
  decimal.focus();
  check("later supported decimal succeeds after the failed attempt", (await run("fillTarget", decimalPayload)).success && decimal.value === "1.25");
  check("supported overwrite undo restores original integer", (await run("undo", {})).failedCount === 0 && decimal.value === "42");
  const rejectEveryWrite = () => { decimal.value = "125"; };
  decimal.addEventListener("input", rejectEveryWrite);
  decimal.focus();
  check("scalar with failed restoration does not report success", !(await run("fillTarget", decimalPayload)).success);
  const failedScalarUndo = await run("undo", {});
  check("failed scalar restoration remains in undo for retry", failedScalarUndo.failedCount > 0);
  decimal.removeEventListener("input", rejectEveryWrite);
  check("retry scalar undo restores value after rejection is removed", (await run("undo", {})).failedCount === 0 && decimal.value === "42");
  decimal.addEventListener("input", rejectEveryWrite);
  const failedFlatScalar = await run("fillFlatEntries", { profile: { entries: [{ ...decimalPayload.entry, id:'basic.height',category:'基本信息',label:'身高',aliases:[] }], records: {} }, settings: { ...settings, overwriteExisting: true }, resetTransaction: true });
  check("flat scalar failure is reported without a filled result", failedFlatScalar.filled.length === 0);
  check("flat scalar failure keeps retryable undo", (await run("undo", {})).failedCount > 0);
  decimal.removeEventListener("input", rejectEveryWrite);
  check("flat scalar undo retry restores original value", (await run("undo", {})).failedCount === 0 && decimal.value === "42");
  const select = field("候选测试框", '<select><option value="">请选择</option><option>硕士</option><option>研究生</option><option>硕士研究生</option></select>');
  const target = async (value, optionValues = []) => {
    select.focus();
    return run("fillTarget", { entry: { id: "anonymous.option", label: "候选测试", value, optionValues }, forceOverwrite: true });
  };
  check("dropdown main value precedes candidates", (await target("硕士研究生", ["研究生", "硕士"])).success && select.value === "硕士研究生");
  check("ordered user alternatives", (await target("不在列表中的主值", ["研究生", "硕士"])).success && select.value === "研究生");
  check("no inferred alternative", !(await target("不在列表中的主值")).success && select.value === "研究生");
  select.innerHTML = '<option value="">请选择</option><option disabled>硕士</option><option>研究生</option>';
  check("disabled option skipped", (await target("硕士", ["研究生"])).success && select.value === "研究生");
  select.innerHTML = '<option value="">请选择</option><option value="1">硕士</option><option value="2">硕士</option>';
  check("ambiguous exact options fail", !(await target("硕士")).success && !select.value);
  const radio = document.createElement("fieldset"); radio.innerHTML = '<legend>性别</legend><label><input type="radio" name="anonymous-radio">甲</label><label><input type="radio" name="anonymous-radio">乙</label>'; host.append(radio);
  const choice = await run("fillFlatEntries", { profile: { entries: [{ id: "basic.gender",category:'基本信息', label: "性别", aliases: [], value: "乙", optionValues: ["甲"] }], records: {} }, settings, resetTransaction: true });
  check("radio main value before fallback", choice.filled.length === 1 && radio.querySelectorAll("input")[1].checked);
  check("radio restores initially empty group", (await run("undo", {})).failedCount === 0 && !radio.querySelectorAll("input")[1].checked);
  const cascade = field("级联候选测试", '<input readonly role="combobox">');
  let mode = "normal", chosen = [], portal;
  const openLevel = (level) => {
    const menu = document.createElement("ul"); menu.setAttribute("role", "listbox"); portal.append(menu);
    const values = level === 0 ? mode === "ambiguous" ? ["虚构", "虚构"] : ["虚构"] : level === 1 ? mode === "missing" ? ["别的城市"] : ["示例市"] : ["测试"];
    for (const value of values) {
      const option = document.createElement("li"); option.setAttribute("role", "option"); option.textContent = value;
      option.addEventListener("click", () => {
        option.setAttribute("aria-selected", "true"); chosen.push(value);
        if (level < 2) setTimeout(() => openLevel(level + 1), 90);
        else { cascade.value = chosen.join("/"); cascade.dispatchEvent(new Event("change", { bubbles: true })); portal.remove(); }
      }); menu.append(option);
    }
  };
  cascade.addEventListener("click", () => { portal?.remove(); chosen = []; portal = document.createElement("div"); document.body.append(portal); openLevel(0); });
  const cascadeEntry = { id: "anonymous.cascade", label: "地区", value: "虚构省示例市测试区", pathValues: [["虚构省", "虚构"], ["示例市", "示例"], ["测试区", "测试"]] };
  const fillCascade = async () => { cascade.focus(); return run("fillTarget", { entry: cascadeEntry, forceOverwrite: true }); };
  check("cascade ordered alternatives at three levels", (await fillCascade()).success && cascade.value === "虚构/示例市/测试");
  cascade.value = ""; mode = "missing";
  const missing = await fillCascade();
  check("cascade stops at missing second level", !missing.success && /第 2 级/.test(missing.reason) && chosen.length === 1 && !cascade.value);
  cascade.value = ""; mode = "ambiguous";
  const ambiguous = await fillCascade();
  check("cascade stops at ambiguous first level", !ambiguous.success && /第 1 级/.test(ambiguous.reason) && chosen.length === 0);
  portal?.remove();
  const date = document.querySelector('#education-records [data-month-picker] input');
  date.focus();
  const dateResult = await run("fillTarget", { entry: { id: "anonymous.date", label: "开始时间", value: "2024-09-05", optionValues: [] }, forceOverwrite: false });
  const dateRoot = document.querySelector('#education-records [data-month-picker]');
  if (new URLSearchParams(location.search).get("phoenix")?.includes("disabled")) {
    check("disabled month never writes", !dateResult.success && /未找到日期选项/.test(dateResult.reason) && !dateRoot.querySelector("input").dataset.committed);
  } else {
    check("Phoenix display-layer date writes exact requested month", dateResult.success && dateRoot.querySelector("input").dataset.committed === "2024-09");
    check("display-only fixture never relies on input value", dateRoot.querySelector("input").value === "");
    check("date undo after input replacement", (await run("undo", {})).failedCount === 0 && !dateRoot.querySelector("input").dataset.committed);
  }
  return { adapter: "controls", checks, timings };
}
