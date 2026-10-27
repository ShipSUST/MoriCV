// Public Sany form vocabulary and DOM ownership. No profile values or callbacks.
(function registerSanyForms() {
  'use strict';
  const ownsUrl = () => (location.hostname === 'sanycampus.zhiye.com'
    || location.hostname === '127.0.0.1' && document.documentElement.dataset.sanyAnonymous === 'date-v1')
    && location.pathname === '/form';
  const records = {
    awards: {title:'获奖情况', labels:['是否有获奖经历','获奖时间','竞赛名称','奖项名称','奖项类型','奖项级别','奖项等级'],
      fields:[['name','奖项名称'],['awardCategory','奖项类型'],['type','奖项级别'],['grade','奖项等级'],['start','获奖时间','day']]},
    papers: {title:'论文/专著', labels:['是否有论文/专利成果','成果类型','论文名称','作者顺序','期刊类型','论文简介'],
      fields:[['name','论文名称'],['authorOrder','作者顺序'],['type','期刊类型'],['description','论文简介']]}
  };
  const headings = title => ownsUrl() ? Array.from(document.querySelectorAll('div[id]'))
    .filter(node=>!node.matches('div.form') && node.textContent.trim()===title) : [];
  const forms = title => {
    const found=headings(title);
    return found.length===1 ? Array.from(document.querySelectorAll('.ux-standard-form > div.form[id]'))
      .filter(form=>form.id===found[0].id) : [];
  };
  const items = (form,text) => Array.from(form.querySelectorAll('.form-item'))
    .filter(item=>item.querySelector(':scope > .form-item__title > label')?.textContent.trim()===text);
  const label = element => element?.closest('.form-item')?.querySelector(':scope > .form-item__title > label')?.textContent.trim() || '';
  const selectedRadio = (form,title,text) => {
    const groups=items(form,title)[0]?.querySelectorAll('.phoenix-radio-group');
    if(groups?.length!==1 || groups[0].querySelectorAll('.phoenix-radio').length!==2)return false;
    const selected=groups[0].querySelectorAll('.phoenix-radio--checked');
    return selected.length===1 && selected[0].querySelector('.phoenix-radio__radio-text')?.textContent.trim()===text;
  };
  const recordForms = key => {
    const spec=records[key];
    return spec ? forms(spec.title).filter(form=>spec.labels.every(text=>{
      const found=items(form,text);
      return found.length===1 && found[0].querySelectorAll('input:not([type=hidden]),textarea,select,[contenteditable=true]').length<=1;
    }) && (key!=='papers' || selectedRadio(form,'是否有论文/专利成果','是') && selectedRadio(form,'成果类型','论文'))) : [];
  };
  const basicForms = () => {const found=forms('个人信息');return found.length===1?found:[];};
  const ownsRecord = form => Object.keys(records).some(key=>recordForms(key).includes(form));
  const ownsControl = element => {
    if(!ownsUrl() || !element?.matches?.('input,textarea,select'))return false;
    const form=element.closest('.ux-standard-form > div.form[id]'),text=label(element);
    if(!form || !text)return false;
    const found=items(form,text);
    if(found.length!==1 || found[0].querySelectorAll('input:not([type=hidden]),textarea,select,[contenteditable=true]').length!==1)return false;
    const known=basicForms().includes(form) ? ['民族','户口所在地'].includes(text)
      : Object.keys(records).some(key=>recordForms(key).includes(form) && records[key].fields.some(field=>field[1]===text));
    if(!known)return false;
    if(!element.matches('.phoenix-select__input'))return true;
    return Boolean(found[0].querySelector(':scope > .form-item__control > .phoenix-unmodeled-layer > .phoenix-unmodeled-layer__inner > .phoenix-unmodeled-layer__protect > .phoenix-unmodeled-layer__content > .phoenix-select')?.contains(element));
  };
  globalThis.ResumeHelperSany={ownsUrl,headings,forms,label,records,recordForms,ownsRecord,ownsControl,
    ownsPage:()=>ownsUrl() && (basicForms().length>0 || Object.keys(records).some(key=>recordForms(key).length)),
    section:key=>records[key] && recordForms(key).length ? headings(records[key].title)[0] : null,
    // Ambiguous headings still mark a record namespace for exclusion; they
    // cannot establish ownership for filling it.
    excludedForms:()=>{
      const ids=new Set(Object.values(records).flatMap(spec=>headings(spec.title)).map(heading=>heading.id));
      return Array.from(document.querySelectorAll('.ux-standard-form > div.form[id]')).filter(form=>ids.has(form.id));
    },
    requiresOwnership:element=>ownsUrl() && element?.matches?.('.phoenix-select__input')
      && ['民族','户口所在地','奖项类型','奖项级别','作者顺序','期刊类型'].includes(label(element)),
    isPaperGate:element=>element?.matches?.('.phoenix-radio')
      && recordForms('papers').includes(element.closest('.ux-standard-form > div.form[id]'))
      && ['是否有论文/专利成果','成果类型'].includes(label(element)),
    controls:()=>Array.from(document.querySelectorAll('.phoenix-select__input')).filter(ownsControl),
    isRegion:element=>ownsControl(element) && label(element)==='户口所在地',
    isConstant:element=>ownsControl(element) && label(element)==='民族'};
})();
