import { SCHEMA_VERSION, RECORD_COLLECTIONS } from '../shared/schema.js';

// The portable blank source has no personal rows; normalization projects the
// code-owned fixed catalog with empty values for the editor and working copy.
export const DEFAULT_PROFILE = {
  schemaVersion: SCHEMA_VERSION, name: '空白求职资料', updatedAt: '', source: '用户本地填写或导入',
  entries: [], records: Object.fromEntries(RECORD_COLLECTIONS.map(key => [key, []]))
};
