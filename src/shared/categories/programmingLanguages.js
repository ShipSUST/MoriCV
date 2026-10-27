import { field } from './common.js';

// Public metadata only. generic:false preserves historically unsupported fields.
export const programmingLanguagesCategory = {
  key: "programmingLanguages", category: "技术技能", title: "技术技能", prefix: "skill", recordType: "skill", kind: "record",
  fields: [
    field("name", "技能名称", ["编程语言"], {"generic":{"aliases":["技能名称","语言名称","编程语言名称","技能","skill name","language"],"order":0}}),
    field("level", "掌握程度", ["熟练程度"], {"enumOptions":["精通","熟练","熟悉","良好","一般","了解"],"generic":{"aliases":["掌握程度","熟练程度","技能水平","水平","proficiency","level"],"order":1}})
  ],
  generic: { heading: new RegExp("^(技术技能|专业技能|技能|编程语言能力|编程语言|语言能力|technical skills?|programming languages?|skills?)$", "i"), add: new RegExp("^(?:\\+\\s*)?(?:添加|新增)(?:一条|一项|一段)?\\s*(?:技能|编程语言|语言|记录)?$|^add(?: another)?(?: skill| language| record)?$", "i") },
  presentation(record) { return {
      label: record.name || "技能",
      summary: [record.name, record.level].filter(Boolean).join("｜"),
      aliases: [record.name, record.level]
    }; }
};
