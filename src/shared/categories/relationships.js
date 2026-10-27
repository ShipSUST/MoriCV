import { field, fieldSummary } from './common.js';

// Public metadata only. generic:false preserves historically unsupported fields.
export const relationshipsCategory = {
  key: "relationships", category: "亲属关系", title: "亲属关系", prefix: "relative", recordType: "relationship", kind: "record",
  fields: [
    field("relation", "关系", ["与本人关系","亲属关系","称谓","家庭成员关系","relationship"], {"enumOptions":["父亲","母亲","配偶","儿子","女儿","兄弟","姐妹","祖父","祖母","外祖父","外祖母","其他"],"generic":{"aliases":["关系","与本人关系","亲属关系","称谓","relationship"],"order":0}}),
    field("name", "姓名", ["亲属姓名","家庭成员姓名","成员姓名"], {"generic":{"aliases":["姓名","亲属姓名","家庭成员姓名","联系人姓名","name"],"order":1}}),
    field("phone", "亲属电话", ["亲属联系电话","家庭成员电话","联系电话","电话号码","电话","手机号码","phone","telephone"]),
    field("gender", "性别", ["亲属性别"], {"enumOptions":["男","女"],"generic":{"aliases":["性别","亲属性别","gender"],"order":2}}),
    field("birthDate", "出生日期", ["出生年月","生日"], {"type":"date","generic":{"aliases":["出生日期","出生年月","生日","date of birth"],"order":3}}),
    field("employer", "工作单位", ["单位名称","所在单位"], {"generic":{"aliases":["工作单位","单位名称","所在单位","employer"],"order":4}}),
    field("jobTitle", "职务名称", ["职务","职位"], {"generic":{"aliases":["职务名称","职务","职位","job title"],"order":5}}),
    field("employed", "是否在岗", ["在岗状态","是否在职"], {"enumOptions":["在岗","退休","离职","无业"],"generic":{"aliases":["是否在岗","在岗状态","是否在职","employment status"],"order":6}}),
    field("politicalStatus", "政治面貌", ["亲属政治面貌"], {"enumOptions":["中共党员","中共预备党员","共青团员","民主党派","群众"],"generic":{"aliases":["政治面貌","亲属政治面貌","political status"],"order":7}})
  ],
  generic: { heading: new RegExp("^(亲属关系|家庭成员|家庭情况|主要家庭成员|紧急联系人|family members?|relationships?|emergency contacts?)$", "i"), add: new RegExp("^(?:\\+\\s*)?(?:添加|新增)(?:一条|一项|一位)?\\s*(?:亲属|家庭成员|联系人|记录)?$|^add(?: another)?(?: family member| relationship| contact| record)?$", "i") },
  presentation(record) { return {
      label: [record.relation, record.name].filter(Boolean).join('｜') || '亲属',
      summary: fieldSummary(this.fields, record), aliases: [record.relation, record.name]
    }; }
};
