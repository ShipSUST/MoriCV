// MAIN-world, read-only bridge. The isolated extension cannot inspect React
// expandos directly. Only the observed tenants' minimal control metadata is
// returned; profile JSON, credentials and arbitrary property paths are absent.
(function installChinalifeReadback() {
  'use strict';
  const requestType = 'MORI_CV_CHINALIFE_READ';
  const responseType = 'MORI_CV_CHINALIFE_READ_RESULT';
  const readerVersion = 9;
  const isSany = () => (location.hostname === 'sanycampus.zhiye.com'
    || (location.hostname === '127.0.0.1' && document.documentElement.dataset.sanyAnonymous === 'date-v1')) && location.pathname === '/form';
  function sanyDateControl(element) {
    if (!isSany() || !element?.matches('.phoenix-select__input')) return false;
    const item=element.closest('.form-item.form-item--phoenix'),form=item?.closest('.ux-standard-form > div.form[id]');
    const labels=item?.querySelectorAll(':scope > .form-item__title > label.form-item__text');
    return Boolean(form && labels?.length===1 && /^(出生日期|毕业时间|开始时间|结束时间|获奖时间)$/.test(labels[0].textContent.trim())
      && Array.from(form.querySelectorAll('.form-item > .form-item__title > label')).filter(label=>label.textContent.trim()===labels[0].textContent.trim()).length===1
      && item.querySelectorAll('input:not([type=hidden]),textarea,select,[contenteditable=true]').length===1
      && item.querySelector(':scope > .form-item__control > .phoenix-unmodeled-layer > .phoenix-unmodeled-layer__inner > .phoenix-unmodeled-layer__protect > .phoenix-unmodeled-layer__content > .phoenix-select')?.contains(element));
  }
  const isSeyond = () => location.hostname === 'seyond.zhiye.com'
    || (location.hostname === '127.0.0.1' && document.documentElement.dataset.seyondAnonymous === 'form-v1');
  function seyondForms() {
    const specs=[['论文/专著',['发布时间','名称','所属期刊','作者顺序','年度/期次']],['获奖情况',['获奖时间','获奖项','获奖级别','获奖描述']]];
    return specs.flatMap(([title,labels])=>{
      const headings=Array.from(document.querySelectorAll('div[id]')).filter(node=>!node.matches('div.form')&&node.textContent.trim()===title);
      if(headings.length!==1)return [];
      return Array.from(document.querySelectorAll('.ux-standard-form > div.form[id]')).filter(form=>form.id===headings[0].id
        && labels.every(label=>{
          const matches=Array.from(form.querySelectorAll('.form-item > .form-item__title > label')).filter(node=>node.textContent.trim()===label);
          return matches.length===1&&matches[0].closest('.form-item').querySelectorAll('input:not([type=hidden]),textarea,select,[contenteditable=true]').length<=1;
        }));
    });
  }
  const allowed = () => (location.hostname === 'chinalife.zhiye.com'
    || (location.hostname === '127.0.0.1' && document.documentElement.dataset.chinalifeAnonymous === 'readback')
    || (isSeyond() && seyondForms().length) || isSany() || globalThis.ResumeHelperBosc?.ownsPage())
    && location.pathname === '/form' && Boolean(document.querySelector('.ux-standard-form > div.form[id]'));
  if (!allowed() || globalThis.__moriChinalifeReadbackInstalled === readerVersion) return;
  const previousListener = globalThis.__moriChinalifeReadbackListener;
  if (typeof previousListener === 'function') document.removeEventListener(requestType,previousListener,true);
  function committedControlBranch(fiber) {
    if (!globalThis.ResumeHelperBosc?.ownsUrl() && !isSany()) return null;
    const path = [],seen = new Set();
    for (let cursor = fiber; cursor && path.length < 160; cursor = cursor.return) {
      if (seen.has(cursor)) return [];
      seen.add(cursor);path.push(cursor);
    }
    const root = path.at(-1);
    if (root?.return) return [];
    // Anonymous/legacy metadata may have no React root. Real alternate props
    // are resolved by child membership in root.current, never by newer values.
    if (root?.tag !== 3) return isSany() || fiber?.alternate ? [] : null;
    let current = root.stateNode?.current;
    if (current !== root && current !== root.alternate) return [];
    const committed = [current];
    for (let index = path.length - 2; index >= 0; index -= 1) {
      const wanted = path[index],matches = [];
      let child = current.child,steps = 0;
      for (; child && steps < 10000; child = child.sibling,steps += 1) {
        if (child === wanted || child === wanted.alternate) matches.push(child);
      }
      if (child || matches.length !== 1) return [];
      current = matches[0];committed.push(current);
    }
    return committed.reverse().slice(0,24);
  }
  function* reactAncestors(element) {
    const key = Object.keys(element).find(key => /^__react(Fiber|InternalInstance)/.test(key));
    let fiber = key && element[key];
    const committed = committedControlBranch(fiber);
    if (committed) { yield* committed;return; }
    for (let depth = 0; fiber && depth < 24; depth += 1, fiber = fiber.return) yield fiber;
  }
  const info = (element, predicate) => {
    for (const fiber of reactAncestors(element)) {
      const props = fiber.memoizedProps || {}, state = fiber.stateNode?.state;
      if (predicate(props,state)) return { props,state };
    }
    return null;
  };
  const text = value => String(value ?? '').slice(0,400);
  const selection = rows => rows.length <= 100 && rows.every(item => item && item.id != null && typeof item.label === 'string'
    && String(item.id).length <= 400 && item.label.length <= 400)
    ? rows.map(item => ({ id:text(item.id), label:text(item.label) })) : null;
  const node = item => ({ id:text(item.id), label:text(item.label), parentId:text(item.parentId), hasChildren:text(item.hasChildren) });
  function ownedControlPopup(input) {
    const owners=new Set();
    for(const fiber of reactAncestors(input)){
      const instance=fiber.stateNode,container=instance?.containerRef?.current;
      if(!(container instanceof Element)||!container.contains(input))continue;
      const root=instance?.triggerRef?.current?._component?.rootNode,content=instance?.layerRef?.wrapperRef?.current;
      if(root instanceof Element&&root.isConnected&&root.matches('.common-unmodeled-layer'))owners.add(root);
      if(content instanceof Element&&content.isConnected&&content.matches('.common-unmodeled-layer__layerContent')){
        const popup=content.closest('.common-unmodeled-layer');if(popup?.isConnected)owners.add(popup);
      }
    }
    return owners.size===1?[...owners][0]:null;
  }
  function read(element,kind) {
    if (!allowed() || !(element instanceof Element) || !element.isConnected) return null;
    const bosc=globalThis.ResumeHelperBosc,sany=globalThis.ResumeHelperSany;
    const scopedControl=bosc?.ownsControl(element)?bosc:sany?.ownsControl(element)?sany:null;
    if (isSany()) {
      const candidates=Array.from(document.querySelectorAll('.phoenix-select__input'))
        .filter(input=>sanyDateControl(input)||sany?.ownsControl(input));
      if (['date','popup'].includes(kind) && sanyDateControl(element)) {
        const date=info(element,props=>typeof props.mode==='string' || typeof props.format==='string');
        if (date?.props.mode!=='date' || date.props.format!=='YYYY-MM-DD') return null;
        if (kind==='popup') {
          const popup=ownedControlPopup(element);
          if (!popup || candidates.filter(input=>ownedControlPopup(input)===popup).length!==1) return null;
        }
      } else if (['popup','selection'].includes(kind)) {
        if (!element.matches('.phoenix-select__input') || !sany?.ownsControl(element)
          || kind==='selection' && !sany.isRegion(element)) return null;
      } else if (['area','row','constant','constantRow'].includes(kind)) {
        const popup=element.closest('.common-unmodeled-layer');
        const owners=popup?candidates.filter(input=>ownedControlPopup(input)===popup):[];
        if (owners.length!==1 || (['area','row'].includes(kind)?!sany?.isRegion(owners[0]):!sany?.isConstant(owners[0]))) return null;
      } else return null;
    }
    if(bosc?.ownsUrl()){
      if(['date','popup','selection'].includes(kind)){
        if(!element.matches('.phoenix-select__input')||!bosc.ownsControl(element)||(kind==='selection'&&!bosc.isRegion(element)))return null;
      }else{
        if(!['area','row','constant','constantRow'].includes(kind))return null;
        const popup=element.closest('.common-unmodeled-layer');
        if(!popup||bosc.controls().filter(input=>ownedControlPopup(input)===popup).length!==1)return null;
      }
    }
    if (isSeyond() && (!['date','popup'].includes(kind) || !element.matches('.phoenix-select__input')
      || !seyondForms().includes(element.closest('.ux-standard-form > div.form[id]')))) return null;
    if (kind === 'popup') {
      if (!element.matches('.phoenix-select__input') || !element.closest('.form-item')) return null;
      const owners = new Set();
      for (const fiber of reactAncestors(element)) {
        const instance = fiber.stateNode, container = instance?.containerRef?.current;
        const popup = instance?.triggerRef?.current?._component?.rootNode;
        // Observed Phoenix portal refs, read directly without calling component
        // methods. Export only the DOM position, never props or personal values.
        if (container instanceof Element && container.contains(element)
          && popup instanceof Element && popup.isConnected && popup.matches('.common-unmodeled-layer')) owners.add(popup);
        // Phoenix may retain the first trigger rootNode after destroying and
        // reopening its portal. The live content wrapper is a second observed
        // ref on the same owning instance; never infer ownership by proximity.
        const content = instance?.layerRef?.wrapperRef?.current;
        const currentPopup = content instanceof Element && content.isConnected
          && content.matches('.common-unmodeled-layer__layerContent')
          ? content.closest('.common-unmodeled-layer') : null;
        if ((isSeyond() || isSany() || bosc?.ownsControl(element)) && container instanceof Element && container.contains(element) && currentPopup?.isConnected) owners.add(currentPopup);
      }
      if (owners.size !== 1) return null;
      const index = Array.from(document.querySelectorAll('.common-unmodeled-layer')).indexOf([...owners][0]);
      if (index < 0) return null;
      if (!isSeyond() && !isSany() && !bosc?.ownsControl(element)) return { index };
      if (scopedControl) {
        const constants = [...owners][0].querySelectorAll('.constant-main-layer-container');
        if (constants.length) {
          const constant = constants.length === 1 && info(constants[0], (props,state) => typeof props.isMulti === 'boolean' && Array.isArray(state?.selectData));
          const scalar = Boolean(constant && !constant.props.isMulti && constant.state.selectData.length <= 1);
          const display = element.closest('.phoenix-select')?.querySelector('.phoenix-select__calcEle');
          const normalize = value => String(value ?? '').replace(/\s+/g,' ').trim();
          const committed = /^(请选择|请输入)$/.test(normalize(display?.textContent)) ? '' : normalize(display?.textContent);
          const staged = constant?.state.selectData || [];
          const settled = scalar && Boolean(display) && (staged.length === 0 ? !committed
            : [staged[0].name,staged[0].fullPathName].some(value => value != null && normalize(value) === committed));
          return { index, scalar, pending: !settled };
        }
        const areas = [...owners][0].querySelectorAll('.area-selector-container');
        if (scopedControl.isRegion(element) && areas.length) {
          const area = areas.length === 1 && info(areas[0], (props,state) => typeof props.isMulti === 'boolean' && typeof props.isSingleSelect === 'boolean' && state?.areaData && Array.isArray(state.selectData));
          const scalar = Boolean(area && !area.props.isMulti && area.props.isSingleSelect && area.state.selectData.length <= 1);
          const committed = info(element, props => 'allLevelDisplay' in props && Array.isArray(props.value));
          const before = committed && selection(committed.props.value),staged = area && selection(area.state.selectData);
          const settled = scalar && before && staged && before.length === staged.length
            && before.every(item => staged.some(other => item.id === other.id));
          return { index, scalar, pending: !settled };
        }
      }
      const select = info(element,props=>typeof props.multiple === 'boolean' && Array.isArray(props.options));
      const date = info(element,props=>['date','month'].includes(props.mode) && typeof props.format === 'string');
      return { index, scalar: select ? !select.props.multiple : Boolean(date?.props.mode === 'date' && date.props.format === 'YYYY-MM-DD'
        || bosc?.ownsControl(element) && date?.props.mode === 'month' && date.props.format === 'YYYY-MM') };
    }
    if (['selection','date'].includes(kind)) {
      if (!element.matches('.phoenix-select__input') || !element.closest('.form-item')) return null;
      if (kind === 'selection') {
        const value = info(element, props => 'allLevelDisplay' in props && Array.isArray(props.value));
        return value ? selection(value.props.value) : null;
      }
      const value = info(element, props => ['date','month'].includes(props.mode) && typeof props.format === 'string');
      return value ? { mode:value.props.mode, format:text(value.props.format) } : null;
    }
    if (kind === 'area' && element.matches('.area-selector-container')) {
      const value = info(element, (_props,state) => state?.areaData && Array.isArray(state.selectData));
      if (!value) return null;
      const source = value.state.areaData;
      const rows = Array.isArray(source) ? source : Object.values(source).filter(Array.isArray).flat();
      if (rows.length > 50000 || value.state.selectData.length > 100) return null;
      const selections=selection(value.state.selectData);
      return selections ? { nodes:rows.filter(item => item?.id != null).map(node), selections } : null;
    }
    if (kind === 'row' && element.matches('.area-data-container .area-item-container')) {
      const value = info(element, props => props.data?.id != null);
      return value ? node(value.props.data) : null;
    }
    if (kind === 'constant' && element.matches('.constant-main-layer-container')) {
      const value=info(element,(props,state)=>typeof props.isMulti==='boolean'&&Array.isArray(state?.selectData));
      if (!value) return null;
      const selections=selection(value.state.selectData.map(item=>({id:item?.code,label:item?.name})));
      return selections ? {multi:value.props.isMulti,selections} : null;
    }
    if (kind === 'constantRow' && element.matches('.list-data-container .list-item-container')) {
      const value=info(element,props=>props.data?.code!=null&&typeof props.data.name==='string'&&typeof props.isForbidExpand==='boolean');
      if (!value) return null;
      return {id:text(value.props.data.code),label:text(value.props.data.name),leaf:value.props.isForbidExpand,disabled:!!value.props.disabled};
    }
    return null;
  }
  const listener = event => {
    if (typeof event.detail !== 'string' || event.detail.length > 200) return;
    try {
      const request = JSON.parse(event.detail);
      if (typeof request.id !== 'string' || request.id.length > 80 || typeof request.kind !== 'string') return;
      const value = read(event.target,request.kind);
      event.target.dispatchEvent(new CustomEvent(responseType,{detail:JSON.stringify({id:request.id,value})}));
    } catch (_) { /* Unknown component shapes fail closed. */ }
  };
  // v1.11.10 stored only a boolean, so its anonymous listener cannot be removed.
  // The new synchronous response follows it; the correlated consumer retains
  // the final value. Later versions can replace this owned listener directly.
  document.addEventListener(requestType,listener,true);
  globalThis.__moriChinalifeReadbackListener = listener;
  globalThis.__moriChinalifeReadbackInstalled = readerVersion;
})();
