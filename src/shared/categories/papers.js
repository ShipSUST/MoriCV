import { field, compact, formatProfileDate } from './common.js';

// Public metadata only. generic:false preserves historically unsupported fields.
export const papersCategory = {
  key: "papers", category: "论文成果", title: "论文成果", prefix: "paper", recordType: "paper", kind: "record",
  fields: [
    field("name", "论文名称", ["论文题目","文章名称"], {"generic":{"aliases":["论文名称","论文题目","paper title","publication title"],"order":0}}),
    field("type", "论文类型", ["发表类型"], {"generic":{"aliases":["论文类型","发表类型","publication type"],"order":1}}),
    field("venue", "发表刊物", ["发表会议","发表平台","期刊名称","会议名称","journal","conference","publication venue"], {"generic":{"aliases":["发表刊物","发表会议","期刊名称","会议名称","journal","conference","publication venue"],"order":2}}),
    field("authorOrder", "作者顺序", ["作者排名","第几作者"], {"generic":{"aliases":["作者顺序","作者排名","author order"],"order":3}}),
    field("publishedAt", "发表时间", ["论文时间"], {"type":"date","generic":{"aliases":["发表时间","论文时间","publication date"],"order":4}}),
    field("link", "论文链接", ["DOI","论文地址"], {"generic":{"aliases":["论文链接","DOI","论文地址","paper url"],"order":5}}),
    field("description", "论文描述/个人贡献", ["论文描述","个人贡献","论文成果"], {"type":"textarea","generic":{"aliases":["论文描述","个人贡献","论文成果","description"],"order":6}})
  ],
  generic: { heading: new RegExp("^(论文成果|论文|论文信息|发表论文|papers?|publications?)$", "i"), add: new RegExp("^(?:\\+\\s*)?(?:添加|新增)(?:一条|一项|一篇)?\\s*(?:论文|成果|记录)?$|^add(?: another)?(?: paper| publication| record)?$", "i") },
  presentation(record) { return {
      label: record.name || "论文成果",
      summary: [[formatProfileDate(record.publishedAt), record.type, record.venue, record.authorOrder].filter(Boolean).join("｜"), compact(record.description), compact(record.link)].filter(Boolean).join("\n"),
      aliases: [record.name, record.type, record.venue]
    }; }
};
