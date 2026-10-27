import { CATEGORY_SCHEMA } from '../schema.js';

// This catalogue is metadata, never a fallback source for an operation's data.
export function ordinaryEntryTemplates(category) {
  return structuredClone(CATEGORY_SCHEMA.filter(item => item.kind === 'single' && (!category || item.category === category))
    .flatMap(item => item.entryTemplates || []));
}

export function createTemplateEntry(id, category) {
  const template = ordinaryEntryTemplates().find(item => item.id === id);
  if (!template) throw new Error('字段模板不存在。');
  const target = category || template.category;
  if (target !== template.category) throw new Error('固定字段分类不能更改。');
  return { ...template, category: target, value: '', optionValues: [] };
}
