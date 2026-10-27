import { field } from './common.js';

// Public metadata only. generic:false preserves historically unsupported fields.
export const foreignLanguagesCategory = {
  key: "foreignLanguages", category: "外语能力", title: "外语能力", prefix: "foreign", recordType: "foreignLanguage", kind: "record",
  fields: [
    field("language", "外语名称", ["语言","语种"], {"generic":{"aliases":["外语名称","语种","语言种类","外语语种","language"],"order":0}}),
    field("proficiency", "总体掌握程度", ["掌握程度","外语水平","语言水平"], {"enumOptions":["精通","熟练","熟悉","良好","一般","了解"],"generic":{"aliases":["外语水平","掌握程度","总体掌握程度","语言水平","proficiency","level"],"order":1}}),
    field("listeningSpeaking", "听说能力", ["听说","口语","听力"], {"generic":{"aliases":["听说能力","听说","口语","听力","listening","speaking"],"order":2}}),
    field("readingWriting", "读写能力", ["读写","阅读写作","阅读与写作"], {"generic":{"aliases":["读写能力","读写","阅读写作","reading","writing"],"order":3}})
  ],
  legacyEntries: {
  "language.cet6": [
    0,
    "certification"
  ],
  "language.cet6_score": [
    0,
    "score"
  ],
  "language.english_proficiency": [
    0,
    "proficiency"
  ]
},
  generic: { heading: new RegExp("^(外语能力|外语水平|语言能力|外语|foreign languages?)$", "i"), add: new RegExp("^(?:\\+\\s*)?(?:添加|新增)(?:一条|一项|一段)?\\s*(?:外语|语言|记录)?$|^add(?: another)?(?: language| record)?$", "i") },
  presentation(record) { return {
      label: record.language || "外语能力",
      summary: [
        record.language,
        record.proficiency,
        record.listeningSpeaking ? `听说：${record.listeningSpeaking}` : "",
        record.readingWriting ? `读写：${record.readingWriting}` : ""
      ].filter(Boolean).join("｜"),
      aliases: [record.language]
    }; }
};
