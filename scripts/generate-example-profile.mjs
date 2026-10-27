import { ordinaryEntryTemplates, createTemplateEntry } from '../src/shared/categories/templates.js';
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PROFILE } from "../src/data/default-profile.js";
import { validateProfile } from "../src/shared/storage.js";
import { toPortableProfile } from '../src/shared/ordinary-fields.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "src", "examples");
const outputPath = path.join(outputDirectory, "mori-cv-profile-example.json");

const profile = structuredClone(DEFAULT_PROFILE);
profile.entries = ordinaryEntryTemplates().map(template => createTemplateEntry(template.id));
profile.name = "Mori CV 匿名示例资料";
profile.updatedAt = "2026-09-20";
profile.source = "公开匿名示例；所有人物、学校、公司、项目、证件号码、联系方式和文件路径均为虚构";

const values = {
  "basic.name": "张三",
  "basic.name_pinyin": "Zhang San",
  "basic.given_name": "San",
  "basic.family_name": "Zhang",
  "basic.nationality": "中国",
  "basic.id_card": "11010120000101001X",
  "basic.gender": "男",
  "basic.birth_date": "2000-01-01",
  "basic.ethnicity": "汉族",
  "basic.political_status": "群众",
  "basic.party_join_date": "",
  "basic.graduation_date": "2024-06-20",
  "basic.highest_education_level": "硕士研究生",
  "basic.highest_academic_degree": "硕士",
  "basic.highest_study_type": "统招全日制",
  "basic.health_status": "良好",
  "basic.work_experience": "无",
  "basic.height": "175",
  "basic.weight": "65",
  "contact.phone": "13800000000",
  "contact.email": "zhangsan@example.com",
  "contact.wechat": "mori_cv_example",
  "location.home": "江苏省苏州市",
  "location.native_place": "江苏省苏州市",
  "location.birth_place": "江苏省南京市",
  "location.student_origin": "江苏省苏州市",
  "location.household": "江苏省苏州市",
  "location.current": "上海市",
  "location.school": "北京市",
  "basic.marital_status": "未婚",
  "contact.address": "上海市浦东新区示例路 100 号",
  "contact.home_address": "江苏省苏州市示例街道 1 号",
  "contact.emergency_name": "李四",
  "contact.emergency_phone": "13900000000",
  "relation.company": "否",
  "career.fresh_graduate": "是",
  "career.graduation_date": "2027-06-30",
  "career.expected_salary": "面议",
  "career.minimum_salary": "10000",
  "career.salary_negotiable": "面议",
  "career.internship_available": "是",
  "career.internship_start": "2026-07",
  "career.graduation_year": "2027",
  "hobby.summary": "长跑、摄影、阅读和开源项目实践。",
  "experience.campus_summary": "担任学院学生科技协会项目组成员，参与技术分享、活动组织和新成员培训。",
  "skills.certificates_summary": "大学英语六级；计算机技术与软件专业技术资格示例证书。",
  "profile.self_evaluation": "具备扎实的软件开发基础和持续学习能力，重视代码质量、事实核验与团队沟通，能够将复杂任务拆解并按计划交付。",
  "career.interview_city": "上海市",
  "career.adjustment": "是",
  "education.master.school": "示例大学",
  "education.master.degree": "硕士研究生",
  "education.master.type": "普通高等教育",
  "education.master.major": "计算机科学与技术",
  "education.master.college": "计算机学院",
  "education.bachelor.start_date": "2020-09-01",
  "education.bachelor.end_date": "2024-06-20",
  "education.master.start_date": "2024-09-01",
  "education.master.end_date": "2027-06-20",
  "education.master.gpa": "3.60/4.00",
  "education.master.rank": "前 20%",
  "education.master.research": "智能软件工程与机器学习系统",
  "education.bachelor.summary": "2020-09 至 2024-06，就读于示例科技大学软件工程专业，获工学学士学位。",
  "internship.company": "示例科技有限公司",
  "internship.department": "平台研发部",
  "internship.position": "软件开发实习生",
  "internship.location": "上海市",
  "internship.referee_name": "王老师",
  "internship.referee_title": "研发经理",
  "internship.referee_phone": "13700000000",
  "internship.period": "2025-07 至 2025-10",
  "internship.description": "参与内部数据平台的接口开发、自动化测试和使用文档整理，协助定位问题并跟进修复验证。",
  "profile.github": "https://github.com/example",
  "language.cet6": "CET-6",
  "language.cet6_score": "550",
  "language.english_proficiency": "能够阅读英文技术文档并进行日常工作沟通",
  "skills.summary": "编程语言：熟悉 Python、C/C++，了解 Java。\n工程工具：熟悉 Linux、Git、Conda 和常用调试工具。\n后端与数据：使用过 FastAPI、SQLite、MySQL、NumPy 和 Pandas。\nAI 基础：具备 PyTorch 模型训练、评估和部署实践。",
  "awards.summary": "2025年6月｜全国大学生软件创新大赛二等奖\n2024年12月｜示例大学优秀学生干部\n2024年5月｜示例大学程序设计竞赛一等奖"
};

