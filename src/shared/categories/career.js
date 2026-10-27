import { FIXED_FIELDS } from '../ordinary-fields.js';

export const careerCategory = {
  key: 'career', category: '求职偏好', title: '求职偏好', kind: 'single',
  entryTemplates: FIXED_FIELDS.filter(field => field.category === '求职偏好')
};
