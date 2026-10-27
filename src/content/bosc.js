// Public Shanghai Bank contracts. No built-in personal values or component writes.
(function installBoscContracts() {
  'use strict';
  const basicLabels = ['姓名','民族','籍贯（具体到市/区）'];
  const basicFields = ['姓名','性别','证件号码','出生日期','政治面貌','政治面貌参加年月','国籍','民族',
    '籍贯（具体到市/区）','出生地','出生地（单选）','生源地','户口所在地','现居住地址','手机号码','邮箱',
    '毕业时间','全日制最高学历','全日制最高学位','最高学历学习形式','婚姻状况','健康状况','身高(厘米)',
    '体重(公斤)','紧急联系人','紧急联系电话','从何处获得此招聘信息','个人特长和爱好'];
  const records = {
    foreignLanguages: { title:'语言能力',labels:['语言类型','证书名称','颁发单位','获证日期','成绩','掌握程度'],
      fields:[['language','语言类型'],['proficiency','掌握程度']] },
    certifications: { title:'证书',labels:['证书种类','证书名称','颁发机构','获得时间'],
      fields:[['name','证书名称'],['certType','证书种类'],['issuer','颁发机构'],['obtainedAt','获得时间','day']] },
    internships: { title:'实习经历',labels:['开始时间','结束时间','单位名称','实习地点','部门','岗位','实习内容及收获'],
      fields:[['company','单位名称'],['department','部门'],['position','岗位'],['description','实习内容及收获'],['location','实习地点'],['start','开始时间','month'],['end','结束时间','month']] },
    papers: { title:'论文/专著',labels:['名称','所属期刊','发布时间','主要内容','作者顺序','个人主要贡献'],
      fields:[['name','名称'],['venue','所属期刊'],['authorOrder','作者顺序'],['description','个人主要贡献'],['publishedAt','发布时间','day']] },
    relationships: { title:'家庭情况',labels:['称谓','姓名','出生日期','政治面貌','工作单位','工作部门','职务'],
      fields:[['relation','称谓'],['name','姓名'],['birthDate','出生日期','day'],['politicalStatus','政治面貌'],['employer','工作单位'],['jobTitle','职务']] },
    educations: { title:'教育经历',labels:['开始时间','结束时间','学习形式','学历','学位','院校类别','学校名称','学院名称','专业类别','专业名称','满绩点/总分','平均绩点/平均分','成绩排名'],
      fields:[['school','学校名称'],['college','学院名称'],['major','专业名称'],['educationLevel','学历'],['academicDegree','学位'],['studyType','学习形式'],['start','开始时间','month'],['end','结束时间','month'],['gpa','平均绩点/平均分'],['rank','成绩排名']] },
    awards: { title:'获奖情况', labels:['获奖级别','获奖项','授奖单位','获奖时间'], fields:[['name','获奖项'],['type','获奖级别'],['issuer','授奖单位'],['start','获奖时间','day']] }
  };
  const flatAliases = {
    '籍贯（具体到市/区）':['籍贯'], '出生地（单选）':['出生地'],
    '政治面貌参加年月':['加入党派时间'], '毕业时间':['毕业日期'],
    '身高(厘米)':['身高','身高(CM)'], '体重(公斤)':['体重'],
    '紧急联系电话':['紧急联系人电话','紧急联系方式'], '现居住地址':['现居地址','现居住地'],
    '个人特长和爱好':['兴趣爱好','特长爱好'], '从何处获得此招聘信息':['招聘信息来源','信息来源']
  };
  const ownsUrl = () => location.pathname === '/form' && (location.hostname === 'bosc.zhiye.com'
    || (location.hostname === '127.0.0.1' && document.documentElement.dataset.boscAnonymous === 'form-v1'));
  const label = element => element?.closest?.('.form-item')?.querySelector('.form-item__title > label')?.textContent.trim() || '';
  const headings = title => ownsUrl() ? Array.from(document.querySelectorAll('div[id]'))
    .filter(node => !node.matches('div.form') && node.textContent.trim() === title) : [];
  function forms(title,labels) {
    const titles = headings(title);
    if (titles.length !== 1) return [];
    return Array.from(document.querySelectorAll('.ux-standard-form > div.form[id]')).filter(form => form.id === titles[0].id
      && labels.every(text => {
        const items = Array.from(form.querySelectorAll('.form-item')).filter(item => item.querySelector('.form-item__title > label')?.textContent.trim() === text);
        return items.length === 1 && items[0].querySelectorAll('input:not([type=hidden]),textarea,select,[contenteditable=true]').length <= 1;
      }));
  }
  const basicForms = () => forms('个人信息',basicLabels);
  const ownsPage = () => basicForms().length === 1;
  const recordForms = key => records[key] ? forms(records[key].title,records[key].labels) : [];
  const ownsRecord = element => ownsPage() && Object.keys(records).some(key=>recordForms(key).includes(element));
  const ownsControl = element => {
    if(!ownsPage())return false;
    const form=element?.closest?.('.ux-standard-form > div.form[id]'),text=label(element);
    if(!form||!text)return false;
    const items=Array.from(form.querySelectorAll('.form-item')).filter(item=>item.querySelector('.form-item__title > label')?.textContent.trim()===text);
    if(items.length!==1||items[0].querySelectorAll('input:not([type=hidden]),textarea,select,[contenteditable=true]').length>1)return false;
    if(basicForms().includes(form))return basicFields.includes(text);
    return Object.keys(records).some(key=>recordForms(key).includes(form)&&records[key].fields.some(field=>field[1]===text));
  };
  // Explicit targeting may use an unmodeled plain field, never a search box or
  // compound widget. Automatic matching continues to require ownsControl.
  const ownsPlainTarget = element => {
    if(!ownsPage() || element.disabled || element.readOnly || element.closest('.phoenix-select,[role=combobox],[aria-haspopup]')) return false;
    if(!element.matches('textarea,input:not([type]),input[type=text],input[type=email],input[type=tel],input[type=url],input[type=number],[contenteditable=true]')) return false;
    const form=element.closest('.ux-standard-form > div.form[id]'),text=label(element);
    if(!form||!text||Array.from(document.querySelectorAll('.ux-standard-form > div.form[id]')).filter(item=>item.id===form.id).length!==1)return false;
    const items=Array.from(form.querySelectorAll('.form-item')).filter(item=>item.querySelector('.form-item__title > label')?.textContent.trim()===text);
    return items.length===1&&items[0].querySelectorAll('input:not([type=hidden]),textarea,select,[contenteditable=true]').length===1;
  };
  function datePrecision(element) {
    if(!ownsControl(element))return '';
    if(basicForms().includes(element.closest('.ux-standard-form > div.form[id]')))return ['出生日期','政治面貌参加年月','毕业时间'].includes(label(element))?'day':'';
    return Object.keys(records).flatMap(key=>recordForms(key).includes(element.closest('.ux-standard-form > div.form[id]'))?records[key].fields:[]).find(field=>field[1]===label(element))?.[2]||'';
  }
  globalThis.ResumeHelperBosc = { ownsUrl,ownsPage,ownsControl,ownsPlainTarget,ownsRecord,label,forms,headings,records,recordForms,datePrecision,flatAliases,
    section: key => ownsPage()&&recordForms(key).length?headings(records[key].title)[0]:null,
    excludedForms: () => ownsUrl()?Array.from(document.querySelectorAll('.ux-standard-form > div.form[id]')).filter(form=>!basicForms().includes(form)):[],
    isRegion: element => ownsControl(element) && ['籍贯（具体到市/区）','出生地','实习地点'].includes(label(element)),
    isDate: element => Boolean(datePrecision(element)),
    controls: () => [...basicForms(),...Object.keys(records).flatMap(recordForms)].flatMap(form=>Array.from(form.querySelectorAll('.phoenix-select__input')).filter(ownsControl)) };
})();
