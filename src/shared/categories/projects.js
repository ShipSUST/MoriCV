import { field, compact, dateRange } from './common.js';

// Public metadata only. generic:false preserves historically unsupported fields.
export const projectsCategory = {
  key: "projects", category: "项目经历", title: "项目经历", prefix: "project", recordType: "project", kind: "record",
  fields: [
    field("name", "项目名称", ["项目名"], {"generic":{"aliases":["项目名称","项目名","project name","project title"],"order":0}}),
    field("start", "开始时间", ["项目开始时间"], {"type":"date","generic":{"aliases":["开始时间","start date","from"],"order":3}}),
    field("end", "结束时间", ["项目结束时间"], {"type":"date","generic":{"aliases":["结束时间","end date","to"],"order":4}}),
    field("role", "项目职责", ["项目角色","职务"], {"generic":{"aliases":["项目中职责","项目职责","职责","project role","role","position"],"order":1}}),
    field("description", "项目描述及成果", ["项目描述","项目成果"], {"type":"textarea","generic":{"aliases":["项目描述及成果","项目描述","项目内容","project description","description","achievements"],"order":2}}),
    field("current", "是否至今", [], {"type":"checkbox","generic":false})
  ],
  generic: { heading: new RegExp("^(项目经历|项目经验|project experience|projects)$", "i") },
  presentation(record) { return {
      label: record.name || "项目经历",
      summary: [[dateRange(record), compact(record.role)].filter(Boolean).join("｜"), compact(record.description)].filter(Boolean).join("\n"),
      aliases: [record.name, record.role]
    }; }
};
