(function installResumeHelperContentScript() {
  "use strict";

  if (globalThis.__resumeHelperContentInstalled) return;
  globalThis.__resumeHelperContentInstalled = true;
  const core = globalThis.ResumeHelperCore;
  const documentToken = crypto.randomUUID();
  let lastFocusedElement = null;
  let lastTransaction = [];
  const controlFailures = new WeakMap();
  const unconfirmedScalarWrites = new WeakSet();
  const datePrecisionNotes = new WeakMap();
  const elementDatePanels = new WeakMap();
  const job51 = globalThis.ResumeHelperJob51?.create({ isVisible, dispatchEditEvents, controlDateParts, dateSelectionPolicy, exactOption, wait, controlFailures, datePrecisionNotes });

  const BLOCKED_INPUT_TYPES = new Set([
    "password", "file", "hidden", "submit", "button", "reset", "image", "color", "range"
  ]);
  const DEFAULT_BATCH_SAFE_IDS = new Set([
    "basic.name", "basic.nationality", "basic.id_card", "basic.gender", "basic.birth_date",
    "contact.phone", "contact.email", "location.current", "career.fresh_graduate",
    "career.graduation_date", "basic.highest_education_level"
  ]);
  const REUSABLE_ENTRY_IDS = new Set([
    "basic.given_name", "basic.family_name", "contact.email", "contact.phone"
  ]);
  const MANUAL_INTENT_LABELS = new Set([
    "意向岗位", "意向岗位1", "意向岗位2", "第一意向岗位", "第二意向岗位",
    "期望岗位", "期望职位", "期望从事职业",
    "期望工作城市", "意向工作城市", "意向工作地", "意向工作地1", "意向工作地2",
    "第一意向工作地", "第二意向工作地", "期望城市", "意向城市", "是否接受其他工作地调剂"
  ].map((value) => core.normalize(value)));
  const FIELD_SELECTOR = [
    "input:not([type])",
    "input[type=text]",
    "input[type=email]",
    "input[type=tel]",
    "input[type=number]",
    "input[type=url]",
    "input[type=date]",
    "input[type=month]",
    "input[type=search]",
    "textarea",
    "select",
    "[contenteditable=true]",
    "[role=combobox]"
  ].join(",");

  const ADAPTERS = {
    generic: {
      containers: [".ud-formily-item", ".el-form-item", ".form-item", ".field", ".form-group", "fieldset", "td", "li"]
    },
    mokahr: {
      containers: [
        "[class*=apply-field]", "[class*=apply-fields]", "[data-nav-id]",
        ".atsx-form-item", ".moka-form-item", ".form-item", ".resume-form-item",
        ".ant-form-item", ".field-item", "fieldset"
      ]
    },
    zhiye: {
      containers: [
        ".form-item", ".fields-col", ".form-part", "div.form[id]", "fieldset"
      ]
    }
  };

  function currentSite() { return job51?.ownsPage() ? "job51" : core.detectSite(location.hostname); }

  function isManualIntentField(value) {
    if (isChinalifeZhiyePage() && compactText(value, 80) === "期望工作城市") return false;
    const normalized = core.normalize(value);
    if (!normalized) return false;
    return MANUAL_INTENT_LABELS.has(normalized)
      || /^(?:意向岗位|期望岗位|期望职位|期望从事职业|期望工作城市|意向工作城市|意向工作地|期望城市|意向城市)\d*$/.test(normalized);
  }

  function isSupportedFieldElement(element) {
    if (isChinalifeRadioGroup(element)) return true;
    if (!(element instanceof Element) || !element.matches(FIELD_SELECTOR)) return false;
    const type = String(element.getAttribute("type") || "").toLowerCase();
    return !BLOCKED_INPUT_TYPES.has(type) && !element.disabled;
  }

  function rememberFocusedElement(event) {
    const element = isChinalifeZhiyePage() ? event.target.closest?.('.phoenix-radio-group') || event.target : event.target;
    if (!isSupportedFieldElement(element)) return;
    lastFocusedElement = element;
    try {
      const pending = chrome.runtime.sendMessage?.({ type: "RESUME_HELPER_TARGET_CHANGED", target: targetStatus() });
      pending?.catch?.(() => {});
    } catch (_) {}
  }

  document.addEventListener("focusin", rememberFocusedElement, true);
  document.addEventListener("pointerdown", rememberFocusedElement, true);

  function isVisible(element) {
    if (!(element instanceof Element)) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && element.getClientRects().length > 0;
  }

  function compactText(value, max = 260) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function associatedLabelText(element) {
    const texts = [];
    if (element.labels) texts.push(...Array.from(element.labels, (label) => label.innerText || label.textContent));
    const id = element.id;
    if (id) {
      try {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (label) texts.push(label.innerText || label.textContent);
      } catch (_) {}
    }
    const wrappingLabel = element.closest("label");
    if (wrappingLabel) texts.push(wrappingLabel.innerText || wrappingLabel.textContent);
    return texts.map((text) => compactText(text, 100)).filter(Boolean).join(" ");
  }

  // aria-labelledby 指向的元素常常是真正的标签，比父容器整段文本精确得多。
  // label 元素本身也被 fieldContext/associatedLabelText 捕获，但纯 div 型的标签只能靠这里。
  function labelledByText(element) {
    const ids = String(element.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
    const texts = [];
    for (const id of ids) {
      let node = null;
      try {
        node = document.getElementById(id);
      } catch (_) {
        node = null;
      }
      if (node) texts.push(node.innerText || node.textContent);
    }
    return texts.map((text) => compactText(text, 100)).filter(Boolean).join(" ");
  }

  // 框所在表格列的列名（表头），"姓名" 这类无前缀的窄标签常在这里。
  function columnHeaderText(element) {
    const cell = element.closest("td, th");
    const table = cell?.closest("table");
    if (!cell || !table) return "";
    const cells = Array.from(cell.parentElement?.children || []);
    const index = cells.indexOf(cell);
    if (index < 0) return "";
    const headerRow = table.querySelector("thead tr") || table.querySelector("tr");
    const header = headerRow?.children?.[index];
    return compactText(header?.innerText || header?.textContent, 80);
  }

  // 紧邻的上一个兄弟节点的文字：自定义组件常常把标签放在输入框前面的 div/span 里，
  // 既不在 <label> 里，也不在 aria 属性上。
  function neighbourLabelText(element) {
    let node = element;
    for (let hop = 0; hop < 3 && node; hop += 1) {
      const previous = node.previousElementSibling;
      if (previous && !previous.querySelector?.(FIELD_SELECTOR)) {
        const text = compactText(previous.innerText || previous.textContent, 80);
        if (text && text.length <= 40) return text;
      }
      node = node.parentElement;
      if (!node || node === document.body) break;
    }
    return "";
  }

  function fieldContext(element, site) {
    if (globalThis.ResumeHelperSany?.ownsControl(element)) return globalThis.ResumeHelperSany.label(element);
    if (globalThis.ResumeHelperBosc?.ownsControl(element)) return globalThis.ResumeHelperBosc.label(element);
    const udField = element.closest?.('.ud-formily-item[data-form-field-i18n-name]');
    if (udField) {
      const label = udField.getAttribute('data-form-field-i18n-name');
      const range = element.closest('.throne-biz-date-range-picker-wrapper');
      if (range) {
        const index = Array.from(range.querySelectorAll('input')).indexOf(element);
        if (index === 0 || index === 1) return `${label} | ${index === 0 ? '开始时间' : '结束时间'}`;
      }
      if (label) return label;
    }
    const labelText = associatedLabelText(element);
    const ariaLabel = element.getAttribute("aria-label");
    const ariaLabelledBy = labelledByText(element);
    const placeholder = element.getAttribute("placeholder");
    const autocomplete = element.getAttribute("autocomplete");
    const name = element.getAttribute("name");
    const id = element.id;
    const dataCy = element.getAttribute("data-cy");
    const testId = element.getAttribute("data-testid");
    const parts = [labelText, ariaLabel, ariaLabelledBy, placeholder, name, id, autocomplete, dataCy, testId];

    // A directly associated label/name is authoritative. Pulling text from a
    // broad parent in this case can leak a neighboring field's label into the
    // match (for example Greenhouse groups Country and Phone together).
    const genericCues = new Set(["请输入", "请选择", "select", "search", "input", "text", "off", "on"]);
    const isInformative = (value) => Boolean(value) && !genericCues.has(core.normalize(value));
    const semanticIdentifier = /(?:name|email|mail|phone|mobile|tel|country|city|address|school|college|major|degree|date|gender|sex|national|location|wechat|project|company|title|position|role|salary)/i;
    const hasDirectIdentity = [labelText, ariaLabel, ariaLabelledBy, placeholder, autocomplete, dataCy, testId].some(isInformative)
      || [name, id].some((value) => isInformative(value) && semanticIdentifier.test(value));
    if (hasDirectIdentity) return parts.filter(Boolean).join(" | ");

    // 没有直接身份线索时，按「表格列名 → 邻居标签 → 容器 → 父节点」由近及远补齐。
    // 注意：容器整段文本本身也带着同一组别名，补进来的邻居文字不会把分数抬高，
    // 它只是让原本完全不重叠的字段有一线召回机会。
    const columnHeader = columnHeaderText(element);
    if (columnHeader) parts.push(columnHeader);
    const neighbour = neighbourLabelText(element);
    if (neighbour) parts.push(neighbour);

    const selectors = ADAPTERS[site]?.containers || ADAPTERS.generic.containers;
    for (const selector of selectors) {
      const container = element.closest(selector);
      if (container && container !== element) {
        parts.push(compactText(container.innerText || container.textContent, 180));
        break;
      }
    }

    const parent = element.parentElement;
    if (parent) parts.push(compactText(parent.innerText || parent.textContent, 120));
    return parts.filter(Boolean).join(" | ");
  }

  function fieldName(element, context) {
    if (globalThis.ResumeHelperSany?.ownsControl(element)) return globalThis.ResumeHelperSany.label(element);
    if (globalThis.ResumeHelperBosc?.ownsControl(element)) return globalThis.ResumeHelperBosc.label(element);
    return compactText(
      associatedLabelText(element) ||
      element.getAttribute("aria-label") ||
      element.getAttribute("placeholder") ||
      element.getAttribute("name") ||
      element.id ||
      context,
      80
    );
  }

  function collectFields(site) {
    if (job51?.ownsPage()) return job51.fields();
    const seen = new Set();
    const fields = [];
    for (const element of document.querySelectorAll(FIELD_SELECTOR)) {
      if (seen.has(element) || !isVisible(element)) continue;
      seen.add(element);
      const type = String(element.getAttribute("type") || "").toLowerCase();
      if (BLOCKED_INPUT_TYPES.has(type) || element.disabled) continue;
      const context = fieldContext(element, site);
      if (!context) continue;
      fields.push({ element, context, name: fieldName(element, context), type: type || element.tagName.toLowerCase() });
    }
    return fields;
  }

  function selectedField(site) {
    const focused = lastFocusedElement;
    if (job51?.ownsPage()) return job51.fields().find(field => field.element === focused || field.job51.controls?.includes(focused)) || null;
    const element = focused;
    if (!element?.isConnected || !isSupportedFieldElement(element) || !isVisible(element)) return null;
    const type = String(element.getAttribute("type") || "").toLowerCase() || element.tagName.toLowerCase();
    const context = fieldContext(element, site);
    return { element, context, name: fieldName(element, context) || "当前输入框", type };
  }

  function choiceContainer(element, site) {
    const selectors = [
      "[role=radiogroup]", "[role=group]", "fieldset", ".ant-form-item", ".semi-form-field",
      ".atsx-form-item", ".moka-form-item", ".form-item", ".form-group", ".field-item",
      ...(ADAPTERS[site]?.containers || [])
    ];
    for (const selector of selectors) {
      const container = element.closest(selector);
      if (container && container !== element && container.querySelectorAll("input[type=radio], input[type=checkbox], [role=radio], [role=checkbox]").length) {
        return container;
      }
    }
    const label = element.closest("label");
    return label?.parentElement || element.parentElement;
  }

  function choiceOptionText(option) {
    if (option instanceof HTMLInputElement && option.labels?.length) {
      return compactText(Array.from(option.labels, (label) => label.innerText || label.textContent).join(" "), 100);
    }
    const label = option.closest("label");
    if (label) return compactText(label.innerText || label.textContent, 100);
    return compactText(option.getAttribute("aria-label") || option.innerText || option.textContent, 100);
  }

  function collectChoiceGroups(site) {
    if (job51?.ownsPage()) return [];
    const byContainer = new Map();
    const options = document.querySelectorAll("input[type=radio], input[type=checkbox], [role=radio], [role=checkbox]" + (isChinalifeZhiyePage() ? ', .phoenix-radio-group .phoenix-radio' : ''));
    for (const option of options) {
      if (!isVisible(option) || option.disabled || option.getAttribute("aria-disabled") === "true") continue;
      const container = option.matches('.phoenix-radio') ? option.closest('.form-item') : choiceContainer(option, site);
      if (!container || container === document.body || container === document.documentElement) continue;
      if (!byContainer.has(container)) byContainer.set(container, []);
      byContainer.get(container).push(option);
    }
    return Array.from(byContainer, ([container, groupOptions]) => {
      const context = [
        container.getAttribute("aria-label"),
        container.querySelector("legend")?.innerText,
        compactText(container.innerText || container.textContent, 260)
      ].filter(Boolean).join(" | ");
      return {
        container,
        options: [...new Set(groupOptions)],
        context,
        name: compactText(container.querySelector("legend")?.innerText || container.getAttribute("aria-label") || context, 80),
        multi: groupOptions.some((option) => option.getAttribute("role") === "checkbox" || option.getAttribute("type") === "checkbox")
      };
    }).filter((group) => group.context);
  }

  function optionSelected(option) {
    if (option instanceof HTMLInputElement) return option.checked;
    if (option.matches('.phoenix-radio') && (isChinalifeZhiyePage()
      || globalThis.ResumeHelperSany?.ownsRecord(option.closest('.ux-standard-form > div.form[id]')))) return option.classList.contains('phoenix-radio--checked');
    return option.getAttribute("aria-checked") === "true" || option.getAttribute("aria-selected") === "true";
  }

  function selectedChoiceValues(group) {
    return group.options.filter(optionSelected).map(choiceOptionText).filter(Boolean);
  }

  async function selectChoiceGroup(group, entry) {
    const targets = entry.multi ? (entry.optionValues?.length ? entry.optionValues : [entry.value]) : targetValues(entry, "select");
    const chosen = targets.map((target) => exactOption(group.options, target, choiceOptionText));
    const desired = entry.multi ? chosen.filter(Boolean) : [chosen.find(Boolean)].filter(Boolean);
    if (!desired.length || (entry.multi && desired.length !== targets.length)) return false;

    const phoenix = isChinalifeZhiyePage() && group.options.some(option => option.matches('.phoenix-radio'));
    const before = phoenix ? captureChoiceState(group) : null;

    for (const option of desired) {
      if (!optionSelected(option)) {
        option.click();
        await wait(60);
      }
    }
    if (!phoenix) return desired.every(optionSelected);
    if (await waitUntil(() => desired.every(optionSelected), {timeout:800})) return true;
    await restoreRecord(before);
    return false;
  }

  function getCurrentValue(element) {
    if (!element) return "";
    const job51Value = job51?.value(element);
    if (job51Value !== undefined) return job51Value;
    if (isChinalifeRadioGroup(element)) return selectedChoiceValues({options:Array.from(element.querySelectorAll('.phoenix-radio'))}).join('、');
    if (element instanceof HTMLSelectElement) {
      if (element.value === "") return "";
      return element.selectedOptions?.[0]?.textContent?.trim() || element.value || "";
    }
    if (element.isContentEditable) return compactText(element.innerText || element.textContent, 4000);
    if ("value" in element) {
      if ((isChinalifeZhiyePage() || isSeyondRecordControl(element) || globalThis.ResumeHelperBosc?.ownsControl(element) || globalThis.ResumeHelperSany?.ownsControl(element)) && element.closest?.('.phoenix-select')) {
        if (isChinalifeRegion(element)) {
          const values = chinalifeRegionSelections(element);
          if (values) return values.map(item => item.label).join('、');
        }
        const display = element.closest('.phoenix-select').querySelector('.phoenix-select__calcEle');
        if (display) {
          const text = compactText(display.textContent, 4000);
          return /^(请选择|请输入)$/.test(text) ? '' : text;
        }
      }
      const udSelect = element.closest?.('.ud__select');
      if (udSelect && element.getAttribute?.('role') === 'combobox') {
        // A search query is not a committed selection. Blank placeholders stay blank.
        const selected = udSelect.querySelector('.ud__select__selector__selectItem');
        return selected ? compactText(selected.innerText || selected.textContent, 300) : '';
      }
      const mokaSelect = element.closest?.("[class*=sd-Select-container]");
      if (mokaSelect) {
        const display = mokaSelect.querySelector("[class*=sd-Input-display-value]");
        if (display) {
          // This input may contain a search query, not the selected value.
          const text = compactText(display.innerText || display.textContent, 300);
          if (!text || /必填项未填写/.test(text) || /^(请选择|请输入|年|月)$/.test(text)) return "";
          return text;
        }
      }
      if (element.getAttribute?.("role") === "combobox" || element.readOnly) {
        const customSelect = element.closest?.(".ant-select, .semi-select, .atsx-select, [class*=Select-container], [class*=select-container]");
        const selected = customSelect?.querySelector?.(
          ".ant-select-selection-item, .semi-select-selection-text, [class*=selection-item], [class*=selected-value], [class*=display-value]"
        );
        if (selected) {
          const text = compactText(selected.innerText || selected.textContent, 300);
          return /^(请选择|请输入)$/.test(text) ? "" : text;
        }
      }
      const value = String(element.value || "").trim();
      if (value) return value;
      const phoenixSelect = element.closest?.(".phoenix-select");
      if (phoenixSelect) {
        for (const display of phoenixSelect.querySelectorAll(".phoenix-select__calcEle, .phoenix-select__placeHolder")) {
          const text = compactText(display.innerText || display.textContent, 300);
          if (text && !/^(请选择|请输入|年|月)$/.test(text)) return text;
        }
      }
      return "";
    }
    if (element.matches?.(".atsx-select")) return compactText(element.querySelector(".atsx-select-selection-selected-value")?.textContent, 300);
    return compactText(element.getAttribute("aria-valuetext") || element.innerText || element.textContent, 4000);
  }

  // 组合框的显示层：值真正呈现给用户的地方。没有它时才回退到读 input 的 value。
  function choiceDisplayElement(element) {
    const wrapper = element.closest?.(
      ".ant-select, .semi-select, .atsx-select, [class*=Select-container], [class*=select-container], [class*=select]"
    );
    return wrapper?.querySelector?.(
      ".ud__select__selector__selectItem, .ant-select-selection-item, .semi-select-selection-text, [class*=selection-item], [class*=selected-value], [class*=display-value]"
    ) || null;
  }

  function setNativeValue(element, value) {    if (element.isContentEditable) {
      element.focus();
      element.textContent = value;
      return;
    }
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor?.set) descriptor.set.call(element, value);
    else element.value = value;
  }

  function dispatchEditEvents(element) {
    for (const type of ["input", "change"]) {
      element.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
    }
    element.dispatchEvent(new FocusEvent("blur", { bubbles: true, composed: true }));
  }

  function captureFieldState(field) {
    const state = job51?.snapshot(field.element);
    if (state) return { kind: "job51Composite", element: field.element, values: state, locator: cssLocator(field.element),
      job51Module: job51.moduleName(), job51Identity: job51.identity(field.element) };
    const { element } = field;
    if (isChinalifeRadioGroup(element)) return captureChoiceState({options:Array.from(element.querySelectorAll('.phoenix-radio'))});
    const pair = linkedElementDates(element);
    if (pair) return { kind: "linkedDates", element, elements: pair.elements, values: pair.elements.map(getCurrentValue),
      groupElement: pair.scope, locator: cssLocator(element) };
    return {
      kind: "field",
      job51Module: job51?.info(element)?.job51.module,
      job51Identity: job51?.identity(element),
      element,
      groupElement: element.closest?.('.form, [class*=apply-fields], .resumeEditForm-item, [data-repeat-item], .repeat-item, [class^="apply-form-array-card__"]'),
      locator: cssLocator(element),
      value: getCurrentValue(element),
      selectedValues: element instanceof HTMLSelectElement ? Array.from(element.selectedOptions, (option) => option.value) : null,
      chinalifeRegions: isChinalifeRegion(element) ? chinalifeRegionSelections(element) : null,
      zhiyeMonth: isZhiyeMonthControl(element)
    };
  }

  function captureChoiceState(group) {
    return {
      kind: "choice",
      options: group.options.map((option) => ({ option, selected: optionSelected(option) }))
    };
  }

  function retainFailedChoiceWrite(transaction, record) {
    if (record.options.some(item => item.option?.isConnected && optionSelected(item.option) !== item.selected)) transaction.push(record);
  }

  function groupSnapshot(element) {
    return JSON.stringify(Array.from(element.querySelectorAll(`${FIELD_SELECTOR}, .atsx-select, .atsx-date-picker-period-month-label, input[type=radio], input[type=checkbox]${isChinalifeZhiyePage() ? ', .phoenix-radio-group .phoenix-radio' : ''}`), (control) => (
      control.matches('.phoenix-radio') ? ['phoenix-radio',optionSelected(control)] : /^(radio|checkbox)$/.test(control.type) ? [control.type, control.checked] : [control.tagName, getCurrentValue(control), "value" in control ? String(control.value) : null]
    )));
  }

  // Only groups observed being added by this transaction are eligible for removal.
  function captureAddedGroup(report, element, getItems) {
    report.transaction.push({ kind: "addedGroup", element, getItems });
  }

  async function removeAddedGroup(record) {
    if (!record.element?.isConnected) return true;
    if (groupSnapshot(record.element) !== record.afterSnapshot) return false;
    if (isChinalifeZhiyePage()) return removeChinalifeRecord(record.element, record.getItems);
    const buttons = Array.from(record.element.querySelectorAll("button, a, [role=button], [aria-label]"));
    const remove = buttons.filter(isVisible).filter((button) => !button.disabled && button.getAttribute("aria-disabled") !== "true")
      .filter((button) => /^(删除|移除|删除本条|删除本组|删除经历|删除记录|remove|delete)$/i.test(compactText(button.getAttribute("aria-label") || button.getAttribute("title") || button.innerText || button.textContent, 50)));
    if (remove.length !== 1) return false;
    remove[0].click();
    return Boolean(await waitUntil(() => !record.getItems().includes(record.element), { timeout: 1000 }));
  }

  function feishuPeriodValues(period) {
    return Array.from(period.querySelectorAll(".atsx-date-picker-period-month-label"), (label) => {
      const year = label.querySelector(".atsx-date-picker-period-month-label-year")?.textContent?.trim();
      const month = label.querySelector(".atsx-date-picker-period-month-label-month")?.textContent?.trim();
      return /^\d{4}$/.test(year || "") && /^\d{1,2}$/.test(month || "") ? `${year}-${month.padStart(2, "0")}` : "";
    });
  }

  async function restoreRecord(record) {
    if (record.job51Module && (!job51?.ownsPage() || job51.moduleName() !== record.job51Module
      || job51.identity(record.element?.isConnected ? record.element : document.querySelector(record.locator)) !== record.job51Identity)) return false;
    if (record.kind === "job51Composite") {
      const element = record.element?.isConnected ? record.element : document.querySelector(record.locator);
      if (!element || !job51?.info(element)
        || (record.afterValues && JSON.stringify(job51.snapshot(element)) !== JSON.stringify(record.afterValues))) return false;
      return job51.restore(element, record.values);
    }
    if (record.kind === "linkedDates") {
      if (record.elements.some(element => !element?.isConnected)
        || (record.afterValues && JSON.stringify(record.elements.map(getCurrentValue)) !== JSON.stringify(record.afterValues))) return false;
      return restoreLinkedDates(record);
    }
    if (record.kind === "feishuPeriod") {
      if (!record.element?.isConnected || JSON.stringify(feishuPeriodValues(record.element)) !== record.afterValue) return false;
      if (record.values.some((value) => !value)) {
        const clear = record.element.querySelector('[class*=clear], [aria-label="清空"]');
        if (!clear || !isVisible(clear)) return false;
        clear.click();
        if (!await waitUntil(() => feishuPeriodValues(record.element).every((value) => !value), { timeout: 700 })) return false;
      }
      for (let index = 0; index < record.values.length; index += 1) {
        if (record.values[index] && !await chooseFeishuMonth(record.element, record.values[index], index)) return false;
      }
      return JSON.stringify(feishuPeriodValues(record.element)) === JSON.stringify(record.values);
    }
    if (record.kind === "choice") {
      if (record.options.some((item) => !item.option?.isConnected || (item.afterSelected !== undefined && optionSelected(item.option) !== item.afterSelected))) return false;
      for (const item of record.options) {
        if (!item.option?.isConnected || optionSelected(item.option) === item.selected) continue;
        if (item.option instanceof HTMLInputElement && item.option.type === "radio" && !item.selected) {
          item.option.checked = false;
          dispatchEditEvents(item.option);
        } else item.option.click();
        await wait(40);
      }
      return record.options.every((item) => item.option?.isConnected && optionSelected(item.option) === item.selected);
    }

    const element = record.element?.isConnected ? record.element : document.querySelector(record.locator || "__missing_undo_target__");
    if (!element?.isConnected) return false;
    if (record.afterValue !== undefined && getCurrentValue(element) !== record.afterValue) return false;
    if (record.afterInputValue !== undefined && "value" in element && String(element.value) !== record.afterInputValue) return false;
    if (isChinalifeRegion(element)) {
      if (!record.chinalifeRegions || (record.chinalifeAfterRegions && JSON.stringify(chinalifeRegionSelections(element)) !== JSON.stringify(record.chinalifeAfterRegions))) return false;
      return chooseChinalifeRegion(element, {}, record.chinalifeRegions, false);
    }
    if (chinalifeDatePrecision(element)) return record.value
      ? chooseChinalifeDate(element, { value: record.value }, false) : clearChinalifeChoice(element);
    if ((isChinalifeZhiyePage() || isSeyondRecordControl(element) || globalThis.ResumeHelperBosc?.ownsControl(element) || globalThis.ResumeHelperSany?.ownsControl(element)) && element.closest?.('.phoenix-select')) return record.value
      ? chooseChinalifeOption(element, { value: record.value }) : clearChinalifeChoice(element);
    if (isElementDayPicker(element)) return record.value
      ? chooseElementDay(element, { value: record.value }, false) : clearControlledDate(element);
    if (isCmbMonthPicker(element)) return record.value
      ? chooseCmbMonth(element, { value: record.value }, false) : clearCmbDate(element);
    if (isCmbHonorChoice(element)) return record.value
      ? chooseCmbHonorChoice(element, { value: record.value }) : clearCmbHonorChoice(element);
    if (isMokaMonthPicker(element)) return record.value ? chooseMokaMonth(element, record.value, [], false) : clearControlledDate(element);
    if (isMokaDayPicker(element) && !record.value) return clearControlledDate(element);
    if (isMokaRegionControl(element)) return record.value ? restoreMokaRegionValue(element, record.value) : clearControlledChoice(element);
    if (isMokaDropdown(element) && !record.value) return clearControlledChoice(element);
    if (isZhaopinSearchChoice(element) || isZhaopinRegion(element)) {
      if (record.value) return writeField({ element, type: "text" }, { value: record.value,
        optionValues: [], pathValues: isZhaopinRegion(element) ? record.value.split(/\s*[\/>]\s*/).filter(Boolean).map(value => [value]) : [] });
      return clearZhaopinChoice(element);
    }
    if (isFeishuYearControl(element)) {
      if (record.value) return chooseFeishuYear(element, record.value);
      const clear = element.closest('.atsx-date-picker')?.querySelector('.atsx-date-picker-clear');
      if (!clear || !isVisible(clear)) return false;
      clear.click();
      return Boolean(await waitUntil(() => !getCurrentValue(element), { timeout: 900 }));
    }
    if (record.zhiyeMonth) {
      if (record.value) return chooseZhiyeMonth(element, record.value);
      const clear = element.closest(".phoenix-select")?.querySelector(".phoenix-select__clearIcon");
      if (!clear) return false;
      clear.click();
      await wait(180);
      return !getCurrentValue(element);
    }
    if (element.closest?.('.throne-biz-date-range-picker-wrapper')) {
      if (record.value) return chooseUdMonth(element, record.value);
      const clear = element.closest('.throne-biz-date-range-picker-input')?.querySelector('.ud__input__clear-icon');
      if (!clear || !isVisible(clear)) return false;
      clear.click();
      return Boolean(await waitUntil(() => !getCurrentValue(element), { timeout: 900 }));
    }
    if (element instanceof HTMLSelectElement) {
      const selected = new Set(record.selectedValues || []);
      for (const option of element.options) option.selected = selected.has(option.value);
      dispatchEditEvents(element);
      return getCurrentValue(element) === record.value;
    }
    if (record.value && (isMokaDropdown(element) || element.closest?.(".phoenix-select") || element.getAttribute("role") === "combobox")) {
      return isMokaDropdown(element)
        ? (await writeMokaValue(element, record.value, { overwrite: true })).success
        : await writeField({ element, type: element.type || "text" }, { value: record.value, optionValues: [] });
    }
    if (element.matches?.(".atsx-select") && record.value) return chooseFeishuOption(element, [record.value]);
    if (!record.value && (isMokaDropdown(element) || element.closest?.(".phoenix-select") || element.matches?.(".atsx-select") || element.getAttribute("role") === "combobox")) {
      const container = element.closest(".ud__select, .phoenix-select, .ant-select, .atsx-select, [class*=sd-Select-container]");
      const clear = container?.querySelector(".ud__select__selector__clear, .phoenix-select__clearIcon, .ant-select-clear, .atsx-select-selection-clear, [class*=clearIcon], [class*=clear-icon]");
      if (!clear || !isVisible(clear)) return false;
      clear.click();
      return Boolean(await waitUntil(() => !getCurrentValue(element), { timeout: 700 }));
    }
    if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement) && !element.isContentEditable) return false;
    setNativeValue(element, record.value);
    dispatchEditEvents(element);
    return getCurrentValue(element) === record.value;
  }

  async function clearControlledChoice(element) {
    const container = element.closest(".s-region, .el-select, [class*=sd-Dropdown-container], [class*=sd-Select-container]");
    container?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
    container?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    const clear = Array.from(container?.querySelectorAll("[class*=clearIcon], [class*=clear-icon], .el-icon-circle-close, [aria-label='清空']") || [])
      .filter(isVisible).filter(node => !node.disabled);
    if (clear.length !== 1) return false;
    clear[0].click();
    return Boolean(await waitUntil(() => !getCurrentValue(element), { timeout: 900 }));
  }

  function sealTransaction(records) {
    for (const record of records) {
      if (record.kind === "job51Composite") { record.afterValues = job51?.snapshot(record.element); continue; }
      if (record.kind === "addedGroup") { record.afterSnapshot = groupSnapshot(record.element); continue; }
      if (record.kind === "feishuPeriod") { record.afterValue = JSON.stringify(feishuPeriodValues(record.element)); continue; }
      if (record.kind === "linkedDates") { record.afterValues = record.elements.map(getCurrentValue); continue; }
      if (record.kind === "choice") { record.options.forEach((item) => { item.afterSelected = optionSelected(item.option); }); continue; }
      if (record.kind !== "field") continue;
      const element = record.element?.isConnected ? record.element : document.querySelector(record.locator || "__missing_undo_target__");
      if (element) {
        record.afterValue = getCurrentValue(element);
        if (isChinalifeRegion(element)) record.chinalifeAfterRegions = chinalifeRegionSelections(element);
        if ("value" in element) record.afterInputValue = String(element.value);
      }
    }
    for (const record of lastTransaction) {
      if (record.kind === "addedGroup" && record.element.isConnected && !record.userModified) record.afterSnapshot = groupSnapshot(record.element);
    }
    return records;
  }

  function protectChangedGroups() {
    for (const record of lastTransaction) {
      if (record.kind === "addedGroup" && record.element.isConnected && groupSnapshot(record.element) !== record.afterSnapshot) record.userModified = true;
    }
  }

  function normalizedValueMatches(actual, expected) {
    const normalize = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    const a = normalize(actual);
    const e = normalize(expected);
    if (!a || !e) return false;
    return a === e;
  }

  function targetValues(entry, inputType) {
    const formatted = core.formatValue(entry, inputType);
    return [formatted, ...(entry.optionValues || [])].filter(Boolean);
  }

  function exactOption(options, target, text = (option) => option.innerText || option.textContent || option.getAttribute?.("title")) {
    const normalize = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
    const matches = options.filter((option) => !option.disabled && option.getAttribute?.("aria-disabled") !== "true"
      && !/(?:^|[\s_-])disabled(?:$|[\s_-])/i.test(option.className || "")
      && normalize(text(option)) === normalize(target));
    const leaves = matches.filter((option) => !matches.some((other) => other !== option && option.contains?.(other)));
    return leaves.length === 1 ? leaves[0] : null;
  }

  function chooseNativeSelect(element, entry) {
    const normalizeOption = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
    const targets = targetValues(entry, "select").map(normalizeOption);
    const options = Array.from(element.options).filter((option) => !option.disabled && !option.hidden);
    let selected;
    for (const target of targets) {
      const matches = options.filter((option) => target === normalizeOption(option.textContent) || target === normalizeOption(option.value));
      if (matches.length > 1) return false;
      if (matches.length === 1) { selected = matches[0]; break; }
    }
    if (!selected) return false;
    element.value = selected.value;
    selected.selected = true;
    dispatchEditEvents(element);
    return normalizedValueMatches(getCurrentValue(element), selected.textContent || selected.value);
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 观察式等待：面板是被 JS 渲染进来的，固定 sleep 在慢机器上必然抓空。
  // 轮询到条件成立就立刻返回，最坏情况退化回原来的一个固定等待。
  //
  // heavyInterval：predicate 昂贵时（要遍历并排序整个候选列表）用它限流。
  // 不加限流会把「只调用一次的昂贵收集」变成一秒内跑几十次——这正是拖慢
  // Moka 这种字段极多页面的原因。
  async function waitUntil(predicate, { timeout = 900, interval = 40, heavyInterval = 0 } = {}) {
    const deadline = Date.now() + timeout;
    let lastHeavy = 0;
    for (;;) {
      const now = Date.now();
      if (!heavyInterval || now - lastHeavy >= heavyInterval) {
        lastHeavy = now;
        let result;
        try {
          result = predicate();
        } catch (_) {
          result = null;
        }
        if (result) return result;
      }
      if (now >= deadline) return null;
      await wait(interval);
    }
  }

  async function waitForElement(predicate, options) {
    return waitUntil(predicate, options);
  }

  // 通用兜底：现有 10 组选择器之外，再认一认「刚冒出来的浮层里那些可点小项」，
  // 覆盖 element-ui / arco / tdesign / 自研列表。
  const GENERIC_OPTION_CONTAINER = [
    "[role=listbox]", "[role=menu]", "[role=tree]", "[role=grid]",
    "[class*=dropdown]:not([class*=hidden])", "[class*=popover]", "[class*=popper]", "[class*=popup]",
    "[class*=select-menu]", "[class*=options-list]", "[class*=cascader-menu]"
  ].join(",");

  function genericOptionCandidates(element) {
    const containers = [];
    const seen = new Set();
    const roots = [document];
    const owner = element?.closest?.("[class*=dropdown], [class*=select], [class*=picker], [class*=popover], [class*=popper], [class*=popup]");
    if (owner?.parentElement) roots.unshift(owner.parentElement);
    for (const root of roots) {
      for (const container of root.querySelectorAll(GENERIC_OPTION_CONTAINER)) {
        if (seen.has(container) || !isVisible(container)) continue;
        seen.add(container);
        containers.push(container);
      }
    }
    const options = [];
    const seenItems = new Set();
    for (const container of containers) {
      // 收叶子节点：选项的文字各不相同，但类名千奇百怪（.opt / .arco-select-option / 无类名）。
      // 只认「有文字、无元素子节点、可见」，不依赖类名。
      for (const item of container.querySelectorAll("*")) {
        if (seenItems.has(item) || !isVisible(item) || item.children.length) continue;
        const text = compactText(item.textContent, 120);
        if (!text || text.length > 100) continue;
        seenItems.add(item);
        options.push(item);
      }
    }
    return options;
  }

  // 专用适配器（Moka / Zhiye）继续只用它们各自已知的选择器，行为与改造前一致。
  function visibleOptions(root = document) {
    const selectors = [
      "[role=listbox] [role=option]", "[role=option]", ".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option",
      ".ant-cascader-menus .ant-cascader-menu-item", ".semi-select-option", ".atsx-select-option",
      ".moka-select-option", ".rc-virtual-list-holder [title]"
      , "[class*=sd-Menu-content-item]", "[class*=sd-Tag-container]",
      "[class*=sd-Dropdown-dropdown] [class*=item]"
    ];
    const options = [];
    const seen = new Set();
    for (const selector of selectors) {
      for (const option of root.querySelectorAll(selector)) {
        if (!seen.has(option) && isVisible(option)) {
          seen.add(option);
          options.push(option);
        }
      }
    }
    return options;
  }

  // 通用路径专用：已知选择器都没命中时，才退到与类名无关的叶子节点兜底。
  // 单独成函数是为了不让这个兜底影响 Moka / Zhiye 的既有匹配行为。
  function genericVisibleOptions(element) {
    const known = visibleOptions();
    if (known.length) return known;
    return genericOptionCandidates(element);
  }

  function visibleMokaPopupCandidates() {
    const candidates = [];
    const seen = new Set();
    const popups = Array.from(document.querySelectorAll("[class*=sd-Dropdown-dropdown], [class*=sd-panal-menu-wrapper]")).filter(isVisible);
    for (const popup of popups) {
      for (const element of popup.querySelectorAll("[role=option], button, li, [class*=item], div, span")) {
        if (seen.has(element) || !isVisible(element)) continue;
        const text = compactText(element.innerText || element.textContent, 220);
        if (!text || text.length > 180) continue;
        seen.add(element);
        candidates.push(element);
      }
    }
    return candidates.sort((left, right) => left.querySelectorAll("*").length - right.querySelectorAll("*").length);
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 观察式等待的廉价闸门：先花一次 querySelector 判断浮层有没有出现，
  // 没出现就直接返回，不必每轮都跑一遍昂贵的候选收集与排序。
  function anyOptionLayerPresent() {
    return Boolean(document.querySelector(
      "[class*=dropdown], [class*=popup], [class*=popper], [class*=popover], [role=listbox], [role=option], [role=menu]"
    ));
  }

  async function chooseCustomOption(element, entry) {
    if (entry.multi) return false;
    const targets = targetValues(entry, element.getAttribute("type") || "text");
    const findChoice = (options, target) => {
      const normalize = (text) => String(text || "").trim().replace(/\s+/g, " ").toLowerCase();
      const matches = options.filter((option) => !option.disabled && option.getAttribute("aria-disabled") !== "true"
        && normalize(option.innerText || option.textContent || option.getAttribute("title")) === normalize(target));
      return matches.length === 1 ? matches[0] : null;
    };
    element.focus();
    element.click();
    let options = await waitUntil(() => {
      const found = genericVisibleOptions(element);
      return found.length ? found : null;
    }, { timeout: 900, heavyInterval: 200 });
    options = options || [];
    for (const target of targets) {
      let chosen = findChoice(options, target);
      if (!chosen && !element.readOnly && "value" in element) {
        setNativeValue(element, "");
        element.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "deleteContentBackward", data: null }));
        setNativeValue(element, target);
        element.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: target }));
        options = (await waitUntil(() => {
          const found = genericVisibleOptions(element);
          return found.length ? found : null;
        }, { timeout: 1200 })) || [];
        chosen = findChoice(options, target);
      }
      if (chosen) {
        chosen.click();
        await wait(100);
        const actual = getCurrentValue(element);
        return targets.some((expected) => normalizedValueMatches(actual, expected));
      }
    }
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    return false;
  }

  function visibleUdLayers(selector) {
    return Array.from(document.querySelectorAll(selector)).filter((layer) => {
      if (!isVisible(layer)) return false;
      const popup = layer.closest('.ud__dropdown, .ud__select__dropdown');
      return !popup || isVisible(popup);
    });
  }

  function closeUdControl(element) {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    element.blur();
  }

  // The observed ByteDance form uses Universe Design, not ATSX/Semi controls.
  // Select only a newly opened unique layer; do not borrow stale portal options.
  async function chooseUdOption(element, entry) {
    const before = new Set(visibleUdLayers('.ud__select__dropdown'));
    controlFailures.set(element, '未打开控件');
    element.focus(); element.click();
    const popup = await waitUntil(() => {
      const layers = visibleUdLayers('.ud__select__dropdown');
      return layers.length === 1 && !before.has(layers[0]) ? layers[0] : null;
    }, { timeout: 1200 });
    if (!popup) { closeUdControl(element); return false; }
    controlFailures.set(element, '未找到下拉选项或存在歧义');
    for (const target of targetValues(entry, 'select')) {
      let option = exactOption(Array.from(popup.querySelectorAll('.ud__select__list__item')).filter(isVisible), target);
      if (!option && !element.readOnly) {
        setNativeValue(element, target);
        element.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: target }));
        option = await waitUntil(() => exactOption(Array.from(popup.querySelectorAll('.ud__select__list__item')).filter(isVisible), target), { timeout: 1000 });
      }
      if (!option) continue;
      option.click();
      controlFailures.set(element, '写入未确认');
      const confirmed = await waitUntil(() => normalizedValueMatches(getCurrentValue(element), target), { timeout: 900 });
      closeUdControl(element);
      if (confirmed) controlFailures.delete(element);
      return Boolean(confirmed);
    }
    closeUdControl(element); return false;
  }

  async function chooseUdMonth(element, value) {
    const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(String(value));
    if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return false;
    const expected = `${match[1]}-${match[2]}`;
    const before = new Set(visibleUdLayers('.throne-biz-date-range-picker-panel'));
    controlFailures.set(element, '未打开控件');
    element.focus(); element.click();
    const panel = await waitUntil(() => {
      const layers = visibleUdLayers('.throne-biz-date-range-picker-panel');
      return layers.length === 1 && !before.has(layers[0]) ? layers[0] : null;
    }, { timeout: 1200 });
    if (!panel) { closeUdControl(element); return false; }
    const shownYear = () => {
      const label = compactText(panel.querySelector('.ud__picker-panel-header-btn')?.textContent, 20);
      return /^(\d{4})年$/.exec(label)?.[1] || '';
    };
    controlFailures.set(element, '未找到日期选项');
    const deadline = Date.now() + 18000;
    while (shownYear() && shownYear() !== match[1] && Date.now() < deadline) {
      const previous = shownYear();
      const icon = Number(previous) > Number(match[1]) ? 'LeftBoldOutlined' : 'RightBoldOutlined';
      const buttons = Array.from(panel.querySelectorAll(`button:has([data-icon="${icon}"])`)).filter(isVisible);
      if (buttons.length !== 1 || buttons[0].disabled || buttons[0].getAttribute('aria-disabled') === 'true') break;
      buttons[0].click();
      if (!await waitUntil(() => shownYear() && shownYear() !== previous, { timeout: 900 })) break;
    }
    if (shownYear() !== match[1]) { closeUdControl(element); return false; }
    const options = Array.from(panel.querySelectorAll('.ud__picker-month-panel-cell')).filter(isVisible);
    const month = exactOption(options, `${Number(match[2])}月`, (cell) => {
      const text = compactText(cell.querySelector('.ud__picker__cell-interactive-area')?.textContent, 10);
      return /^\d{1,2}月$/.test(text) ? `${parseInt(text, 10)}月` : '';
    });
    if (!month) { closeUdControl(element); return false; }
    month.click();
    controlFailures.set(element, '写入未确认');
    const confirmed = await waitUntil(() => getCurrentValue(element) === expected, { timeout: 1000 });
    closeUdControl(element);
    if (confirmed) controlFailures.delete(element);
    return Boolean(confirmed);
  }

  function cascadeLevelOptions(options, level) {
    const groups = [...new Set(options.map((option) => option.closest?.('[role="listbox"], [role="menu"], ul, [class*=cascader-menu]')).filter(Boolean))];
    if (!groups.length) return level === 0 ? options : [];
    const group = groups[level];
    return group ? options.filter((option) => option.closest('[role="listbox"], [role="menu"], ul, [class*=cascader-menu]') === group) : [];
  }

  // 每行一个层级；只在该层尝试用户给定的候选，失败不再回退成普通下拉。
  async function chooseCascaderPath(field, entry) {
    const { element } = field;
    const segments = entry.pathValues || [];
    const selected = [];
    element.focus();
    element.click();
    for (let level = 0; level < segments.length; level += 1) {
      const candidates = Array.isArray(segments[level]) ? segments[level] : [segments[level]];
      const optionText = (option) => compactText(option.innerText || option.textContent || option.getAttribute("title"), 120);
      let chosen = null;
      for (let attempt = 0; attempt < 3 && !chosen; attempt += 1) {
        const options = await waitUntil(() => {
          if (!anyOptionLayerPresent()) return null;
          const found = cascadeLevelOptions(genericVisibleOptions(element), level);
          return found.length ? found : null;
        }, { timeout: 700, interval: 50, heavyInterval: 200 }) || [];
        for (const candidate of candidates) {
          chosen = exactOption(options, candidate, optionText);
          if (chosen) break;
        }
      }
      if (!chosen) {
        controlFailures.set(element, `级联第 ${level + 1} 级未找到选项或存在歧义`);
        element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
        return false;
      }
      selected.push(optionText(chosen));
      chosen.click();
      await wait(80);
    }
    await wait(100);
    const actual = getCurrentValue(element);
    const normalizePath = (value) => String(value).toLowerCase().replace(/[\s/＞>、,，|]/g, "");
    const confirmed = normalizePath(actual) === normalizePath(selected.join(""));
    if (!confirmed) controlFailures.set(element, "级联写入未确认");
    return confirmed;
  }

  async function writeScalarValue(element, value) {
    controlFailures.delete(element);
    unconfirmedScalarWrites.delete(element);
    const before = getCurrentValue(element);
    element.focus();
    setNativeValue(element, value);
    dispatchEditEvents(element);
    await wait(30);
    if (normalizedValueMatches(getCurrentValue(element), value)) return { success: true };
    // Controlled inputs may sanitize values (for example, strip a decimal point).
    // Do not leave the altered value behind or mistake it for the requested value.
    setNativeValue(element, before);
    dispatchEditEvents(element);
    await wait(30);
    const restored = String(getCurrentValue(element) ?? "") === String(before ?? "");
    const reason = restored
      ? "写入未确认：网站改写或拒绝填写值，已恢复填写前内容"
      : "写入未确认：网站改写或拒绝填写值，原值恢复未确认，请检查";
    controlFailures.set(element, reason);
    if (!restored) unconfirmedScalarWrites.add(element);
    return { success: false, needsUndo: !restored, reason };
  }

  function retainFailedScalarWrite(transaction, record) {
    if (record?.kind === "job51Composite") {
      if (JSON.stringify(job51?.snapshot(record.element)) !== JSON.stringify(record.values)) transaction.push(record);
      return;
    }
    if (record?.kind === 'choice') { retainFailedChoiceWrite(transaction, record); return; }
    if (!record?.element || !unconfirmedScalarWrites.has(record.element)) return;
    unconfirmedScalarWrites.delete(record.element);
    transaction.push(record);
  }

  async function writeField(field, entry, explicitTarget = false) {
    const { element, type } = field;
    if (globalThis.ResumeHelperSany?.requiresOwnership(element) && !globalThis.ResumeHelperSany.ownsControl(element)) {
      controlFailures.set(element,'三一控件归属或字段结构未知，请手动处理');return false;
    }
    if (globalThis.ResumeHelperBosc?.ownsUrl() && !globalThis.ResumeHelperBosc.ownsControl(element)
      && !(explicitTarget && globalThis.ResumeHelperBosc.ownsPlainTarget(element))) {
      controlFailures.set(element,'本站控件归属或字段结构未知，请手动处理'); return false;
    }
    if (job51?.info(element)?.job51.module === "self" && String(entry.value || "").length > 4000) { controlFailures.set(element,"自我评价超过网站 4000 字限制，请手动精简；未截断填写"); return false; }
    const job51Written=await job51?.write(element,entry);
    if(job51Written!==undefined&&job51Written!==null)return job51Written;
    if (isChinalifeRadioGroup(element)) return selectChoiceGroup({options:Array.from(element.querySelectorAll('.phoenix-radio'))}, entry);
    datePrecisionNotes.delete(element);
    if (isSanyDateCandidate(element)) return chooseChinalifeDate(element, entry);
    if (chinalifeDatePrecision(element)) return chooseChinalifeDate(element, entry);
    if (isChinalifeRegion(element)) return chooseChinalifeRegion(element, entry);
    if ((isChinalifeZhiyePage() || isSeyondRecordControl(element) || globalThis.ResumeHelperBosc?.ownsControl(element) || globalThis.ResumeHelperSany?.ownsControl(element)) && element.closest?.('.phoenix-select')) return chooseChinalifeOption(element, entry);
    if (entry.fieldType === "date" && entry.pathValues?.length) {
      const policy = dateSelectionPolicy(entry, "month");
      if (policy.reason) { controlFailures.set(element, policy.reason); return false; }
    }
    if (isElementDayPicker(element)) {
      const pair = linkedElementDates(element);
      return pair ? writeLinkedDates(pair, new Map([[element, entry]]), captureFieldState(field)) : chooseElementDay(element, entry);
    }
    if (isZhaopinRegion(element)) return chooseZhaopinRegion(element, entry);
    if (isZhaopinSearchChoice(element)) return chooseZhaopinSearchChoice(element, entry);
    if (isCmbMonthPicker(element)) return chooseCmbMonth(element, entry);
    if (isCmbHonorChoice(element)) return chooseCmbHonorChoice(element, entry);
    if (isFeishuYearControl(element)) return chooseFeishuYear(element, entry.value);
    if (element instanceof HTMLSelectElement) return chooseNativeSelect(element, entry);
    if (element.matches?.(".atsx-select")) return chooseFeishuOption(element, targetValues(entry, "select"));
    if (element.closest?.('.throne-biz-date-range-picker-wrapper')) {
      if (entry.fieldType !== "date") return chooseUdMonth(element, String(entry.value || ""));
      const policy = dateSelectionPolicy(entry, "month");
      if (policy.reason) { controlFailures.set(element, policy.reason); return false; }
      const success = await chooseUdMonth(element, policy.parts.ym);
      if (success && policy.parts.day) datePrecisionNotes.set(element, "网站仅支持年月，已填写年月并忽略日");
      return success;
    }
    if (element.closest?.('.ud__select') && element.getAttribute('role') === 'combobox') return chooseUdOption(element, entry);

    if (isMokaMonthPicker(element)) return chooseMokaMonth(element, String(entry.value || ""), entry.pathValues);
    if (isMokaDayPicker(element)) return chooseMokaDay(element, String(entry.value || ""), entry.pathValues);
    if (isAntDayPicker(element)) {
      if (entry.fieldType !== "date") return chooseAntDay(element, String(entry.value || ""));
      const policy = dateSelectionPolicy(entry);
      if (policy.reason) { controlFailures.set(element, policy.reason); return false; }
      return chooseAntDay(element, policy.parts.date);
    }
    if (isMokaDropdown(element)) return (await writeMokaValue(element, entry.value, { overwrite: true, optionValues: entry.optionValues, pathValues: entry.pathValues, fieldType: entry.fieldType })).success;
    if (isZhiyeMonthControl(element)) {
      if (entry.fieldType !== "date") return chooseZhiyeMonth(element, String(entry.value || ""));
      const policy = dateSelectionPolicy(entry, "month");
      if (policy.reason) { controlFailures.set(element, policy.reason); return false; }
      const success = await chooseZhiyeMonth(element, policy.parts.ym);
      if (success && policy.parts.day) datePrecisionNotes.set(element, "网站仅支持年月，已填写年月并忽略日");
      return success;
    }
    if (element.closest?.(".phoenix-select")) return chooseZhiyeOption(element, targetValues(entry, "select"));

    const isCustomChoice = element.getAttribute("role") === "combobox" || element.readOnly || Boolean(element.closest?.("[class*=sd-Dropdown-container]"));
    if (isCustomChoice && entry.pathValues?.length && entry.fieldType !== "date") {
      return chooseCascaderPath(field, entry);
    }
    if (isCustomChoice) {
      return chooseCustomOption(element, entry);
    }

    if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement) && !element.isContentEditable) {
      return false;
    }

    let value = core.formatValue(entry, type);
    if (type === "date" || type === "month") {
      const policy = dateSelectionPolicy(entry, type === "month" ? "month" : "day");
      if (policy.reason) { controlFailures.set(element, policy.reason); return false; }
      value = type === "month" ? policy.parts.ym : policy.parts.date;
      if (type === "month" && policy.parts.day) datePrecisionNotes.set(element, "网站仅支持年月，已填写年月并忽略日");
    }
    return (await writeScalarValue(element, value)).success;
  }

  function cssLocator(element) {
    const owned = job51?.locator(element);
    if (owned) return owned;
    if (element.id && document.querySelectorAll(`#${CSS.escape(element.id)}`).length === 1) return `#${CSS.escape(element.id)}`;
    const dataCy = element.getAttribute("data-cy");
    if (dataCy && document.querySelectorAll(`[data-cy="${CSS.escape(dataCy)}"]`).length === 1) return `[data-cy="${CSS.escape(dataCy)}"]`;
    const name = element.getAttribute("name");
    if (name) {
      const same = document.querySelectorAll(`[name="${CSS.escape(name)}"]`);
      if (same.length === 1) return `[name="${CSS.escape(name)}"]`;
    }
    const path = [];
    let node = element;
    while (node && node !== document.body) {
      if (node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
        path.unshift(`#${CSS.escape(node.id)}`);
        return path.join(" > ");
      }
      let part = node.tagName.toLowerCase();
      const siblings = node.parentElement ? Array.from(node.parentElement.children).filter((child) => child.tagName === node.tagName) : [];
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      path.unshift(part);
      node = node.parentElement;
    }
    return `body > ${path.join(" > ")}`;
  }

  function highlight(element, status) {
    element.dataset.resumeHelperStatus = status;
    element.style.outline = status === "filled" ? "2px solid #2b8a66" : "2px solid #d97706";
    element.style.outlineOffset = "2px";
  }

  function isMokaStructuredPage() {
    const fixture = document.documentElement.dataset.resumeHelperFixture;
    if (fixture === "zte" || fixture === "mokahr") return true;
    return core.detectSite(location.hostname) === "mokahr"
      && Boolean(document.querySelector("[data-nav-id] [class*=apply-fields], [data-nav-id][class*=apply-fields], [class*='apply-block-'] [class*=apply-fields]"));
  }

  const MOKA_BLOCKS = {
    apply: { fallbackId: "block-applyInfo", headings: ["申请信息"] },
    basic: { fallbackId: "block-basicInfo", headings: ["个人信息", "基本信息"] },
    education: { fallbackId: "block-educationInfo", headings: ["教育背景", "教育经历"] },
    experience: { fallbackId: "block-practiceInfo", headings: ["实习经历", "工作经历", "实践经历"] },
    projects: { fallbackId: "block-projectInfo", headings: ["项目经历", "项目经验"] },
    papers: { fallbackId: "block-34807", headings: ["论文", "论文信息", "论文成果", "期刊发表情况", "论文/期刊"] },
    competitions: { fallbackId: "block-32781", headings: ["竞赛", "竞赛经历"] },
    honors: { fallbackId: "block-32786", headings: ["荣誉奖项", "奖项", "获奖经历", "获奖情况"] },
    programmingLanguages: { fallbackId: "block-30701", headings: ["编程语言能力", "编程语言"] },
    foreignLanguages: { fallbackId: "block-30706", headings: ["外语能力", "语言能力"] },
    campusSummary: { fallbackId: "block-32783", headings: ["校园工作经历", "校园经历"] },
    certificatesSummary: { fallbackId: "block-32787", headings: ["技能证书", "证书信息"] },
    selfDescription: { fallbackId: "block-selfDescription", headings: ["自我评价", "自我描述"] }
  };

  function mokaBlock(blockKey) {
    const spec = MOKA_BLOCKS[blockKey] || { fallbackId: blockKey, headings: [] };
    const candidates = Array.from(document.querySelectorAll("[data-nav-id], [class*='apply-block-']"));
    for (const candidate of candidates) {
      const headingNodes = candidate.querySelectorAll(":scope > [class*='title' i], :scope > [class*='title' i] *, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > legend");
      const headingTexts = Array.from(headingNodes, (node) => compactText(node.innerText || node.textContent, 80));
      if (spec.headings.some((heading) => headingTexts.some((text) => core.normalize(text) === core.normalize(heading)))) return candidate;
    }
    return document.querySelector(`[data-nav-id="${CSS.escape(spec.fallbackId)}"]`);
  }

  function profileEntry(profile, id) {
    return eligibleEntries(profile).find(entry => entry.id === id) || null;
  }

  function mokaRecordElements(blockKey) {
    const block = mokaBlock(blockKey);
    if (!block) return [];
    return Array.from(block.children).filter((element) => element.matches?.("[class*=apply-fields]"));
  }

  function mokaField(record, label) {
    return Array.from(record.querySelectorAll("[class*=apply-field]")).find((field) => {
      const title = field.querySelector("[class*=title]");
      return compactText(title?.innerText || title?.textContent, 120) === label;
    }) || null;
  }

  function mokaControls(record, label) {
    const field = mokaField(record, label);
    return field ? Array.from(field.querySelectorAll("input,textarea,select")).filter(isVisible) : [];
  }

  async function ensureMokaRecords(blockKey, count) {
    const block = mokaBlock(blockKey);
    if (!block) return [];
    let records = mokaRecordElements(blockKey);
    const addButton = Array.from(block.querySelectorAll("button")).find((button) => compactText(button.innerText || button.textContent, 40) === "添加");
    while (records.length < count && addButton) {
      const before = records.length;
      addButton.click();
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await wait(100);
        records = mokaRecordElements(blockKey);
        if (records.length > before) break;
      }
      if (records.length === before) break;
    }
    return records;
  }

  async function chooseMokaOption(element, values) {
    const candidates = [...new Set(values.filter(Boolean).map(String))];
    const originalInputValue = element.value || "";
    const dropdown = element.closest?.("[class*=sd-Dropdown-container]");
    const optionText = (item) => item.innerText || item.textContent || item.getAttribute("title") || "";
    const findOption = (options, value) => exactOption(options, value, optionText);
    const currentOptions = () => [...new Set([...visibleOptions(), ...visibleMokaPopupCandidates()])];
    element.focus();
    element.click();
    // Moka 走自己的专用驱动，保持原有的固定等待：这里字段极多，
    // 观察式轮询会把「只跑一次的重候选收集」变成每秒跑几十次。
    await wait(180);
    let options = currentOptions();
    if (!options.length && dropdown) {
      dropdown.click();
      await wait(100);
      options = currentOptions();
    }
    for (const value of candidates) {
      let option = findOption(options, value);
      if (!option && !element.readOnly) {
        setNativeValue(element, "");
        element.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "deleteContentBackward", data: null }));
        setNativeValue(element, value);
        element.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: value }));
        element.dispatchEvent(new KeyboardEvent("keyup", { key: String(value).slice(-1), bubbles: true, composed: true }));
        option = await waitUntil(() => {
          if (!anyOptionLayerPresent()) return null;
          const found = currentOptions();
          return findOption(found, value) || null;
        }, { timeout: 900, heavyInterval: 200 });
        options = option ? currentOptions() : currentOptions();
      }
      if (!option || !option.isConnected) continue;
      option.click();
      await wait(120);
      if (candidates.some((candidate) => mokaValueMatches(element, candidate))) return true;
      options = currentOptions();
    }
    if (/专业名称|最近毕业专业|就读学校/.test(element.placeholder || "")) {
      const desired = candidates[0];
      const popup = Array.from(document.querySelectorAll("[class*=sd-Dropdown-dropdown]")).find(isVisible);
      const addFullName = popup && Array.from(popup.querySelectorAll("button")).find((button) => /添加(?:专业|学校)全称/.test(compactText(button.innerText || button.textContent, 40)));
      if (addFullName && desired) {
        addFullName.click();
        await wait(180);
        if (mokaValueMatches(element, desired)) return true;
        const dialog = Array.from(document.querySelectorAll('[role="dialog"], [class*=Modal], [class*=modal]')).find(isVisible);
        const dialogInput = dialog && Array.from(dialog.querySelectorAll("input,textarea")).find(isVisible);
        if (dialogInput) {
          setNativeValue(dialogInput, desired);
          dispatchEditEvents(dialogInput);
          const confirm = Array.from(dialog.querySelectorAll("button")).find((button) => /^(确认|确定|添加)$/.test(compactText(button.innerText || button.textContent, 20)));
          confirm?.click();
          await wait(180);
          if (mokaValueMatches(element, desired)) return true;
        }
      }
    }
    if (!element.readOnly && element.value !== originalInputValue) {
      setNativeValue(element, originalInputValue);
      element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    }
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    return false;
  }

  // Date semantics stay local to confirmed controls; source values stay intact.
  const DATE_MONTH_NAMES = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

  function controlDateParts(value) {
    const match = /^(\d{4})([-/])(\d{1,2})(?:\2(\d{1,2}))?$/.exec(String(value || "").trim());
    if (!match) return null;
    const year = Number(match[1]), month = Number(match[3]), day = match[4] ? Number(match[4]) : null;
    if (year < 1000 || month < 1 || month > 12) return null;
    if (day !== null && (day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate())) return null;
    const ym = match[1] + "-" + String(month).padStart(2, "0");
    return { year, month, day, ym, date: day === null ? "" : ym + "-" + String(day).padStart(2, "0") };
  }

  function dateLayerNumber(value, level) {
    const text = String(value || "").replace(/\s/g, "");
    if (level === 1 && DATE_MONTH_NAMES.includes(text)) return DATE_MONTH_NAMES.indexOf(text) + 1;
    const match = (level === 0 ? /^(\d{4})年?$/ : level === 1 ? /^(\d{1,2})(?:月|月份)?$/ : /^(\d{1,2})(?:日|号)?$/).exec(text);
    return match ? Number(match[1]) : null;
  }

  function dateSelectionPolicy(entry, precision = "day") {
    const parts = controlDateParts(entry.value);
    if (!parts) return { reason: "资料日期格式无效或日期不存在" };
    if (precision === "day" && parts.day === null) return { reason: "网站要求日期到日，资料只提供年月" };
    const levels = precision === "month" ? 2 : 3;
    const target = [parts.year, parts.month, parts.day];
    const canonical = [
      [String(parts.year), parts.year + "年"],
      [String(parts.month), String(parts.month).padStart(2, "0"), parts.month + "月", DATE_MONTH_NAMES[parts.month - 1]],
      [String(parts.day), String(parts.day).padStart(2, "0"), parts.day + "日"]
    ];
    const path = entry.pathValues || [];
    if (!Array.isArray(path) || path.length > 3) return { reason: "日期路径应依次为年、月、日" };
    for (let level = 0; level < path.length; level += 1) {
      if (!Array.isArray(path[level]) || !path[level].length || path[level].some(value => typeof value !== "string" || !value.trim())) return { reason: "日期路径格式错误" };
      for (const value of path[level]) {
        const number = dateLayerNumber(value, level);
        if (number !== null && target[level] !== null && number !== target[level]) return { reason: "日期路径与主日期不一致，未操作控件" };
      }
      canonical[level].push(...path[level]);
    }
    return { parts, candidates: canonical.slice(0, levels).map(values => [...new Set(values)]) };
  }

  function isZhaopinPage() {
    return (location.hostname === "xiaoyuan.zhaopin.com" && /^\/scrd\/resume2/.test(location.pathname))
      || document.documentElement.dataset.resumeHelperFixture === "zhaopin";
  }

  function isElementDayPicker(element) {
    return Boolean(element?.readOnly && element.closest?.(".el-date-editor--date"));
  }

  function elementDatePanel(element, before = null) {
    const component = element.closest?.(".el-date-editor--date")?.__vue__;
    const ownedPanel = component?.picker?.$el || component?.popperElm || component?.$refs?.picker?.$el;
    if (ownedPanel?.matches?.(".el-date-picker") && isVisible(ownedPanel)) return ownedPanel;
    const ids = (element.getAttribute("aria-controls") || element.getAttribute("aria-owns") || "").split(/\s+/).filter(Boolean);
    const owned = ids.map(id => document.getElementById(id)).filter(panel => panel?.matches(".el-date-picker") && isVisible(panel));
    if (owned.length === 1) return owned[0];
    const known = elementDatePanels.get(element);
    if (known?.isConnected && isVisible(known)) return known;
    if (!before) return null;
    const added = Array.from(document.querySelectorAll(".el-date-picker")).filter(panel => isVisible(panel) && !before.has(panel));
    if (added.length !== 1) return null;
    elementDatePanels.set(element, added[0]);
    return added[0];
  }

  function elementDateHeader(panel) {
    return Array.from(panel.querySelectorAll(".el-date-picker__header-label")).filter(isVisible);
  }

  function activeDateTable(panel, selector) {
    return Array.from(panel.querySelectorAll(selector)).filter(isVisible).find(Boolean) || null;
  }

  function dateTableOption(table, candidates, predicate = () => true) {
    if (!table) return null;
    const cells = Array.from(table.querySelectorAll("td")).filter(isVisible).filter(predicate);
    for (const candidate of candidates) {
      const cell = exactOption(cells, candidate, option => compactText(option.textContent, 40));
      if (cell) return cell.querySelector("a.cell, .cell, span") || cell;
    }
    return null;
  }

  async function clearControlledDate(element) {
    const container = element.closest(".el-date-editor, [class*=sd-Dropdown-container]");
    container?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
    element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    const clears = Array.from(container?.querySelectorAll(".el-icon-circle-close, [class*=clearIcon], [class*=clear-icon], [aria-label='清空']") || [])
      .filter(isVisible).filter(control => !control.disabled);
    if (clears.length !== 1) return false;
    clears[0].click();
    return Boolean(await waitUntil(() => !getCurrentValue(element), { timeout: 900 }));
  }

  function dateControlKey(element) {
    const item = element.closest?.(".el-form-item");
    // The published FormItem prop is the model key; a generated input id need
    // not be that key. Do not infer linked rules from field order.
    const prop = item?.__vue__?.$props?.prop;
    return (element.getAttribute("name") || (typeof prop === "string" ? prop : "") || element.closest?.("[data-field-key]")?.dataset.fieldKey || item?.querySelector(".el-form-item__label")?.getAttribute("for") || "")
      .split(".").pop();
  }

  function linkedElementDates(element) {
    if (!isZhaopinPage() || !isElementDayPicker(element)) return null;
    const key = dateControlKey(element);
    const keys = [["edu_date_start", "edu_date_end"], ["job_date_start", "job_date_end"],
      ["project_date_start", "project_date_end"], ["position_start_time", "position_end_time"]].find(pair => pair.includes(key));
    if (!keys) return null;
    const scope = element.closest(".apply-form");
    if (!scope) return null;
    const controls = Array.from(scope.querySelectorAll(".el-date-editor--date input")).filter(isVisible);
    const found = keys.map(name => controls.filter(control => dateControlKey(control) === name));
    return found.every(matches => matches.length === 1) ? { scope, keys, elements: found.map(matches => matches[0]) } : null;
  }

  function linkedDateConflict(pair, entries) {
    const before = pair.elements.map(getCurrentValue);
    const parsed = before.map(value => value ? controlDateParts(value) : null);
    if (before.some((value, index) => value && !parsed[index]?.date)) return "关联日期已有内容无法确认，未操作控件";
    const final = pair.elements.map((element, index) => entries.get(element)?.parts?.date || parsed[index]?.date || "");
    if (final.every(Boolean) && final[0] > final[1]) return "起止日期冲突；填写会清空另一端，未操作控件";
    if (parsed.every(Boolean) && parsed[0].date > parsed[1].date) return "原有起止日期冲突，无法保证恢复，未操作控件";
    return "";
  }

  function linkedDateOrder(elements, values) {
    const targetStart = controlDateParts(values[0])?.date;
    const oldEnd = controlDateParts(getCurrentValue(elements[1]))?.date;
    return targetStart && oldEnd && targetStart > oldEnd ? [1, 0] : [0, 1];
  }

  async function restoreLinkedDates(record) {
    const { elements, values } = record;
    // Clear empty targets before selecting dates; restored valid intervals never
    // need to pass through a reversed interval that clears the other endpoint.
    for (let index = 0; index < 2; index += 1) {
      if (!values[index] && getCurrentValue(elements[index]) && !await clearControlledDate(elements[index])) return false;
    }
    for (const index of linkedDateOrder(elements, values)) {
      if (values[index] && getCurrentValue(elements[index]) !== values[index]
        && !await chooseElementDay(elements[index], { value: values[index], linkedDateAuthorized: true }, false)) return false;
    }
    const restored = JSON.stringify(elements.map(getCurrentValue)) === JSON.stringify(values);
    if (restored) elements.forEach(element => unconfirmedScalarWrites.delete(element));
    return restored;
  }

  async function writeLinkedDates(pair, entries, undo) {
    const policies = new Map();
    for (const [element, entry] of entries) {
      const policy = dateSelectionPolicy(entry);
      if (policy.reason) { entries.forEach((_, control) => controlFailures.set(control, policy.reason)); return false; }
      policies.set(element, policy);
    }
    const conflict = linkedDateConflict(pair, policies);
    if (conflict) { entries.forEach((_, control) => controlFailures.set(control, conflict)); return false; }
    const final = pair.elements.map((element, index) => policies.get(element)?.parts.date || controlDateParts(undo.values[index])?.date || "");
    for (const index of linkedDateOrder(pair.elements, final)) {
      const element = pair.elements[index];
      if (!entries.has(element)) continue;
      if (!await chooseElementDay(element, { ...entries.get(element), linkedDateAuthorized: true }, false)) {
        const reason = controlFailures.get(element) || "关联日期提交未确认";
        const restored = await restoreLinkedDates(undo);
        entries.forEach((_, control) => {
          controlFailures.set(control, reason + (restored ? "；已恢复整组旧值" : "；整组旧值恢复未完成"));
          if (!restored) unconfirmedScalarWrites.add(control);
        });
        return false;
      }
    }
    if (pair.elements.every((element, index) => controlDateParts(getCurrentValue(element))?.date === final[index]
      || (!final[index] && !getCurrentValue(element)))) return true;
    const restored = await restoreLinkedDates(undo);
    entries.forEach((_, control) => {
      controlFailures.set(control, "关联日期结果未确认" + (restored ? "；已恢复整组旧值" : "；旧值恢复未完成"));
      if (!restored) unconfirmedScalarWrites.add(control);
    });
    return false;
  }

  function isZhaopinSearchChoice(element) {
    return isZhaopinPage() && Boolean(element.closest?.(".el-select, .el-autocomplete"));
  }

  function controlledChoicePanel(element, selector) {
    const ids = (element.getAttribute("aria-controls") || element.getAttribute("aria-owns") || "").split(/\s+/).filter(Boolean);
    const linked = ids.map(id => document.getElementById(id)).filter(node => node?.matches(selector) && isVisible(node));
    if (linked.length === 1) return linked[0];
    if (ids.length && selector === ".s-region__modal") return null;
    const panels = Array.from(document.querySelectorAll(selector)).filter(isVisible);
    return panels.length === 1 ? panels[0] : null;
  }

  async function clearZhaopinChoice(element) {
    const host = element.closest(".el-select, .el-autocomplete, .s-region");
    host?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
    const clear = Array.from(host?.querySelectorAll(".el-icon-circle-close, [aria-label='清空']") || []).filter(isVisible).filter(node => !node.disabled);
    if (clear.length !== 1) return false;
    clear[0].click();
    return Boolean(await waitUntil(() => !getCurrentValue(element), { timeout: 900 }));
  }

  async function chooseZhaopinSearchChoice(element, entry) {
    const before = getCurrentValue(element);
    const selector = ".el-select-dropdown, .el-autocomplete-suggestion";
    const candidates = targetValues(entry, "select");
    controlFailures.delete(element);
    element.focus(); element.click();
    for (const candidate of candidates) {
      if (!element.readOnly) {
        setNativeValue(element, candidate);
        element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      }
      const option = await waitUntil(() => {
        const panel = controlledChoicePanel(element, selector);
        return panel && exactOption(Array.from(panel.querySelectorAll(".el-select-dropdown__item, li, [role=option]")).filter(isVisible), candidate);
      }, { timeout: 1200, heavyInterval: 100 });
      if (!option) continue;
      option.click();
      if (await waitUntil(() => !controlledChoicePanel(element, selector) && normalizedValueMatches(getCurrentValue(element), candidate), { timeout: 900 })) return true;
      break;
    }
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    element.blur();
    await wait(80);
    if (getCurrentValue(element) !== before) {
      // Search text alone must never be reported as a committed selection.
      setNativeValue(element, before);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      element.blur(); await wait(80);
    }
    controlFailures.set(element, "未找到当前控件的精确选项或组件未确认选择");
    return false;
  }

  function isZhaopinRegion(element) {
    return isZhaopinPage() && Boolean(element.closest?.(".s-region"));
  }

  function zhaopinRegionValueMatches(actual, expected) {
    // Only hierarchy separators and their surrounding spaces are display syntax.
    // Punctuation and spaces inside a region name remain part of the value.
    const normalize = value => String(value || "").trim().split(/\s*[\/>]\s*/).join("/");
    return normalize(actual) === normalize(expected);
  }

  async function chooseZhaopinRegion(element, entry, rollback = true) {
    controlFailures.delete(element);
    unconfirmedScalarWrites.delete(element);
    const before = getCurrentValue(element);
    const path = entry.pathValues?.length ? entry.pathValues : String(entry.value || "").split(/\s*[\/>]\s*/).filter(Boolean).map(value => [value]);
    if (!path.length || path.some(level => !Array.isArray(level) || !level.length)) {
      controlFailures.set(element, "地区控件需要逐级地区路径"); return false;
    }
    element.click();
    const panel = await waitUntil(() => controlledChoicePanel(element, ".s-region__modal"), { timeout: 900 });
    const fail = async reason => {
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      if (getCurrentValue(element) !== before) {
        const restored = rollback && (before
          ? await chooseZhaopinRegion(element, { value: before }, false)
          : await clearZhaopinChoice(element));
        const confirmed = restored && zhaopinRegionValueMatches(getCurrentValue(element), before);
        if (!confirmed) unconfirmedScalarWrites.add(element);
        else unconfirmedScalarWrites.delete(element);
        reason += confirmed ? "；已恢复填写前内容" : "；旧值恢复未完成，请检查或撤销";
      }
      controlFailures.set(element, reason);
      return false;
    };
    if (!panel) return fail("未找到当前地区控件的面板");
    const selected = [];
    for (let index = 0; index < path.length; index += 1) {
      const list = await waitUntil(() => Array.from(panel.querySelectorAll("[role=listbox]")).filter(isVisible)[index], { timeout: 700 });
      if (!list) return fail("地区路径超出该控件的层级");
      let option = null;
      for (const candidate of path[index]) {
        option = exactOption(Array.from(list.querySelectorAll("[role=option]")).filter(isVisible), candidate);
        if (option) break;
      }
      if (!option) return fail("地区第 " + (index + 1) + " 级选项未找到或存在歧义");
      selected.push(compactText(option.textContent, 100)); option.click();
    }
    const confirms = Array.from(panel.querySelectorAll("button")).filter(isVisible).filter(node => !node.disabled && /^(确定|确认|完成)$/.test(compactText(node.textContent, 20)));
    if (confirms.length !== 1) return fail("地区层级未选完整或未找到确认按钮");
    confirms[0].click();
    if (!await waitUntil(() => !controlledChoicePanel(element, ".s-region__modal")
      && zhaopinRegionValueMatches(getCurrentValue(element), selected.join("/")), { timeout: 900 })) return fail("地区选择未确认提交");
    return true;
  }

  async function chooseElementDay(element, entry, rollback = true) {
    controlFailures.delete(element);
    const policy = dateSelectionPolicy(entry);
    if (policy.reason) { controlFailures.set(element, policy.reason); return false; }
    const pair = linkedElementDates(element);
    if (pair && !entry.linkedDateAuthorized) {
      const reason = linkedDateConflict(pair, new Map([[element, policy]]));
      if (reason) { controlFailures.set(element, reason); return false; }
    }
    const beforeValue = getCurrentValue(element);
    const panelsBefore = new Set(Array.from(document.querySelectorAll(".el-date-picker")).filter(isVisible));
    let panel = elementDatePanel(element);
    if (!panel) {
      element.click();
      panel = await waitUntil(() => elementDatePanel(element, panelsBefore), { timeout: 1000 });
    }
    const fail = async reason => {
      controlFailures.set(element, reason);
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
      if (getCurrentValue(element) !== beforeValue) {
        const restored = rollback && (beforeValue
          ? await chooseElementDay(element, { value: beforeValue, linkedDateAuthorized: entry.linkedDateAuthorized }, false)
          : await clearControlledDate(element));
        if (!restored) unconfirmedScalarWrites.add(element);
        controlFailures.set(element, reason + (restored ? "" : "；旧值恢复未完成"));
      }
      return false;
    };
    if (!panel) return fail("未找到属于当前日期框的日历面板");
    const yearHeader = elementDateHeader(panel)[0];
    if (!yearHeader) return fail("未找到日历年份入口");
    if (!activeDateTable(panel, ".el-year-table")) yearHeader.click();
    let table = await waitUntil(() => activeDateTable(panel, ".el-year-table"), { timeout: 700 });
    if (!table) return fail("未进入年份面板");
    let yearSelected = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const year = dateTableOption(table, policy.candidates[0]);
      if (year) { year.click(); yearSelected = true; break; }
      const years = Array.from(table.querySelectorAll("td")).map(cell => Number(compactText(cell.textContent, 20))).filter(value => value >= 1000);
      if (!years.length || (policy.parts.year >= Math.min(...years) && policy.parts.year <= Math.max(...years))) return fail("目标年份被禁用或存在歧义");
      const direction = policy.parts.year < Math.min(...years) ? "left" : "right";
      const arrow = panel.querySelector(".el-icon-d-arrow-" + direction);
      if (!arrow || !isVisible(arrow)) return fail("未找到年份翻页入口");
      const previous = compactText(table.textContent, 200);
      arrow.click();
      table = await waitUntil(() => {
        const next = activeDateTable(panel, ".el-year-table");
        return next && compactText(next.textContent, 200) !== previous ? next : null;
      }, { timeout: 700 });
      if (!table) return fail("年份翻页未确认");
    }
    if (!yearSelected) return fail("目标年份超出可导航范围");
    table = await waitUntil(() => activeDateTable(panel, ".el-month-table"), { timeout: 700 });
    if (!table || !elementDateHeader(panel).some(header => dateLayerNumber(header.textContent, 0) === policy.parts.year)) return fail("目标年份未确认");
    const month = dateTableOption(table, policy.candidates[1]);
    if (!month) return fail("目标月份被禁用、未找到或存在歧义");
    month.click();
    table = await waitUntil(() => activeDateTable(panel, ".el-date-table"), { timeout: 700 });
    const headers = elementDateHeader(panel);
    if (!table || !headers.some(header => dateLayerNumber(header.textContent, 0) === policy.parts.year)
      || !headers.some(header => dateLayerNumber(header.textContent, 1) === policy.parts.month)) return fail("目标年月未确认");
    const day = dateTableOption(table, policy.candidates[2], cell => cell.classList.contains("available")
      && !cell.classList.contains("prev-month") && !cell.classList.contains("next-month"));
    if (!day) return fail("本月目标日期被禁用、未找到或存在歧义");
    day.click();
    const confirmed = await waitUntil(() => controlDateParts(getCurrentValue(element))?.date === policy.parts.date, { timeout: 900 });
    if (!confirmed) return fail("日历日期提交未确认");
    controlFailures.delete(element);
    return true;
  }

  function isMokaDayPicker(element) {
    return element.readOnly && /日期（年月日）/.test(element.placeholder || "");
  }

  function isMokaMonthPicker(element) {
    return Boolean(element?.readOnly && element.closest?.("[class*=sd-Dropdown-container]")
      && /出生日期\s*[（(]年龄[）)]|日期\s*[（(]年月[）)]/.test(element.placeholder || ""));
  }

  const mokaDatePanels = new WeakMap();

  function isCmbResumePage() {
    return core.detectSite(location.hostname) === "cmbchina" && location.pathname === "/center/resume"
      && Boolean(document.querySelector('form#resume .item-box input[id^="resume_awardList_"]'));
  }

  function isCmbMonthPicker(element) {
    return isCmbResumePage() && /^resume_awardList_\d+_awardDate$/.test(element?.id || "")
      && Boolean(element.readOnly && element.closest('.ant-picker.time-cell'));
  }

  function isCmbHonorChoice(element) {
    return isCmbResumePage() && /^resume_awardList_\d+_awardLevel$/.test(element?.id || "")
      && Boolean(element.closest('.ant-select'));
  }

  async function chooseCmbHonorChoice(element, entry) {
    const selector = element.closest('.ant-select')?.querySelector('.ant-select-selector');
    const listId = element.getAttribute('aria-controls');
    if (!selector || !listId) return false;
    const targets = targetValues(entry, 'select');
    element.focus();
    selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const ownedOptions = () => {
      const panel = document.getElementById(listId)?.closest('.ant-select-dropdown');
      return panel && isVisible(panel) ? Array.from(panel.querySelectorAll('.ant-select-item-option')).filter(isVisible) : [];
    };
    const options = await waitUntil(() => { const options = ownedOptions(); return options.length ? options : null; }, { timeout: 900 });
    for (const target of targets) {
      const matches = (options || []).filter(option => !option.classList.contains('ant-select-item-option-disabled')
        && option.getAttribute('aria-disabled') !== 'true' && normalizedValueMatches(compactText(option.textContent, 200), target));
      if (matches.length !== 1) continue;
      matches[0].click();
      return Boolean(await waitUntil(() => targets.some(value => normalizedValueMatches(getCurrentValue(element), value)), { timeout: 900 }));
    }
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', which: 27, keyCode: 27, bubbles: true, cancelable: true }));
    controlFailures.set(element, '未找到对应级别；请核对 JSON 下拉候选与网站选项');
    return false;
  }

  async function clearCmbDate(element) {
    const picker = element.closest('.ant-picker');
    const clears = Array.from(picker?.querySelectorAll('.ant-picker-clear') || []);
    if (clears.length !== 1 || !isVisible(picker) || clears[0].getAttribute('aria-disabled') === 'true') return false;
    clears[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    clears[0].dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return Boolean(await waitUntil(() => !getCurrentValue(element), { timeout: 700 }));
  }

  async function clearCmbHonorChoice(element) {
    const select = element.closest('.ant-select');
    const clears = Array.from(select?.querySelectorAll('.ant-select-clear') || []);
    if (clears.length !== 1 || !isVisible(select)) return false;
    clears[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    return Boolean(await waitUntil(() => !getCurrentValue(element), { timeout: 700 }));
  }

  async function chooseCmbMonth(element, entry, recover = true) {
    const policy = dateSelectionPolicy(entry, 'month');
    if (policy.reason) { controlFailures.set(element, policy.reason); return false; }
    const visible = () => Array.from(document.querySelectorAll('.ant-picker-dropdown'))
      .filter(panel => isVisible(panel) && !panel.classList.contains('ant-picker-dropdown-hidden'));
    if (visible().length) { controlFailures.set(element, '请先关闭其他日期浮层，再填写'); return false; }
    const before = getCurrentValue(element);
    element.focus();
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    let panel = await waitUntil(() => { const panels = visible(); return panels.length === 1 && panels[0].querySelector('.ant-picker-month-panel') ? panels[0] : null; }, { timeout: 900 });
    const owned = node => node?.isConnected && visible().length === 1 && visible()[0] === panel;
    const cell = () => Array.from(panel?.querySelectorAll('.ant-picker-month-panel td[title]') || [])
      .find(node => node.getAttribute('title') === policy.parts.ym && node.classList.contains('ant-picker-cell-in-view') && !node.classList.contains('ant-picker-cell-disabled'));
    if (panel && !cell()) {
      panel.querySelector('.ant-picker-year-btn')?.click();
      await waitUntil(() => owned(panel) && panel.querySelector('.ant-picker-year-panel'), { timeout: 600 });
      for (let attempt = 0; owned(panel) && attempt < 25; attempt += 1) {
        const years = Array.from(panel.querySelectorAll('.ant-picker-year-panel td[title]'));
        const year = years.find(node => node.getAttribute('title') === String(policy.parts.year)
          && node.classList.contains('ant-picker-cell-in-view') && !node.classList.contains('ant-picker-cell-disabled'));
        if (year) { year.click(); break; }
        const range = compactText(panel.querySelector('.ant-picker-decade-btn')?.textContent, 40).match(/(\d{4})\D+(\d{4})/);
        if (!range) break;
        const direction = policy.parts.year < Number(range[1]) ? 'prev' : policy.parts.year > Number(range[2]) ? 'next' : '';
        const nav = direction && panel.querySelector(`.ant-picker-header-super-${direction}-btn`);
        if (!nav) break;
        const oldRange = range[0]; nav.click();
        if (!await waitUntil(() => owned(panel) && compactText(panel.querySelector('.ant-picker-decade-btn')?.textContent, 40) !== oldRange, { timeout: 600 })) break;
      }
      await waitUntil(() => owned(panel) && panel.querySelector('.ant-picker-month-panel'), { timeout: 600 });
    }
    const month = owned(panel) && cell();
    if (month) month.click();
    const confirmed = month && await waitUntil(() => controlDateParts(getCurrentValue(element))?.ym === policy.parts.ym, { timeout: 900 });
    if (confirmed) {
      if (policy.parts.day) datePrecisionNotes.set(element, '网站仅支持年月，已填写年月并忽略日');
      return true;
    }
    if (owned(panel)) { element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', which: 27, keyCode: 27, bubbles: true, cancelable: true })); await waitUntil(() => !visible().length, { timeout: 600 }); }
    controlFailures.set(element, '未找到可用月份或年月回读未确认');
    if (recover && getCurrentValue(element) !== before) {
      const restored = before ? await chooseCmbMonth(element, { value: before }, false) : await clearCmbDate(element);
      if (!restored) unconfirmedScalarWrites.add(element);
    }
    return false;
  }

  function isAntDayPicker(element) {
    return Boolean(element?.readOnly && element.closest?.(".ant-calendar-picker, .ant-picker"));
  }

  function visibleAntDayPanel() {
    return Array.from(document.querySelectorAll(".ant-calendar-picker-container, .ant-picker-dropdown")).reverse().find((panel) => {
      if (!isVisible(panel) || panel.classList.contains("ant-calendar-picker-container-hidden") || panel.classList.contains("ant-picker-dropdown-hidden")) return false;
      return Boolean(panel.querySelector("[title], .ant-calendar-date, .ant-picker-cell-inner"));
    }) || null;
  }

  function antDateCell(panel, year, month, day) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const chinese = `${year}年${month}月${day}日`;
    const titled = Array.from(panel?.querySelectorAll("[title]") || []).find((item) => {
      const title = compactText(item.getAttribute("title"), 40);
      return title === iso || title === chinese;
    });
    if (!titled || titled.closest(".ant-calendar-disabled-cell, .ant-picker-cell-disabled")) return null;
    return titled.querySelector?.(".ant-calendar-date, .ant-picker-cell-inner") || titled;
  }

  async function chooseAntDay(element, value) {
    const match = String(value || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) return false;
    const targetYear = Number(match[1]);
    const targetMonth = Number(match[2]);
    const targetDay = Number(match[3]);
    const expected = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
    element.focus();
    element.click();
    let panel = await waitUntil(() => visibleAntDayPanel(), { timeout: 900 });
    if (!panel) return false;

    let dayCell = antDateCell(panel, targetYear, targetMonth, targetDay);
    if (!dayCell) {
      const yearButton = panel.querySelector(".ant-calendar-year-select, .ant-picker-year-btn");
      yearButton?.click();
      panel = (await waitUntil(() => visibleAntDayPanel(), { timeout: 600 })) || panel;
      const findYearCell = () => Array.from(panel?.querySelectorAll(".ant-calendar-year-panel-year, .ant-picker-year-panel [title], .ant-picker-year-panel .ant-picker-cell-inner") || []).find((item) => {
        return compactText(item.getAttribute?.("title") || item.textContent, 20).replace(/\D/g, "") === String(targetYear);
      });
      let yearCell = findYearCell();
      for (let attempt = 0; !yearCell && panel && attempt < 20; attempt += 1) {
        const range = compactText(panel.textContent, 200).match(/(\d{4})\D+(\d{4})/);
        if (!range) break;
        const previous = targetYear < Number(range[1]);
        const next = targetYear > Number(range[2]);
        const nav = previous
          ? panel.querySelector(".ant-calendar-year-panel-prev-decade-btn, .ant-picker-header-super-prev-btn")
          : next
            ? panel.querySelector(".ant-calendar-year-panel-next-decade-btn, .ant-picker-header-super-next-btn")
            : null;
        if (!nav) break;
        nav.click();
        panel = (await waitUntil(() => {
          const next0 = visibleAntDayPanel();
          return next0 && findYearCell() ? next0 : null;
        }, { timeout: 400 })) || visibleAntDayPanel() || panel;
        yearCell = findYearCell();
      }
      if (yearCell) {
        yearCell.click();
        panel = (await waitUntil(() => {
          const next0 = visibleAntDayPanel();
          return next0 && next0.querySelector(".ant-calendar-month-select, .ant-picker-month-btn") ? next0 : null;
        }, { timeout: 600 })) || visibleAntDayPanel() || panel;
      }

      const monthButton = panel?.querySelector(".ant-calendar-month-select, .ant-picker-month-btn");
      monthButton?.click();
      panel = (await waitUntil(() => {
        const next0 = visibleAntDayPanel();
        return next0 && next0.querySelector(".ant-calendar-month-panel-month, .ant-picker-month-panel [title]") ? next0 : null;
      }, { timeout: 600 })) || visibleAntDayPanel() || panel;
      const monthCell = Array.from(panel?.querySelectorAll(".ant-calendar-month-panel-month, .ant-picker-month-panel [title], .ant-picker-month-panel .ant-picker-cell-inner") || []).find((item) => {
        const text = compactText(item.getAttribute?.("title") || item.textContent, 30);
        const numeric = text.match(/(?:^|\D)(1[0-2]|0?[1-9])(?:月|$)/)?.[1];
        return Number(numeric) === targetMonth;
      });
      if (monthCell) {
        monthCell.click();
        panel = (await waitUntil(() => {
          const next0 = visibleAntDayPanel();
          return next0 && antDateCell(next0, targetYear, targetMonth, targetDay) ? next0 : null;
        }, { timeout: 600 })) || visibleAntDayPanel() || panel;
      }
      dayCell = antDateCell(panel, targetYear, targetMonth, targetDay);
    }
    if (!dayCell) return false;
    dayCell.click();
    await wait(100);
    return normalizedValueMatches(getCurrentValue(element), expected);
  }

  function visibleMokaDatePanel(element, before = null) {
    const dropdown = element.closest?.("[class*=sd-Dropdown-container]");
    const local = dropdown ? Array.from(dropdown.querySelectorAll("[class*=sd-panal-menu-wrapper]")).find(isVisible) : null;
    if (local) return local;
    const known = mokaDatePanels.get(element);
    if (known?.isConnected && isVisible(known)) return known;
    const visible = Array.from(document.querySelectorAll("[class*=sd-panal-menu-wrapper]")).filter(isVisible);
    const owned = before ? visible.filter(panel => !before.has(panel)) : [];
    if (owned.length !== 1) return null;
    mokaDatePanels.set(element, owned[0]);
    return owned[0];
  }

  function mokaDateOptionDisabled(item) {
    return Boolean(item?.disabled || item?.getAttribute?.("aria-disabled") === "true"
      || item?.closest?.("[disabled], [aria-disabled=true], .disabled, [class*='-disabled']"));
  }

  async function chooseMokaMonth(element, value, pathValues = [], rollback = true) {
    controlFailures.delete(element);
    datePrecisionNotes.delete(element);
    const policy = dateSelectionPolicy({ value, pathValues }, "month");
    if (policy.reason) { controlFailures.set(element, policy.reason); return false; }
    const beforeValue = getCurrentValue(element);
    const fail = async reason => {
      let restored = getCurrentValue(element) === beforeValue;
      if (!restored && rollback) {
        restored = beforeValue
          ? await chooseMokaMonth(element, beforeValue, [], false)
          : await clearControlledDate(element);
        restored = Boolean(restored && (beforeValue
          ? controlDateParts(getCurrentValue(element))?.ym === controlDateParts(beforeValue)?.ym
          : !getCurrentValue(element)));
      }
      if (!restored) unconfirmedScalarWrites.add(element);
      else unconfirmedScalarWrites.delete(element);
      datePrecisionNotes.delete(element);
      controlFailures.set(element, reason + (restored ? "" : "；旧值恢复未完成，可重试撤销"));
      return false;
    };
    const before = new Set(Array.from(document.querySelectorAll("[class*=sd-panal-menu-wrapper]")).filter(isVisible));
    let panel = visibleMokaDatePanel(element);
    if (!panel) {
      element.click();
      panel = await waitUntil(() => visibleMokaDatePanel(element, before), { timeout: 900 });
    }
    if (!panel) return fail("未找到属于当前日期框的月份面板");
    let yearConfirmed = false;
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const year = dateLayerNumber(panel.querySelector("[class*=sd-basic-selector-year]")?.textContent, 0);
      if (year === policy.parts.year) { yearConfirmed = true; break; }
      if (!year) return fail("月份面板年份未确认");
      const arrow = panel.querySelector(year > policy.parts.year ? "[class*=sd-basic-prev-icon]" : "[class*=sd-basic-next-icon]");
      if (!arrow || !isVisible(arrow) || mokaDateOptionDisabled(arrow)) return fail("目标年份超出可选范围或翻年入口不可用");
      arrow.click();
      panel = await waitUntil(() => {
        const next = visibleMokaDatePanel(element);
        return next && dateLayerNumber(next.querySelector("[class*=sd-basic-selector-year]")?.textContent, 0) !== year ? next : null;
      }, { timeout: 700 });
      if (!panel) return fail("月份面板翻年未确认");
    }
    if (!yearConfirmed) return fail("目标年份超出可导航范围");
    const months = Array.from(panel.querySelectorAll("[class*=sd-basic-year-item]")).filter(isVisible).filter(item => !mokaDateOptionDisabled(item));
    const month = policy.candidates[1].map(candidate => exactOption(months, candidate)).find(Boolean);
    if (!month) return fail("目标月份被禁用、未找到或存在歧义");
    month.click();
    const confirmed = await waitUntil(() => controlDateParts(getCurrentValue(element))?.ym === policy.parts.ym, { timeout: 900 });
    if (!confirmed) return fail("月份选择未确认写入");
    datePrecisionNotes.set(element, "网站仅支持年月，已按年月填写");
    unconfirmedScalarWrites.delete(element);
    controlFailures.delete(element);
    return true;
  }

  async function chooseMokaDay(element, value, pathValues = []) {
    controlFailures.delete(element);
    datePrecisionNotes.delete(element);
    const policy = dateSelectionPolicy({ value, pathValues });
    if (policy.reason) { controlFailures.set(element, policy.reason); return false; }
    const targetYear = String(policy.parts.year), rawMonth = String(policy.parts.month), rawDay = String(policy.parts.day);
    const monthNames = DATE_MONTH_NAMES;
    const dropdown = element.closest?.("[class*=sd-Dropdown-container]");
    const before = new Set(Array.from(document.querySelectorAll("[class*=sd-panal-menu-wrapper]")).filter(isVisible));
    let panel = visibleMokaDatePanel(element);
    if (!panel) {
      element.click();
      panel = await waitUntil(() => visibleMokaDatePanel(element, before), { timeout: 900 });
    }
    if (!panel && dropdown) {
      dropdown.click();
      panel = await waitUntil(() => visibleMokaDatePanel(element, before), { timeout: 700 });
    }
    if (!panel) return false;

    let yearHeader = panel.querySelector("[class*=sd-basic-selector-year]");
    if (!yearHeader) return false;
    yearHeader.click();
    panel = (await waitUntil(() => {
      const next0 = visibleMokaDatePanel(element);
      return next0 && next0.querySelector("[class*=sd-basic-year-item]") ? next0 : null;
    }, { timeout: 600 })) || visibleMokaDatePanel(element);
    for (let attempt = 0; panel && attempt < 20; attempt += 1) {
      const year = Array.from(panel.querySelectorAll("[class*=sd-basic-year-item]")).find((item) => compactText(item.textContent, 20).replace(/\D/g, "") === targetYear && !mokaDateOptionDisabled(item));
      if (year) {
        year.click();
        break;
      }
      const previousRange = compactText(panel.querySelector("[class*=sd-basic-selector-year]")?.textContent, 40);
      const range = previousRange.match(/(\d{4})\D*-\D*(\d{4})/);
      if (!range) return false;
      const direction = Number(targetYear) < Number(range[1]) ? "doubleLeft" : "doubleRight";
      const arrow = panel.querySelector(`[class*=sd-Icon-icon${direction}]`);
      if (!arrow) return false;
      arrow.click();
      panel = (await waitUntil(() => {
        const next0 = visibleMokaDatePanel(element);
        if (!next0) return null;
        const current = compactText(next0.querySelector("[class*=sd-basic-selector-year]")?.textContent, 40);
        return current !== previousRange ? next0 : null;
      }, { timeout: 500 })) || visibleMokaDatePanel(element);
    }

    panel = (await waitUntil(() => {
      const next0 = visibleMokaDatePanel(element);
      return next0 && next0.querySelector("[class*=sd-basic-selector-month]") ? next0 : null;
    }, { timeout: 600 })) || visibleMokaDatePanel(element);
    const monthHeader = panel?.querySelector("[class*=sd-basic-selector-month]");
    if (!monthHeader) return false;
    monthHeader.click();
    panel = (await waitUntil(() => {
      const next0 = visibleMokaDatePanel(element);
      return next0 && next0.querySelector("[class*=sd-basic-year-item]") ? next0 : null;
    }, { timeout: 600 })) || visibleMokaDatePanel(element);
    const targetMonth = monthNames[Number(rawMonth) - 1];
    const month = Array.from(panel?.querySelectorAll("[class*=sd-basic-year-item]") || []).find((item) => compactText(item.textContent, 20) === targetMonth && !mokaDateOptionDisabled(item));
    if (!month) return false;
    month.click();
    panel = (await waitUntil(() => {
      const next0 = visibleMokaDatePanel(element);
      return next0 && next0.querySelector("[class*=sd-basic-day], [class*=sd-basic-date]") ? next0 : null;
    }, { timeout: 600 })) || visibleMokaDatePanel(element);
    const day = Array.from(panel?.querySelectorAll("[class*=sd-basic-date-item]") || []).find((item) => {
      return compactText(item.textContent, 10) === String(Number(rawDay)) && !item.parentElement?.className.includes("fade") && !mokaDateOptionDisabled(item);
    });
    if (!day) return false;
    day.click();
    await wait(100);
    return controlDateParts(getCurrentValue(element))?.date === policy.parts.date
      || controlDateParts(element.value)?.date === policy.parts.date;
  }

  function mokaRegionTabs(panel) {
    const label = node => compactText(node.innerText || node.textContent, 20);
    const isTab = text => /^(省份|城市|县区|区县)$/.test(text);
    return Array.from(panel.querySelectorAll("button, [role=tab], a, span, div"))
      .filter(node => isTab(label(node)) && !Array.from(node.children || []).some(child => isTab(label(child))));
  }

  function mokaRegionPanel(element, includeHidden = false) {
    const dropdown = element.closest?.("[class*=sd-Dropdown-container]");
    if (!dropdown) return null;
    const popups = Array.from(dropdown.querySelectorAll("[class*=sd-Dropdown-dropdown]"));
    const panels = (popups.length ? popups : [dropdown]).filter(panel => (includeHidden || isVisible(panel))
      && panel.querySelector(".page-container")
      && mokaRegionTabs(panel).some(tab => compactText(tab.innerText || tab.textContent, 20) === "省份")
      && mokaRegionTabs(panel).some(tab => compactText(tab.innerText || tab.textContent, 20) === "城市"));
    return panels.length === 1 ? panels[0] : null;
  }

  const confirmedMokaRegions = new WeakSet();

  function isMokaRegionControl(element) {
    if (mokaRegionPanel(element, true)) confirmedMokaRegions.add(element);
    return confirmedMokaRegions.has(element);
  }

  async function prepareMokaRegionControl(element, pathValues) {
    if (isMokaRegionControl(element)) return true;
    const dropdown = element.closest?.("[class*=sd-Dropdown-container]");
    if (!dropdown || (!pathValues?.length && !/籍贯|户籍|现居|居住|地区|地址/.test(element.placeholder || ""))) return false;
    const wasOpen = Array.from(dropdown.querySelectorAll("[class*=sd-Dropdown-dropdown]")).some(isVisible);
    if (!wasOpen) element.click();
    const region = await waitUntil(() => isMokaRegionControl(element), { timeout: 700 });
    if (!region && !wasOpen) element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    return Boolean(region);
  }

  function mokaRegionPage(panel) {
    const pages = Array.from(panel.querySelectorAll(".page-container")).filter(isVisible);
    return pages.length === 1 ? pages[0] : null;
  }

  function mokaRegionOptions(page) {
    if (!page) return [];
    const text = node => compactText(node.innerText || node.textContent || node.getAttribute?.("title"), 120);
    return Array.from(page.querySelectorAll("[class*=sd-Tag-container], [role=option], button, li, a, span, div"))
      .filter(node => isVisible(node) && !mokaDateOptionDisabled(node) && text(node)
        && !Array.from(node.children || []).some(child => text(child) === text(node)));
  }

  function normalizeMokaRegion(value) {
    return String(value || "").toLowerCase().replace(/[\s/＞>、,，|]/g, "");
  }

  function mokaRegionTabSelected(tab) {
    const parent = tab.parentElement;
    const nodes = [tab, ...(parent && compactText(parent.innerText || parent.textContent, 20)
      === compactText(tab.innerText || tab.textContent, 20) ? [parent] : [])];
    return nodes.some(node => node.getAttribute?.("aria-selected") === "true"
      || /(?:^|[-_\s])(?:active|selected)(?:$|[-_\s])/.test(String(node.className || "")));
  }

  function mokaRegionHasTabState(tabs) {
    return tabs.some(tab => tab.getAttribute?.("aria-selected") !== null || mokaRegionTabSelected(tab));
  }

  function mokaRegionOptionsChanged(options, before) {
    if (!before) return true;
    const text = option => compactText(option.innerText || option.textContent, 120);
    return options.length !== before.length || options.some((option, index) => option !== before[index].node || text(option) !== before[index].text);
  }

  async function selectMokaRegion(element, segments, previousValue = "") {
    let panel = mokaRegionPanel(element);
    if (!panel) {
      element.click();
      panel = await waitUntil(() => mokaRegionPanel(element), { timeout: 900 });
    }
    const fail = reason => {
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
      controlFailures.set(element, reason); return false;
    };
    if (!panel) return fail("地区级联面板未打开");
    const selected = [], labels = ["省份", "城市", "县区"];
    const expected = normalizeMokaRegion(previousValue);
    let previousOptions = null;
    for (let level = 0; level < (segments?.length || 3); level += 1) {
      panel = mokaRegionPanel(element) || panel;
      const findTab = current => mokaRegionTabs(current).find(node => compactText(node.innerText || node.textContent, 20) === labels[level]
        || (level === 2 && compactText(node.innerText || node.textContent, 20) === "区县"));
      const tab = findTab(panel), tabs = mokaRegionTabs(panel);
      if (!tab || mokaDateOptionDisabled(tab)) return fail(`级联第 ${level + 1} 级入口不可用`);
      const selectedTab = mokaRegionTabSelected(tab);
      const transition = previousOptions || (mokaRegionHasTabState(tabs) && !selectedTab
        ? mokaRegionOptions(mokaRegionPage(panel)).map(node => ({ node, text: compactText(node.innerText || node.textContent, 120) })) : null);
      if (!selectedTab) tab.click();
      const option = await waitUntil(() => {
        const active = mokaRegionPanel(element);
        if (!active) return null;
        const activeTabs = mokaRegionTabs(active), targetTab = findTab(active);
        if (!targetTab || (mokaRegionHasTabState(activeTabs) && !mokaRegionTabSelected(targetTab))) return null;
        const options = mokaRegionOptions(mokaRegionPage(active));
        if (!mokaRegionOptionsChanged(options, transition)) return null;
        if (segments) return segments[level].map(candidate => exactOption(options, candidate)).find(Boolean) || null;
        const remaining = expected.slice(normalizeMokaRegion(selected.join("")).length);
        const matches = options.filter(node => {
          const text = normalizeMokaRegion(compactText(node.innerText || node.textContent, 120));
          return text && remaining.startsWith(text);
        });
        return matches.length === 1 ? matches[0] : null;
      }, { timeout: 900 });
      if (!option) return fail(`级联第 ${level + 1} 级未找到选项、切层未确认或存在歧义`);
      previousOptions = mokaRegionOptions(mokaRegionPage(mokaRegionPanel(element) || panel))
        .map(node => ({ node, text: compactText(node.innerText || node.textContent, 120) }));
      selected.push(compactText(option.innerText || option.textContent, 120));
      option.click();
      await wait(120);
      if (!segments && normalizeMokaRegion(selected.join("")) === expected) break;
    }
    const selectedValue = normalizeMokaRegion(selected.join(""));
    if (previousValue && selectedValue !== expected) return fail("旧地区路径未能完整还原，未确认提交");
    panel = mokaRegionPanel(element) || panel;
    const confirm = Array.from(panel.querySelectorAll("button")).filter(button => isVisible(button) && !mokaDateOptionDisabled(button)
      && compactText(button.innerText || button.textContent, 20) === "确认");
    if (confirm.length > 1) return fail("地区确认入口存在歧义");
    if (confirm[0]) { confirm[0].click(); await wait(80); }
    const confirmed = await waitUntil(() => normalizeMokaRegion(getCurrentValue(element)) === selectedValue, { timeout: 900 });
    if (!confirmed) return fail("地区级联写入未确认");
    controlFailures.delete(element);
    return true;
  }

  async function restoreMokaRegionValue(element, value) {
    if (!value || !isMokaRegionControl(element)) return false;
    const split = String(value).split(/\s*[/＞>、,，|]\s*/).filter(Boolean);
    if (split.length > 3) return false;
    const segments = split.length > 1 ? split.map(part => [part]) : null;
    const restored = await selectMokaRegion(element, segments, value);
    if (restored) unconfirmedScalarWrites.delete(element);
    return restored;
  }

  async function chooseMokaPath(element, pathValues) {
    const before = getCurrentValue(element);
    const fail = async reason => {
      let restored = getCurrentValue(element) === before;
      if (!restored) restored = before ? await restoreMokaRegionValue(element, before) : await clearControlledDate(element);
      if (!restored) unconfirmedScalarWrites.add(element);
      else unconfirmedScalarWrites.delete(element);
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
      controlFailures.set(element, reason + (restored ? "" : "；旧值恢复未完成，可重试撤销"));
      return false;
    };
    if (!isMokaRegionControl(element) || !Array.isArray(pathValues) || !pathValues.length || pathValues.length > 3) {
      return fail("已识别地区级联需要省、市、县区路径");
    }
    const segments = pathValues.map(level => Array.isArray(level) ? level : [level]);
    if (segments.some(level => !level.length || level.some(value => typeof value !== "string" || !value.trim()))) {
      return fail("地区级联路径格式错误");
    }
    const success = await selectMokaRegion(element, segments);
    if (!success) return fail(controlFailures.get(element) || "地区级联写入未确认");
    unconfirmedScalarWrites.delete(element);
    return true;
  }

  function isMokaDropdown(element) {
    return Boolean(element.closest("[class*=sd-Dropdown-container]") || element.closest("[class*=sd-Select-container]"));
  }

  function mokaValueMatches(element, value) {
    const normalize = (text) => String(text || "").trim().replace(/\s+/g, " ").toLowerCase();
    return Boolean(normalize(value)) && normalize(getCurrentValue(element)) === normalize(value);
  }

  function mokaDateLayerControl(element, options) {
    if (options.fieldType !== "date" || !/^(年|月)$/.test(String(element.placeholder || "").trim())) return null;
    const field = element.closest?.("[class*=apply-field]");
    const title = compactText(field?.querySelector("[class*=title]")?.textContent, 80).replace(/[＊*]/g, "").trim();
    if (!/^(就读时间|起止时间|入学时间|入学日期|毕业时间|毕业日期|开始时间|结束时间|实习开始时间|实习结束时间|入职时间|离职时间)$/.test(title)) return null;
    return element.placeholder.trim() === "年" ? 0 : 1;
  }

  async function chooseMokaDateLayer(element, policy, layer) {
    const before = getCurrentValue(element), target = layer === 0 ? policy.parts.year : policy.parts.month;
    const selected = await chooseMokaOption(element, policy.candidates[layer]);
    const confirmed = selected && await waitUntil(() => dateLayerNumber(getCurrentValue(element), layer) === target, { timeout: 900 });
    if (confirmed) {
      datePrecisionNotes.set(element, layer === 0 ? "当前控件仅支持年份，已填写年份" : "当前控件仅支持月份，已填写月份");
      unconfirmedScalarWrites.delete(element); controlFailures.delete(element); return true;
    }
    let restored = getCurrentValue(element) === before;
    if (!restored) restored = before ? await chooseMokaOption(element, [before]) : await clearControlledDate(element);
    if (!restored) unconfirmedScalarWrites.add(element);
    else unconfirmedScalarWrites.delete(element);
    controlFailures.set(element, "日期分字段选择未确认" + (restored ? "" : "；旧值恢复未完成，可重试撤销"));
    return false;
  }

  async function writeMokaValue(element, value, options = {}) {
    if (!element || value == null || String(value).trim() === "") return { success: false, reason: "资料为空" };
    if (options.fieldType === "date" && options.pathValues?.length) {
      const policy = dateSelectionPolicy({ value, pathValues: options.pathValues }, "month");
      if (policy.reason) { controlFailures.set(element, policy.reason); return { success: false, reason: policy.reason }; }
    }
    const values = [String(value), ...(options.optionValues || [])];
    const current = getCurrentValue(element);
    const layer = mokaDateLayerControl(element, options);
    const layerPolicy = layer !== null ? dateSelectionPolicy({ value, pathValues: options.pathValues || [] }, "month") : null;
    if (layerPolicy?.reason) { controlFailures.set(element, layerPolicy.reason); return { success: false, reason: layerPolicy.reason }; }
    const precision = layer === 0 ? "year" : layer === 1 ? "month" : isMokaMonthPicker(element) ? "month" : isMokaDayPicker(element) ? "day" : "";
    if (current && !options.overwrite && !options.force) {
      const dateKey = precision === "month" ? "ym" : "date";
      const expectedDate = precision ? controlDateParts(value)?.[dateKey] : "";
      const unchanged = layer !== null ? dateLayerNumber(current, layer) === (layer === 0 ? layerPolicy.parts.year : layerPolicy.parts.month)
        : precision ? Boolean(expectedDate && controlDateParts(current)?.[dateKey] === expectedDate)
        : values.some((candidate) => mokaValueMatches(element, candidate));
      return unchanged
        ? { success: true, unchanged: true }
        : { success: false, reason: "字段已有内容" };
    }
    const undoRecord = captureFieldState({ element });
    const regionControl = !precision && options.fieldType !== "date" && await prepareMokaRegionControl(element, options.pathValues);
    let success = false;
    let scalarResult;
    if (layer !== null) success = await chooseMokaDateLayer(element, layerPolicy, layer);
    else if (isMokaMonthPicker(element)) success = await chooseMokaMonth(element, String(value), options.pathValues || []);
    else if (isMokaDayPicker(element)) success = await chooseMokaDay(element, String(value), options.pathValues || []);
    else if (regionControl) success = await chooseMokaPath(element, options.pathValues || []);
    else if (isMokaDropdown(element)) success = await chooseMokaOption(element, values);
    else {
      scalarResult = await writeScalarValue(element, String(value));
      success = scalarResult.success;
    }
    if (success) highlight(element, "filled");
    else highlight(element, "manual");
    const needsUndo = scalarResult?.needsUndo || (!success && getCurrentValue(element) !== current);
    if (needsUndo) unconfirmedScalarWrites.add(element);
    return { success, undoRecord, needsUndo, note: datePrecisionNotes.get(element) || "", precision,
      reason: success ? "" : (scalarResult?.reason || controlFailures.get(element) || "控件未确认写入") };
  }

  function mokaMonthRangeState(record, label) {
    const controls = mokaControls(record, label).filter((element) => element.type !== "checkbox");
    const values = controls.map(getCurrentValue);
    const defaultMonths = controls.map((element, index) => index % 2 === 1
      && !values[index - 1] && values[index] === "1" && !String(element.value || "").trim()
      && Boolean(element.closest?.("[class*=sd-Select-container]")?.querySelector("[class*=sd-Input-display-value]")));
    // The widget initializes the month display to 1 while its year is unselected.
    // Once a year exists, January is a real existing date and must be protected.
    return { controls, values: values.map((value, index) => defaultMonths[index] ? "" : value) };
  }

  async function fillMokaMonthRange(record, label, data, settings, report) {
    const before = mokaMonthRangeState(record, label);
    const controls = mokaControls(record, label);
    const current = controls.find((element) => element.type === "checkbox");
    const policies = ["start", "end"].map(key => {
      if (!data[key] || (key === "end" && data.current)) return null;
      const policy = dateSelectionPolicy({ value: data[key], pathValues: data.fieldPaths?.[key] || [] }, "month");
      if (policy.reason) report.skipped.push({ field: `${label}${key === "start" ? "开始" : "结束"}`, entryId: data.id,
        label: String(data[key]), score: 100, reason: policy.reason });
      return policy.reason ? null : policy;
    });
    const values = policies.flatMap(policy => policy ? [String(policy.parts.year), String(policy.parts.month)] : ["", ""]);
    const parts = ["开始年", "开始月", "结束年", "结束月"];
    for (let index = 0; index < values.length; index += 1) {
      // Selecting a year can replace the controls and initialize its month to 1.
      const live = mokaMonthRangeState(record, label);
      const element = live.controls[index]; const value = values[index];
      if (!element || !value || (data.current && index >= 2)) continue;
      if (index % 2 && dateLayerNumber(live.values[index - 1], 0) !== Number(values[index - 1])) {
        report.skipped.push({ field: `${label}${parts[index]}`, entryId: data.id, label: value, score: 100, reason: "对应年份未确认写入，未选择月份" });
        continue;
      }
      const candidates = policies[Math.floor(index / 2)].candidates[index % 2];
      await recordMokaWrite(report, element, value, `${label}${parts[index]}`, data.id, settings, candidates, [], index % 2 === 1 && !before.values[index]);
    }
    if (current && Boolean(data.current) !== optionSelected(current)) {
      if (!optionSelected(current) || settings.overwriteExisting) {
        const undoRecord = captureChoiceState({ options: [current] });
        current.click();
        await wait(50);
        if (optionSelected(current) === Boolean(data.current)) {
          report.transaction.push(undoRecord);
          report.filled.push({ field: `${label}至今`, entryId: data.id, label: data.name || data.company || data.id, expectedValue: "至今", kind: "choice", locator: cssLocator(current) });
        }
      }
    }
  }

  async function recordMokaWrite(report, element, value, fieldNameValue, entryId, settings, optionValues = [], pathValues = [], force = false, fieldType = "") {
    if (!element || value == null || String(value).trim() === "") return;
    report.suggestions.push({ field: fieldNameValue, entryId, label: String(value), score: 100 });
    if (!report.shouldFill) return;
    let outcome;
    try {
      outcome = await writeMokaValue(element, value, { optionValues, pathValues, overwrite: settings.overwriteExisting, force, fieldType });
    } catch (error) {
      outcome = { success: false, reason: `控件处理异常：${error?.message || String(error)}` };
    }
    if (outcome.success) {
      if (!outcome.unchanged && outcome.undoRecord) report.transaction.push(outcome.undoRecord);
      if (!outcome.unchanged) report.filled.push({ field: fieldNameValue, entryId, label: String(value), expectedValue: getCurrentValue(element), precisionNote: outcome.note || datePrecisionNotes.get(element), kind: "field", locator: outcome.undoRecord?.locator || cssLocator(element) });
    } else {
      if (outcome.needsUndo && outcome.undoRecord) retainFailedScalarWrite(report.transaction, outcome.undoRecord);
      report.skipped.push({ field: fieldNameValue, entryId, label: String(value), score: 100, reason: outcome.reason });
    }
  }

  // 记录级的自定义下拉选项（设置页可编辑），与映射里写死的 optionValues 合并。
  function recordFieldOptions(data, key) {
    if (typeof key !== "string") return [];
    const options = data?.fieldOptions?.[key];
    return Array.isArray(options) ? options.map((item) => String(item)).filter(Boolean) : [];
  }

  function mappedLabels(data, item, entry = null) {
    const labels = item.labels || item.label || item.aliases || [];
    return [...new Set([...(Array.isArray(labels) ? labels : [labels]),
      ...(data?.fieldAliases?.[item.value || item.key] || []),
      ...(entry ? [entry.label, ...(entry.aliases || [])] : [])].filter(Boolean))];
  }

  function mokaMappedCurrentValue(record, data, item) {
    const label = mappedLabels(data, item).find((label) => mokaControls(record, label).length);
    if (!label) return undefined;
    const controls = mokaControls(record, label);
    if (item.monthDate && controls.length === 2) {
      const { values } = mokaMonthRangeState(record, label);
      const [year, month] = values;
      // A partially selected year is not an empty record or a confirmed date.
      return year && month ? `${year}-${month.padStart(2, "0")}` : (year || month || "");
    }
    return getCurrentValue(controls[item.index || 0]);
  }

  async function fillMokaMappedRecord(record, data, mapping, settings, report) {
    for (const item of mapping) {
      const entry = item.entryId ? profileEntry(report.profile, item.entryId) : null;
      const controls = mappedLabels(data, item, entry).map((label) => mokaControls(record, label)).find((controls) => controls.length) || [];
      const element = controls[item.index || 0];
      const raw = typeof item.value === "function" ? item.value(data) : data[item.value];
      const value = raw ?? entry?.value;
      if (item.monthDate && controls.length === 2 && value) {
        const label = mappedLabels(data, item, entry).find((label) => mokaControls(record, label).length);
        await fillMokaMonthRange(record, label, { ...data, start: String(value), end: "", current: false }, settings, report);
        continue;
      }
      const optionValues = typeof item.optionValues === "function" ? item.optionValues(data) : item.optionValues;
      const pathValues = typeof item.pathValues === "function" ? item.pathValues(data) : item.pathValues;
      const mergedOptions = [...(optionValues || []), ...recordFieldOptions(data, item.value), ...(entry?.optionValues || [])];
      await recordMokaWrite(report, element, value, item.label, item.entryId || data.id, settings, mergedOptions,
        pathValues || data.fieldPaths?.[item.value] || entry?.pathValues || [], item.force,
        ["start", "end"].includes(item.value) ? "date" : entry?.fieldType || "");
    }
  }

  async function fillMokaCollection(blockKey, records, mapping, dateLabel, settings, report) {
    if (!records?.length) return;
    if (report.shouldFill) await ensureMokaRecords(blockKey, records.length);
    for (let index = 0; index < records.length; index += 1) {
      let element = mokaRecordElements(blockKey)[index];
      const data = records[index];
      if (!element) {
        report.skipped.push({ field: blockKey, entryId: data.id, label: data.name || data.company || data.id, score: 100, reason: report.shouldFill ? "未能创建对应记录" : "点击填写时将自动创建记录" });
        continue;
      }
      if (dateLabel) await fillMokaMonthRange(element, dateLabel, data, settings, report);
      element = mokaRecordElements(blockKey)[index] || element;
      await fillMokaMappedRecord(element, data, mapping, settings, report);
    }
  }

  const RECORD_IDENTITY_KEYS = new Set(["school", "company", "name", "language"]);
  const recordSlotOwners = new WeakMap();

  function claimRecordSlot(element, data) {
    if (element && data.id) recordSlotOwners.set(element, data.id);
  }

  function recordValueMatches(actual, data, key, expected = data[key]) {
    const normalize = (value) => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
    if (["start", "end", "awardDate"].includes(key)
      || (key === "publishedAt" && /^\d{4}(?:-|\/|年)\d{1,2}月?$/.test(String(actual || "")))) {
      const month = (value) => String(value || "").match(/^(\d{4})(?:-|\/|年)(\d{1,2})(?:月|(?:-\d{1,2})?)$/);
      const a = month(actual); const b = month(expected);
      if (a && b) return a[1] === b[1] && Number(a[2]) === Number(b[2]);
    }
    return [expected, ...(data.fieldOptions?.[key] || [])].some((value) => normalize(value) && normalize(actual) === normalize(value));
  }

  function mappedRecordValueMatches(actual, data, item, expected = data[item.value || item.key]) {
    if (item.datePrecision === "month") {
      const current = controlDateParts(actual)?.ym;
      const target = controlDateParts(expected)?.ym;
      return Boolean(current && target && current === target);
    }
    if (item.datePrecision === "day") {
      const current = controlDateParts(actual)?.date;
      const target = controlDateParts(expected)?.date;
      return Boolean(current && target && current === target);
    }
    return recordValueMatches(actual, data, item.value || item.key, expected);
  }

  function bestRecordSlot(elements, data, mapping, currentValue) {
    const identity = mapping.filter((item) => RECORD_IDENTITY_KEYS.has(item.value) && String(data?.[item.value] || "").trim());
    const discriminators = mapping.filter((item) => ["educationLevel", "academicDegree", "degree", "start", "position"].includes(item.value) && String(data?.[item.value] || "").trim());
    const match = elements.findIndex((element) => (!recordSlotOwners.has(element) || recordSlotOwners.get(element) === data.id)
      && identity.length && identity.every((item) => mappedRecordValueMatches(currentValue(element, item), data, item))
      && discriminators.every((item) => !String(currentValue(element, item) || "").trim() || mappedRecordValueMatches(currentValue(element, item), data, item)));
    if (match >= 0) return match;
    return elements.findIndex((element) => {
      const values = mapping.map((item) => currentValue(element, item));
      return values.some((value) => value !== undefined) && values.every((value) => value === undefined || !String(value).trim());
    });
  }

  function recordConflicts(data, mapping, readValue) {
    return mapping.flatMap((item) => {
      const raw = typeof item.value === "function" ? item.value(data) : data[item.value];
      const expected = typeof item.format === "function" ? item.format(raw) : raw;
      const current = readValue(item);
      if (expected == null || !String(expected).trim() || current == null || !String(current).trim()
        || mappedRecordValueMatches(current, data, item, expected)) return [];
      return [{ field: item.label || item.key, entryId: data.id, currentValue: String(current), expectedValue: String(expected) }];
    });
  }

  function stopForRecordConflicts(report, conflicts, settings) {
    if (!conflicts.length || settings.recordConflictConfirmed) return false;
    report.conflicts = [...(report.conflicts || []), ...conflicts];
    report.requiresConfirmation = true;
    return true;
  }

  async function fillMokaSingleRecord(blockKey, data, mapping, dateLabel, settings, report) {
    let elements = mokaRecordElements(blockKey);
    const identityMapping = dateLabel ? [...mapping, { value: "start", label: dateLabel, recordStart: true }] : mapping;
    let index = bestRecordSlot(elements, data, identityMapping, (record, item) => {
      if (item.recordStart) {
        const { values } = mokaMonthRangeState(record, dateLabel);
        const [year, month] = values;
        return year && month ? `${year}-${month.padStart(2, "0")}` : "";
      }
      return mokaMappedCurrentValue(record, data, item);
    });
    if (index < 0 && report.shouldFill) {
      const before = elements.length;
      elements = await ensureMokaRecords(blockKey, before + 1);
      if (elements.length > before) {
        index = elements.length - 1;
        captureAddedGroup(report, elements[index], () => mokaRecordElements(blockKey));
      }
    }
    const element = elements[index];
    if (!element) {
      report.skipped.push({ field: blockKey, entryId: data.id, label: data.name || data.school || data.company || data.language || data.id, score: 100, reason: "未找到空记录且未能新增记录" });
      return;
    }
    const conflicts = recordConflicts(data, mapping, (item) => mokaMappedCurrentValue(element, data, item));
    if (dateLabel) {
      const { values } = mokaMonthRangeState(element, dateLabel);
      const dates = [data.start?.slice(0, 4), data.start?.slice(5, 7).replace(/^0/, ""), data.current ? "" : data.end?.slice(0, 4), data.current ? "" : data.end?.slice(5, 7).replace(/^0/, "")];
      conflicts.push(...recordConflicts({ id: data.id, ...Object.fromEntries(dates.map((value, i) => [i, value])) }, dates.map((_, i) => ({ value: i, label: `${dateLabel}${i < 2 ? "开始" : "结束"}${i % 2 ? "月" : "年"}` })), (item) => values[item.value]));
    }
    if (stopForRecordConflicts(report, conflicts, settings)) return;
    claimRecordSlot(element, data);
    if (dateLabel) await fillMokaMonthRange(element, dateLabel, data, settings, report);
    await fillMokaMappedRecord(mokaRecordElements(blockKey)[index] || element, data, mapping, settings, report);
  }

  function appendManualIntentSkips(report, root = document) {
    const seen = new Set(report.skipped.map((item) => core.normalize(item.field)));
    for (const title of root.querySelectorAll("label, legend, [class*=title]")) {
      const label = compactText(title.innerText || title.textContent, 80);
      const normalized = core.normalize(label);
      if (!isManualIntentField(label) || seen.has(normalized)) continue;
      seen.add(normalized);
      report.skipped.push({ field: label, entryId: "manual.intent", label: "手动选择", score: 100, reason: "岗位和工作城市因企业而异，请手动填写" });
    }
  }

  function mokaProgrammingLanguageRecords(records = []) {
    return records;
  }

  // v6 把竞赛与荣誉合并成 awards；Moka 的页面仍可能分成两个区块，这里按「奖项类别」拆开。
  // 站点视图（siteProfile）已经拆好后传进来时优先用现成的，未拆时从 awards 现算。
  function mokaAwardSplit(records) {
    if (records.competitions || records.honors) {
      return {
        competitions: records.competitions || [],
        honors: records.honors || [],
        merged: [...(records.competitions || []), ...(records.honors || [])]
      };
    }
    const awards = records.awards || [];
    const isHonor = (award) => /荣誉/.test(String(award.awardCategory || ""));
    return {
      competitions: awards.filter((award) => !isHonor(award)),
      honors: awards.filter(isHonor),
      merged: awards
    };
  }

  function mokaCombinedAwardRecords(records) {
    return mokaAwardSplit(records).merged.map((record) => ({
      ...record,
      start: /^\d{4}-\d{2}/.test(record.start || "") ? record.start : (record.end || record.start)
    }));
  }

  // 每个可批量填写的一对多大类在这里声明一次；整页扫描与「批量填入」共用同一份映射。
  const MOKA_AWARD_MAPPINGS = {
    competitions: [
      { label: "竞赛名称", value: "name" }, { label: "竞赛类型", value: "type" },
      { label: "竞赛成绩", value: "result" }, { label: "竞赛描述", value: "description" }
    ],
    honors: [
      { label: "奖项名称", value: "name" }, { label: "奖项类型", value: "type" },
      { label: "奖项成绩", value: "result" }, { label: "奖项描述", value: "description" }
    ]
  };

  function mokaAwardBlocks(records, options = {}) {
    const runCompetitions = options.runCompetitions !== false;
    const runHonors = options.runHonors !== false;
    const split = mokaAwardSplit(records);
    const competitionBlock = mokaBlock("competitions");
    const honorBlock = mokaBlock("honors");
    if (competitionBlock && honorBlock && competitionBlock !== honorBlock) {
      const blocks = [];
      if (runCompetitions) blocks.push({ blockKey: "competitions", records: split.competitions, dateLabel: "参赛时间", mapping: MOKA_AWARD_MAPPINGS.competitions });
      if (runHonors) blocks.push({ blockKey: "honors", records: split.honors, dateLabel: "获奖时间", mapping: MOKA_AWARD_MAPPINGS.honors });
      return blocks;
    }
    if (!runCompetitions && !runHonors) return [];
    if (honorBlock) return [{ blockKey: "honors", records: mokaCombinedAwardRecords(records), dateLabel: "获奖时间", mapping: MOKA_AWARD_MAPPINGS.honors }];
    if (competitionBlock) return [{ blockKey: "competitions", records: mokaCombinedAwardRecords(records), dateLabel: "参赛时间", mapping: MOKA_AWARD_MAPPINGS.competitions }];
    return [];
  }

  const MOKA_COLLECTION_SPECS = {
    educations: {
      blocks: (records) => [{
        blockKey: "education", records: records.educations, dateLabel: "就读时间",
        mapping: [
          { label: "学校名称", value: "school" }, { label: "学院／系", value: "college" },
          { label: "专业名称", value: "major" }, { label: "学历", value: "educationLevel" }, { label: "学位", value: "academicDegree" },
          { label: "学习形式", labels: ["学习形式", "学历类型（校招）", "学历类型", "教育类型"], value: "studyType" },
          { label: "是否最高学历", value: "highest" }, { label: "实验室名称", value: "laboratory" },
          { label: "导师姓名", value: "advisor" }, { label: "研究方向", value: "research" },
          { label: "成绩排名", value: "rank" },
          { label: "GPA分数", value: "gpa" },
          { label: "统考成绩", value: "unifiedExamScore" }, { label: "专业课程", value: "professionalCourses" },
          { label: "入学时间", value: "start" }, { label: "毕业时间", value: "end" }
        ]
      }]
    },
    internships: {
      blocks: (records) => [{
        blockKey: "experience", records: records.internships, dateLabel: "起止时间",
        mapping: [
          { label: "公司名称", value: "company" }, { label: "职位名称", value: "position" },
          { label: "实习使用技能", value: "skills" }, { label: "经历描述及成果", value: "description" }
        ]
      }]
    },
    projects: {
      blocks: (records) => [{
        blockKey: "projects", records: records.projects, dateLabel: "起止时间",
        mapping: [
          { label: "项目名称", value: "name" },
          { label: "职责", value: "role" }, { label: "项目中职责", value: "role" },
          { label: "项目描述", value: "description" }, { label: "项目描述及成果", value: "description" }
        ]
      }]
    },
    papers: {
      blocks: (records) => [{
        blockKey: "papers", records: records.papers, dateLabel: null,
        mapping: [
          { label: "论文名称", labels: ["论文名称", "文章名称"], value: "name" }, { label: "论文类型", value: "type" },
          { label: "发表刊物", labels: ["发表刊物", "发表会议", "发表平台", "期刊名称", "会议名称", "journal", "conference", "publication venue"], value: "venue" },
          { label: "作者顺序", labels: ["作者顺序", "第几作者"], value: "authorOrder" }, { label: "发表时间", value: "publishedAt", monthDate: true },
          { label: "论文链接", value: "link" }, { label: "论文描述", value: "description" }
        ]
      }]
    },
    awards: {
      blocks: (records, options) => mokaAwardBlocks(records, options)
    },
    programmingLanguages: {
      blocks: (records) => [{
        blockKey: "programmingLanguages", records: mokaProgrammingLanguageRecords(records.programmingLanguages), dateLabel: null,
        mapping: [{ label: "编程语言名称", value: "name" }, { label: "掌握程度", value: "level" }]
      }]
    },
    foreignLanguages: {
      blocks: (records) => [{
        blockKey: "foreignLanguages", records: records.foreignLanguages, dateLabel: null,
        mapping: [
          { label: "语言类型", value: "language" }, { label: "语言种类", value: "language" },
          { label: "掌握程度", value: "proficiency" },
          { label: "听说", value: "listeningSpeaking" },
          { label: "读写", value: "readingWriting" },
          { label: "认证类型", value: "certification" }, { label: "成绩", value: "score" }
        ]
      }]
    }
  };

  const MOKA_COLLECTION_ORDER = ["educations", "internships", "projects", "papers", "awards", "programmingLanguages", "foreignLanguages"];

  async function scanOrFillMoka(profile, settings, shouldFill, segment = "all", resetTransaction = false) {
    const runIdentity = segment === "all" || segment === "basics" || segment === "identity";
    const runEducation = segment === "all" || segment === "basics" || segment === "education";
    const runExperience = segment === "all" || segment === "basics" || segment === "experience";
    const runProjects = segment === "all" || segment === "projects";
    const runPaper = segment === "all" || segment === "achievements" || segment === "paper";
    const runCompetitions = segment === "all" || segment === "achievements" || segment === "competitions";
    const runAchievementTail = segment === "all" || segment === "achievements" || segment === "achievement-tail";
    if (resetTransaction) lastTransaction = [];
    const report = { profile, shouldFill, suggestions: [], filled: [], skipped: [], transaction: [] };
    const basic = mokaRecordElements("basic")[0];
    if (runIdentity && basic) {
      const basicMap = [
        { label: "姓名", entryId: "basic.name" },
        { label: "姓名拼音（如:Li Xiaolong/Li Lin)", entryId: "basic.name_pinyin" },
        { label: "邮箱", entryId: "contact.email" },
        { label: "证件号码", entryId: "basic.id_card", index: 1 },
        { label: "性别", entryId: "basic.gender" },
        { label: "籍贯", entryId: "location.native_place" },
        { label: "民族", entryId: "basic.ethnicity" },
        { label: "毕业年份", entryId: "career.graduation_year" },
        { label: "最高学历", entryId: "basic.highest_education_level" },
        { label: "最高学历院校所在城市", entryId: "location.school" },
        { label: "是否接受其他岗位调剂", entryId: "career.adjustment" },
        { label: "兴趣爱好", entryId: "hobby.summary" },
        { label: "国籍", entryId: "basic.nationality" },
      ];
      await fillMokaMappedRecord(basic, { id: "basic" }, basicMap, settings, report);
      const phone = mokaControls(basic, "手机号码");
      const phoneEntry = profileEntry(profile, "contact.phone");
      const digits = phoneEntry?.value.replace(/^\+86\s*/, "").replace(/\s+/g, "");
      if (digits) {
        await recordMokaWrite(report, phone[0], "+86", "手机号码区号", "contact.phone.country", settings, ["+86"], [], true);
        await recordMokaWrite(report, phone[1], digits, "手机号码", "contact.phone", settings, [], [], true);
      }
    }

    const records = profile.records || {};
    const awardSplit = mokaAwardSplit(records);
    const mokaProgrammingLanguages = mokaProgrammingLanguageRecords(records.programmingLanguages);
    const collectionOptions = { runCompetitions, runHonors: runAchievementTail };
    for (const key of MOKA_COLLECTION_ORDER) {
      if (key === "educations" && !runEducation) continue;
      if (key === "internships" && !runExperience) continue;
      if (key === "projects" && !runProjects) continue;
      if (key === "papers" && !runPaper) continue;
      if (["programmingLanguages", "foreignLanguages"].includes(key) && !runAchievementTail) continue;
      for (const block of MOKA_COLLECTION_SPECS[key].blocks(records, collectionOptions)) {
        await fillMokaCollection(block.blockKey, block.records, block.mapping, block.dateLabel, settings, report);
      }
    }

    const singleBlocks = [
      ["selfDescription", "自我评价", "profile.self_evaluation"]
    ];
    for (const [blockId, label, entryId] of runExperience ? singleBlocks : []) {
      const record = mokaRecordElements(blockId)[0];
      if (record) await fillMokaMappedRecord(record, { id: entryId }, [{ label, entryId }], settings, report);
    }

    if (runIdentity) appendManualIntentSkips(report);

    if (shouldFill && report.transaction.length) {
      lastTransaction = segment === "all" ? report.transaction : [...lastTransaction, ...report.transaction];
    }
    const liveFields = collectFields("mokahr");
    return {
      site: "mokahr", adapter: "mokahr", hostname: location.hostname, url: location.href, documentToken,
      scannedCount: liveFields.length + collectChoiceGroups("mokahr").length,
      suggestions: report.suggestions, filled: report.filled, skipped: report.skipped,
      reasonCounts: reasonCounts(report.skipped),
      structured: true, segments: ["identity", "education", "experience", "projects", "paper", "competitions", "achievement-tail"], plannedRecords: {
        educations: records.educations?.length || 0, internships: records.internships?.length || 0,
        projects: records.projects?.length || 0, papers: records.papers?.length || 0,
        competitions: awardSplit.competitions.length, honors: awardSplit.honors.length,
        programmingLanguages: mokaProgrammingLanguages.length, foreignLanguages: records.foreignLanguages?.length || 0
      }
    };
  }

  const ZHIYE_SECTIONS = {
    identity: { heading: /^(个人信息|基本信息)$/i },
    education: { heading: /^(教育经历|教育背景)$/i, add: /添加\s*(?:教育经历|教育背景)/i },
    experience: { heading: /^(工作经历|实习经历)$/i, add: /添加\s*(?:工作经历|实习经历)/i },
    projects: { heading: /^(项目经历|项目经验)$/i, add: /添加\s*(?:项目经历|项目经验)/i }
  };

  // Public tenant metadata only. Personal values and equivalent options remain
  // in the user's JSON; these maps describe the observed website, not a profile.
  const CHINALIFE_ZHIYE = {
    basic: { title: '个人基本信息', fields: [] },
    educations: { title: '教育经历', fields: [['school','学校'],['major','专业名称'],['educationLevel','学历'],['academicDegree','学位'],['start','开始时间','day'],['end','结束时间','day']] },
    internships: { title: '工作/实习经历', fields: [['company','单位名称'],['department','所在部门'],['position','职位名称'],['description','工作描述'],['start','开始时间','day'],['end','结束时间','day']] },
    projects: { title: '参与科研项目', fields: [['name','项目名称'],['role','担当角色'],['description','主要工作内容'],['start','开始时间','month'],['end','结束时间','month']] },
    awards: { title: '学习/工作获奖情况', fields: [['name','奖项名称'],['type','获奖级别'],['issuer','颁奖单位'],['description','其他补充'],['start','获奖时间','day']] },
    papers: { title: '专业论著', fields: [['name','文章名、书名'],['venue','刊物、出版社'],['publishedAt','日期','day']] },
    foreignLanguages: { title: '语言能力', fields: [['language','外语语种'],['certification','语言等级'],['score','得分']] },
    certifications: { title: '专业资格', fields: [['name','证书名称'],['obtainedAt','获得时间','day']] },
    relationships: { title: '家庭成员及重要社会关系', fields: [['relation','称谓'],['name','姓名'],['birthDate','出生日期','day'],['employer','工作单位'],['jobTitle','所属职务']] },
    programmingLanguages: { title: '计算机技能', fields: [['name','技能类别']] }
  };
  const CHINALIFE_FLAT_ALIASES = {
    '移动电话': ['手机号码','手机号','联系电话'], '电子邮箱': ['邮箱','电子邮件'],
    '出生年月': ['出生日期','生日'], '党派': ['政治面貌'], '现居住地': ['现居住城市','现居城市'],
    '生源地(高考时户口所在地)': ['生源地'], '紧急联系方式': ['紧急联系人电话'],
    '身高(CM)': ['身高'], '体重(公斤)': ['体重'], '自我评价及求职目标': ['自我评价']
  };
  let chinalifeFingerprint = null;

  function isChinalifeRadioGroup(element) {
    return Boolean(element?.matches?.('.phoenix-radio-group') && element.closest('.ux-standard-form > div.form[id]') && isChinalifeZhiyePage());
  }

  function isChinalifeZhiyePage() {
    if (core.detectZhiyeTemplate?.(location.hostname) !== 'chinalife' || location.pathname !== '/form') return false;
    if (!document.querySelector('.ux-standard-form > div.form[id] .phoenix-select__input')) return false;
    if (!chinalifeFingerprint?.isConnected) chinalifeFingerprint = Array.from(document.querySelectorAll('div[id]')).find(node => !node.matches('div.form')
      && /^个人基本信息\s*\*?$/.test(compactText(node.textContent, 100)));
    return Boolean(chinalifeFingerprint && /^个人基本信息\s*\*?$/.test(compactText(chinalifeFingerprint.textContent, 100)));
  }

  function chinalifeSection(key) {
    const spec = CHINALIFE_ZHIYE[key];
    if (!spec) return null;
    const headings = Array.from(document.querySelectorAll('div[id]')).filter(node => !node.matches('div.form')
      && compactText(node.textContent, 100).replace(/\s*\*$/, '') === spec.title
      && document.querySelector(`.ux-standard-form > div.form[id="${CSS.escape(node.id)}"]`));
    return headings.length === 1 ? headings[0] : null;
  }

  function chinalifeSchema(schema, data) {
    const spec = CHINALIFE_ZHIYE[schema.key];
    const fields = (spec?.fields || []).map(([key,label,datePrecision]) => ({ key, aliases: [label], datePrecision }));
    // An explicit JSON alias can supply an otherwise unmapped field. It must
    // still match a real website label, and cannot reuse another field's slot.
    for (const [key,aliases] of Object.entries(data?.fieldAliases || {})) {
      if (!fields.some(field => field.key === key) && Array.isArray(aliases) && aliases.length && data[key] != null)
        fields.push({ key, aliases: [...aliases] });
    }
    return { ...schema, fields };
  }

  function chinalifeRecordForms() {
    if (!isChinalifeZhiyePage()) return [];
    // Collect every known record title, including duplicates. Explicit JSON
    // answers in ordinary questionnaire sections may still match flat fields.
    const titles = new Set(Object.entries(CHINALIFE_ZHIYE).filter(([key]) => key !== 'basic').map(([,spec]) => spec.title));
    const ids = new Set(Array.from(document.querySelectorAll('div[id]')).filter(node => !node.matches('div.form')
      && titles.has(compactText(node.textContent,100).replace(/\s*\*$/, ''))).map(node => node.id));
    return Array.from(document.querySelectorAll('.ux-standard-form > div.form[id]')).filter(form => ids.has(form.id));
  }

  // MAIN-world reader responses are correlated strings, not shared JS objects.
  // No JSON profile or write instruction is sent across this boundary.
  function chinalifeReadback(element, kind) {
    if (!element?.isConnected) return null;
    const id = crypto.randomUUID();
    let value = null;
    const listener = event => {
      if (typeof event.detail !== 'string') return;
      try { const response = JSON.parse(event.detail); if (response.id === id) value = response.value; } catch (_) {}
    };
    element.addEventListener('MORI_CV_CHINALIFE_READ_RESULT',listener);
    try { element.dispatchEvent(new CustomEvent('MORI_CV_CHINALIFE_READ',{bubbles:true,detail:JSON.stringify({id,kind})})); }
    finally { element.removeEventListener('MORI_CV_CHINALIFE_READ_RESULT',listener); }
    return value;
  }

  function isSanyDatePage() {
    return core.detectZhiyeTemplate?.(location.hostname)==='sany' && location.pathname==='/form';
  }
  function isSanyDateCandidate(element) {
    return isSanyDatePage() && element?.matches?.('.phoenix-select__input')
      && /^(出生日期|毕业时间|开始时间|结束时间|获奖时间)$/.test(compactText(element.closest('.form-item')?.querySelector('label')?.textContent,80));
  }
  function chinalifeDatePrecision(element) {
    if (isSanyDateCandidate(element)) {
      const observed=chinalifeReadback(element,'date');
      return observed?.mode==='date' && observed.format==='YYYY-MM-DD' ? 'day' : '';
    }
    if (globalThis.ResumeHelperBosc?.isDate(element) && element.matches('.phoenix-select__input')) {
      return globalThis.ResumeHelperBosc.datePrecision(element);
    }
    if (isSeyondRecordControl(element) && element?.matches?.('.phoenix-select__input')
      && /^(发布时间|获奖时间)$/.test(compactText(element.closest('.form-item')?.querySelector('label')?.textContent,80))) return 'day';
    if (!isChinalifeZhiyePage() || !element?.matches?.('.phoenix-select__input')) return '';
    const label = compactText(element.closest('.form-item')?.querySelector('label')?.textContent, 80);
    if (!/^(出生年月|加入党派时间|开始时间|结束时间|获奖时间|日期|获得时间|出生日期|填表日期)$/.test(label)) return '';
    const observed = chinalifeReadback(element,'date');
    if (observed && ['date','month'].includes(observed.mode)) return observed.mode === 'month' ? 'month' : 'day';
    const project = chinalifeSection('projects');
    return project && element.closest('div.form')?.id === project.id && /^(开始时间|结束时间)$/.test(label) ? 'month' : 'day';
  }

  function isChinalifeRegion(element) {
    return Boolean(element?.matches?.('.phoenix-select__input') && (globalThis.ResumeHelperBosc?.isRegion(element) || globalThis.ResumeHelperSany?.isRegion(element)
      || (isChinalifeZhiyePage() && /^(籍贯|生源地\(高考时户口所在地\)|现居住地|期望工作城市)$/.test(compactText(element.closest('.form-item')?.querySelector('label')?.textContent, 100)))));
  }

  function chinalifeRegionSelections(element) {
    const selections = chinalifeReadback(element,'selection');
    return Array.isArray(selections) && selections.every(item => typeof item.id === 'string' && typeof item.label === 'string') ? selections : null;
  }

  function chinalifeLayers() {
    return Array.from(document.querySelectorAll('.common-unmodeled-layer'))
      .filter(node => {
        const style = getComputedStyle(node);
        // An entering popup already owns its control even at opacity zero.
        // Ignoring it would click the trigger again and close it mid-animation.
        return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0
          && !node.classList.contains('common-unmodeled-layer-hidden');
      });
  }

  async function openChinalifeLayer(element, selector) {
    const existing = chinalifeLayers();
    // A normal click can switch between the observed single-value Seyond
    // controls. Do not turn another record's expanded menu into a batch-wide
    // blocker, or dismiss an unknown/multi-value popup on the user's behalf.
    const switchOwners = (isSeyondRecordControl(element) || globalThis.ResumeHelperBosc?.ownsControl(element) || globalThis.ResumeHelperSany?.ownsControl(element) || isSanyDateCandidate(element)) && existing.length === 1
      ? Array.from(document.querySelectorAll('.phoenix-select__input')).filter(input => {
        if (!globalThis.ResumeHelperSany?.ownsControl(input) && !isSanyDateCandidate(input) && !globalThis.ResumeHelperBosc?.ownsControl(input) && (!isSeyondRecordControl(input) || !/^(获奖时间|获奖级别|发布时间|作者顺序)$/.test(
          compactText(input.closest('.form-item')?.querySelector('label')?.textContent,100)))) return false;
        const popup = chinalifeReadback(input,'popup');
        return popup?.scalar === true && popup.pending !== true && Number.isInteger(popup.index)
          && Array.from(document.querySelectorAll('.common-unmodeled-layer'))[popup.index] === existing[0];
      }) : [];
    const canSwitch = switchOwners.length === 1 && switchOwners[0] !== element;
    if (existing.length && !canSwitch) {
      if (existing.length === 1) {
        const current = chinalifeReadback(element,'popup');
        if (current?.pending === true && Array.from(document.querySelectorAll('.common-unmodeled-layer'))[current.index] === existing[0]) {
          controlFailures.set(element,'当前控件有尚未确认的选择，请先确定或取消');return null;
        }
        const ready = await waitUntil(() => {
          const layers = chinalifeLayers();
          const popup = chinalifeReadback(element,'popup');
          const owned = Number.isInteger(popup?.index) && Array.from(document.querySelectorAll('.common-unmodeled-layer'))[popup.index];
          return layers.length === 1 && layers[0] === existing[0] && layers[0] === owned
            && isVisible(owned) && owned.querySelector(selector) ? owned : null;
        }, { timeout: 1000 });
        if (ready) return ready;
      }
      controlFailures.set(element, '请先关闭其他控件浮层，再填写'); return null;
    }
    const owner = element.closest('.phoenix-select') || element;
    activateZhiyeControl(owner);
    const layer = await waitUntil(() => {
      const layers = chinalifeLayers();
      const needsOwner=isSanyDateCandidate(element) || isSeyondRecordControl(element) || globalThis.ResumeHelperBosc?.ownsControl(element) || globalThis.ResumeHelperSany?.ownsControl(element);
      const owner=needsOwner ? chinalifeReadback(element,'popup') : null;
      const owned=!needsOwner || (Number.isInteger(owner?.index) && Array.from(document.querySelectorAll('.common-unmodeled-layer'))[owner.index]===layers[0]);
      return layers.length === 1 && owned && isVisible(layers[0]) && layers[0].querySelector(selector) ? layers[0] : null;
    }, { timeout: 1000 });
    if (!layer) controlFailures.set(element, '未找到所属控件浮层，请手动处理');
    return layer;
  }

  function ownsChinalifeLayer(layer) {
    const layers = chinalifeLayers();
    return layer?.isConnected && layers.length === 1 && layers[0] === layer;
  }

  function clickChinalifeFooter(button) {
    if (!button) return false;
    // Phoenix binds onClick to the inner wrapper, not the visual outer div.
    const wrappers = button.querySelectorAll(':scope > .phoenix-button__wraper');
    if (wrappers.length > 1) return false;
    const target = wrappers[0] || button;
    if (!isVisible(target) || /--disabled/.test(target.className || '')) return false;
    target.click();
    return true;
  }

  async function closeChinalifeLayer(element, layer) {
    if (!ownsChinalifeLayer(layer)) return !chinalifeLayers().includes(layer);
    const cancel = exactTextElement(layer, '.area-footer-button .phoenix-button, .selector-footer-button .phoenix-button', '取消');
    if (cancel) clickChinalifeFooter(cancel);
    else element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', which: 27, keyCode: 27, bubbles: true }));
    // Phoenix dates and Seyond single-select menus can ignore Escape and
    // listen for an outside mousedown instead.
    // The own field label closes it without selecting, clearing or focusing a
    // different control. Never dispatch an outside event for a foreign popup.
    const popup = isSeyondRecordControl(element) || globalThis.ResumeHelperBosc?.ownsControl(element) || globalThis.ResumeHelperSany?.ownsControl(element) ? chinalifeReadback(element,'popup') : null;
    const ownedScalarMenu = popup?.scalar === true && Number.isInteger(popup.index)
      && Array.from(document.querySelectorAll('.common-unmodeled-layer'))[popup.index] === layer
      && layer.querySelector('.phoenix-selectList');
    if (ownsChinalifeLayer(layer) && (layer.querySelector('.phoenix-calendar') || ownedScalarMenu)) {
      const label = element.closest('.form-item')?.querySelector('label');
      if (label && !layer.contains(label)) label.dispatchEvent(new MouseEvent('mousedown', {button:0,bubbles:true}));
    }
    return Boolean(await waitUntil(() => !chinalifeLayers().includes(layer), { timeout: 700 }));
  }

  async function clearChinalifeChoice(element) {
    const select = element.closest('.phoenix-select');
    select?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    select?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    // This date widget's enabled clear icon is revealed by CSS :hover only;
    // dispatched mouse events do not activate :hover in an extension script.
    const hoverClear = (chinalifeDatePrecision(element) || globalThis.ResumeHelperBosc?.ownsControl(element) || globalThis.ResumeHelperSany?.ownsControl(element)) && !element.disabled && isVisible(select)
      && select.classList.contains('phoenix-select--editable') && !select.classList.contains('phoenix-select--disabled');
    const clears = Array.from(select?.querySelectorAll('.phoenix-select__clearIcon') || [])
      .filter(node => isVisible(node) || (hoverClear && node.classList.contains('phoenix-select__clearIcon--show')));
    if (clears.length !== 1) return false;
    clears[0].click();
    return Boolean(await waitUntil(() => !getCurrentValue(element), { timeout: 800 }));
  }

  async function chooseChinalifeOption(element, entry, recover = true) {
    const before = getCurrentValue(element);
    let failureReason='未找到精确选项；请核对 JSON 主值和下拉候选';
    const layer = await openChinalifeLayer(element, '.phoenix-selectList__listItem, .constant-main-layer-container');
    if (!layer) return false;
    const constant=layer.querySelector('.constant-main-layer-container');
    if (constant) {
      if (globalThis.ResumeHelperSany?.isConstant(element)) await waitUntil(()=>!ownsChinalifeLayer(layer)
        || Array.from(constant.querySelectorAll('.list-data-container .list-item-container')).some(isVisible),{timeout:1500});
      const initial=chinalifeReadback(constant,'constant');
      if (!initial || initial.multi || initial.selections.length>1) failureReason='常量控件结构未知或为多选，当前未自动填写，请手动处理';
      if (initial && !initial.multi && initial.selections.length<=1 && Boolean(before)===Boolean(initial.selections.length)) {
        const rows=Array.from(constant.querySelectorAll('.list-data-container .list-item-container')).filter(isVisible)
          .map(row=>({row,meta:chinalifeReadback(row,'constantRow'),label:row.querySelector('.item-text-label'),icon:row.querySelector('.RadioUnchecked,.RadioChecked')}));
        for (const candidate of targetValues(entry,'select')) {
          const matches=rows.filter(item=>item.meta?.leaf&&!item.meta.disabled&&item.icon&&isVisible(item.icon)
            && normalizedValueMatches(item.label?.textContent,candidate));
          if (matches.length!==1) continue;
          const chosen=matches[0];chosen.icon.dispatchEvent(new MouseEvent('click', {bubbles:true}));
          failureReason='常量选中或提交回读未确认，请手动核对控件';
          const selected=await waitUntil(()=>{const snapshot=chinalifeReadback(constant,'constant');return snapshot&&!snapshot.multi&&snapshot.selections.length===1&&snapshot.selections[0].id===chosen.meta.id;},{timeout:800});
          const confirm=exactTextElement(layer,'.selector-footer-button .phoenix-button','确定');
          if (!selected||!confirm) break;
          clickChinalifeFooter(confirm);
          if (await waitUntil(()=>!ownsChinalifeLayer(layer)&&normalizedValueMatches(getCurrentValue(element),candidate),{timeout:800})) return true;
          break;
        }
      }
    }
    const options = Array.from(layer.querySelectorAll('.phoenix-selectList__listItem')).filter(isVisible);
    for (const value of targetValues(entry, 'select')) {
      const item = exactOption(options, value);
      if (!item) continue;
      item.click();
      if (await waitUntil(() => !ownsChinalifeLayer(layer) && normalizedValueMatches(getCurrentValue(element), value), { timeout: 800 })) return true;
      break;
    }
    await closeChinalifeLayer(element, layer);
    if (recover && getCurrentValue(element) !== before) {
      const restored = before ? await chooseChinalifeOption(element, { value: before }, false) : await clearChinalifeChoice(element);
      if (!restored) unconfirmedScalarWrites.add(element);
    }
    controlFailures.set(element, failureReason);
    return false;
  }

  function bestChinalifeRecordSlot(items, data, mapping, fields, settings) {
    const owned = items.filter(item => recordSlotOwners.get(item) === data.id);
    if (owned.length === 1) return items.indexOf(owned[0]);
    const identity = mapping.filter(field => (RECORD_IDENTITY_KEYS.has(field.key) || field.key === 'relation') && String(data[field.key] || '').trim());
    const discriminators = mapping.filter(field => ['educationLevel','academicDegree','start','position','birthDate','publishedAt'].includes(field.key) && String(data[field.key] || '').trim());
    const read = (item, field) => { const control = fields.get(item)?.get(field.key); return control ? getCurrentValue(control.element) : undefined; };
    const fits = (item, field) => mappedRecordValueMatches(read(item, field), data, { ...field, value: field.key });
    const matches = items.filter(item => (!recordSlotOwners.has(item) || recordSlotOwners.get(item) === data.id)
      && identity.length && identity.every(field => fits(item,field))
      && discriminators.every(field => !String(read(item,field) || '').trim() || fits(item,field)));
    if (matches.length === 1) return items.indexOf(matches[0]);
    if (settings.recordConflictConfirmed) {
      const matchingIdentity = items.filter(item => (!recordSlotOwners.has(item) || recordSlotOwners.get(item) === data.id)
        && identity.length && identity.every(field => fits(item,field)));
      if (matchingIdentity.length === 1) return items.indexOf(matchingIdentity[0]);
    }
    return items.findIndex(item => !recordSlotOwners.has(item) && Array.from(item.querySelectorAll(FIELD_SELECTOR)).filter(isSupportedFieldElement).every(element => !getCurrentValue(element))
      && !Array.from(item.querySelectorAll('input[type=radio],input[type=checkbox],[role=radio],[role=checkbox],.phoenix-radio-group .phoenix-radio'))
        .some(option=>!globalThis.ResumeHelperSany?.isPaperGate(option) && optionSelected(option)));
  }

  async function chooseChinalifeYear(layer, target) {
    const opener=layer.querySelector('.phoenix-calendar-year-select, .phoenix-calendar-month-panel-year-select');
    if (!opener || !isVisible(opener)) return null;
    activateZhiyeControl(opener);
    if (!await waitUntil(()=>ownsChinalifeLayer(layer)&&layer.querySelector('.phoenix-calendar-year-panel'),{timeout:800})) return false;
    const cells=()=>Array.from(layer.querySelectorAll('.phoenix-calendar-year-panel-cell')).filter(cell=>isVisible(cell)
      && !/(last|next)-decade/.test(cell.className));
    for(let step=0;ownsChinalifeLayer(layer)&&step<100;step++) {
      const options=cells();
      const matching=options.filter(cell=>dateLayerNumber(cell.textContent,0)===target&&!mokaDateOptionDisabled(cell));
      if (matching.length===1) {activateZhiyeControl(matching[0]);return Boolean(await waitUntil(()=>!layer.querySelector('.phoenix-calendar-year-panel'),{timeout:800}));}
      const years=options.map(cell=>dateLayerNumber(cell.textContent,0)).filter(Number.isFinite);
      if (!years.length||target>=Math.min(...years)&&target<=Math.max(...years)) return false;
      const direction=target<Math.min(...years)?'prev':'next';
      // The day header remains underneath the year grid. A comma selector
      // picks it first in DOM order and moves only one year, not one decade.
      const nav=layer.querySelector('.phoenix-calendar-year-panel')
        ?.querySelector(`.phoenix-calendar-year-panel-${direction}-decade-btn`);
      if (!nav||!isVisible(nav)||mokaDateOptionDisabled(nav)) return false;
      const before=years.join('|');activateZhiyeControl(nav);
      if (!await waitUntil(()=>cells().map(cell=>dateLayerNumber(cell.textContent,0)).join('|')!==before,{timeout:800})) return false;
    }
    return false;
  }

  async function chooseChinalifeDate(element, entry, recover = true) {
    if (globalThis.ResumeHelperBosc?.isDate(element)) {
      const observed=chinalifeReadback(element,'date'),precision=globalThis.ResumeHelperBosc.datePrecision(element);
      if(observed?.mode!==(precision==='month'?'month':'date')||observed.format!==(precision==='month'?'YYYY-MM':'YYYY-MM-DD')){
        controlFailures.set(element,'日期控件格式或所属元数据未知，请手动处理');return false;
      }
    } else if (isSanyDateCandidate(element) || isSeyondRecordControl(element)) {
      const observed=chinalifeReadback(element,'date');
      if (observed?.mode!=='date'||observed.format!=='YYYY-MM-DD') { controlFailures.set(element,'日期控件格式或所属元数据未知，请手动处理');return false; }
    }
    const precision = chinalifeDatePrecision(element);
    const policy = dateSelectionPolicy(entry, precision);
    if (policy.reason) { controlFailures.set(element, policy.reason); return false; }
    const before = getCurrentValue(element);
    const layer = await openChinalifeLayer(element, '.phoenix-calendar');
    if (!layer) return false;
    const yearNode = () => layer.querySelector('.phoenix-calendar-month-panel-year-select-content, .phoenix-calendar-year-select');
    const currentYear = () => Number(compactText(yearNode()?.textContent, 40).match(/\d{4}/)?.[0]);
    let year = currentYear();
    const yearChoice=year && year!==policy.parts.year ? await chooseChinalifeYear(layer,policy.parts.year) : null;
    year=currentYear();
    for (let step = 0; yearChoice!==false && ownsChinalifeLayer(layer) && year && year !== policy.parts.year && step < 200; step += 1) {
      const direction = policy.parts.year < year ? 'prev' : 'next';
      const nav = layer.querySelector(`.phoenix-calendar-month-panel-${direction}-year-btn, .phoenix-calendar-${direction}-year-btn`);
      if (!nav || !isVisible(nav)) break;
      activateZhiyeControl(nav);
      if (!await waitUntil(() => currentYear() !== year, { timeout: 700 })) break;
      year = currentYear();
    }
    if (yearChoice!==false && year === policy.parts.year && ownsChinalifeLayer(layer)) {
      if (!layer.querySelector('.phoenix-calendar-month-panel-cell, .phoenix-calendar-month-panel-month'))
        activateZhiyeControl(layer.querySelector('.phoenix-calendar-month-select'));
      const month = await waitUntil(() => policy.candidates[1].map(candidate=>exactTextElement(layer,
        '.phoenix-calendar-month-panel-cell',candidate)).find(Boolean), { timeout: 800 });
      if (month) {
        activateZhiyeControl(month);
        if (precision === 'day') {
          await waitUntil(() => ownsChinalifeLayer(layer) && layer.querySelector('.phoenix-calendar-date-panel'), { timeout: 800 });
          const days = Array.from(layer.querySelectorAll('.phoenix-calendar-cell')).filter(cell => isVisible(cell)
            && !/(last|next)-month|disabled/.test(cell.className) && cell.getAttribute('aria-disabled') !== 'true'
            && compactText(cell.querySelector('.phoenix-calendar-date')?.textContent || cell.textContent, 20) === String(policy.parts.day));
          if (days.length === 1) activateZhiyeControl(days[0].querySelector('.phoenix-calendar-date') || days[0]);
        }
      }
    }
    const expected = precision === 'month' ? policy.parts.ym : policy.parts.date;
    const confirmed = await waitUntil(() => !ownsChinalifeLayer(layer)
      && (precision === 'month' ? controlDateParts(getCurrentValue(element))?.ym : controlDateParts(getCurrentValue(element))?.date) === expected, { timeout: 800 });
    if (confirmed) {
      if (precision === 'month' && policy.parts.day) datePrecisionNotes.set(element, '网站仅支持年月，已填写年月并忽略日');
      return true;
    }
    await closeChinalifeLayer(element, layer);
    if (recover && getCurrentValue(element) !== before) {
      const restored = before ? await chooseChinalifeDate(element, { value: before }, false) : await clearChinalifeChoice(element);
      if (!restored) unconfirmedScalarWrites.add(element);
    }
    controlFailures.set(element, '日期选项禁用、未找到或完整回读未确认');
    return false;
  }

  function chinalifeAreaModel(layer) {
    const area = layer?.querySelector('.area-selector-container');
    const value = chinalifeReadback(area,'area');
    if (!Array.isArray(value?.nodes) || !Array.isArray(value.selections)) return null;
    return { nodes:value.nodes, state:{selectData:value.selections}, area };
  }

  function chinalifeAreaPath(nodes, id) {
    const path = [], seen = new Set();
    let node = nodes.find(node => String(node.id) === String(id));
    while (node && !seen.has(String(node.id))) {
      seen.add(String(node.id)); path.unshift(node);
      node = nodes.find(parent => String(parent.id) === String(node.parentId));
    }
    return path;
  }

  function chinalifeAreaRows(layer) {
    return Array.from(layer.querySelectorAll('.area-data-container .area-item-container')).filter(isVisible)
      .map(row => ({ row, data: chinalifeReadback(row,'row'),
        label: row.querySelector('.area-text-label'), icon: row.querySelector('[class*=area-icon-Radio], [class*=area-icon-Checkbox]') }));
  }

  async function chooseChinalifeRegion(element, entry, restoreSelections = null, recover = true) {
    const before = chinalifeRegionSelections(element);
    if (!before) { controlFailures.set(element, '地区选择结构已变化，无法安全快照，请手动处理'); return false; }
    const layer = await openChinalifeLayer(element, '.area-selector-container');
    if (!layer) return false;
    // Sany loads its dictionaries after opening; a visible shell is not a
    // finished single-select panel. Keep the existing other-tenant timing.
    if (globalThis.ResumeHelperSany?.isRegion(element)) await waitUntil(()=>chinalifeReadback(element,'popup')?.scalar===true
      && chinalifeAreaModel(layer)?.nodes.length && chinalifeAreaRows(layer).length,{timeout:1500});
    if ((globalThis.ResumeHelperBosc?.isRegion(element) || globalThis.ResumeHelperSany?.isRegion(element)) && chinalifeReadback(element,'popup')?.scalar !== true) {
      controlFailures.set(element,'地区控件单值模式未确认，请手动处理');return false;
    }
    const model = chinalifeAreaModel(layer);
    let success = false;
    if (model && before.every(item => model.nodes.some(node => String(node.id) === item.id))) {
      const clear = layer.querySelector('.clear-select-data');
      if (clear && isVisible(clear)) clear.click();
      const paths = [];
      if (restoreSelections) {
        for (const item of restoreSelections) {
          const node = model.nodes.find(node => String(node.id) === item.id);
          if (node) paths.push({ levels: [[node.label]], id: item.id });
        }
      } else if (entry.pathValues?.length) paths.push({ levels: entry.pathValues });
      else {
        // No guessed split of a copy value into province/city/district.
        const rows = chinalifeAreaRows(layer);
        const leaf = targetValues(entry, 'select').map(value => rows.find(row => row.data?.hasChildren !== '1' && normalizedValueMatches(row.label?.textContent, value))).find(Boolean);
        if (leaf) paths.push({ levels: [[leaf.data.label]] });
      }
      let selectedId = null;
      let complete = Boolean(paths.length || restoreSelections?.length === 0);
      for (const sourcePath of paths) {
        const home = layer.querySelector('.area-breadcrumb-list .phoenix-breadcrumb-link');
        if (home && isVisible(home)) home.click();
        const first = sourcePath.levels[0] || [];
        const matching = sourcePath.id ? model.nodes.filter(node => String(node.id) === sourcePath.id)
          : first.map(value => model.nodes.filter(node => normalizedValueMatches(node.label, value))).find(nodes => nodes.length) || [];
        const ancestors = matching.length === 1 ? chinalifeAreaPath(model.nodes, matching[0].id).slice(0,-1) : [];
        const levels = [...ancestors.map(node => [node.label]), ...sourcePath.levels];
        for (let index = 0; complete && index < levels.length; index += 1) {
          let rows = chinalifeAreaRows(layer);
          const candidates = levels[index].map(value => rows.filter(row => normalizedValueMatches(row.label?.textContent, value)
            && row.data && row.icon && !/disabled/.test(row.icon.getAttribute('class') || ''))).find(options => options.length) || [];
          // ChinaLife shows a non-expandable national shortcut next to its
          // provinces. Skip a model ancestor only when its direct child is
          // already present in this panel; never click that shortcut as a path.
          if (index < ancestors.length && (!candidates.length || candidates[0].data.hasChildren !== '1')) {
            const ancestor=ancestors[index];
            const child=rows.some(row=>String(row.data?.parentId)===String(ancestor.id)
              && levels[index+1]?.some(value=>normalizedValueMatches(row.label?.textContent,value)));
            if (child) continue;
          }
          if (candidates.length !== 1) { complete = false; break; }
          const chosen = candidates[0]; selectedId = String(chosen.data.id);
          if (index < levels.length-1) {
            const old = rows.map(row => row.data?.id).join('|');
            chosen.label.click();
            if (!await waitUntil(() => chinalifeAreaRows(layer).map(row => row.data?.id).join('|') !== old, { timeout: 1000 })) { complete = false; break; }
          } else {
            if (!isVisible(chosen.icon)) { complete = false; break; }
            chosen.icon.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            if (!await waitUntil(() => chinalifeAreaModel(layer)?.state.selectData.some(item => String(item.id) === selectedId), { timeout: 800 })) { complete = false; break; }
          }
        }
        if (!complete) break;
      }
      if (complete) {
        const pending = chinalifeAreaModel(layer)?.state.selectData.map(item => String(item.id)) || [];
        const expected = restoreSelections ? restoreSelections.map(item => item.id) : selectedId ? [selectedId] : [];
        const equals = (a,b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
        const confirm = exactTextElement(layer, '.area-footer-button .phoenix-button', '确定');
        if (confirm && equals(pending, expected)) {
          clickChinalifeFooter(confirm);
          success = Boolean(await waitUntil(() => !ownsChinalifeLayer(layer)
            && equals((chinalifeRegionSelections(element) || []).map(item => item.id), expected), { timeout: 1000 }));
        }
      }
    }
    if (success) return true;
    await closeChinalifeLayer(element, layer);
    if (recover && JSON.stringify(chinalifeRegionSelections(element)) !== JSON.stringify(before)) {
      if (!await chooseChinalifeRegion(element, {}, before, false)) unconfirmedScalarWrites.add(element);
    }
    controlFailures.set(element, '地区路径缺项、候选歧义或提交回读未确认；请核对 JSON 级联路径');
    return false;
  }

  async function removeChinalifeRecord(form, getItems) {
    let owner = form.parentElement;
    while (owner && owner.querySelectorAll('div.form').length === 1) {
      const deletes = Array.from(owner.querySelectorAll('span')).filter(node => isVisible(node) && node.children.length === 0 && compactText(node.textContent, 40) === '删除');
      if (deletes.length === 1) {
        if (chinalifeLayers().length) return false;
        deletes[0].click();
        const layer = await waitUntil(() => { const layers = chinalifeLayers(); return layers.length === 1 ? layers[0] : null; }, { timeout: 800 });
        const confirm = layer && exactTextElement(layer, 'button, .phoenix-button', '确定');
        if (!confirm) return false;
        confirm.click();
        return Boolean(await waitUntil(() => !getItems().includes(form), { timeout: 1000 }));
      }
      owner = owner.parentElement;
    }
    return false;
  }

  // The legacy observed template has four sections. Tenant templates may differ.
  const ZHIYE_COLLECTION_SPECS = {
    educations: {
      section: "education",
      mapping: [
        { label: "学校名称", value: "school" },
        { label: "院系名称", value: "college" },
        { label: "专业名称", value: "major" },
        { label: "统考成绩", value: "unifiedExamScore" },
        { label: "专业课程", value: "professionalCourses" },
        { label: "学历", value: "educationLevel" },
        { label: "学位", value: "academicDegree" },
        { label: "开始时间", value: "start" },
        { label: "结束时间", value: "end" }
      ]
    },
    internships: {
      section: "experience",
      mapping: [
        { label: "公司名称", value: "company" },
        { label: "职位名称", value: "position" },
        { label: "开始时间", value: "start" },
        { label: "结束时间", value: "end" },
        { label: "工作职责", value: "description" }
      ]
    },
    projects: {
      section: "projects",
      mapping: [
        { label: "项目名称", value: "name" },
        { label: "职务", value: "role" },
        { label: "开始时间", value: "start" },
        { label: "结束时间", value: "end" },
        { label: "项目描述", value: "description" }
      ]
    }
  };

  function isZhiyeStructuredPage() {
    if (document.documentElement.dataset.resumeHelperFixture === "zhiye") return true;
    return core.detectSite(location.hostname) === "zhiye"
      && Boolean(document.querySelector("div.form[id], .phoenix-input__input, .phoenix-select__input"));
  }

  function zhiyeSectionId(sectionKey) {
    const schema = ZHIYE_SECTIONS[sectionKey];
    if (!schema) return "";
    const headings = Array.from(document.querySelectorAll("div[id]")).filter((element) => {
      if (element.matches("div.form[id]")) return false;
      return schema.heading.test(compactText(element.innerText || element.textContent, 80));
    });
    return headings[0]?.id || "";
  }

  function isNjzqZhiyePage() {
    return core.detectZhiyeTemplate?.(location.hostname) === 'njzq' && location.pathname === '/form';
  }

  const SEYOND_RECORDS = {
    papers: { title:'论文/专著', labels:['发布时间','名称','所属期刊','作者顺序','年度/期次'], fields:[['name','名称'],['venue','所属期刊'],['authorOrder','作者顺序'],['publishedAt','发布时间','day']] },
    awards: { title:'获奖情况', labels:['获奖时间','获奖项','获奖级别','获奖描述'], fields:[['name','获奖项'],['type','获奖级别'],['description','获奖描述'],['start','获奖时间','day']] }
  };
  function isSeyondZhiyePage() {
    return core.detectZhiyeTemplate?.(location.hostname) === 'seyond' && location.pathname === '/form';
  }
  function seyondHeadings(key) {
    if (!isSeyondZhiyePage() || !SEYOND_RECORDS[key]) return [];
    return Array.from(document.querySelectorAll('div[id]')).filter(node => !node.matches('div.form')
      && compactText(node.textContent,100) === SEYOND_RECORDS[key].title);
  }
  function seyondRecordForms(key, supportedOnly = true) {
    if (!isSeyondZhiyePage() || !SEYOND_RECORDS[key]) return [];
    const ids = new Set(seyondHeadings(key).map(node=>node.id));
    return Array.from(document.querySelectorAll('.ux-standard-form > div.form[id]')).filter(form => (ids.has(form.id)
      || (!supportedOnly && SEYOND_RECORDS[key].labels.every(label=>Array.from(form.querySelectorAll('.form-item > .form-item__title > label')).some(node=>compactText(node.textContent,100)===label))))
      && (!supportedOnly || SEYOND_RECORDS[key].labels.every(label => {
        const labels=Array.from(form.querySelectorAll('.form-item > .form-item__title > label')).filter(node=>compactText(node.textContent,100)===label);
        return labels.length===1 && labels[0].closest('.form-item').querySelectorAll('input:not([type=hidden]),textarea,select,[contenteditable=true]').length<=1;
      })));
  }
  function seyondSection(key) {
    const headings=seyondHeadings(key);
    return headings.length===1 && seyondRecordForms(key).length ? headings[0] : null;
  }
  function isSeyondRecordControl(element) {
    const form=element?.closest?.('.ux-standard-form > div.form[id]');
    return Boolean(form && Object.keys(SEYOND_RECORDS).some(key=>seyondSection(key)&&seyondRecordForms(key).includes(form)));
  }

  // The heading and repeated Phoenix forms share a runtime ID. Styled classes
  // are unstable; use only the observed title, ID link and field fingerprint.
  function njzqFamilyForms(section) {
    if (!isNjzqZhiyePage() || !section?.id) return [];
    return Array.from(document.querySelectorAll(`.ux-standard-form > div.form[id="${CSS.escape(section.id)}"]`))
      .filter(form => ['姓名','与本人关系','工作单位','年龄','职务','联系电话'].every(label => zhiyeField(form, label)));
  }

  function njzqFamilySection() {
    const headings = njzqFamilyHeadings().filter(node => njzqFamilyForms(node).length);
    return headings.length === 1 ? headings[0] : null;
  }

  function njzqFamilyHeadings() {
    if (!isNjzqZhiyePage()) return [];
    return Array.from(document.querySelectorAll('div[id]')).filter(node => !node.matches('div.form')
      && compactText(node.textContent, 100).replace(/\s*\*$/, '') === '家庭情况');
  }

  function njzqFamilyRecordForms() {
    const ids = new Set(njzqFamilyHeadings().map(node => node.id));
    // Even an unsupported/ambiguous family editor must not receive the
    // applicant's ordinary name, phone or age from the flat-data pass.
    return Array.from(document.querySelectorAll('.ux-standard-form > div.form[id]')).filter(form => ids.has(form.id));
  }

  function zhiyeRecordElements(sectionKey) {
    const sectionId = zhiyeSectionId(sectionKey);
    if (!sectionId) return [];
    return Array.from(document.querySelectorAll(`div.form[id="${CSS.escape(sectionId)}"]`));
  }

  function zhiyeAddControl(sectionKey) {
    const schema = ZHIYE_SECTIONS[sectionKey];
    const sectionId = zhiyeSectionId(sectionKey);
    if (!schema || !sectionId) return null;
    return Array.from(document.querySelectorAll('[id$="_addButton"]')).find((element) => {
      return element.id === `${sectionId}_addButton`
        || schema.add.test(compactText(element.innerText || element.textContent, 80));
    }) || null;
  }

  async function ensureZhiyeRecords(sectionKey, count) {
    let records = zhiyeRecordElements(sectionKey);
    const add = zhiyeAddControl(sectionKey);
    while (records.length < count && add) {
      const before = records.length;
      add.click();
      for (let attempt = 0; attempt < 25; attempt += 1) {
        await wait(100);
        records = zhiyeRecordElements(sectionKey);
        if (records.length > before) break;
      }
      if (records.length === before) break;
    }
    return records;
  }

  function zhiyeField(record, labels) {
    const candidates = Array.isArray(labels) ? labels : [labels];
    const normalized = candidates.map(core.normalize);
    return Array.from(record.querySelectorAll(".form-item, [class*=form-item]")).find((field) => {
      const label = field.querySelector("label");
      return normalized.includes(core.normalize(label?.innerText || label?.textContent));
    }) || null;
  }

  function zhiyeControl(field) {
    if (!field) return null;
    return Array.from(field.querySelectorAll("input,textarea,select,[contenteditable=true]")).find((element) => {
      const type = String(element.getAttribute("type") || "").toLowerCase();
      return isVisible(element) && !["file", "checkbox", "radio", "hidden"].includes(type) && !element.disabled;
    }) || null;
  }

  function zhiyeVisibleOptions(owner = null) {
    const selectors = [
      ".phoenix-select__dropdown [role=option]", ".phoenix-select__dropdown li",
      ".phoenix-selectList__listItem",
      "[class*=phoenix-select][class*=option]", "[class*=phoenix-cascader] li",
      "[class*=phoenix-picker] [class*=item]", "[role=listbox] [role=option]"
    ];
    const options = [];
    const seen = new Set();
    for (const selector of selectors) {
      for (const option of document.querySelectorAll(selector)) {
        if (seen.has(option) || !isVisible(option)) continue;
        if (owner) {
          const layer = option.closest(".common-unmodeled-layer");
          if (layer) {
            const anchor = owner.getBoundingClientRect();
            const rect = layer.getBoundingClientRect();
            if (Math.abs(rect.left - anchor.left) > 100 || Math.min(Math.abs(rect.top - anchor.bottom), Math.abs(rect.bottom - anchor.top)) > 120) continue;
          }
        }
        const text = compactText(option.innerText || option.textContent || option.getAttribute("title"), 100);
        if (!text) continue;
        seen.add(option);
        options.push(option);
      }
    }
    return options.sort((left, right) => left.querySelectorAll("*").length - right.querySelectorAll("*").length);
  }

  function isZhiyeMonthControl(element) {
    if (isChinalifeZhiyePage() || isSanyDatePage() || globalThis.ResumeHelperBosc?.ownsUrl()) return false;
    if (!element?.matches?.(".phoenix-select__input")) return false;
    const field = element.closest(".form-item");
    const label = compactText(field?.querySelector("label")?.innerText || field?.querySelector("label")?.textContent, 40);
    return /^(开始时间|结束时间)$/.test(label);
  }

  function visibleZhiyeMonthLayer(owner = null) {
    const layers = Array.from(document.querySelectorAll(".common-unmodeled-layer")).filter((layer) => {
      if (layer.classList.contains("common-unmodeled-layer-hidden")) return false;
      const style = getComputedStyle(layer);
      return style.display !== "none" && style.visibility !== "hidden"
        && Boolean(layer.querySelector(".phoenix-calendar-month-calendar"));
    });
    if (!owner) return layers.length === 1 ? layers[0] : null;
    const ownedId = owner.getAttribute("aria-controls") || owner.querySelector("[aria-controls]")?.getAttribute("aria-controls");
    if (ownedId) return layers.find((layer) => layer.id === ownedId || layer.contains(document.getElementById(ownedId))) || null;
    if (layers.length === 1) return layers[0];
    const anchor = owner.getBoundingClientRect();
    const owned = layers.map((layer) => ({ layer, rect: layer.getBoundingClientRect() }))
      .filter(({ rect }) => Math.abs(rect.left - anchor.left) < 100 && Math.min(Math.abs(rect.top - anchor.bottom), Math.abs(rect.bottom - anchor.top)) < 120)
      .sort((a, b) => Math.abs(a.rect.top - anchor.bottom) - Math.abs(b.rect.top - anchor.bottom));
    return owned.length === 1 ? owned[0].layer : null;
  }

  function exactTextElement(root, selector, expected) {
    return Array.from(root?.querySelectorAll(selector) || []).find((element) => {
      return isVisible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true"
        && !element.closest('[aria-disabled="true"], [disabled], [class$="-disabled"]')
        && !/(?:^|[\s_-])disabled(?:$|[\s_-])/i.test(element.className || "")
        && compactText(element.innerText || element.textContent, 40) === expected;
    }) || null;
  }

  function activateZhiyeControl(element) {
    if (!element) return false;
    // Calendar buttons are ordinary React onClick targets. Focusing an anchor
    // first can blur its owning select and close the panel before the click.
    if (element.closest?.(".phoenix-calendar")) {
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 1 }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, composed: true, view: window, button: 0, buttons: 0 }));
      element.click();
      return true;
    }
    const eventInit = { bubbles: true, cancelable: true, composed: true, view: window };
    try {
      if (typeof PointerEvent === "function") {
        element.dispatchEvent(new PointerEvent("pointerdown", { ...eventInit, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1 }));
      }
      element.dispatchEvent(new MouseEvent("mousedown", { ...eventInit, button: 0, buttons: 1 }));
      element.focus?.({ preventScroll: true });
      if (typeof PointerEvent === "function") {
        element.dispatchEvent(new PointerEvent("pointerup", { ...eventInit, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: 0 }));
      }
      element.dispatchEvent(new MouseEvent("mouseup", { ...eventInit, button: 0, buttons: 0 }));
      element.click();
      return true;
    } catch (_) {
      element.click();
      return true;
    }
  }

  async function chooseZhiyeMonth(element, value) {
    controlFailures.set(element, "未打开控件");
    const match = String(value || "").match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
    if (!match || !isZhiyeMonthControl(element)) return false;
    const targetYear = Number(match[1]);
    const targetMonth = Number(match[2]);
    if (targetMonth < 1 || targetMonth > 12) return false;
    const expected = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
    const sameMonth = (actual) => {
      const parts = String(actual || "").trim().match(/^(\d{4})(?:-|\/|年)(\d{1,2})(?:月)?$/);
      return Boolean(parts && Number(parts[1]) === targetYear && Number(parts[2]) === targetMonth);
    };
    if (sameMonth(getCurrentValue(element))) return true;

    const field = element.closest(".form-item");
    const currentInput = () => field?.querySelector(".phoenix-select__input") || (element.isConnected ? element : null);
    const container = element.closest(".phoenix-select") || element;
    container.scrollIntoView({ block: "center", inline: "nearest" });
    element.focus();
    activateZhiyeControl(container);
    const ownedLayer = () => visibleZhiyeMonthLayer(container);
    let layer = await waitUntil(ownedLayer, { timeout: 900 });
    if (!layer) {
      activateZhiyeControl(currentInput());
      layer = await waitUntil(ownedLayer, { timeout: 700 });
    }
    if (!layer) return false;
    controlFailures.set(element, "未找到日期选项");

    // Prefer the visible month panel's year navigation. This avoids opening
    // nested year/decade panels and works with the original rc-calendar API.
    let panelYear = layer.querySelector(".phoenix-calendar-month-panel-year-select-content");
    for (let attempt = 0; panelYear && attempt < 200; attempt += 1) {
      const year = Number(String(panelYear.textContent || "").match(/\d{4}/)?.[0]);
      if (year === targetYear) break;
      if (!Number.isFinite(year)) return false;
      const button = layer.querySelector(year > targetYear
        ? ".phoenix-calendar-month-panel-prev-year-btn" : ".phoenix-calendar-month-panel-next-year-btn");
      if (!button || !isVisible(button)) return false;
      activateZhiyeControl(button);
      layer = await waitUntil(() => {
        const next = ownedLayer();
        const current = Number(next?.querySelector(".phoenix-calendar-month-panel-year-select-content")?.textContent);
        return next && Number.isFinite(current) && current !== year ? next : null;
      }, { timeout: 700 });
      if (!layer) return false;
      panelYear = layer.querySelector(".phoenix-calendar-month-panel-year-select-content");
    }

    const yearHeader = layer.querySelector(".phoenix-calendar-month-panel-year-select") || layer.querySelector(".phoenix-calendar-year-select");
    const displayedYear = Number(String(yearHeader?.textContent || "").match(/\d{4}/)?.[0]);
    if (!Number.isFinite(displayedYear) || displayedYear !== targetYear) {
      activateZhiyeControl(yearHeader);
      layer = await waitUntil(() => {
        const next0 = ownedLayer();
        return next0 && next0.querySelector(".phoenix-calendar-year-panel-year") ? next0 : null;
      }, { timeout: 600 });
      if (!layer) return false;

      let yearOption = null;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        yearOption = exactTextElement(layer, ".phoenix-calendar-year-panel-year", String(targetYear));
        if (yearOption) break;
        const rangeText = compactText(layer.querySelector(".phoenix-calendar-year-panel-decade-select-content")?.textContent, 40);
        const range = rangeText.match(/(\d{4})\D+(\d{4})/);
        if (!range) break;
        const start = Number(range[1]);
        const end = Number(range[2]);
        const nav = targetYear < start
          ? layer.querySelector(".phoenix-calendar-year-panel-prev-decade-btn")
          : targetYear > end
            ? layer.querySelector(".phoenix-calendar-year-panel-next-decade-btn")
            : null;
        if (!nav) break;
        const before = compactText(layer.querySelector(".phoenix-calendar-year-panel-decade-select-content")?.textContent, 40);
        activateZhiyeControl(nav);
        layer = await waitUntil(() => {
          const next0 = ownedLayer();
          if (!next0) return null;
          const after = compactText(next0.querySelector(".phoenix-calendar-year-panel-decade-select-content")?.textContent, 40);
          return after && after !== before ? next0 : null;
        }, { timeout: 500 });
        if (!layer) return false;
      }
      if (!yearOption) return false;
      activateZhiyeControl(yearOption);
      layer = await waitUntil(() => {
        const next0 = ownedLayer();
        return next0 && (next0.querySelector(".phoenix-calendar-month-panel-cell") || next0.querySelector(".phoenix-calendar-month-panel-month") || next0.querySelector(".phoenix-calendar-month-select")) ? next0 : null;
      }, { timeout: 600 });
      if (!layer) return false;
    }

    const monthText = `${targetMonth}月`;
    let monthCell = exactTextElement(layer, ".phoenix-calendar-month-panel-cell", monthText)
      || exactTextElement(layer, ".phoenix-calendar-month-panel-month", monthText);
    if (!monthCell) {
      const monthHeader = layer.querySelector(".phoenix-calendar-month-select");
      if (!monthHeader) return false;
      activateZhiyeControl(monthHeader);
      layer = await waitUntil(() => {
        const next0 = ownedLayer();
        return next0 && (exactTextElement(next0, ".phoenix-calendar-month-panel-cell", monthText) || exactTextElement(next0, ".phoenix-calendar-month-panel-month", monthText)) ? next0 : null;
      }, { timeout: 600 });
      if (!layer) return false;
      monthCell = exactTextElement(layer, ".phoenix-calendar-month-panel-cell", monthText)
        || exactTextElement(layer, ".phoenix-calendar-month-panel-month", monthText);
    }
    if (!monthCell) return false;
    activateZhiyeControl(monthCell);
    controlFailures.set(element, "写入未确认");

    // 面板收起、输入框读回目标值，才算真的选中。
    const settled = await waitUntil(() => {
      const liveInput = currentInput();
      return !ownedLayer() && liveInput && sameMonth(getCurrentValue(liveInput)) ? liveInput : null;
    }, { timeout: 720 });
    if (settled) controlFailures.delete(element);
    return Boolean(settled);
  }

  async function chooseZhiyeOption(element, values) {
    if (isSanyDateCandidate(element)) return chooseChinalifeDate(element, {value:String(values[0] || '')});
    const candidates = [...new Set(values.filter(Boolean).map(String))];
    const monthCandidate = candidates.find((value) => /^\d{4}-\d{1,2}(?:-\d{1,2})?$/.test(value));
    if (monthCandidate && isZhiyeMonthControl(element)) {
      return chooseZhiyeMonth(element, monthCandidate);
    }
    const normalizedCandidates = candidates.map(core.normalize);
    const container = element.closest("[class*=phoenix-select], [class*=phoenix-picker]") || element.parentElement;
    container.scrollIntoView({ block: "center", inline: "nearest" });
    element.focus();
    (container || element).click();
    await wait(180);
    let options = zhiyeVisibleOptions(container);
    for (let index = 0; index < candidates.length; index += 1) {
      const target = normalizedCandidates[index];
      let option = exactOption(options, candidates[index]);
      if (!option && !element.readOnly) {
        setNativeValue(element, candidates[index]);
        element.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: candidates[index] }));
        await wait(220);
        options = zhiyeVisibleOptions(container);
        option = exactOption(options, candidates[index]);
      }
      if (option) {
        option.click();
        await wait(120);
        if (candidates.some((value) => mokaValueMatches(element, value))) return true;
      }
    }
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    return false;
  }

  async function chooseZhiyeTextChoice(field, values) {
    const targets = values.filter(Boolean).map((value) => core.normalize(value));
    const selected = field.querySelector('[aria-checked="true"], [class*=checked], [class*=selected], [class*=active]');
    const selectedText = compactText(selected?.innerText || selected?.textContent, 60);
    if (selectedText && targets.includes(core.normalize(selectedText))) return true;
    const leaves = Array.from(field.querySelectorAll("span, label, [role=radio], [role=checkbox], div")).filter((element) => {
      if (!isVisible(element)) return false;
      const text = core.normalize(compactText(element.innerText || element.textContent, 60));
      return targets.includes(text) && element.children.length <= 1;
    });
    const target = leaves.sort((left, right) => left.querySelectorAll("*").length - right.querySelectorAll("*").length)[0];
    if (!target) return false;
    const before = field.innerHTML;
    (target.closest("label, [role=radio], [role=checkbox]") || target).click();
    await wait(100);
    if (field.innerHTML !== before) return true;
    return Boolean(target.closest('[aria-checked="true"], [class*=checked], [class*=selected], [class*=active]'));
  }

  async function recordZhiyeWrite(report, field, value, fieldNameValue, entryId, settings, optionValues = [], pathValues = []) {
    if (!field || value == null || String(value).trim() === "") return;
    const suggestion = { field: fieldNameValue, entryId, label: String(value), score: 100 };
    report.suggestions.push(suggestion);
    if (!report.shouldFill) return;
    const element = zhiyeControl(field);
    const existing = element ? getCurrentValue(element) : "";
    if (existing && !settings.overwriteExisting) {
      report.skipped.push({ ...suggestion, reason: "字段已有内容" });
      return;
    }
    if (!element) {
      const selected = field.querySelector('[aria-checked="true"], [class*=checked], [class*=selected], [class*=active]');
      const selectedText = compactText(selected?.innerText || selected?.textContent, 80);
      if (selectedText && !settings.overwriteExisting) {
        if (normalizedValueMatches(selectedText, String(value))) return;
        report.skipped.push({ ...suggestion, reason: "选项组已有选择" });
        return;
      }
    }
    let success = false;
    let undoRecord = null;
    if (element) {
      undoRecord = captureFieldState({ element });
      const isPhoenixChoice = Boolean(element.closest("[class*=phoenix-select], [class*=phoenix-picker]"));
      if (isSanyDateCandidate(element)) success = await chooseChinalifeDate(element, {value:String(value),pathValues,fieldType:'date'});
      else if (isPhoenixChoice) success = await chooseZhiyeOption(element, [String(value), ...optionValues]);
      else {
        setNativeValue(element, String(value));
        dispatchEditEvents(element);
        await wait(40);
        success = normalizedValueMatches(getCurrentValue(element), String(value));
      }
    } else {
      success = await chooseZhiyeTextChoice(field, [String(value), ...optionValues]);
    }
    if (!success) {
      highlight(element || field, "manual");
      report.skipped.push({ ...suggestion, reason: controlFailures.get(element) || "未找到下拉选项、存在歧义或写入未确认" });
      return;
    }
    if (undoRecord) report.transaction.push(undoRecord);
    highlight(element || field, "filled");
    report.filled.push({ ...suggestion, expectedValue: element ? getCurrentValue(element.isConnected ? element : document.querySelector(undoRecord.locator)) : String(value), kind: "field", locator: undoRecord?.locator || cssLocator(field) });
  }

  async function fillZhiyeMappedRecord(record, data, mapping, settings, report) {
    for (const item of mapping) {
      const entry = item.entryId ? profileEntry(report.profile, item.entryId) : null;
      const field = zhiyeField(record, mappedLabels(data, item, entry));
      const raw = typeof item.value === "function" ? item.value(data) : data?.[item.value];
      const sourceValue = raw ?? entry?.value;
      const value = typeof item.format === "function" ? item.format(sourceValue) : sourceValue;
      const optionValues = typeof item.optionValues === "function" ? item.optionValues(data || entry || {}) : item.optionValues;
      const mergedOptions = [...(optionValues || []), ...recordFieldOptions(data, item.value), ...(entry?.optionValues || [])];
      await recordZhiyeWrite(report, field, value, item.label, item.entryId || data?.id, settings, mergedOptions, data?.fieldPaths?.[item.value] || entry?.pathValues || []);
    }
  }

  async function fillZhiyeCurrent(record, data, settings, report) {
    const field = zhiyeField(record, ["结束时间"]);
    const checkbox = field?.querySelector('input[type="checkbox"]');
    if (!checkbox || !data?.current) return;
    const suggestion = { field: "结束时间至今", entryId: data.id, label: "至今", score: 100 };
    report.suggestions.push(suggestion);
    if (!report.shouldFill || optionSelected(checkbox)) return;
    if (!settings.overwriteExisting && getCurrentValue(zhiyeControl(field))) return;
    const undoRecord = captureChoiceState({ options: [checkbox] });
    checkbox.click();
    await wait(60);
    if (optionSelected(checkbox)) {
      report.transaction.push(undoRecord);
      report.filled.push({ ...suggestion, expectedValue: "至今", expectedValues: ["至今"], kind: "choice", locator: cssLocator(checkbox) });
    }
  }

  async function fillZhiyeCollection(sectionKey, records, mapping, settings, report) {
    if (!records?.length) return;
    let elements = zhiyeRecordElements(sectionKey);
    if (report.shouldFill) elements = await ensureZhiyeRecords(sectionKey, records.length);
    for (let index = 0; index < records.length; index += 1) {
      const data = records[index];
      const record = zhiyeRecordElements(sectionKey)[index] || elements[index];
      if (!record) {
        report.skipped.push({ field: sectionKey, entryId: data.id, label: data.name || data.school || data.company || data.id, score: 100, reason: report.shouldFill ? "未能创建对应记录" : "点击填写时将自动创建记录" });
        continue;
      }
      await fillZhiyeMappedRecord(record, data, mapping, settings, report);
      await fillZhiyeCurrent(record, data, settings, report);
    }
  }

  async function fillZhiyeSingleRecord(sectionKey, data, mapping, settings, report) {
    let elements = zhiyeRecordElements(sectionKey);
    let index = bestRecordSlot(elements, data, mapping, (record, item) => {
      const field = zhiyeField(record, mappedLabels(data, item));
      const control = zhiyeControl(field);
      return control ? getCurrentValue(control) : undefined;
    });
    if (index < 0 && report.shouldFill) {
      const before = elements.length;
      elements = await ensureZhiyeRecords(sectionKey, before + 1);
      if (elements.length > before) {
        index = elements.length - 1;
        captureAddedGroup(report, elements[index], () => zhiyeRecordElements(sectionKey));
      }
    }
    const record = elements[index];
    if (!record) {
      report.skipped.push({ field: sectionKey, entryId: data.id, label: data.name || data.school || data.company || data.id, score: 100, reason: "未找到空记录且未能新增记录" });
      return;
    }
    if (stopForRecordConflicts(report, recordConflicts(data, mapping, (item) => getCurrentValue(zhiyeControl(zhiyeField(record, mappedLabels(data, item))))), settings)) return;
    claimRecordSlot(record, data);
    await fillZhiyeMappedRecord(record, data, mapping, settings, report);
    await fillZhiyeCurrent(record, data, settings, report);
  }

  async function scanOrFillZhiye(profile, settings, shouldFill, segment = "all", resetTransaction = false) {
    const runIdentity = segment === "all" || segment === "identity";
    const runEducation = segment === "all" || segment === "education";
    const runExperience = segment === "all" || segment === "experience";
    const runProjects = segment === "all" || segment === "projects";
    if (resetTransaction) lastTransaction = [];
    const report = { profile, shouldFill, suggestions: [], filled: [], skipped: [], transaction: [] };

    const identity = zhiyeRecordElements("identity")[0];
    if (runIdentity && identity) {
      await fillZhiyeMappedRecord(identity, { id: "basic" }, [
        { label: "姓名", entryId: "basic.name" },
        { label: "手机号码", entryId: "contact.phone", format: (value) => String(value || "").replace(/^\+86\s*/, "").replace(/\s+/g, "") },
        { label: "邮箱", entryId: "contact.email" },
        { label: "性别", entryId: "basic.gender" },
        { label: "出生日期", entryId: "basic.birth_date" },
        { label: "证件号码", entryId: "basic.id_card" },
        ...(globalThis.ResumeHelperSany?.ownsUrl() ? [
          { label: "民族", entryId: "basic.ethnicity" },
          { label: "户口所在地", entryId: "location.household" }
        ].filter(mapping=>globalThis.ResumeHelperSany.ownsControl(zhiyeControl(zhiyeField(identity,mapping.label)))) : [])
      ], settings, report);
      appendManualIntentSkips(report);
    }

    const records = profile.records || {};
    if (runEducation) await fillZhiyeCollection("education", records.educations, [
      { label: "学校名称", value: "school" },
      { label: "专业名称", value: "major" },
      { label: "统考成绩", value: "unifiedExamScore" },
      { label: "专业课程", value: "professionalCourses" },
      { label: "学历", value: "educationLevel" },
      { label: "学位", value: "academicDegree" },
      { label: "开始时间", value: "start" },
      { label: "结束时间", value: "end" }
    ], settings, report);
    if (runExperience) await fillZhiyeCollection("experience", records.internships, [
      { label: "公司名称", value: "company" },
      { label: "职位名称", value: "position" },
      { label: "开始时间", value: "start" },
      { label: "结束时间", value: "end" },
      { label: "工作职责", value: "description" }
    ], settings, report);
    if (runProjects) await fillZhiyeCollection("projects", records.projects, [
      { label: "项目名称", value: "name" },
      { label: "职务", value: "role" },
      { label: "开始时间", value: "start" },
      { label: "结束时间", value: "end" },
      { label: "项目描述", value: "description" }
    ], settings, report);

    const liveFields = collectFields("zhiye");
    const plannedRecords = {
      educations: records.educations?.length || 0,
      internships: records.internships?.length || 0,
      projects: records.projects?.length || 0
    };
    if (segment === 'all' && njzqFamilySection()) {
      const schema = GENERIC_REPEAT_SCHEMAS.find(item => item.key === 'relationships');
      const owners = new WeakMap();
      for (const record of records.relationships || []) {
        const part = await fillGenericRepeatSchema(schema, profile, settings, shouldFill, 'zhiye', Infinity, record.id, owners);
        for (const key of ['suggestions','filled','skipped','transaction']) report[key].push(...part[key]);
      }
      plannedRecords.relationships = records.relationships?.length || 0;
    }
    if (segment === 'all' && isSeyondZhiyePage()) {
      const owners=new WeakMap();
      for(const key of Object.keys(SEYOND_RECORDS)) {
        const schema=GENERIC_REPEAT_SCHEMAS.find(item=>item.key===key);
        for(const record of records[key]||[]) {
          const part=await fillGenericRepeatSchema(schema,profile,settings,shouldFill,'zhiye',Infinity,record.id,owners);
          for(const field of ['suggestions','filled','skipped','transaction'])report[field].push(...part[field]);
        }
        if(seyondSection(key))plannedRecords[key]=records[key]?.length||0;
      }
    }
    if (segment === 'all' && globalThis.ResumeHelperSany?.ownsUrl()) {
      const owners=new WeakMap();
      for(const key of Object.keys(globalThis.ResumeHelperSany.records)) {
        if(!globalThis.ResumeHelperSany.section(key))continue;
        const schema=GENERIC_REPEAT_SCHEMAS.find(item=>item.key===key);
        for(const record of records[key]||[]) {
          const part=await fillGenericRepeatSchema(schema,profile,settings,shouldFill,'zhiye',Infinity,record.id,owners);
          for(const field of ['suggestions','filled','skipped','transaction'])report[field].push(...part[field]);
        }
        plannedRecords[key]=records[key]?.length||0;
      }
    }
    if (shouldFill && report.transaction.length) {
      lastTransaction = segment === "all" ? report.transaction : [...lastTransaction, ...report.transaction];
    }
    return {
      site: "zhiye", adapter: "zhiye", hostname: location.hostname, url: location.href, documentToken,
      scannedCount: liveFields.length + collectChoiceGroups("zhiye").length,
      suggestions: report.suggestions, filled: report.filled, skipped: report.skipped,
      reasonCounts: reasonCounts(report.skipped),
      structured: true, segments: ["identity", "education", "experience", "projects"], plannedRecords
    };
  }

  // ── 飞书招聘（ATSX 设计系统，*.jobs.feishu.cn） ──────────────────────────
  // 与其它适配器一致：只按 DOM 结构识别，不绑定某个租户。
  function isFeishuStructuredPage() {
    if (document.documentElement.dataset.resumeHelperFixture === "feishu") return true;
    if (core.detectSite(location.hostname) !== "feishu") return false;
    // 页面底部有「提交简历」，正文是一串 createFormSection 区块。
    const submit = Array.from(document.querySelectorAll("button"))
      .some((button) => /提交简历/.test(compactText(button.innerText || button.textContent, 20)));
    return submit && document.querySelectorAll(".createFormSection-container").length >= 3;
  }

  function feishuSections() {
    return Array.from(document.querySelectorAll(".createFormSection-container")).filter((section) => (
      Boolean(section.querySelector(".createFormSection-title"))
    ));
  }

  function feishuSection(titlePattern) {
    return feishuSections().find((section) => {
      const title = compactText(section.querySelector(".createFormSection-title")?.innerText || "", 40);
      return titlePattern.test(title);
    }) || null;
  }

  // 区块标题 → 大类。只认标题文字，不认租户。
  const FEISHU_SECTION_PATTERNS = {
    basic: /^基本信息$/,
    projects: /^项目经历$/,
    honors: /^获奖$/,
    languages: /^语言能力$/,
    selfEvaluation: /^自我评价$/,
    education: /^教育经历$/,
    career: /^工作经历$/,
    internship: /^实习经历$/
  };

  // 区块内已存在的记录块。ATSX 用 .resumeEditForm-item 承载一条重复记录。
  function feishuItems(section) {
    if (!section) return [];
    return Array.from(section.querySelectorAll(".resumeEditForm-item"));
  }

  function feishuAddButton(section) {
    if (!section) return null;
    return section.querySelector(".createFormSection-addBtn")
      || Array.from(section.querySelectorAll("[class*=addBtn]")).find((button) => /添加/.test(compactText(button.innerText || button.textContent, 12)))
      || null;
  }

  // 「添加」按下去会异步插入一条记录；观察到条数变化再继续，比固定 sleep 稳。
  async function ensureFeishuItems(section, count) {
    if (!section) return [];
    let items = feishuItems(section);
    const add = feishuAddButton(section);
    while (items.length < count && add) {
      const before = items.length;
      add.click();
      await waitUntil(() => feishuItems(section).length > before, { timeout: 2000 });
      items = feishuItems(section);
      if (items.length === before) break;
    }
    return items;
  }

  // ATSX 每个字段都是 .atsx-form-item，标签在 .atsx-form-item-label 里。
  function feishuField(record, labels) {
    const wanted = (Array.isArray(labels) ? labels : [labels]).map((label) => core.normalize(label));
    return Array.from(record.querySelectorAll(".atsx-form-item")).find((field) => {
      const label = compactText(field.querySelector(".atsx-form-item-label")?.innerText || "", 60);
      const normalized = core.normalize(label);
      return wanted.some((item) => normalized === item || normalized.startsWith(item));
    }) || null;
  }

  function feishuSelectWrapper(field) {
    return field?.querySelector(".atsx-select") || null;
  }

  // 只对飞书结构化页面、ATSX 日期容器和明确的 YYYY 占位符启用年份驱动。
  // 不放宽通用日期匹配，也不改变其他站点的年月/完整日期行为。
  function isFeishuYearControl(element) {
    return Boolean(element?.matches?.('input') && element.getAttribute('placeholder')?.trim() === 'YYYY'
      && element.closest('.atsx-date-picker') && !element.closest('.atsx-date-picker-period-month')
      && element.closest('.createFormSection-container') && isFeishuStructuredPage());
  }

  function feishuDateYear(value) {
    const match = String(value ?? '').trim().match(/^(\d{4})(?:([-\/])(\d{1,2})(?:\2(\d{1,2}))?)?$/);
    if (!match || Number(match[1]) < 1) return '';
    if (match[3]) {
      const month = Number(match[3]);
      if (month < 1 || month > 12) return '';
      if (match[4]) {
        const year = Number(match[1]), day = Number(match[4]);
        const days = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (day < 1 || day > days[month - 1]) return '';
      }
    }
    return match[1];
  }

  // 记录身份/冲突比较同样按该控件的年精度，避免重复填写时新增同一奖项。
  // 只返回比较用的值，原始记录、候选和 JSON 均不改写。
  function feishuComparableValue(field, actual, expected) {
    const input = field?.querySelector('input[placeholder="YYYY"]');
    return isFeishuYearControl(input) && /^\d{4}$/.test(String(actual || '').trim())
      && String(actual).trim() === feishuDateYear(expected) ? expected : actual;
  }

  async function chooseFeishuYear(input, value) {
    controlFailures.delete(input);
    unconfirmedScalarWrites.delete(input);
    const before = getCurrentValue(input);
    const fail = (reason) => {
      controlFailures.set(input, reason);
      if (getCurrentValue(input) !== before) unconfirmedScalarWrites.add(input);
      return false;
    };
    const expected = feishuDateYear(value);
    if (!isFeishuYearControl(input) || !expected) return fail('年份主值格式无效');
    if (!isVisible(input) || input.disabled || input.getAttribute('aria-disabled') === 'true') return fail('年份控件不可用');
    if (getCurrentValue(input) === expected) return true;
    const visiblePanels = () => Array.from(document.querySelectorAll('.atsx-date-picker-panel')).filter(isVisible);
    const previous = new Set(visiblePanels());
    const owner = input.getAttribute('data-cy');
    const ownedPanel = () => {
      const panels = visiblePanels().filter(panel => owner
        ? panel.getAttribute('data-cy') === `${owner}Dropdown`
        : !previous.has(panel));
      return panels.length === 1 && panels[0].querySelector('.atsx-date-picker-panel-body-year') ? panels[0] : null;
    };
    const usable = element => element && isVisible(element) && !element.disabled
      && !element.closest('[aria-disabled="true"], [disabled], [class*="disabled"]');
    input.click();
    let panel = await waitUntil(ownedPanel, { timeout: 1200 });
    if (!panel) return fail('未打开属于当前字段的年份控件');
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const cells = Array.from(panel.querySelectorAll('.atsx-date-picker-panel-body-year .atsx-date-picker-panel-body-cell-content'));
      const matches = cells.filter(cell => compactText(cell.textContent, 10) === expected);
      if (matches.length) {
        if (matches.length !== 1 || !usable(matches[0])) return fail('年份选项不可用或存在歧义');
        matches[0].click();
        const confirmed = await waitUntil(() => getCurrentValue(input) === expected && !ownedPanel(), { timeout: 1200 });
        return confirmed ? true : fail('年份写入未确认');
      }
      const rangeText = compactText(panel.querySelector('.atsx-date-picker-panel-header-title')?.textContent, 30);
      const range = rangeText.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
      if (!range) return fail('未识别年份面板范围');
      const direction = Number(expected) < Number(range[1]) ? 'prev' : Number(expected) > Number(range[2]) ? 'next' : null;
      const buttons = direction ? Array.from(panel.querySelectorAll(`.atsx-date-picker-panel-header [data-cy="${direction}"]`)).filter(usable) : [];
      if (buttons.length !== 1) return fail('未找到可用年份选项或翻页按钮');
      buttons[0].click();
      panel = await waitUntil(() => {
        const next = ownedPanel();
        return next && compactText(next.querySelector('.atsx-date-picker-panel-header-title')?.textContent, 30) !== rangeText ? next : null;
      }, { timeout: 1000 });
      if (!panel) return fail('年份面板翻页未确认');
    }
    return fail('年份不在可遍历范围内');
  }

  // 控件形态：ATSX 下拉 / 输入框 / 年份 / 月份区间。
  function feishuControls(field) {
    if (!field) return {};
    return {
      field,
      select: feishuSelectWrapper(field),
      hidden: field.querySelector("input.atsx-date-picker-period-hidden-input"),
      input: Array.from(field.querySelectorAll("input:not(.atsx-date-picker-period-hidden-input), textarea"))
        .find((element) => isVisible(element) && !["file", "checkbox", "radio", "hidden"].includes(String(element.getAttribute("type") || "").toLowerCase())) || null,
      period: field.querySelector(".atsx-date-picker-period-month") || null
    };
  }

  function feishuVisibleOptions() {
    const menus = Array.from(document.querySelectorAll(".atsx-select-dropdown, .atsx-select-dropdown-menu"))
      .filter((menu) => isVisible(menu) && !menu.classList.contains("atsx-select-dropdown-hidden"));
    const options = [];
    const seen = new Set();
    for (const menu of menus) {
      for (const item of menu.querySelectorAll(".atsx-select-dropdown-menu-item")) {
        const text = compactText(item.innerText || item.textContent, 60);
        if (!text || seen.has(item)) continue;
        seen.add(item);
        options.push(item);
      }
    }
    return options;
  }

  // 面板固定在 body 上，且年月是两个并排列表：年份一个 list、月份一个 list。
  function feishuMonthPanel() {
    return Array.from(document.querySelectorAll(".atsx-date-picker-period-month-panel"))
      .find((panel) => isVisible(panel)) || null;
  }

  function feishuPanelEntries(panel, index) {
    const list = panel?.querySelectorAll(".atsx-date-picker-period-month-panel-list")[index];
    if (!list) return [];
    return Array.from(list.querySelectorAll(".atsx-date-picker-period-month-panel-list-item"));
  }

  function feishuPanelPick(panel, index, text) {
    const wanted = String(text);
    const entries = feishuPanelEntries(panel, index);
    return entries.find((item) => compactText(item.innerText || item.textContent, 10) === wanted)
      || entries.find((item) => item.getAttribute("data-cy") === wanted)
      || null;
  }

  // 年月区间：一个 form-item 里可能有多个 label（开始 / 结束），
  // 用 periodIndex 明确指的是哪一个，不能靠 closest 推断。
  async function chooseFeishuMonth(element, value, periodIndex = 0) {
    const match = String(value || "").match(/^(\d{4})-(\d{1,2})/);
    if (!match) return false;
    const year = Number(match[1]);
    const month = match[2].padStart(2, "0");
    const expected = `${year}-${month}`;

    const period = element.closest(".atsx-date-picker-period-month") || element.closest(".atsx-date-picker") || element;
    const labels = Array.from(period.querySelectorAll(".atsx-date-picker-period-month-label"));
    if (!labels.length) return false;
    const target = labels[periodIndex] || labels[0];

    const labelValue = () => {
      const yearText = compactText(target.querySelector(".atsx-date-picker-period-month-label-year")?.innerText
        || target.querySelector(".atsx-date-picker-period-month-label-year")?.textContent, 6);
      const monthText = compactText(target.querySelector(".atsx-date-picker-period-month-label-month")?.innerText
        || target.querySelector(".atsx-date-picker-period-month-label-month")?.textContent, 4);
      if (!/^\d{4}$/.test(yearText) || !/^\d{1,2}$/.test(monthText)) return "";
      return `${yearText}-${monthText.padStart(2, "0")}`;
    };
    if (normalizedValueMatches(labelValue(), expected)) return true;

    target.click();
    let panel = await waitUntil(() => feishuMonthPanel(), { timeout: 1200 });
    if (!panel) return false;

    const yearCell = feishuPanelPick(panel, 0, String(year));
    if (yearCell) {
      yearCell.click();
      panel = (await waitUntil(() => {
        const next = feishuMonthPanel();
        return next && feishuPanelPick(next, 1, month) ? next : null;
      }, { timeout: 1000 })) || feishuMonthPanel();
    }
    const monthCell = panel ? feishuPanelPick(panel, 1, month) : null;
    if (monthCell) monthCell.click();

    return Boolean(await waitUntil(() => (normalizedValueMatches(labelValue(), expected) ? true : null), { timeout: 1200 }));
  }

  async function recordFeishuWrite(report, field, value, fieldNameValue, entryId, settings, optionValues = [], periodIndex = 0) {
    if (!field || value == null || String(value).trim() === "") return;
    const suggestion = { field: fieldNameValue, entryId, label: String(value), score: 100 };
    report.suggestions.push(suggestion);
    if (!report.shouldFill) return;
    const controls = feishuControls(field);
    const element = controls.input || controls.hidden || controls.select;

    const existing = controls.period
      ? feishuPeriodValues(controls.period)[periodIndex] || ""
      : controls.select
        ? getCurrentValue(controls.select)
        : getCurrentValue(controls.input || controls.hidden);
    const hasFillablePlaceholder = !/YYYY|\bMM\b|^(请选择|请输入)$/.test(existing);
    if (existing && hasFillablePlaceholder && !settings.overwriteExisting) {
      report.skipped.push({ ...suggestion, reason: "字段已有内容" });
      return;
    }

    let success = false;
    let undoRecord = null;
    if (controls.period) {
      if (!report.transaction.some((record) => record.kind === "feishuPeriod" && record.element === controls.period)) {
        undoRecord = { kind: "feishuPeriod", element: controls.period, values: feishuPeriodValues(controls.period) };
      }
      success = await chooseFeishuMonth(controls.period, String(value), periodIndex);
    } else if (isFeishuYearControl(controls.input)) {
      undoRecord = captureFieldState({ element: controls.input });
      success = await chooseFeishuYear(controls.input, value);
    } else if (controls.select) {
      undoRecord = captureFieldState({ element: controls.select });
      success = await chooseFeishuOption(controls.select, [String(value), ...optionValues]);
    } else if (element) {
      undoRecord = captureFieldState({ element });
      setNativeValue(element, String(value));
      dispatchEditEvents(element);
      await wait(40);
      success = normalizedValueMatches(getCurrentValue(element), String(value));
    }

    if (!success) {
      if (isFeishuYearControl(controls.input)) retainFailedScalarWrite(report.transaction, undoRecord);
      highlight(controls.select || element || field, "manual");
      report.skipped.push({ ...suggestion, reason: controlFailures.get(element) || "ATSX 控件未确认写入，请手动处理" });
      return;
    }
    if (undoRecord) report.transaction.push(undoRecord);
    highlight(controls.select || element || field, "filled");
    const verifiedElement = controls.period ? controls.period.querySelectorAll(".atsx-date-picker-period-month-label")[periodIndex] : controls.select || element || field;
    const expectedValue = controls.period ? feishuPeriodValues(controls.period)[periodIndex] : getCurrentValue(verifiedElement);
    report.filled.push({ ...suggestion, expectedValue, kind: "field", locator: cssLocator(verifiedElement) });
  }

  async function chooseFeishuOption(select, values) {
    const candidates = [...new Set(values.filter(Boolean).map(String))];
    const optionText = (item) => compactText(item.innerText || item.textContent, 60);
    select.click();
    let options = (await waitUntil(() => {
      const found = feishuVisibleOptions();
      return found.length ? found : null;
    }, { timeout: 1200 })) || [];
    for (const value of candidates) {
      const option = exactOption(options, value, optionText);
      if (!option) continue;
      option.click();
      await wait(120);
      if (candidates.some((candidate) => mokaValueMatches(select, candidate))) return true;
      select.click();
      options = (await waitUntil(() => {
        const found = feishuVisibleOptions();
        return found.length ? found : null;
      }, { timeout: 800 })) || [];
    }
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    return false;
  }

  function feishuMappedField(record, item, data = null) {
    const candidates = Array.from(record.querySelectorAll(".atsx-form-item")).filter((candidate) => {
      const label = compactText(candidate.querySelector(".atsx-form-item-label")?.innerText || "", 60);
      const normalized = core.normalize(label);
      const wanted = mappedLabels(data, item).map(core.normalize);
      return wanted.some((want) => normalized === want || normalized.startsWith(want));
    });
    return candidates[item.index || 0] || candidates[0] || null;
  }

  async function fillFeishuCollection(pattern, records, mapping, settings, report, limit = Infinity) {
    const section = feishuSection(pattern);
    if (!section) return;
    const dataRecords = (records || []).slice(0, limit);
    if (!dataRecords.length) return;
    const items = report.shouldFill ? await ensureFeishuItems(section, dataRecords.length) : feishuItems(section);
    for (let index = 0; index < dataRecords.length; index += 1) {
      const data = dataRecords[index];
      const record = feishuItems(section)[index] || items[index];
      if (!record) {
        report.skipped.push({ field: pattern.source, entryId: data.id, label: data.name || data.school || data.company || data.id, score: 100, reason: report.shouldFill ? "未能创建对应记录" : "点击填写时将自动创建记录" });
        continue;
      }
      for (const item of mapping) {
        const raw = typeof item.value === "function" ? item.value(data) : data[item.value];
        const value = typeof item.format === "function" ? item.format(raw) : raw;
        // 起止时间在一次映射里出现两次，用 index 区分开始 / 结束两个控件。
        const field = feishuMappedField(record, item, data);
        const optionValues = typeof item.optionValues === "function" ? item.optionValues(data) : item.optionValues;
        await recordFeishuWrite(report, field, value, item.label, data.id, settings, [...(optionValues || []), ...recordFieldOptions(data, item.value)], item.periodIndex || 0);
      }
    }
  }

  async function fillFeishuSingleRecord(pattern, data, mapping, settings, report) {
    const section = feishuSection(pattern);
    if (!section) throw new Error("当前页面未检测到对应的飞书记录区块");
    let items = feishuItems(section);
    let index = bestRecordSlot(items, data, mapping, (record, item) => {
      const field = feishuMappedField(record, item, data);
      if (!field) return undefined;
      const period = field.querySelectorAll(".atsx-date-picker-period-month-label")[item.periodIndex || 0];
      if (period) {
        const year = compactText(period.querySelector(".atsx-date-picker-period-month-label-year")?.textContent, 6);
        const month = compactText(period.querySelector(".atsx-date-picker-period-month-label-month")?.textContent, 4);
        return /^\d{4}$/.test(year) && /^\d{1,2}$/.test(month) ? `${year}-${month.padStart(2, "0")}` : "";
      }
      const selected = field.querySelector(".atsx-select-selection-selected-value");
      if (selected) return compactText(selected.innerText || selected.textContent || "", 80);
      const controls = Array.from(field.querySelectorAll("input,textarea,select,[contenteditable=true]"));
      if (controls.length) return feishuComparableValue(field, controls.map((control) => getCurrentValue(control)).filter(Boolean).join("｜"), data[item.value]);
      const label = compactText(field.querySelector(".atsx-form-item-label")?.innerText || "", 60);
      return compactText(field.innerText || "", 120).replace(label, "").trim();
    });
    if (index < 0 && report.shouldFill) {
      const before = items.length;
      items = await ensureFeishuItems(section, before + 1);
      if (items.length > before) {
        index = items.length - 1;
        captureAddedGroup(report, items[index], () => feishuItems(section));
      }
    }
    const record = items[index];
    if (!record) {
      report.skipped.push({ field: pattern.source, entryId: data.id, label: data.name || data.school || data.company || data.language || data.id, score: 100, reason: "未找到空记录且未能新增记录" });
      return;
    }
    const conflicts = recordConflicts(data, mapping, (item) => {
      const field = feishuMappedField(record, item, data);
      if (!field) return undefined;
      const controls = feishuControls(field);
      if (controls.period) {
        const target = controls.period.querySelectorAll(".atsx-date-picker-period-month-label")[item.periodIndex || 0];
        const year = compactText(target?.querySelector(".atsx-date-picker-period-month-label-year")?.textContent, 6);
        const month = compactText(target?.querySelector(".atsx-date-picker-period-month-label-month")?.textContent, 4);
        return /^\d{4}$/.test(year) && /^\d{1,2}$/.test(month) ? `${year}-${month.padStart(2, "0")}` : "";
      }
      const actual = controls.select ? compactText(controls.select.querySelector(".atsx-select-selection-selected-value")?.textContent, 100) : getCurrentValue(controls.input || controls.hidden);
      return feishuComparableValue(field, actual, data[item.value]);
    });
    if (stopForRecordConflicts(report, conflicts, settings)) return;
    claimRecordSlot(record, data);
    for (const item of mapping) {
      const raw = typeof item.value === "function" ? item.value(data) : data[item.value];
      const value = typeof item.format === "function" ? item.format(raw) : raw;
      const field = feishuMappedField(record, item, data);
      const optionValues = typeof item.optionValues === "function" ? item.optionValues(data) : item.optionValues;
      await recordFeishuWrite(report, field, value, item.label, data.id, settings, [...(optionValues || []), ...recordFieldOptions(data, item.value)], item.periodIndex || 0);
    }
  }

  // 工作经历与实习经历共用一套字段（不在同一页面同时出现）。
  const FEISHU_CAREER_MAPPING = [
    { label: "公司名称", value: "company" },
    { label: "职位名称", value: "position" },
    { label: "起止时间", value: "start", periodIndex: 0 },
    { label: "起止时间", value: "end", periodIndex: 1 },
    { label: "描述", value: "description" }
  ];

  const FEISHU_COLLECTION_SPECS = {
    educations: {
      pattern: FEISHU_SECTION_PATTERNS.education,
      mapping: [
        { label: "学校名称", value: "school" },
        { label: "院系名称", value: "college" },
        { label: "学历", value: "educationLevel" },
        { label: "学位", value: "academicDegree" },
        { label: "专业", value: "major" },
        { label: "统考成绩", value: "unifiedExamScore" },
        { label: "专业课程", value: "professionalCourses" },
        // 起止时间在同一个 form-item 里，用 periodIndex 指定开始 / 结束两个 label。
        { label: "起止时间", value: "start", periodIndex: 0 },
        { label: "起止时间", value: "end", periodIndex: 1 }
      ]
    },
    internships: {
      pattern: FEISHU_SECTION_PATTERNS.internship,
      mapping: FEISHU_CAREER_MAPPING
    },
    projects: {
      pattern: FEISHU_SECTION_PATTERNS.projects,
      mapping: [
        { label: "项目名称", value: "name" },
        { label: "项目角色", value: "role" },
        { label: "项目链接", value: "link" },
        { label: "起止时间", value: "start", periodIndex: 0 },
        { label: "起止时间", value: "end", periodIndex: 1 },
        { label: "描述", value: "description" }
      ]
    },
    awards: {
      pattern: FEISHU_SECTION_PATTERNS.honors,
      mapping: [
        { label: "获奖名称", value: "name" },
        { label: "获奖时间", value: "start" },
        { label: "描述", value: "description" }
      ]
    },
    foreignLanguages: {
      pattern: FEISHU_SECTION_PATTERNS.languages,
      mapping: [
        { label: "语言", value: "language" },
        { label: "精通程度", value: "proficiency" },
        { label: "听说能力", value: "listeningSpeaking" },
        { label: "读写能力", value: "readingWriting" }
      ]
    }
  };

  const FEISHU_BASIC_MAP = [
    { label: "姓名", entryId: "basic.name" },
    { label: "手机号码", entryId: "contact.phone", format: (value) => String(value || "").replace(/^\+86\s*/, "").replace(/\s+/g, "") },
    { label: "邮箱", entryId: "contact.email" },
    { label: "性别", entryId: "basic.gender" },
    { label: "家乡", entryId: "location.native_place" },
    { label: "出生日期", entryId: "basic.birth_date" },
    { label: "身高（cm）", entryId: "basic.height" },
    { label: "体重（KG）", entryId: "basic.weight" },
    { label: "政治面貌", entryId: "basic.political_status" },
    { label: "民族", entryId: "basic.ethnicity" },
    { label: "现居住地址", entryId: "contact.address" },
    { label: "期望薪资", entryId: "career.expected_salary" },
    { label: "健康状况", entryId: "basic.health_status" }
  ];

  async function scanOrFillFeishu(profile, settings, shouldFill, segment = "all", resetTransaction = false) {
    const runIdentity = segment === "all" || segment === "identity" || segment === "basics";
    const runEducation = segment === "all" || segment === "education" || segment === "basics";
    const runExperience = segment === "all" || segment === "experience" || segment === "basics";
    const runProjects = segment === "all" || segment === "projects";
    const runAchievements = segment === "all" || segment === "achievements";
    const runSelfEvaluation = segment === "all" || segment === "achievements" || segment === "self-evaluation";
    if (resetTransaction) lastTransaction = [];
    const report = { profile, shouldFill, suggestions: [], filled: [], skipped: [], transaction: [] };
    const records = profile.records || {};

    if (runIdentity) {
      const basicSection = feishuSection(FEISHU_SECTION_PATTERNS.basic);
      const basicItem = basicSection ? (feishuItems(basicSection)[0] || basicSection) : null;
      if (basicItem) {
        for (const item of FEISHU_BASIC_MAP) {
          const field = feishuField(basicItem, item.label);
          const entry = profileEntry(profile, item.entryId);
          if (!field || !entry) continue;
          const value = typeof item.format === "function" ? item.format(entry.value) : entry.value;
          await recordFeishuWrite(report, field, value, item.label, item.entryId, settings, entry.optionValues || []);
        }
      }
    }

    if (runEducation) await fillFeishuCollection(FEISHU_SECTION_PATTERNS.education, records.educations, FEISHU_COLLECTION_SPECS.educations.mapping, settings, report);
    // 工作经历与实习经历共用同一套字段映射，只换区块标题。
    if (runExperience) {
      await fillFeishuCollection(FEISHU_SECTION_PATTERNS.career, records.internships, FEISHU_CAREER_MAPPING, settings, report);
      await fillFeishuCollection(FEISHU_SECTION_PATTERNS.internship, records.internships, FEISHU_CAREER_MAPPING, settings, report);
    }
    if (runProjects) await fillFeishuCollection(FEISHU_SECTION_PATTERNS.projects, records.projects, FEISHU_COLLECTION_SPECS.projects.mapping, settings, report);
    if (runAchievements) {
      await fillFeishuCollection(FEISHU_SECTION_PATTERNS.honors, records.awards, FEISHU_COLLECTION_SPECS.awards.mapping, settings, report);
      await fillFeishuCollection(FEISHU_SECTION_PATTERNS.languages, records.foreignLanguages, FEISHU_COLLECTION_SPECS.foreignLanguages.mapping, settings, report);
    }
    if (runSelfEvaluation) {
      const section = feishuSection(FEISHU_SECTION_PATTERNS.selfEvaluation);
      const item = section ? (feishuItems(section)[0] || section) : null;
      const entry = profileEntry(profile, "profile.self_evaluation");
      if (item && entry) {
        await recordFeishuWrite(report, feishuField(item, "自我评价"), entry.value, "自我评价", "profile.self_evaluation", settings, entry.optionValues || []);
      }
    }
    if (runIdentity) appendManualIntentSkips(report);

    if (shouldFill && report.transaction.length) {
      lastTransaction = segment === "all" ? report.transaction : [...lastTransaction, ...report.transaction];
    }
    const liveFields = collectFields("feishu");
    return {
      site: "feishu", adapter: "feishu", hostname: location.hostname, url: location.href, documentToken,
      scannedCount: liveFields.length + collectChoiceGroups("feishu").length,
      suggestions: report.suggestions, filled: report.filled, skipped: report.skipped,
      reasonCounts: reasonCounts(report.skipped),
      structured: true,
      segments: ["identity", "education", "experience", "projects", "achievements", "self-evaluation"],
      plannedRecords: {
        educations: records.educations?.length || 0, internships: records.internships?.length || 0,
        projects: records.projects?.length || 0, awards: records.awards?.length || 0,
        foreignLanguages: records.foreignLanguages?.length || 0
      }
    };
  }

  const GENERIC_REPEAT_SCHEMAS = globalThis.ResumeHelperCategories.repeatSchemas;

  const DEFAULT_GENERIC_REPEAT_ADD = /^(添加|新增|添加一条|add|add another|add project|add experience)$/i;

  function genericRepeatAddButton(section, schema) {
    const pattern = schema.add || DEFAULT_GENERIC_REPEAT_ADD;
    return Array.from(section.querySelectorAll("button, [role=button]")).find((button) => (
      pattern.test(compactText(button.innerText || button.textContent, 60))
    ));
  }

  function genericRepeatHeading(container) {
    if (isCmbResumePage() && container.matches?.('.item-box')) {
      return compactText(Array.from(container.querySelector(':scope > .item-name')?.childNodes || [])
        .filter(node => node.nodeType === 3).map(node => node.textContent).join(''), 100);
    }
    if (isZhaopinPage() && container.matches?.(".apply-module")) return compactText(container.querySelector("h6.form-content--title")?.textContent, 100);
    if (container.matches?.('.applyFormModuleWrapper-windows')) {
      return compactText(container.querySelector('.applyFormModuleWrapper-left p')?.textContent, 100);
    }
    const heading = container.querySelector(":scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > legend, :scope > [class*=title], :scope > [data-section-title]");
    return compactText(heading?.innerText || heading?.textContent, 100);
  }

  function findGenericRepeatSection(schema) {
    if (globalThis.ResumeHelperSany?.ownsUrl() && globalThis.ResumeHelperSany.records[schema.key]) return globalThis.ResumeHelperSany.section(schema.key);
    if (globalThis.ResumeHelperBosc?.ownsUrl()) return globalThis.ResumeHelperBosc.section(schema.key);
    if (isSeyondZhiyePage() && SEYOND_RECORDS[schema.key]) return seyondSection(schema.key);
    if (isChinalifeZhiyePage()) return chinalifeSection(schema.key);
    if (isNjzqZhiyePage() && schema.key === 'relationships') return njzqFamilySection();
    if (isCmbResumePage() && ['awards', 'papers'].includes(schema.key)) {
      return Array.from(document.querySelectorAll('form#resume .item-box'))
        .find(container => genericRepeatHeading(container) === '个人荣誉') || null;
    }
    if (isZhaopinPage()) {
      const module = Array.from(document.querySelectorAll(".apply-module")).find(container => schema.heading.test(genericRepeatHeading(container))
        && Array.from(container.querySelectorAll(".apply-module__form .apply-form")).some(isVisible));
      if (module) return module;
    }
    const candidates = document.querySelectorAll(".applyFormModuleWrapper-windows, [data-resume-repeat], section, fieldset, [class*=section], [class*=experience], [class*=projects], [class*=award], [class*=honor], [class*=skill]");
    return Array.from(candidates).find((container) => {
      if (!schema.heading.test(genericRepeatHeading(container))) return false;
      return Boolean(genericRepeatAddButton(container, schema));
    }) || null;
  }

  function genericRepeatItems(section, schema) {
    if (!section) return [];
    if (globalThis.ResumeHelperSany?.records[schema.key] && globalThis.ResumeHelperSany.ownsUrl()) return globalThis.ResumeHelperSany.recordForms(schema.key).filter(isVisible);
    if (globalThis.ResumeHelperBosc?.ownsUrl()) return globalThis.ResumeHelperBosc.recordForms(schema.key).filter(isVisible);
    if (isSeyondZhiyePage() && SEYOND_RECORDS[schema.key]) return seyondRecordForms(schema.key).filter(isVisible);
    if (isChinalifeZhiyePage()) return Array.from(document.querySelectorAll(`div.form[id="${CSS.escape(section.id)}"]`)).filter(isVisible);
    if (isNjzqZhiyePage() && schema.key === 'relationships') return njzqFamilyForms(section).filter(isVisible);
    if (isCmbResumePage() && ['awards', 'papers'].includes(schema.key) && section.matches('.item-box')) {
      const expected = schema.key === 'awards' ? '奖项' : '专著或文献';
      const nameLabel = schema.key === 'awards' ? '奖项名称' : '专著或文献名称';
      return Array.from(section.querySelectorAll('input[id^="resume_awardList_"][id$="_awardName"]')).filter(isVisible).flatMap(input => {
        if (compactText(input.closest('.ant-form-item')?.querySelector('label')?.textContent, 60) !== nameLabel) return [];
        const kind = document.getElementById(input.id.replace(/_awardName$/, '_awardType'));
        if (!kind || getCurrentValue(kind) !== expected) return [];
        let item = input.closest('.ant-form-item');
        let found = null;
        while (item && item !== section) {
          if (item.contains(kind) && item.querySelectorAll('input[id$="_awardName"]').length === 1
            && !item.querySelector('.add-item, .btn-add')) found = item;
          item = item.parentElement;
        }
        return found ? [found] : [];
      });
    }
    if (isZhaopinPage() && section.matches(".apply-module")) return Array.from(section.querySelectorAll(".apply-module__form .apply-form")).filter(isVisible);
    const selector = [
      `[data-repeat-item="${schema.key}"]`, "[data-repeat-item]", ".repeat-item",
      `[class*=${schema.key.slice(0, -1)}-item]`, "[class*=experience-item]", "[class*=record-item]", '[class^="apply-form-array-card__"]'
    ].join(",");
    return Array.from(section.querySelectorAll(selector)).filter((item) => {
      const parentItem = item.parentElement?.closest?.(selector);
      return !parentItem || !section.contains(parentItem);
    });
  }

  async function ensureGenericRepeatItems(section, schema, count) {
    let items = genericRepeatItems(section, schema);
    if (globalThis.ResumeHelperSany?.records[schema.key] && globalThis.ResumeHelperSany.ownsUrl()) return items;
    if (globalThis.ResumeHelperBosc?.ownsUrl()) return items;
    if (isSeyondZhiyePage() && SEYOND_RECORDS[schema.key]) return items;
    // Fill existing editors only. Do not click an unverified add/save flow.
    if (isNjzqZhiyePage() && schema.key === 'relationships') return items;
    if (isChinalifeZhiyePage()) {
      const add = document.getElementById(`${section.id}_addButton`);
      if (!add || !isVisible(add) || compactText(add.textContent, 100).replace(/\s*\*$/, '') !== `添加${compactText(section.textContent, 100).replace(/\s*\*$/, '')}`) return items;
      while (items.length < count) {
        const before = items.length;
        add.click();
        if (!await waitUntil(() => genericRepeatItems(section, schema).length > before, { timeout: 1200 })) break;
        items = genericRepeatItems(section, schema);
      }
      return items;
    }
    // This mixed collection needs an explicit website type. Do not add or
    // convert publication/patent rows merely to create an award slot.
    if (isCmbResumePage() && ['awards', 'papers'].includes(schema.key)) return items;
    if (isZhaopinPage() && section.matches(".apply-module")) return items;
    const add = genericRepeatAddButton(section, schema);
    while (items.length < count && add) {
      const before = items.length;
      add.click();
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await wait(100);
        items = genericRepeatItems(section, schema);
        if (items.length > before) break;
      }
      if (items.length === before) break;
    }
    return items;
  }

  // 与设置页同一个阈值；fill.js 是经典脚本，不能导入 storage.js，缺省值与 DEFAULT_SETTINGS 保持一致。
  function matchThreshold(settings) {
    const value = Number(settings?.confidenceThreshold);
    return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 78;
  }

  function genericRecordField(record, aliases, site, threshold, used = new Set()) {
    const sanyRecord = globalThis.ResumeHelperSany?.ownsRecord(record);
    const ownedPhoenixRecord = isChinalifeZhiyePage() || isSeyondRecordControl(record) || globalThis.ResumeHelperBosc?.ownsRecord(record) || sanyRecord || (isNjzqZhiyePage() && njzqFamilyForms(njzqFamilySection()).includes(record));
    const candidates = Array.from(record.querySelectorAll(FIELD_SELECTOR + (isChinalifeZhiyePage() ? ', .phoenix-radio-group' : '')))
      .filter((element) => !used.has(element) && isSupportedFieldElement(element) && isVisible(element))
      // The first alias is the observed Sany contract label. siteProfile also
      // supplies generic aliases such as 竞赛名称; they must not take its place.
      .filter(element => !sanyRecord || globalThis.ResumeHelperSany.label(element) === aliases[0])
      .filter(element => !(isCmbResumePage() && /^resume_awardList_\d+_awardType$/.test(element.id || '')))
      .map((element) => {
        // This tenant's label belongs to one form-item even when its Phoenix
        // input is deeply wrapped. Surrounding prompts must not lower an exact
        // date-label match or borrow another record's field.
        const label = ownedPhoenixRecord && element.closest('div.form') === record
          ? compactText(element.closest('.form-item')?.querySelector('label')?.textContent, 120) : '';
        const context = label || fieldContext(element, site);
        const score = Math.max(0, ...aliases.map((alias) => core.scoreAlias(context, alias)));
        return { element, context, name: label || fieldName(element, context), type: String(element.getAttribute("type") || "").toLowerCase() || element.tagName.toLowerCase(), score };
      })
      .sort((left, right) => right.score - left.score);
    // sort 是稳定排序：同分时取块内位置更靠前的框，与资料顺序填写的约定一致。
    if (!candidates[0] || candidates[0].score < threshold) return null;
    return candidates[0];
  }

  function genericStructuredValue(data, key, field) {
    const value = key === "awardDate"
      ? (data?.awardDate || (/^\d{4}-\d{2}/.test(data?.start || "") ? data.start : data?.end) || data?.start)
      : data?.[key];
    if (value == null || value === '' || (!isChinalifeZhiyePage() && !value)) return "";
    if (key === "start" || key === "end" || key === "awardDate") {
      if (field?.type === "month") return controlDateParts(value)?.ym || String(value);
    }
    return String(value);
  }

  function genericRecordFieldMap(record, data, schema, site, threshold) {
    const used = new Set();
    const fields = new Map();
    // Reserve exact labels first, so 学历 cannot take a 学历类型 control before
    // the field whose alias is precisely 学历类型. Then retain template order
    // for partial matches: a merged 学历/学位 box still belongs only to level.
    for (const minimum of [100, threshold]) {
      for (const mapping of schema.fields) {
        if (fields.has(mapping.key)) continue;
        const field = genericRecordField(record, mappedLabels(data, mapping), site, minimum, used);
        if (!field) continue;
        used.add(field.element);
        fields.set(mapping.key, field);
      }
    }
    return fields;
  }

  // 单个重复大类填一组；批量填入（fillCollection）与整页扫描共用这一段。
  async function fillGenericRepeatSchema(schema, profile, settings, shouldFill, site, limit = Infinity, recordId = "", scanOwners = null) {
    const sanySpec = globalThis.ResumeHelperSany?.ownsUrl() && globalThis.ResumeHelperSany.records[schema.key];
    if (sanySpec) schema = {...schema,fields:sanySpec.fields.map(([key,label,datePrecision])=>({key,aliases:[label],datePrecision}))};
    const boscSpec = globalThis.ResumeHelperBosc?.ownsPage() && globalThis.ResumeHelperBosc.records[schema.key];
    if (boscSpec) schema = {...schema,fields:boscSpec.fields.map(([key,label,datePrecision])=>({key,aliases:[label],datePrecision}))};
    if (isSeyondZhiyePage() && SEYOND_RECORDS[schema.key]) schema = { ...schema, fields:SEYOND_RECORDS[schema.key].fields.map(([key,label,datePrecision])=>({key,aliases:[label],datePrecision})) };
    if (isChinalifeZhiyePage()) schema = chinalifeSchema(schema, recordId ? profile.records?.[schema.key]?.find(row => row.id === recordId) : null);
    if (isCmbResumePage() && schema.key === 'awards') schema = { ...schema, fields: [
      { key: 'name', aliases: ['奖项名称'] }, { key: 'type', aliases: ['获奖级别'] }, { key: 'start', aliases: ['获奖时间'], datePrecision: 'month' }
    ] };
    if (isCmbResumePage() && schema.key === 'papers') schema = { ...schema, fields: [
      { key: 'name', aliases: ['专著或文献名称'] }, { key: 'venue', aliases: ['出版书号或期刊名称'] }, { key: 'description', aliases: ['详细说明'] }
    ] };
    const result = { suggestions: [], filled: [], skipped: [], transaction: [], plannedRecords: {} };
    const allRecords = schema.records ? schema.records(profile) : (profile.records?.[schema.key] || []);
    const dataRecords = recordId ? allRecords.filter((record) => record.id === recordId) : allRecords.slice(0, limit);
    if (!dataRecords.length) return result;
    const section = findGenericRepeatSection(schema);
    if (!section) return result;
    let items = genericRepeatItems(section, schema);
    if (boscSpec || sanySpec || (isSeyondZhiyePage() && SEYOND_RECORDS[schema.key])) {
      const sourceIds=new Set(allRecords.map(record=>record.id));
      for(const item of items)if(recordSlotOwners.has(item)&&!sourceIds.has(recordSlotOwners.get(item)))recordSlotOwners.delete(item);
    }
    let singleIndex = -1;
    if (recordId) {
      const data = dataRecords[0];
      const slotFields = new Map(items.map(item => [item, genericRecordFieldMap(item, data, schema, site, matchThreshold(settings))]));
      const available = scanOwners ? items.filter(item => !scanOwners.has(item) || scanOwners.get(item) === data.id) : items;
      const slot = isChinalifeZhiyePage() || boscSpec || sanySpec || (isSeyondZhiyePage() && SEYOND_RECORDS[schema.key]) ? bestChinalifeRecordSlot(available, data, schema.fields, slotFields, settings) : bestRecordSlot(available, data, schema.fields.map((field) => ({ value: field.key, ...field,
        datePrecision: items.some(item => {
          const control = slotFields.get(item)?.get(field.key)?.element;
          return control && (isElementDayPicker(control) || control.type === "date");
        }) ? "day" : field.datePrecision })), (item, mapping) => {
        const field = slotFields.get(item)?.get(mapping.key);
        return field ? getCurrentValue(field.element) : undefined;
      });
      singleIndex = slot < 0 ? -1 : items.indexOf(available[slot]);
      if (scanOwners && singleIndex >= 0) scanOwners.set(items[singleIndex], data.id);
      if (singleIndex < 0 && isZhaopinPage() && items.length === 1
        && (!recordSlotOwners.has(items[0]) || recordSlotOwners.get(items[0]) === data.id)) {
        const identity = schema.fields.filter(mapping => RECORD_IDENTITY_KEYS.has(mapping.key) && String(data[mapping.key] || "").trim());
        const sameIdentity = identity.length && identity.every(mapping => {
          const field = slotFields.get(items[0])?.get(mapping.key);
          return field && recordValueMatches(getCurrentValue(field.element), data, mapping.key);
        });
        // This site exposes one editor at a time. Its occupied dates may be the
        // values being corrected, rather than the identity of a different row.
        if (sameIdentity || settings.recordConflictConfirmed) singleIndex = 0;
      }
      if (singleIndex < 0 && shouldFill) {
        const before = items.length;
        items = await ensureGenericRepeatItems(section, schema, before + 1);
        if (items.length > before) {
          singleIndex = items.length - 1;
          captureAddedGroup(result, items[singleIndex], () => genericRepeatItems(section, schema));
        }
      }
    } else if (shouldFill) {
      items = await ensureGenericRepeatItems(section, schema, dataRecords.length);
    }
    result.plannedRecords[schema.key] = dataRecords.length;
    for (let index = 0; index < dataRecords.length; index += 1) {
      const data = dataRecords[index];
      const targetIndex = recordId ? singleIndex : index;
      const item = genericRepeatItems(section, schema)[targetIndex] || items[targetIndex];
      if (!item) {
        result.skipped.push({ field: genericRepeatHeading(section), entryId: data.id, label: data.name || data.school || data.company || data.id, score: 100,
          reason: boscSpec || (isSeyondZhiyePage() && SEYOND_RECORDS[schema.key]) ? '未找到唯一对应或空的记录；请手动核对或打开更多编辑器，仅填写当前可编辑记录' : isNjzqZhiyePage() && schema.key === 'relationships' ? "请先在网站添加或打开对应家庭记录；仅填写当前可编辑记录" : isCmbResumePage() ? "请在网站添加记录并选择对应荣誉类型；仅填写当前可编辑记录" : isZhaopinPage() ? "网站需要先手动保存或打开对应记录；仅填写当前可编辑记录" : shouldFill ? "未能创建对应记录" : "点击填写时将自动创建记录" });
        continue;
      }
      let itemFields = genericRecordFieldMap(item, data, schema, site, matchThreshold(settings));
      if (isSeyondZhiyePage() && schema.key==='papers') result.skipped.push({field:'年度/期次',entryId:data.id,label:data.name||data.id,reason:'现有资料无对应年度/期次字段，请手动填写；不会从发表日期推断'});
      if (recordId && shouldFill) {
        const mapped = schema.fields.map((field) => ({ ...field, value: field.key, label: field.aliases[0],
          datePrecision: itemFields.get(field.key)?.element && (isElementDayPicker(itemFields.get(field.key).element)
            || itemFields.get(field.key).element.type === "date") ? "day" : field.datePrecision }));
        const conflicts = recordConflicts(data, mapped, (mapping) => {
          const field = itemFields.get(mapping.key);
          return field ? getCurrentValue(field.element) : undefined;
        });
        if (stopForRecordConflicts(result, conflicts, settings)) continue;
        claimRecordSlot(item, data);
      }
      const processedDates = new Set();
      if (shouldFill) {
        for (const mapping of schema.fields) {
          const field = itemFields.get(mapping.key);
          const pair = field && linkedElementDates(field.element);
          if (!pair || processedDates.has(field.element)) continue;
          const entries = new Map();
          const suggestions = new Map();
          for (const peerMapping of schema.fields) {
            const peer = itemFields.get(peerMapping.key);
            if (!peer || !pair.elements.includes(peer.element)) continue;
            const value = genericStructuredValue(data, peerMapping.key, peer);
            if (!value) continue;
            const suggestion = { field: peer.name, entryId: data.id + "." + peerMapping.key, label: String(value), score: 100, locator: cssLocator(peer.element) };
            suggestions.set(peer.element, suggestion);
            result.suggestions.push(suggestion);
            processedDates.add(peer.element);
            if (getCurrentValue(peer.element) && !settings.overwriteExisting) {
              result.skipped.push({ ...suggestion, reason: "字段已有内容" }); continue;
            }
            entries.set(peer.element, { value, optionValues: recordFieldOptions(data, peerMapping.key),
              pathValues: data.fieldPaths?.[peerMapping.key] || [], fieldType: "date" });
          }
          if (!entries.size) continue;
          const undo = captureFieldState(field);
          const success = await writeLinkedDates(pair, entries, undo);
          if (success) result.transaction.push(undo);
          else retainFailedScalarWrite(result.transaction, undo);
          for (const [element] of entries) {
            const suggestion = suggestions.get(element);
            highlight(element, success ? "filled" : "manual");
            if (success) result.filled.push({ ...suggestion, expectedValue: getCurrentValue(element), kind: "field" });
            else result.skipped.push({ ...suggestion, reason: controlFailures.get(element) || "关联日期未确认写入" });
          }
        }
      }
      for (const mapping of schema.fields) {
        // Phoenix may enable an end-date control only after the start is
        // committed. Refresh inside this record instead of keeping the map
        // that excluded the initially disabled field.
        if ((shouldFill && isChinalifeZhiyePage()) || [...itemFields.values()].some(field => !field.element.isConnected))
          itemFields = genericRecordFieldMap(item, data, schema, site, matchThreshold(settings));
        const field = itemFields.get(mapping.key);
        if (field && processedDates.has(field.element)) continue;
        const value = genericStructuredValue(data, mapping.key, field);
        if (!field || !value) {
          if ((isChinalifeZhiyePage() || boscSpec) && field) result.skipped.push({ field: field.name, entryId: `${data.id}.${mapping.key}`, label: data.name || data.school || data.language || data.id, reason: '个人资料中的对应字段为空，请补充或手动填写' });
          continue;
        }
        const suggestion = { field: field.name, entryId: `${data.id}.${mapping.key}`, label: String(value), score: 100, locator: cssLocator(field.element) };
        result.suggestions.push(suggestion);
        if (!shouldFill) continue;
        const current = getCurrentValue(field.element);
        if (current && !settings.overwriteExisting) {
          result.skipped.push({ ...suggestion, reason: "字段已有内容" });
          continue;
        }
        const undoRecord = captureFieldState(field);
        const success = await writeField(field, { value, optionValues: recordFieldOptions(data, mapping.key), multi: false,
          pathValues: data.fieldPaths?.[mapping.key] || [], fieldType: mapping.datePrecision || (["educations", "internships"].includes(schema.key) && ["start", "end"].includes(mapping.key)) ? "date" : undefined });
        if (!success) {
          retainFailedScalarWrite(result.transaction, undoRecord);
          highlight(field.element, "manual");
          result.skipped.push({ ...suggestion, reason: controlFailures.get(field.element) || "复杂控件未确认写入，请手动处理" });
          continue;
        }
        result.transaction.push(undoRecord);
        highlight(field.element, "filled");
        result.filled.push({ ...suggestion, expectedValue: getCurrentValue(field.element), precisionNote: datePrecisionNotes.get(field.element), kind: "field", locator: cssLocator(field.element) });
      }
      if (isChinalifeZhiyePage() || boscSpec || (isNjzqZhiyePage() && schema.key === 'relationships')) {
        const mapped = new Set(Array.from(itemFields.values(), field => field.element.closest('.form-item')));
        for (const field of item.querySelectorAll('.form-item')) {
          if (!mapped.has(field) && field.querySelector(`${FIELD_SELECTOR}, [role=radio], [role=checkbox], .phoenix-radio-group`)) result.skipped.push({ field: compactText(field.querySelector('label')?.textContent, 100), entryId: data.id, label: data.name || data.school || data.language || data.id, reason: '本站字段没有明确对应的 JSON 配置；请补充字段别名或手动处理' });
        }
      }
    }
    return result;
  }

  async function scanOrFillGenericRepeats(profile, settings, shouldFill, site) {
    const result = { suggestions: [], filled: [], skipped: [], transaction: [], plannedRecords: {} };
    const scanOwners = isChinalifeZhiyePage() || globalThis.ResumeHelperBosc?.ownsPage() || globalThis.ResumeHelperSany?.ownsPage() ? new WeakMap() : null;
    for (const schema of GENERIC_REPEAT_SCHEMAS) {
      if (isChinalifeZhiyePage() || globalThis.ResumeHelperBosc?.ownsPage() || globalThis.ResumeHelperSany?.ownsPage()) {
        for (const record of profile.records?.[schema.key] || []) {
          const part = await fillGenericRepeatSchema(schema, profile, settings, shouldFill, site, Infinity, record.id, scanOwners);
          for (const key of ['suggestions','filled','skipped','transaction']) result[key].push(...part[key]);
        }
        if (profile.records?.[schema.key]?.length && chinalifeSection(schema.key)) result.plannedRecords[schema.key] = profile.records[schema.key].length;
        continue;
      }
      const part = await fillGenericRepeatSchema(schema, profile, settings, shouldFill, site);
      result.suggestions.push(...part.suggestions);
      result.filled.push(...part.filled);
      result.skipped.push(...part.skipped);
      result.transaction.push(...part.transaction);
      Object.assign(result.plannedRecords, part.plannedRecords);
    }
    return result;
  }

  function eligibleEntries(profile) {
    const catalog = globalThis.ResumeHelperCategories;
    return (profile.entries || []).filter(entry => catalog?.isFixedEntry(entry) && String(entry.value ?? '').trim())
      .map(entry => {
        const field = catalog.fixedField(entry.id);
        return { ...entry, ...field, aliases:[...field.aliases],
          optionValues:field.supportsOptions ? [...(entry.optionValues || [])] : [],
          pathValues:field.supportsPath ? structuredClone(entry.pathValues || []) : [],
          ...(field.type === 'date' ? {fieldType:'date'} : {}) };
      });
  }

  // 分最高者胜出；其余达到阈值的候选作为候补随结果回传，被用户否决的「框::词条」组合不再参与。
  function bestMatch(field, entries, site, settings = {}) {
    // These three facts deliberately have independent main values. A fuzzy
    // shared "graduation/date" token must not turn a missing fact into another.
    const graduationIds = ['basic.graduation_date','career.graduation_date','career.graduation_year'];
    const target = core.normalize(field.name);
    // Explicit relative fields belong to structured relationship records, not
    // applicant facts that happen to share a name, phone or address suffix.
    if (/亲属|家属|家庭成员/.test(target)) return null;
    if (/紧急(?:联系|联络)(?:人|电话)|emergencycontact/.test(target)) {
      const emergencyId = /电话|手机|联系方式|phone|mobile|telephone/.test(target) ? 'contact.emergency_phone'
        : /^(紧急(?:联系|联络)人(?:姓名|名字)?|emergencycontact(?:name)?)(?:\1)*$/.test(target) ? 'contact.emergency_name' : '';
      entries = entries.filter(entry => entry.id === emergencyId);
    }
    let graduationId = '';
    if (/毕业|graduat/i.test(target)) {
      if (/硕士|本科|博士|专科|研究生|master|bachelor|doctor/i.test(target)) graduationId = 'record-specific';
      else if (/毕业年份|毕业年$|graduationyear|yearofgraduation/i.test(target)) graduationId = 'career.graduation_year';
      else if (/预计|预期|expected|anticipated/i.test(target)) graduationId = 'career.graduation_date';
      else if (/毕业时间|毕业日期|graduationdate|dateofgraduation/i.test(target)) graduationId = 'basic.graduation_date';
    }
    entries = entries.filter(entry => graduationId ? entry.id === graduationId : !graduationIds.includes(entry.id));
    if (globalThis.ResumeHelperBosc?.ownsUrl() && !globalThis.ResumeHelperBosc.ownsControl(field.element || field.container)) return null;
    if (field.job51) {
      const allowed = entries.filter(entry => [entry.label, ...(entry.aliases || [])]
        .some(alias => field.job51.aliases.some(label => core.normalize(label) === core.normalize(alias))));
      const ranked = allowed.map(entry => ({ entry, score: 100, specificity: 100, alias: entry.label }));
      const match = core.resolveMatch(ranked, field.name, { threshold: settings.confidenceThreshold, rejected: settings.rejectedMatches });
      return match?.ambiguous ? null : match;
    }
    if (isChinalifeZhiyePage() || globalThis.ResumeHelperBosc?.ownsControl(field.element || field.container) || globalThis.ResumeHelperSany?.ownsControl(field.element || field.container)) {
      const label = compactText((field.element || field.container)?.closest('.form-item')?.querySelector('label')?.textContent || field.name, 120);
      const aliases=globalThis.ResumeHelperBosc?.ownsControl(field.element || field.container)?globalThis.ResumeHelperBosc.flatAliases:isChinalifeZhiyePage()?CHINALIFE_FLAT_ALIASES:{};
      const labels = [label, ...(aliases[label] || [])];
      const allowed = entries.filter(entry => [entry.label, ...(entry.aliases || [])].some(alias => labels.some(text => core.normalize(text) === core.normalize(alias))));
      const ranks=new Map();
      for (const text of labels) for (const item of core.rankEntries(text,allowed,site)) {
        const previous=ranks.get(item.entry.id);
        if (!previous || item.score>previous.score || (item.score===previous.score && item.specificity>previous.specificity)) ranks.set(item.entry.id,item);
      }
      return core.resolveMatch(Array.from(ranks.values()).sort((a,b)=>b.score-a.score||b.specificity-a.specificity), label,
        { threshold: settings.confidenceThreshold, rejected: settings.rejectedMatches });
    }
    const ranked = core.rankEntries(field.context, entries, site);
    return core.resolveMatch(ranked, field.name, {
      threshold: settings.confidenceThreshold,
      rejected: settings.rejectedMatches
    });
  }

  function matchSkip(field, match, settings) {
    if (globalThis.ResumeHelperBosc?.ownsUrl() && !globalThis.ResumeHelperBosc.ownsControl(field.element || field.container)) {
      return { field: field.name, entryId: "", label: "", score: 0, reason: "本站控件归属或字段结构未知，请手动处理" };
    }
    if (globalThis.ResumeHelperBosc?.ownsUrl() && match?.ambiguous) {
      return { field: field.name, entryId: "", label: "", score: match.score, reason: "多个资料来源同等匹配，请明确来源后再填写" };
    }
    if (!match) return { field: field.name, entryId: "", label: "", score: 0, reason: "没有找到候选" };
    if (match.score < settings.confidenceThreshold) {
      return { field: field.name, entryId: match.entry.id, label: match.entry.label, score: match.score, reason: "置信度不足" };
    }
    return null;
  }

  function matchSuggestion(field, match) {
    const { entry, score, ambiguous, alternates, alias } = match;
    return {
      field: field.name,
      entryId: entry.id,
      label: entry.label,
      score,
      alias: alias || "",
      ambiguous: Boolean(ambiguous),
      // 侧栏否决候补时直接写这个键，避免在侧栏重复实现一遍归一化规则。
      rejectionKey: core.rejectionKey(field.name, entry.id),
      alternates: (alternates || []).map((item) => ({ ...item, rejectionKey: core.rejectionKey(field.name, item.entryId) }))
    };
  }

  // 侧栏按原因分组展示；这里同时回传计数，便于对照和排查。
  // suggestions / filled / skipped 结构保持不变，只新增字段。
  function reasonCounts(skipped) {
    const counts = {};
    for (const item of skipped || []) {
      const reason = item.reason || "未说明";
      counts[reason] = (counts[reason] || 0) + 1;
    }
    return counts;
  }

  async function scanOrFill(profile, settings, shouldFill) {
    if (['education','skills','work'].includes(job51?.moduleName())) {
      const collection={education:'educations',skills:'programmingLanguages',work:'internships'}[job51.moduleName()];
      const report={ profile,shouldFill,suggestions:[],filled:[],skipped:[],transaction:[],plannedRecords:{[collection]:profile.records?.[collection]?.length||0} };
      for(const source of profile.records?.[collection]||[]) await fillJob51Record(profile,settings,source,report);
      if(shouldFill)lastTransaction=sealTransaction(report.transaction);
      return collectionResult(report,collection);
    }
    if (isMokaStructuredPage()) return scanOrFillMoka(profile, settings, shouldFill);
    if (isZhiyeStructuredPage() && !isChinalifeZhiyePage() && !globalThis.ResumeHelperBosc?.ownsUrl()) return scanOrFillZhiye(profile, settings, shouldFill);
    if (isFeishuStructuredPage()) return scanOrFillFeishu(profile, settings, shouldFill);
    const site = currentSite();
    const entries = eligibleEntries(job51?.ownsPage()?{...profile,records:{}}:profile);
    const repeated = job51?.ownsPage() ? {profile,shouldFill,suggestions:[],filled:[],skipped:job51.notes(),transaction:[],plannedRecords:{}} : await scanOrFillGenericRepeats(profile, settings, shouldFill, site);
    if(job51?.moduleName()==='basic')for(const source of profile.records?.foreignLanguages||[])await fillJob51Language(profile,settings,source,repeated);
    const repeatLocators = new Set(repeated.suggestions.map(item => item.locator).filter(Boolean));
    const excluded = [...chinalifeRecordForms(),...(globalThis.ResumeHelperBosc?.excludedForms()||[]),...(globalThis.ResumeHelperSany?.excludedForms()||[])];
    const fields = collectFields(site).filter(field => !repeatLocators.has(cssLocator(field.element))
      && !excluded.some(form => form.contains(field.element))
      && !(isCmbResumePage() && genericRepeatHeading(field.element.closest('.item-box') || field.element) === '个人荣誉'));
    const choiceGroups = collectChoiceGroups(site).filter(group => !excluded.some(form => form.contains(group.container)));
    const usedEntries = new Set();
    const filled = [...repeated.filled];
    const suggestions = [...repeated.suggestions];
    const skipped = [...repeated.skipped];
    const transaction = [...repeated.transaction];

    for (const field of fields) {
      if (isManualIntentField(field.name)) {
        skipped.push({ field: field.name, entryId: "manual.intent", label: "手动选择", score: 100, reason: "岗位和工作城市因企业而异，请手动填写" });
        continue;
      }
      const match = bestMatch(field, entries, site, settings);
      const miss = matchSkip(field, match, settings);
      if (miss) {
        skipped.push(miss);
        continue;
      }
      const { entry, score } = match;
      if (usedEntries.has(entry.id) && !REUSABLE_ENTRY_IDS.has(entry.id)) {
        skipped.push({ field: field.name, entryId: entry.id, label: entry.label, score, reason: "同一资料已用于更靠前的字段" });
        continue;
      }

      const current = getCurrentValue(field.element);
      const suggestion = matchSuggestion(field, match);
      suggestions.push(suggestion);
      if (!shouldFill) continue;
      if (current && !settings.overwriteExisting) {
        skipped.push({ ...suggestion, reason: "字段已有内容" });
        continue;
      }

      const undoRecord = captureFieldState(field);
      const success = await writeField(field, entry);
      if (!success) {
        retainFailedScalarWrite(transaction, undoRecord);
        highlight(field.element, "manual");
        skipped.push({ ...suggestion, reason: controlFailures.get(field.element) || "复杂控件未确认写入，请手动处理" });
        continue;
      }

      usedEntries.add(entry.id);
      transaction.push(undoRecord);
      highlight(field.element, "filled");
      filled.push({
        ...suggestion,
        expectedValue: getCurrentValue(field.element), job51State:job51?.snapshot(field.element)||undefined,
        precisionNote: datePrecisionNotes.get(field.element),
        kind: "field",
        locator: cssLocator(field.element)
      });
    }

    for (const group of choiceGroups) {
      if (isManualIntentField(group.name)) {
        skipped.push({ field: group.name, entryId: "manual.intent", label: "手动选择", score: 100, reason: "岗位和工作城市因企业而异，请手动填写" });
        continue;
      }
      const match = bestMatch(group, entries, site, settings);
      const miss = matchSkip(group, match, settings);
      if (miss) {
        skipped.push(miss);
        continue;
      }
      const { entry, score } = match;
      if (usedEntries.has(entry.id)) {
        skipped.push({ field: group.name, entryId: entry.id, label: entry.label, score, reason: "同一资料已用于更靠前的字段" });
        continue;
      }
      const suggestion = matchSuggestion(group, match);
      suggestions.push(suggestion);
      if (!shouldFill) continue;
      if (selectedChoiceValues(group).length && !settings.overwriteExisting) {
        skipped.push({ ...suggestion, reason: "选项组已有选择" });
        continue;
      }
      const undoRecord = captureChoiceState(group);
      const success = await selectChoiceGroup(group, entry);
      if (!success) {
        retainFailedChoiceWrite(transaction, undoRecord);
        group.options.forEach((option) => highlight(option, "manual"));
        skipped.push({ ...suggestion, reason: "单选/多选控件未确认写入，请手动处理" });
        continue;
      }
      usedEntries.add(entry.id);
      transaction.push(undoRecord);
      group.options.filter(optionSelected).forEach((option) => highlight(option, "filled"));
      const expectedValues = entry.multi ? entry.optionValues : [selectedChoiceValues(group)[0]];
      filled.push({
        ...suggestion,
        expectedValue: expectedValues.join("、"),
        expectedValues,
        kind: "choice",
        locator: cssLocator(group.container)
      });
    }

    if (shouldFill && transaction.length) lastTransaction = transaction;

    return {
      site,
      adapter: "generic",
      hostname: location.hostname,
      url: location.href,
      documentToken,
      scannedCount: fields.length + choiceGroups.length,
      suggestions,
      filled,
      skipped,
      structured: Object.keys(repeated.plannedRecords).length > 0,
      segments: [],
      plannedRecords: repeated.plannedRecords
    };
  }

  async function fillFlatEntries(profile, settings, resetTransaction = true) {
    if (resetTransaction) lastTransaction = [];
    protectChangedGroups();
    if (['education','skills','work'].includes(job51?.moduleName())) return collectionResult({suggestions:[],filled:[],skipped:[],plannedRecords:{}},'flat');
    const excluded = [...chinalifeRecordForms(), ...njzqFamilyRecordForms(), ...Object.keys(SEYOND_RECORDS).flatMap(key=>seyondRecordForms(key,false)),...(globalThis.ResumeHelperBosc?.excludedForms()||[]),...(globalThis.ResumeHelperSany?.excludedForms()||[])];
    if (isMokaStructuredPage()) {
      for (const key of ["apply", "education", "experience", "projects", "papers", "competitions", "honors", "programmingLanguages", "foreignLanguages"]) excluded.push(...mokaRecordElements(key));
    }
    if (isZhiyeStructuredPage()) {
      for (const key of ["educations", "internships", "projects"]) excluded.push(...zhiyeRecordElements(ZHIYE_COLLECTION_SPECS[key].section));
    }
    if (isFeishuStructuredPage()) {
      for (const spec of Object.values(FEISHU_COLLECTION_SPECS)) excluded.push(...feishuItems(feishuSection(spec.pattern)));
    }
    for (const schema of GENERIC_REPEAT_SCHEMAS) {
      const section = findGenericRepeatSection(schema);
      if (section) excluded.push(section, ...(isNjzqZhiyePage() && schema.key === 'relationships' ? genericRepeatItems(section, schema) : []));
    }
    const site = currentSite();
    const entries = eligibleEntries(globalThis.ResumeHelperBosc?.ownsUrl()?profile:{ ...profile, records: {} });
    const report = { suggestions: [], filled: [], skipped: [], transaction: [] };
    appendManualIntentSkips(report);
    if (job51?.ownsPage()) report.skipped.push(...job51.notes());
    const fields = collectFields(site).filter((field) => !excluded.some((container) => container.contains(field.element)));
    const usedEntries = new Set();
    for (const element of document.querySelectorAll(".atsx-select")) {
      if (!isVisible(element) || excluded.some((container) => container.contains(element)) || fields.some((field) => element.contains(field.element))) continue;
      const context = fieldContext(element, site);
      fields.push({ element, context, name: fieldName(element, context), type: "select" });
    }
    for (const field of fields) {
      if (isManualIntentField(field.name)) continue;
      const match = bestMatch(field, entries, site, settings);
      const miss = matchSkip(field, match, settings);
      if (miss) { report.skipped.push(miss); continue; }
      const suggestion = matchSuggestion(field, match);
      if (usedEntries.has(match.entry.id) && !REUSABLE_ENTRY_IDS.has(match.entry.id)) {
        report.skipped.push({ ...suggestion, reason: "同一资料已用于更靠前的字段" }); continue;
      }
      report.suggestions.push(suggestion);
      if (getCurrentValue(field.element) && !settings.overwriteExisting) {
        report.skipped.push({ ...suggestion, reason: "字段已有内容" }); continue;
      }
      const undo = captureFieldState(field);
      const success = isMokaDropdown(field.element)
        ? (await writeMokaValue(field.element, match.entry.value, { overwrite: settings.overwriteExisting, optionValues: match.entry.optionValues, pathValues: match.entry.pathValues, fieldType: match.entry.fieldType })).success
        : await writeField(field, match.entry);
      if (!success) {
        retainFailedScalarWrite(report.transaction, undo);
        report.skipped.push({ ...suggestion, reason: controlFailures.get(field.element) || "未找到选项、存在歧义或写入未确认" }); continue;
      }
      usedEntries.add(match.entry.id);
      report.transaction.push(undo);
      report.filled.push({ ...suggestion, expectedValue: getCurrentValue(field.element), job51State:job51?.snapshot(field.element)||undefined, precisionNote: datePrecisionNotes.get(field.element), kind: "field", locator: cssLocator(field.element) });
    }
    const choiceGroups = collectChoiceGroups(site).filter((group) => !excluded.some((container) => container.contains(group.container)));
    for (const group of choiceGroups) {
      if (isManualIntentField(group.name)) continue;
      const match = bestMatch(group, entries, site, settings);
      const miss = matchSkip(group, match, settings);
      if (miss) { report.skipped.push(miss); continue; }
      const suggestion = matchSuggestion(group, match);
      report.suggestions.push(suggestion);
      if (usedEntries.has(match.entry.id)) { report.skipped.push({ ...suggestion, reason: "同一资料已用于更靠前的字段" }); continue; }
      if (selectedChoiceValues(group).length && !settings.overwriteExisting) { report.skipped.push({ ...suggestion, reason: "选项组已有选择" }); continue; }
      const undo = captureChoiceState(group);
      if (!await selectChoiceGroup(group, match.entry)) { retainFailedChoiceWrite(report.transaction, undo); report.skipped.push({ ...suggestion, reason: "单选/多选未找到选项、存在歧义或写入未确认" }); continue; }
      usedEntries.add(match.entry.id);
      report.transaction.push(undo);
      const expectedValues = selectedChoiceValues(group);
      report.filled.push({ ...suggestion, expectedValue: expectedValues.join("、"), expectedValues, kind: "choice", locator: cssLocator(group.container) });
    }
    lastTransaction.push(...sealTransaction(report.transaction));
    return { ...report, transaction: undefined, adapter: site, site, url: location.href, documentToken, scannedCount: fields.length + choiceGroups.length };
  }

  function targetStatus() {
    const site = currentSite();
    const field = selectedField(site);
    return {
      site,
      ready: Boolean(field),
      field: field?.name || "",
      currentValue: field ? getCurrentValue(field.element) : ""
    };
  }

  async function fillSelectedTarget(entry, forceOverwrite = false) {
    protectChangedGroups();
    const site = currentSite();
    const field = selectedField(site);
    if (!field) {
      return { success: false, reason: "请先在网页中点击要填写的输入框。", ...targetStatus() };
    }
    const currentValue = getCurrentValue(field.element);
    const compositeConflict=job51?.conflict(field.element,entry);
    if(compositeConflict&&!forceOverwrite)return {success:false,requiresConfirmation:true,...compositeConflict};
    const monthOnly = isMokaMonthPicker(field.element) || isCmbMonthPicker(field.element) || chinalifeDatePrecision(field.element) === 'month' || field.type === "month";
    const expectedValue = isFeishuYearControl(field.element) ? feishuDateYear(entry.value)
      : monthOnly ? controlDateParts(entry.value)?.ym || entry.value
      : isElementDayPicker(field.element) || chinalifeDatePrecision(field.element) === 'day' ? controlDateParts(entry.value)?.date || entry.value : core.formatValue(entry, field.type);
    if (currentValue && !normalizedValueMatches(currentValue, expectedValue) && !forceOverwrite) {
      return {
        success: false,
        requiresConfirmation: true,
        field: field.name,
        currentValue,
        expectedValue
      };
    }

    const undoRecord = captureFieldState(field);
    const success = await writeField(field, entry, true);
    if (!success) {
      const failedWrites = [];
      retainFailedScalarWrite(failedWrites, undoRecord);
      if (failedWrites.length) lastTransaction.push(...sealTransaction(failedWrites));
      highlight(field.element, "manual");
      return { success: false, field: field.name, reason: controlFailures.get(field.element) || "当前控件未确认写入，请改用复制或手动选择。" };
    }

    lastTransaction = sealTransaction([undoRecord]);
    highlight(field.element, "filled");
    return {
      success: true,
      site,
      url: location.href,
      documentToken,
      field: field.name,
      previousValue: currentValue,
      precisionNote: datePrecisionNotes.get(field.element),
      expectation: {
        field: field.name,
        entryId: entry.id,
        label: entry.label,
        expectedValue: getCurrentValue(field.element), job51State:job51?.snapshot(field.element)||undefined,
        precisionNote: datePrecisionNotes.get(field.element),
        kind: "field",
        locator: cssLocator(field.element)
      }
    };
  }

  async function undoLastFill() {
    if (!lastTransaction.length) return { restoredCount: 0, failedCount: 0, reason: "当前页面没有可撤销的填写记录。" };
    let restoredCount = 0;
    const failed = [];
    const groups = lastTransaction.filter((record) => record.kind === "addedGroup");
    const removedGroups = new Set();
    const blockedGroups = new Set();
    // Remove owned groups before changing their contents. A later user edit blocks
    // the entire group's undo; it must never disappear through partial rollback.
    for (const record of [...groups].reverse()) {
      try {
        if (await removeAddedGroup(record)) { removedGroups.add(record.element); restoredCount += 1; }
        else { blockedGroups.add(record.element); failed.unshift(record); }
      } catch (_) { blockedGroups.add(record.element); failed.unshift(record); }
    }
    for (const record of [...lastTransaction].reverse()) {
      if (record.kind === "addedGroup") continue;
      const elements = record.kind === "choice" ? record.options.map((item) => item.option) : record.kind === "linkedDates" ? record.elements : [record.element];
      if ([...removedGroups].some((group) => record.groupElement === group || elements.every((element) => group.contains(element)))) { restoredCount += 1; continue; }
      if ([...blockedGroups].some((group) => record.groupElement === group || elements.some((element) => group.contains(element)))) { failed.unshift(record); continue; }
      try {
        if (await restoreRecord(record)) restoredCount += 1;
        else failed.unshift(record);
      } catch (_) { failed.unshift(record); }
    }
    const failedCount = lastTransaction.length - restoredCount;
    lastTransaction = failed;
    return { restoredCount, failedCount };
  }

  function findVerificationField(expectation, entry, fields, site, threshold) {
    if (expectation.locator) {
      try {
        const exact = document.querySelector(expectation.locator);
        if (exact && isVisible(exact) && (!expectation.locator.startsWith("body:has(li.leftli2[") || job51?.info(exact))) return fields.find((field) => field.element === exact) || { element: exact, context: fieldContext(exact, site), name: fieldName(exact, ""), type: exact.type || exact.tagName.toLowerCase() };
      } catch (_) {}
    }
    if (expectation.locator?.startsWith("body:has(li.leftli2[")) return null;
    const best = fields
      .map((field) => ({ field, score: Math.max(0, ...[entry.label, ...(entry.aliases || [])].map((alias) => core.scoreAlias(field.context, alias))) }))
      .sort((a, b) => b.score - a.score)[0];
    return best?.score >= threshold ? best.field : null;
  }

  function verify(profile, expectations, originalDocumentToken, threshold = matchThreshold()) {
    const site = currentSite();
    const fields = collectFields(site);
    const choiceGroups = collectChoiceGroups(site);
    const entries = new Map(profile.entries.map((entry) => [entry.id, entry]));
    const results = [];

    for (const expectation of expectations || []) {
      const entry = entries.get(expectation.entryId);
      if (!entry) {
        let exact = null;
        if (expectation.kind !== "choice" && expectation.locator) {
          try { exact = document.querySelector(expectation.locator); } catch (_) {}
        }
        if (expectation.locator?.startsWith("body:has(li.leftli2[") && !job51?.info(exact)) exact = null;
        const actual = exact ? getCurrentValue(exact) : "";
        const confirmed = Boolean(exact && normalizedValueMatches(actual, expectation.expectedValue)&&(!expectation.job51State||JSON.stringify(job51?.snapshot(exact))===JSON.stringify(expectation.job51State)));
        results.push({ ...expectation, confirmed, reason: confirmed ? "" : exact ? "当前值与预期不一致" : "资料条目已不存在且未找到原字段" });
        if (exact) highlight(exact, confirmed ? "filled" : "manual");
        continue;
      }
      let field = null;
      let choiceGroup = null;
      if (expectation.kind === "choice") {
        if (expectation.locator) {
          try {
            const container = document.querySelector(expectation.locator);
            choiceGroup = choiceGroups.find((group) => group.container === container) || null;
          } catch (_) {}
        }
        if (!choiceGroup) {
          choiceGroup = choiceGroups
            .map((group) => ({ group, score: Math.max(0, ...[entry.label, ...(entry.aliases || [])].map((alias) => core.scoreAlias(group.context, alias))) }))
            .sort((a, b) => b.score - a.score)
            .find((candidate) => candidate.score >= threshold)?.group || null;
        }
      } else {
        field = findVerificationField(expectation, entry, fields, site, threshold);
      }
      const actualValues = choiceGroup ? selectedChoiceValues(choiceGroup) : [];
      const actual = field ? getCurrentValue(field.element) : actualValues.join("、");
      const confirmed = choiceGroup
        ? (expectation.expectedValues || []).every((expected) => actualValues.some((value) => normalizedValueMatches(value, expected)))
        : Boolean(field && normalizedValueMatches(actual, expectation.expectedValue)&&(!expectation.job51State||JSON.stringify(job51?.snapshot(field.element))===JSON.stringify(expectation.job51State)));
      results.push({
        entryId: expectation.entryId,
        label: entry.label,
        field: field?.name || choiceGroup?.name || expectation.field,
        confirmed,
        reason: confirmed ? "" : (field || choiceGroup) ? "当前值与预期不一致" : "未找到对应字段"
      });
      if (field) highlight(field.element, confirmed ? "filled" : "manual");
      if (choiceGroup) choiceGroup.options.forEach((option) => highlight(option, confirmed ? "filled" : "manual"));
    }

    return {
      url: location.href,
      documentToken,
      reloaded: documentToken !== originalDocumentToken,
      confirmedCount: results.filter((item) => item.confirmed).length,
      missingCount: results.filter((item) => !item.confirmed).length,
      results
    };
  }

  function collectionResult(report, collection) {
    const liveFields = collectFields(currentSite());
    return {
      site: currentSite(), hostname: location.hostname, url: location.href, documentToken,
      scannedCount: liveFields.length,
      suggestions: report.suggestions, filled: report.filled, skipped: report.skipped,
      reasonCounts: reasonCounts(report.skipped),
      structured: true, collection,
      plannedRecords: report.plannedRecords,
      conflicts: report.conflicts || [], requiresConfirmation: Boolean(report.requiresConfirmation)
    };
  }

  // 51job only reuses confirmed existing editors; users add missing slots themselves.
  async function fillJob51Record(profile,settings,source,report) {
    const plan=(job51.moduleName()==='education'?job51.educationPlan(profile):job51.recordPlan(profile,report.shouldFill?source.id:undefined)).find(item=>item.data.id===source.id);
    if(!plan || plan.reason || !plan.fields.length){report.skipped.push({field:job51.moduleName(),entryId:source.id,label:source.school||source.company||source.name||source.id,reason:plan?.reason||'未找到当前记录编辑器，请手动处理'});return;}
    const mapping=plan.fields.map(field=>({value:field.job51.recordKey,label:field.name,field,datePrecision:field.job51.kind==='my97'?'day':undefined}));
    const conflicts=recordConflicts(source,mapping.filter(item=>item.field.job51.kind!=='dependentPair'),item=>getCurrentValue(item.field.element));
    for(const item of mapping){if(source[item.value]==null||!String(source[item.value]).trim())continue;const conflict=job51.conflict(item.field.element,{value:source[item.value],optionValues:recordFieldOptions(source,item.value),pathValues:source.fieldPaths?.[item.value]||[]});if(conflict)conflicts.push({...conflict,entryId:source.id});}
    if(report.shouldFill && stopForRecordConflicts(report,conflicts,settings))return;
    if(report.shouldFill)job51.claim(plan);
    for(const item of mapping) {
      const value=source[item.value];if(value==null||!String(value).trim())continue;
      const suggestion={field:item.label,entryId:source.id,label:String(value),score:100};report.suggestions.push(suggestion);
      if(!report.shouldFill)continue;
      const field=item.field, current=getCurrentValue(field.element);
      if(job51.matches(field.element,{value:String(value),optionValues:recordFieldOptions(source,item.value),pathValues:source.fieldPaths?.[item.value]||[]})??mappedRecordValueMatches(current,source,item,value))continue;
      const before=captureFieldState(field);
      const success=await writeField(field,{id:source.id,value:String(value),optionValues:recordFieldOptions(source,item.value),pathValues:source.fieldPaths?.[item.value]||[],fieldType:item.datePrecision?'date':''});
      if(success){report.transaction.push(before);report.filled.push({...suggestion,expectedValue:getCurrentValue(field.element),job51State:job51.snapshot(field.element)||undefined,kind:'field',locator:cssLocator(field.element)});}
      else {retainFailedScalarWrite(report.transaction,before);report.skipped.push({...suggestion,reason:controlFailures.get(field.element)||'51job 控件未确认写入，请手动处理'});}
    }
  }

  async function fillJob51Language(profile,settings,source,report){
    const plan=job51.languagePlan(profile).find(item=>item.data.id===source.id);
    if(!plan||plan.reason||!plan.entry){report.skipped.push({field:'外语能力',entryId:source.id,label:source.language||source.id,reason:plan?.reason||'未找到对应外语编辑器，请手动处理'});return;}
    const {field,entry}=plan,suggestion={field:field.name,entryId:source.id,label:source.language,score:100,locator:cssLocator(field.element)};
    report.suggestions.push(suggestion);if(!report.shouldFill)return;
    const conflict=job51.conflict(field.element,entry);if(stopForRecordConflicts(report,conflict?[{...conflict,entryId:source.id}]:[],settings))return;
    if(job51.matches(field.element,entry))return;
    const before=captureFieldState(field);if(await writeField(field,entry)){report.transaction.push(before);report.filled.push({...suggestion,expectedValue:getCurrentValue(field.element),job51State:job51.snapshot(field.element),kind:'field'});}
    else {retainFailedScalarWrite(report.transaction,before);report.skipped.push({...suggestion,reason:controlFailures.get(field.element)||'外语控件未确认选择，请手动处理'});}
  }

  async function fillRecord(profile, settings, collection, recordId, resetTransaction = true) {
    if (resetTransaction) lastTransaction = [];
    protectChangedGroups();
    const report = { profile, shouldFill: true, suggestions: [], filled: [], skipped: [], transaction: [], plannedRecords: { [collection]: 1 } };
    const records = profile.records || {};
    const source = (records[collection] || []).find((record) => record.id === recordId);
    if (!source) throw new Error(`资料中找不到记录：${recordId}`);
    try {
    if (job51?.ownsPage()) {
      if({education:'educations',skills:'programmingLanguages',work:'internships'}[job51.moduleName()]===collection)await fillJob51Record(profile,settings,source,report);
      else if(job51.moduleName()==='basic'&&collection==='foreignLanguages')await fillJob51Language(profile,settings,source,report);
      else report.skipped.push({field:collection,entryId:recordId,label:collection,reason:'当前 51job 模块尚无该记录的专用映射，请手动处理'});
    } else if (isMokaStructuredPage() && MOKA_COLLECTION_SPECS[collection]) {
      const blocks = MOKA_COLLECTION_SPECS[collection].blocks(records, { runCompetitions: true, runHonors: true });
      const identityValue = source.school || source.company || source.name || source.language || source.relation || "";
      const block = blocks.find((candidate) => candidate.records?.some((record) => record.id === recordId))
        || blocks.find((candidate) => candidate.records?.some((record) => normalizedValueMatches(record.school || record.company || record.name || record.language || record.relation || "", identityValue)));
      const data = block?.records?.find((record) => record.id === recordId)
        || block?.records?.find((record) => normalizedValueMatches(record.school || record.company || record.name || record.language || record.relation || "", identityValue));
      if (!block || !data) throw new Error(`当前 MokaHR 页面没有可填写的「${collection}」区块。`);
      await fillMokaSingleRecord(block.blockKey, data, block.mapping, block.dateLabel, settings, report);
    } else if (isZhiyeStructuredPage() && !isChinalifeZhiyePage() && !globalThis.ResumeHelperBosc?.ownsUrl() && ZHIYE_COLLECTION_SPECS[collection]) {
      const spec = ZHIYE_COLLECTION_SPECS[collection];
      await fillZhiyeSingleRecord(spec.section, source, spec.mapping, settings, report);
    } else if (isFeishuStructuredPage() && FEISHU_COLLECTION_SPECS[collection]) {
      const spec = FEISHU_COLLECTION_SPECS[collection];
      await fillFeishuSingleRecord(spec.pattern, source, spec.mapping, settings, report);
    } else {
      const schema = GENERIC_REPEAT_SCHEMAS.find((item) => item.key === collection);
      if (!schema) throw new Error(`当前页面没有可填写的「${collection}」区块。`);
      const part = await fillGenericRepeatSchema(schema, profile, settings, true, currentSite(), Infinity, recordId);
      report.suggestions.push(...part.suggestions);
      report.filled.push(...part.filled);
      report.skipped.push(...part.skipped);
      report.transaction.push(...part.transaction);
      report.conflicts = part.conflicts || [];
      report.requiresConfirmation = part.requiresConfirmation;
      if (!part.plannedRecords[collection]) throw new Error(`当前页面没有检测到可填写的「${collection}」区块。`);
    }

    } finally {
      if (report.transaction.length) lastTransaction = [...lastTransaction, ...sealTransaction(report.transaction)];
    }
    return collectionResult(report, collection);
  }

  async function fillCollection(profile, settings, collection, resetTransaction = true) {
    if (resetTransaction) lastTransaction = [];
    const records = profile.records?.[collection] || [];
    const report = { suggestions: [], filled: [], skipped: [], conflicts: [], plannedRecords: { [collection]: records.length } };
    for (const record of records) {
      try {
        const part = await fillRecord(profile, settings, collection, record.id, false);
        for (const key of ["suggestions", "filled", "skipped", "conflicts"]) report[key].push(...(part[key] || []));
        report.requiresConfirmation ||= part.requiresConfirmation;
      } catch (error) {
        report.skipped.push({ field: collection, entryId: record.id, label: record.name || record.school || record.company || record.id, reason: error.message || "记录填写失败" });
      }
    }
    return collectionResult(report, collection);
  }

  // All public bulk entry points use the same record-level identity/conflict core.
  async function fillUnified(profile, settings, segment = "all", resetTransaction = true) {
    if (resetTransaction) lastTransaction = [];
    const collections = {
      // siteProfile adds derived competitions/honors views for adapters. They
      // are not additional user collections and must not be filled a second time.
      all: GENERIC_REPEAT_SCHEMAS.map((schema) => schema.key),
      identity: [], basics: ["educations", "internships"], education: ["educations"],
      experience: ["internships"], projects: ["projects"], paper: ["papers"],
      achievements: ["papers", "awards", "programmingLanguages", "foreignLanguages", "certifications"],
      competitions: ["awards"], "achievement-tail": ["awards", "programmingLanguages", "foreignLanguages"],
      "self-evaluation": []
    };
    if (!Object.hasOwn(collections, segment)) throw new Error(`未知填写区块：${segment}`);
    const report = { suggestions: [], filled: [], skipped: [], conflicts: [], plannedRecords: {} };
    const merge = (part) => {
      for (const key of ["suggestions", "filled", "skipped", "conflicts"]) report[key].push(...(part[key] || []));
      Object.assign(report.plannedRecords, part.plannedRecords);
      report.requiresConfirmation ||= part.requiresConfirmation;
    };
    if (["all", "identity", "basics", "self-evaluation"].includes(segment)) {
      const flatProfile = segment === "self-evaluation" ? { ...profile, entries: profile.entries.filter(entry => entry.id === 'profile.self_evaluation' && globalThis.ResumeHelperCategories?.isFixedEntry(entry)) } : profile;
      merge(await fillFlatEntries(flatProfile, settings, false));
    }
    for (const collection of collections[segment]) {
      if (!profile.records?.[collection]?.length) continue;
      merge(await fillCollection(profile, settings, collection, false));
    }
    return collectionResult(report, segment);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "RESUME_HELPER_COMMAND") return false;
    const { command, payload } = message;
    (async () => {
      if (command === "scan") return scanOrFill(payload.profile, payload.settings, false);
      if (command === "fill") return fillUnified(payload.profile, payload.settings, "all", payload.resetTransaction !== false);
      if (command === "fillFlatEntries") return fillFlatEntries(payload.profile, payload.settings, Boolean(payload.resetTransaction));
      if (command === "fillStructuredSegment") {
        const adapter = payload.adapter || currentSite();
        const matches = { mokahr: isMokaStructuredPage, zhiye: isZhiyeStructuredPage, feishu: isFeishuStructuredPage };
        if (matches[adapter] && !matches[adapter]()) throw new Error("当前页面与所选结构化适配器不匹配。");
        return fillUnified(payload.profile, payload.settings, payload.segment || "all", Boolean(payload.resetTransaction));
      }
      if (command === "verify") return verify(payload.profile, payload.expectations, payload.documentToken, matchThreshold(payload.settings));
      if (command === "prepareTargeting" || command === "targetStatus") return targetStatus();
      if (command === "fillTarget") return fillSelectedTarget(payload.entry, Boolean(payload.forceOverwrite));
      if (command === "fillRecord") return fillRecord(payload.profile, payload.settings, payload.collection, payload.recordId, Boolean(payload.resetTransaction));
      if (command === "fillCollection") return fillCollection(payload.profile, payload.settings, payload.collection, Boolean(payload.resetTransaction));
      if (command === "undo") return undoLastFill();
      throw new Error(`未知命令：${command}`);
    })().then(sendResponse).catch((error) => sendResponse({ error: error?.message || String(error) }));
    return true;
  });
})();
