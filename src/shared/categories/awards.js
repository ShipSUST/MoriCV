import { field, compact, formatProfileDate } from './common.js';

// Public metadata only. generic:false preserves historically unsupported fields.
export const awardsCategory = {
  key: "awards", category: "奖项荣誉", title: "奖项荣誉", prefix: "award", recordType: "award", kind: "record",
  fields: [
    field("name", "奖项名称", ["竞赛名称","荣誉名称","获奖名称"], {"generic":{"aliases":["荣誉名称","奖项名称","获奖名称","竞赛名称","award name","honor name"],"order":0}}),
    field("awardCategory", "奖项类别", ["获奖类别"], {"enumOptions":["竞赛获奖","荣誉称号"],"generic":false}),
    field("type", "奖项级别", ["竞赛级别","荣誉级别","获奖级别"], {"enumOptions":["国际级","国家级","省级","市级","校级","院级"],"generic":{"aliases":["奖项类型","荣誉类型","奖项级别","获奖级别","award type","award level"],"order":2}}),
    field("grade", "奖项等级", ["获奖等次"], {"generic":false}),
    field("result", "获奖结果", ["获奖等级","荣誉结果","竞赛成绩"], {"generic":{"aliases":["奖项成绩","获奖等级","奖项等级","获奖结果","award result"],"order":3}}),
    field("issuer", "颁奖单位", ["颁发单位","授予单位","主办单位"], {"generic":{"aliases":["颁奖单位","颁发单位","授予单位","主办单位","awarded by","issuer"],"order":4}}),
    field("start", "获奖时间", ["比赛时间","荣誉时间"], {"type":"date","generic":false}),
    field("end", "结束时间", [], {"type":"date","generic":false}),
    field("description", "奖项描述", ["获奖描述","荣誉描述"], {"type":"textarea","generic":{"aliases":["荣誉描述","奖项描述","获奖描述","竞赛描述","描述","award description","description"],"order":5}})
  ],
  generic: { heading: new RegExp("^(荣誉|荣誉奖项|奖项荣誉|奖项|获奖经历|竞赛|竞赛经历|竞赛获奖|竞赛、获奖与荣誉|awards?|honou?rs?)$", "i"), add: new RegExp("^(?:\\+\\s*)?(?:添加|新增)(?:一条|一项|一段)?\\s*(?:荣誉|奖项|获奖|竞赛|记录)?$|^add(?: another)?(?: award| honor| record)?$", "i"), legacyCollections: ["competitions","honors"], derivedFields: [{"key":"awardDate","aliases":["获奖时间","获奖日期","荣誉时间","颁发时间","award date","date received"],"order":1}] },
  presentation(record) { return {
      label: record.name || "奖项荣誉",
      summary: [
        [formatProfileDate(record.start || record.end), record.name, record.grade || record.result].filter(Boolean).join("｜"),
        compact(record.issuer), compact(record.description)
      ].filter(Boolean).join("\n"),
      aliases: [record.name, record.type, record.result]
    }; }
};