const optionValues = {
  "basic.nationality": ["中国", "中华人民共和国"],
  "basic.gender": ["男", "男性"],
  "basic.ethnicity": ["汉族"],
  "basic.political_status": ["群众"],
  "career.fresh_graduate": ["是", "应届生"],
  "career.expected_salary": ["面议"],
  "basic.highest_education_level": ["硕士研究生", "硕士"],
  "basic.highest_study_type": ["统招全日制", "全日制"],
  "career.salary_negotiable": ["面议"],
  "career.internship_available": ["是"],
  "career.adjustment": ["是"],
  "education.master.degree": ["硕士研究生", "硕士"],
  "education.master.type": ["普通高等教育", "全日制"],
  "education.bachelor.start_date": ["2020年9月1日", "2020/09/01"],
  "education.bachelor.end_date": ["2024年6月20日", "2024/06/20"],
  "education.master.start_date": ["2024年9月1日", "2024/09/01"],
  "education.master.end_date": ["2027年6月20日", "2027/06/20"],
  "relation.company": ["否", "无"]
};

const pathValues = {
  "location.household": ["江苏省", "苏州市"],
  "location.current": ["上海市"],
  "location.school": ["北京市"]
};

for (const entry of profile.entries) {
  if (Object.hasOwn(values, entry.id)) entry.value = values[entry.id];
  if (Object.hasOwn(optionValues, entry.id)) entry.optionValues = optionValues[entry.id];
  if (Object.hasOwn(pathValues, entry.id)) entry.pathValues = pathValues[entry.id].map((level) => [level]);
}
// Anonymous manual notes illustrate the separate copy/target-only category.
for (const [id, label] of [['experience.campus_summary','校园工作经历'],['skills.certificates_summary','技能证书汇总'],['skills.summary','技能汇总'],['awards.summary','奖项荣誉汇总']]) {
  profile.entries.push({ id, category:'其他', label, value:values[id] });
}
profile.entries.push({id:'other.career_plan',category:'其他',label:'职业规划',value:'持续学习软件工程，参与有价值的技术项目。'});

