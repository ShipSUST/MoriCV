# 大类模块维护

v2.0.0使用12类和schema9。`src/shared/categories/`中basic、career消费`ordinary-fields.js`的44个固定字段；other仅容纳自定义名称/值，其余9类仍为原有记录集合。`schema.js`注册模块；设置、默认空集合、侧栏和通用填写消费同一目录。

个人主值、允许的候选/路径来自JSON；固定字段身份/名称/分类/别名归程序。默认便携JSON的entries仍为空，规范化时投影44个空固定字段；不从记录补齐普通值。设置只在记录组或其他组新增，不能切换固定字段分类。`toPortableProfile`用于文件/导出边界，避免把固定元数据写回个人主档；旧资料预览和冲突隔离由storage协调。文件冲突检查和网页事务仍是公共框架。

记录模块拥有`fields`、`presentation(record)`、`generic`及可选`legacyEntries`。`emptyRecord()`从字段类型生成空值，设置和侧栏子字段自动读取字段；母记录摘要由本类presentation生成，用户自定义displayName/summary仍优先。跨类奖项/证书迁移由storage协调，跨类网站临时视图仍在schema中生成，不写回主档。

亲属电话是已落地的例子：主要在relationships.js定义`field('phone', '亲属电话', ['联系电话', ...])`。普通文本字段会自动进入空白记录、设置、侧栏子字段和通用整条/整类/整页填写；亲属摘要遍历本类字段，自动纳入它。其他类的摘要格式在本类presentation里调整。v1.11.8已正式加入phone/亲属电话：设置在姓名之后显示，主值默认为空，号码由用户写入JSON；通用填写默认追加该字段，原有字段顺序保持。

`generic.aliases/order`保留历史网页匹配词汇和填写顺序；已有`generic:false`字段保持原通用驱动未支持的边界，新普通字段默认使用自己的标签/别名。awards的awardDate是网页派生字段，保留在generic.derivedFields，不增加JSON主字段。网站特殊日期、地区、搜索控件仍须按实际行为适配，新增字段不保证所有网站立刻支持。

内容脚本保持经典注入，通过`shared/category-runtime.js`消费同一模块生成的公共契约。不要手工编辑桥接或恢复fill.js里的字段表。字段改动后运行`npm run generate:categories`；`npm run check`检查是否过期，构建自动重新生成。后台和所有匿名注入入口按matcher-core→category-runtime→fill顺序加载。

验证使用`npm run verify`、`npm run privacy`和必要隔离匿名浏览器回归。`tests/fixtures/category-runtime-v1115.json`是重构前公开规则基线，不随实现一起改来让测试通过。正式亲属电话场景和临时字段单测覆盖实际设置→内存JSON→侧栏→单字段/记录/大类/整页→撤销及后改保护。匿名通过不能代表用户Chrome已重载或真实招聘页已保存。
