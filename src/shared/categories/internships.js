import { field, compact, dateRange } from './common.js';

// Public metadata only. generic:false preserves historically unsupported fields.
export const internshipsCategory = {
  key: "internships", category: "实习经历", title: "实习/工作经历", prefix: "internship", recordType: "internship", kind: "record",
  fields: [
    field("company", "公司名称", ["单位名称"], {"generic":{"aliases":["公司名称","单位名称","company","employer","organization"],"order":0}}),
    field("department", "部门", ["所在部门"], {"generic":false}),
    field("position", "职位名称", ["岗位名称"], {"generic":{"aliases":["职位名称","岗位名称","position","job title","role"],"order":1}}),
    field("location", "工作地点", ["实习地点"], {"generic":false}),
    field("start", "开始时间", ["入职时间"], {"type":"date","pathConfig":true,"generic":{"aliases":["开始时间","入职时间","start date","from"],"order":3}}),
    field("end", "结束时间", ["离职时间"], {"type":"date","pathConfig":true,"generic":{"aliases":["结束时间","离职时间","end date","to"],"order":4}}),
    field("skills", "使用技能", ["技术栈"], {"type":"textarea","generic":false}),
    field("description", "工作职责", ["经历描述","工作内容"], {"type":"textarea","generic":{"aliases":["经历描述及成果","工作内容","工作职责","description","responsibilities","achievements"],"order":2}}),
    field("refereeName", "证明人姓名", ["推荐人姓名"], {"generic":false}),
    field("refereeTitle", "证明人职务", ["推荐人职务"], {"generic":false}),
    field("refereePhone", "证明人电话", ["推荐人电话"], {"generic":false}),
    field("current", "是否至今", [], {"type":"checkbox","generic":false})
  ],
  legacyEntries: {
  "internship.company": [
    0,
    "company"
  ],
  "internship.department": [
    0,
    "department"
  ],
  "internship.position": [
    0,
    "position"
  ],
  "internship.location": [
    0,
    "location"
  ],
  "internship.referee_name": [
    0,
    "refereeName"
  ],
  "internship.referee_title": [
    0,
    "refereeTitle"
  ],
  "internship.referee_phone": [
    0,
    "refereePhone"
  ],
  "internship.description": [
    0,
    "description"
  ]
},
  generic: { heading: new RegExp("^(实习经历|工作经历|实习[/／、]工作经历|internship experience|work experience|employment)$", "i") },
  presentation(record) { return {
      label: [record.company, record.position].filter(Boolean).join("｜") || "实习经历",
      summary: [dateRange(record), [record.company, record.department, record.position].filter(Boolean).join("｜"), compact(record.description)].filter(Boolean).join("\n"),
      aliases: [record.company, record.department, record.position]
    }; }
};
