// Program-owned vocabulary. Personal values and selection configuration live only in JSON.
export const FIXED_FIELDS = Object.freeze([
  {
    "id": "basic.name",
    "category": "基本信息",
    "label": "姓名",
    "aliases": [
      "姓名",
      "中文姓名",
      "真实姓名",
      "name",
      "full name"
    ],
    "type": "text",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "basic.name_pinyin",
    "category": "基本信息",
    "label": "姓名拼音",
    "aliases": [
      "姓名拼音",
      "姓名拼音（如:Li Xiaolong/Li Lin)",
      "name pinyin",
      "pinyin name"
    ],
    "type": "text",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "basic.given_name",
    "category": "基本信息",
    "label": "英文名",
    "aliases": [
      "英文名",
      "first name",
      "given name",
      "legal first name",
      "preferred first name",
      "forename"
    ],
    "type": "text",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "basic.family_name",
    "category": "基本信息",
    "label": "英文姓",
    "aliases": [
      "英文姓",
      "last name",
      "family name",
      "legal last name",
      "surname"
    ],
    "type": "text",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "basic.nationality",
    "category": "基本信息",
    "label": "国籍地区",
    "aliases": [
      "国籍地区",
      "国籍",
      "国家",
      "国家或地区",
      "国籍/地区",
      "nationality",
      "country",
      "country or region",
      "citizenship"
    ],
    "type": "choice",
    "supportsOptions": true,
    "supportsPath": false
  },
  {
    "id": "basic.id_card",
    "category": "基本信息",
    "label": "身份证号",
    "aliases": [
      "身份证号",
      "身份证号码",
      "证件号码",
      "证件号",
      "id card",
      "identity number"
    ],
    "type": "text",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "basic.gender",
    "category": "基本信息",
    "label": "性别",
    "aliases": [
      "性别",
      "gender",
      "sex"
    ],
    "type": "choice",
    "supportsOptions": true,
    "supportsPath": false
  },
  {
    "id": "basic.birth_date",
    "category": "基本信息",
    "label": "出生日期",
    "aliases": [
      "出生日期",
      "出生年月日",
      "生日",
      "出生年月",
      "date of birth",
      "birth date",
      "birthday"
    ],
    "type": "date",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "basic.ethnicity",
    "category": "基本信息",
    "label": "民族",
    "aliases": [
      "民族",
      "ethnicity",
      "ethnic group"
    ],
    "type": "choice",
    "supportsOptions": true,
    "supportsPath": false
  },
  {
    "id": "basic.political_status",
    "category": "基本信息",
    "label": "政治面貌",
    "aliases": [
      "政治面貌",
      "政治身份",
      "political status"
    ],
    "type": "choice",
    "supportsOptions": true,
    "supportsPath": false
  },
  {
    "id": "basic.party_join_date",
    "category": "基本信息",
    "label": "加入党派时间",
    "aliases": [
      "加入党派时间",
      "入党时间",
      "加入党组织时间"
    ],
    "type": "date",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "contact.phone",
    "category": "基本信息",
    "label": "手机号",
    "aliases": [
      "手机号",
      "手机号码",
      "联系电话",
      "移动电话",
      "mobile",
      "phone",
      "phone number"
    ],
    "type": "text",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "contact.email",
    "category": "基本信息",
    "label": "电子邮箱",
    "aliases": [
      "电子邮箱",
      "邮箱",
      "联系邮箱",
      "email",
      "e-mail"
    ],
    "type": "text",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "contact.wechat",
    "category": "基本信息",
    "label": "微信号",
    "aliases": [
      "微信号",
      "微信",
      "wechat",
      "wechat id"
    ],
    "type": "text",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "location.home",
    "category": "基本信息",
    "label": "家庭所在地",
    "aliases": [
      "家庭所在地",
      "家庭所在城市",
      "home city",
      "family location"
    ],
    "type": "region",
    "supportsOptions": true,
    "supportsPath": true
  },
  {
    "id": "location.household",
    "category": "基本信息",
    "label": "户口所在地",
    "aliases": [
      "户口所在地",
      "户籍所在地",
      "户籍省市",
      "household registration",
      "hukou"
    ],
    "type": "region",
    "supportsOptions": true,
    "supportsPath": true
  },
  {
    "id": "location.native_place",
    "category": "基本信息",
    "label": "籍贯",
    "aliases": [
      "籍贯",
      "native place"
    ],
    "type": "region",
    "supportsOptions": true,
    "supportsPath": true
  },
  {
    "id": "location.birth_place",
    "category": "基本信息",
    "label": "出生地",
    "aliases": [
      "出生地",
      "出生地点",
      "place of birth"
    ],
    "type": "region",
    "supportsOptions": true,
    "supportsPath": true
  },
  {
    "id": "location.student_origin",
    "category": "基本信息",
    "label": "生源地",
    "aliases": [
      "生源地",
      "生源所在地",
      "student origin"
    ],
    "type": "region",
    "supportsOptions": true,
    "supportsPath": true
  },
  {
    "id": "basic.graduation_date",
    "category": "基本信息",
    "label": "毕业时间",
    "aliases": [
      "毕业时间",
      "毕业日期",
      "实际毕业时间",
      "actual graduation date"
    ],
    "type": "date",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "basic.highest_education_level",
    "category": "基本信息",
    "label": "最高学历",
    "aliases": [
      "最高学历",
      "全日制最高学历",
      "最高全日制学历"
    ],
    "type": "choice",
    "supportsOptions": true,
    "supportsPath": false
  },
  {
    "id": "basic.highest_academic_degree",
    "category": "基本信息",
    "label": "最高学位",
    "aliases": [
      "最高学位",
      "全日制最高学位",
      "最高全日制学位"
    ],
    "type": "choice",
    "supportsOptions": true,
    "supportsPath": false
  },
  {
    "id": "basic.highest_study_type",
    "category": "基本信息",
    "label": "最高学历学习形式",
    "aliases": [
      "最高学历学习形式",
      "最高学历教育形式"
    ],
    "type": "choice",
    "supportsOptions": true,
    "supportsPath": false
  },
  {
    "id": "location.current",
    "category": "基本信息",
    "label": "现居住城市",
    "aliases": [
      "现居住城市",
      "现居城市",
      "现所在地",
      "当前城市",
      "current city",
      "current location"
    ],
    "type": "region",
    "supportsOptions": true,
    "supportsPath": true
  },
  {
    "id": "location.school",
    "category": "基本信息",
    "label": "学校所在地",
    "aliases": [
      "学校所在地",
      "院校所在地",
      "就读院校所在城市",
      "school location",
      "university city"
    ],
    "type": "region",
    "supportsOptions": true,
    "supportsPath": true
  },
  {
    "id": "basic.marital_status",
    "category": "基本信息",
    "label": "婚姻状况",
    "aliases": [
      "婚姻状况",
      "婚姻状态",
      "marital status"
    ],
    "type": "choice",
    "supportsOptions": true,
    "supportsPath": false
  },
  {
    "id": "basic.health_status",
    "category": "基本信息",
    "label": "健康状况",
    "aliases": [
      "健康状况",
      "健康情况",
      "health status"
    ],
    "type": "choice",
    "supportsOptions": true,
    "supportsPath": false
  },
  {
    "id": "contact.address",
    "category": "基本信息",
    "label": "通信地址",
    "aliases": [
      "通信地址",
      "联系地址",
      "通讯地址",
      "现居住地址",
      "mailing address",
      "contact address"
    ],
    "type": "text",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "contact.emergency_name",
    "category": "基本信息",
    "label": "紧急联系人",
    "aliases": [
      "紧急联系人",
      "紧急联络人",
      "emergency contact",
      "emergency contact name"
    ],
    "type": "text",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "contact.emergency_phone",
    "category": "基本信息",
    "label": "紧急联系人电话",
    "aliases": [
      "紧急联系人电话",
      "紧急联系电话",
      "紧急联络人电话",
      "emergency contact phone"
    ],
    "type": "text",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "hobby.summary",
    "category": "基本信息",
    "label": "兴趣爱好",
    "aliases": [
      "兴趣爱好",
      "爱好",
      "hobbies"
    ],
    "type": "textarea",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "basic.work_experience",
    "category": "基本信息",
    "label": "工作经验",
    "aliases": [
      "工作经验",
      "工作年限",
      "work experience"
    ],
    "type": "choice",
    "supportsOptions": true,
    "supportsPath": false
  },
  {
    "id": "contact.home_address",
    "category": "基本信息",
    "label": "家庭地址",
    "aliases": [
      "家庭地址",
      "家庭详细地址",
      "home address"
    ],
    "type": "text",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "basic.height",
    "category": "基本信息",
    "label": "身高",
    "aliases": [
      "身高",
      "height"
    ],
    "type": "number",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "basic.weight",
    "category": "基本信息",
    "label": "体重",
    "aliases": [
      "体重",
      "weight"
    ],
    "type": "number",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "profile.self_evaluation",
    "category": "基本信息",
    "label": "自我评价",
    "aliases": [
      "自我评价",
      "自我描述",
      "个人评价",
      "个人总结"
    ],
    "type": "textarea",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "career.fresh_graduate",
    "category": "求职偏好",
    "label": "是否为应届毕业生",
    "aliases": [
      "是否为应届毕业生",
      "是否应届",
      "应届生",
      "fresh graduate"
    ],
    "type": "choice",
    "supportsOptions": true,
    "supportsPath": false
  },
  {
    "id": "career.graduation_date",
    "category": "求职偏好",
    "label": "预计毕业日期",
    "aliases": [
      "预计毕业日期",
      "预计毕业时间",
      "expected graduation",
      "expected graduation date"
    ],
    "type": "date",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "career.expected_salary",
    "category": "求职偏好",
    "label": "期望薪资",
    "aliases": [
      "期望薪资",
      "期望薪酬",
      "期望月薪",
      "expected salary"
    ],
    "type": "choice",
    "supportsOptions": true,
    "supportsPath": false
  },
  {
    "id": "career.internship_available",
    "category": "求职偏好",
    "label": "是否可安排实习",
    "aliases": [
      "是否可安排实习",
      "可否安排实习",
      "是否可以实习",
      "是否接受实习",
      "internship availability"
    ],
    "type": "choice",
    "supportsOptions": true,
    "supportsPath": false
  },
  {
    "id": "career.internship_start",
    "category": "求职偏好",
    "label": "实习预计时间",
    "aliases": [
      "实习预计时间",
      "预计实习时间",
      "可开始实习时间",
      "internship start date"
    ],
    "type": "date",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "career.graduation_year",
    "category": "求职偏好",
    "label": "毕业年份",
    "aliases": [
      "毕业年份",
      "毕业年"
    ],
    "type": "year",
    "supportsOptions": false,
    "supportsPath": false
  },
  {
    "id": "career.interview_city",
    "category": "求职偏好",
    "label": "意向面试地点",
    "aliases": [
      "意向面试地点",
      "面试城市",
      "面试地点",
      "interview city"
    ],
    "type": "region",
    "supportsOptions": true,
    "supportsPath": true
  },
  {
    "id": "career.adjustment",
    "category": "求职偏好",
    "label": "是否接受岗位调剂",
    "aliases": [
      "是否接受岗位调剂",
      "是否接受调剂",
      "岗位调剂",
      "position adjustment"
    ],
    "type": "choice",
    "supportsOptions": true,
    "supportsPath": false
  }
].map(field => Object.freeze({ ...field, aliases: Object.freeze(field.aliases) })));

const BY_ID = new Map(FIXED_FIELDS.map(field => [field.id, field]));
export function fixedField(id) { return BY_ID.get(id) || null; }
export function isFixedEntry(entry) { return Boolean(entry && fixedField(entry.id)?.category === entry.category); }

// Strip program vocabulary at every file/export boundary. Records remain user JSON.
export function toPortableProfile(profile) {
  const result = structuredClone(profile);
  if (!Array.isArray(result?.entries)) return result;
  result.entries = result.entries.map(entry => {
    const field = fixedField(entry.id);
    if (!field) return { id: entry.id, category: '其他', label: entry.label, value: entry.value };
    return {
      id: field.id, value: entry.value,
      ...(field.supportsOptions && entry.optionValues?.length ? { optionValues: structuredClone(entry.optionValues) } : {}),
      ...(field.supportsPath && entry.pathValues?.length ? { pathValues: structuredClone(entry.pathValues) } : {})
    };
  });
  return result;
}
