import { field, dateRange } from './common.js';

// Public metadata only. generic:false preserves historically unsupported fields.
export const educationsCategory = {
  key: "educations", category: "教育经历", title: "教育经历", prefix: "education", recordType: "education", kind: "record",
  fields: [
    field("school", "学校名称", ["毕业院校","院校名称"], {"generic":{"aliases":["学校名称","毕业院校","院校名称","school","university"],"order":0}}),
    field("college", "院系名称", ["学院","院系"], {"generic":{"aliases":["学院","院系","college","department"],"order":1}}),
    field("major", "专业名称", ["所学专业","专业"], {"generic":{"aliases":["专业名称","所学专业","专业","major","discipline","field of study"],"order":2}}),
    field("educationLevel", "学历", ["学历层次","教育程度"], {"generic":{"aliases":["学历","education level"],"order":3}}),
    field("academicDegree", "学位", ["学位名称","学位层次"], {"generic":{"aliases":["学位","academic degree","degree"],"order":4}}),
    field("studyType", "学习形式", ["教育类型","学历类型","培养方式","统招方式"], {"enumOptions":["全日制","非全日制"],"generic":{"aliases":["学习形式","教育类型","学历类型","培养方式","统招方式"],"order":5}}),
    field("highest", "是否最高学历", ["最高学历"], {"enumOptions":["是","否"],"generic":false}),
    field("start", "入学时间", ["开始时间"], {"type":"date","pathConfig":true,"generic":{"aliases":["开始时间","入学时间","start date","from"],"order":13}}),
    field("end", "毕业时间", ["结束时间"], {"type":"date","pathConfig":true,"generic":{"aliases":["结束时间","毕业时间","end date","to"],"order":14}}),
    field("laboratory", "实验室", ["实验室名称"], {"generic":{"aliases":["实验室","实验室名称"],"order":6}}),
    field("advisor", "导师", ["导师姓名"], {"generic":{"aliases":["导师","导师姓名"],"order":7}}),
    field("research", "研究方向", ["研究领域"], {"type":"textarea","generic":{"aliases":["研究方向","研究领域","领域方向"],"order":8}}),
    field("rank", "专业排名", ["成绩排名"], {"generic":{"aliases":["专业排名","成绩排名"],"order":10}}),
    field("gpa", "GPA", ["平均绩点"], {"generic":{"aliases":["GPA","平均绩点"],"order":9}}),
    field("unifiedExamScore", "统考成绩", ["统考初试成绩","考研初试成绩"], {"generic":{"aliases":["统考成绩","统考初试成绩","考研初试成绩"],"order":11}}),
    field("professionalCourses", "专业课程", ["主修课程","专业课","所学课程"], {"type":"textarea","generic":{"aliases":["专业课程","主修课程","专业课","所学课程"],"order":12}})
  ],
  legacyEntries: {
  "education.master.school": [
    "education.master",
    "school"
  ],
  "education.master.degree": [
    "education.master",
    "degree"
  ],
  "education.master.type": [
    "education.master",
    "studyType"
  ],
  "education.master.major": [
    "education.master",
    "major"
  ],
  "education.master.college": [
    "education.master",
    "college"
  ],
  "education.master.start_date": [
    "education.master",
    "start"
  ],
  "education.master.end_date": [
    "education.master",
    "end"
  ],
  "education.master.gpa": [
    "education.master",
    "gpa"
  ],
  "education.master.rank": [
    "education.master",
    "rank"
  ],
  "education.master.research": [
    "education.master",
    "research"
  ],
  "education.bachelor.start_date": [
    "education.bachelor",
    "start"
  ],
  "education.bachelor.end_date": [
    "education.bachelor",
    "end"
  ],
  "education.bachelor.summary": [
    "education.bachelor",
    "summary"
  ]
},
  generic: { heading: new RegExp("^(教育经历|教育背景|education|education experience)$", "i") },
  presentation(record) { return {
      label: [record.school, record.educationLevel].filter(Boolean).join("｜") || "教育经历",
      summary: [
        dateRange(record),
        [record.school, record.college].filter(Boolean).join("｜"),
        [record.educationLevel, record.academicDegree, record.major].filter(Boolean).join("｜"),
        [record.research && `研究方向：${record.research}`, record.gpa && `GPA：${record.gpa}`, record.rank && `排名：${record.rank}`].filter(Boolean).join("；")
      ].filter(Boolean).join("\n"),
      aliases: [record.school, record.college, record.major, record.educationLevel, record.academicDegree]
    }; }
};
