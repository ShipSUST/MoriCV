import { DEFAULT_PROFILE } from '../src/data/default-profile.js';
import { ordinaryEntryTemplates, createTemplateEntry } from '../src/shared/categories/templates.js';

// Explicit anonymous test setup. Production never seeds these entries.
export function anonymousTemplateProfile() {
  const profile = structuredClone(DEFAULT_PROFILE);
  profile.entries = ordinaryEntryTemplates().map(template => createTemplateEntry(template.id));
  return profile;
}
