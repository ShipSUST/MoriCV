import { field, formatProfileDate } from './common.js';

// Public metadata only. generic:false preserves historically unsupported fields.
export const certificationsCategory = {
  key: "certifications", category: "资格证书", title: "资格证书", prefix: "cert", recordType: "certification", kind: "record",
  fields: [
    field("name", "证书名称", ["资格证书","证书","外语证书"], {"generic":{"aliases":["证书名称","资格证书","证书","certificate name"],"order":0}}),
    field("certType", "证书类别", ["证书类型","认证类型"], {"enumOptions":["外语","计算机","职业资格","其他"],"generic":{"aliases":["证书类别","证书类型","认证类型","certificate type"],"order":1}}),
    field("issuer", "发证机构", ["颁发机构","发证单位"], {"generic":{"aliases":["发证机构","颁发机构","发证单位","issuer"],"order":2}}),
    field("number", "证书编号", ["证书号"], {"generic":{"aliases":["证书编号","证书号","certificate number"],"order":3}}),
    field("obtainedAt", "取得时间", ["获证时间","发证日期","考试时间"], {"type":"date","generic":{"aliases":["取得时间","获证时间","发证日期","考试时间","date obtained"],"order":4}}),
    field("level", "结果等级", ["证书等级"], {"generic":{"aliases":["结果等级","证书等级","level"],"order":5}}),
    field("score", "分数", ["考试成绩","成绩"], {"generic":{"aliases":["分数","考试成绩","成绩","score"],"order":6}}),
    field("note", "备注", [], {"type":"textarea","generic":false})
  ],
  generic: { heading: new RegExp("^(资格证书|证书|证书信息|技能证书|职业资格|certificat(?:e|ion)s?)$", "i"), add: new RegExp("^(?:\\+\\s*)?(?:添加|新增)(?:一条|一项|一段)?\\s*(?:证书|资格|记录)?$|^add(?: another)?(?: certificate| record)?$", "i") },
  presentation(record) { return {
      label: record.name || "资格证书",
      summary: [record.name, record.level, record.score, formatProfileDate(record.obtainedAt), record.issuer].filter(Boolean).join("｜"),
      aliases: [record.name, record.certType]
    }; }
};