profile.records = {
  educations: [
    {
      id: "education.example_master",
      school: "示例大学",
      college: "计算机学院",
      major: "计算机科学与技术",
      educationLevel: "硕士研究生",
      academicDegree: "硕士",
      studyType: "统招全日制",
      fieldOptions: { studyType: ["普通高等教育", "全日制"] },
      highest: "是",
      start: "2024-09-01",
      end: "2027-06-20",
      laboratory: "智能软件实验室",
      advisor: "陈老师",
      research: "智能软件工程与机器学习系统",
      rank: "前20%",
      gpa: "3.60/4.00"
    },
    {
      id: "education.example_bachelor",
      school: "示例科技大学",
      college: "软件学院",
      major: "软件工程",
      educationLevel: "本科",
      academicDegree: "学士",
      studyType: "统招全日制",
      fieldOptions: { studyType: ["普通高等教育", "全日制"] },
      highest: "否",
      start: "2020-09-01",
      end: "2024-06-20",
      research: "软件系统开发",
      rank: "前15%",
      gpa: "3.70/4.00"
    }
  ],
  internships: [
    {
      id: "internship.example_platform",
      company: "示例科技有限公司",
      department: "平台研发部",
      position: "软件开发实习生",
      location: "上海市",
      refereeName: "王老师",
      refereeTitle: "研发经理",
      refereePhone: "13700000000",
      skills: "Python、FastAPI、SQLite、Git",
      start: "2025-07",
      end: "2025-10",
      current: false,
      description: "参与内部数据平台的接口开发、自动化测试和使用文档整理，协助定位问题并跟进修复验证。"
    },
    {
      id: "internship.example_ai",
      company: "示例智能研究院",
      department: "算法工程组",
      position: "算法实习生",
      location: "北京市",
      skills: "Python、PyTorch、OpenCV",
      start: "2026-01",
      end: "2026-04",
      current: false,
      description: "协助完成图像分类模型的数据清洗、训练评估和推理脚本整理，并记录实验结果。"
    }
  ],
  projects: [
    {
      id: "project.example_resume_helper",
      name: "本地简历填写助手",
      start: "2026-03",
      end: "2026-06",
      current: false,
      role: "个人开发者",
      description: "开发离线浏览器扩展，使用字段别名、置信度匹配和平台适配器辅助填写招聘表单；数据仅保存在本机，不自动保存或提交。"
    },
    {
      id: "project.example_vision",
      name: "轻量级视觉检测系统",
      start: "2025-03",
      end: "2025-09",
      current: false,
      role: "算法负责人",
      description: "完成数据清洗、模型训练、指标评估和 ONNX 推理部署，在示例数据集上验证完整流程。"
    },
    {
      id: "project.example_data_platform",
      name: "课程数据分析平台",
      start: "2024-10",
      end: "2025-01",
      current: false,
      role: "后端开发",
      description: "使用 FastAPI、Pydantic 和 SQLite 构建数据导入、查询和统计接口，并编写接口测试与部署说明。"
    }
  ],
  papers: [
    {
      id: "paper.example_system",
      name: "An Example Study on Reliable Form Assistance",
      type: "会议论文（示例）",
      venue: "Example Conference on Form Assistance（虚构会议）",
      authorOrder: "第一作者",
      publishedAt: "2026-05-20",
      link: "https://example.com/paper",
      description: "用于展示论文结构化字段的虚构条目，不代表真实发表成果。"
    }
  ],
  awards: [
    {
      id: "competition.example_software",
      awardCategory: "竞赛获奖",
      name: "全国大学生软件创新大赛二等奖",
      start: "2025-06",
      end: "2025-06",
      current: false,
      type: "国家级",
      grade: "二等奖",
      result: "二等奖",
      issuer: "示例竞赛组委会",
      description: "以课程数据分析平台参赛，负责后端接口、数据处理和演示材料整理。"
    },
    {
      id: "competition.example_programming",
      awardCategory: "竞赛获奖",
      name: "示例大学程序设计竞赛一等奖",
      start: "2024-05",
      end: "2024-05",
      current: false,
      type: "校级",
      grade: "一等奖",
      result: "一等奖",
      issuer: "示例大学教务处",
      description: "完成算法设计、编码与现场调试。"
    },
    {
      id: "honor.example_student_leader",
      awardCategory: "荣誉称号",
      name: "示例大学优秀学生干部",
      start: "2024-12",
      type: "校级",
      result: "优秀学生干部",
      issuer: "示例大学",
      description: "因学生工作和志愿服务表现获评校级优秀学生干部。"
    }
  ],
  programmingLanguages: [
    { id: "language.example_python", name: "Python", level: "熟悉" },
    { id: "language.example_java", name: "Java", level: "了解" },
    { id: "language.example_c", name: "C", level: "熟悉" },
    { id: "language.example_cpp", name: "C++", level: "熟悉" },
    { id: "language.example_matlab", name: "Matlab", level: "熟悉" },
    { id: "language.example_linux", name: "Linux", level: "熟悉" }
  ],
  foreignLanguages: [
    {
      id: "foreign.example_english",
      language: "英语",
      proficiency: "熟练",
      listeningSpeaking: "能够进行日常工作沟通",
      readingWriting: "能够阅读和撰写英文技术文档"
    }
  ],
  certifications: [
    {
      id: "cert.example_cet6",
      name: "CET-6",
      certType: "外语",
      issuer: "教育部教育考试院",
      obtainedAt: "2022-06",
      score: "550"
    },
    {
      id: "cert.example_software",
      name: "计算机技术与软件专业技术资格（示例）",
      certType: "计算机",
      obtainedAt: "2023-11",
      level: "合格"
    }
  ],
  relationships: [
    {
      id: "relative.example_father",
      relation: "父亲",
      name: "张大明",
      gender: "男",
      birthDate: "1970-03-15",
      employer: "示例制造有限公司",
      jobTitle: "工程师",
      employed: "在岗",
      politicalStatus: "群众"
    },
    {
      id: "relative.example_mother",
      relation: "母亲",
      name: "王小红",
      gender: "女",
      birthDate: "1972-08-20",
      employer: "示例市第一中学",
      jobTitle: "教师",
      employed: "在岗",
      politicalStatus: "中共党员"
    }
  ]
};

validateProfile(profile);
await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(toPortableProfile(profile), null, 2)}\n`, "utf8");
console.log(`Generated anonymous example profile: ${outputPath}`);
