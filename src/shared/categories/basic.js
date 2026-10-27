import { FIXED_FIELDS } from '../ordinary-fields.js';

export const basicCategory = {
  key: 'basic', category: '基本信息', title: '基本信息', kind: 'single',
  entryTemplates: FIXED_FIELDS.filter(field => field.category === '基本信息')
};
