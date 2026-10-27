// One public metadata contract shared by ESM consumers and the classic content script.
export function compileCategoryContract(categories) {
  return categories.filter(category => category.kind === 'record' && category.generic).map(category => {
    const { heading, add, legacyCollections, derivedFields = [] } = category.generic;
    const fields = [...category.fields.filter(item => item.type !== 'checkbox' && item.generic !== false).map(item => ({
      key: item.key, aliases: item.generic?.aliases || [item.label, ...(item.aliases || [])], order: item.generic?.order ?? Infinity
    })), ...derivedFields].sort((a, b) => a.order - b.order).map(({ key, aliases }) => ({ key, aliases: [...aliases] }));
    return { key: category.key, heading: { source: heading.source, flags: heading.flags },
      ...(add ? { add: { source: add.source, flags: add.flags } } : {}),
      ...(legacyCollections ? { legacyCollections: [...legacyCollections] } : {}), fields };
  });
}

// Self-contained so the generated classic bridge runs without import/eval.
export function hydrateCategoryContract(contract, ordinaryFields = []) {
  const fixedFields = ordinaryFields.map(field => ({ ...field, aliases: [...field.aliases] }));
  const fixedField = id => fixedFields.find(field => field.id === id);
  const isFixedEntry = entry => Boolean(entry && fixedField(entry.id)?.category === entry.category);
  return { fixedFields, fixedField, isFixedEntry, repeatSchemas: contract.map(item => ({
    key: item.key, heading: new RegExp(item.heading.source, item.heading.flags),
    ...(item.add ? { add: new RegExp(item.add.source, item.add.flags) } : {}),
    ...(item.legacyCollections ? { records: profile => profile.records?.[item.key]
      || item.legacyCollections.flatMap(key => profile.records?.[key] || []) } : {}),
    fields: item.fields.map(field => ({ key: field.key, aliases: [...field.aliases] }))
  })) };
}
