import fs from 'node:fs';

const PATH = 'tools/soft-router-suggest/keyword-library.json';
const lib = JSON.parse(fs.readFileSync(PATH, 'utf8'));
if (!lib.keywordSets) throw new Error('missing keywordSets');
if (!lib.kinds?.support) throw new Error('missing kinds.support');

// NOTE: library has normalization.lowercase=true, so case isn't important.

// 1) support: keep it as “simple tech support” domain (one-off technical execution actions)
// - support.strong: concrete ops/support actions & nouns (~100)
// - support.weak: lighter admin/reporting context terms (kept small)

lib.keywordSets['support.strong'] = [
  // keep-ish (CN)
  '查询','检索','统计','报告','周报','月报','工单','排查','维护','运维','监控','文档','整理','管理','跟进','日常',
  '审核','更新','备份','恢复','迁移','上线','发布','应急','救火','故障','宕机','中断','不可用','超时','连接失败',
  '兜底','降级','熔断','回滚','值班','告警','报警','演练','复盘','应急预案','SOP','运行手册','巡检','健康检查',
  '重启','重启服务','重启进程','重启容器','重载','重载配置','reload 配置','配置变更','回退','回放','补数据','数据修复',
  '清缓存','清理缓存','清理磁盘','扩容','缩容','扩缩容','伸缩','限流','熔断开关','切流','灰度','开关量','开关','开关配置',
  '抓包','抓日志','查日志','查看日志','日志分析','日志清理','日志轮转','日志切割','对账','核对数据',
  '权限','权限配置','账号','账号恢复','重置密码','权限申请','授权','证书','证书续期','续期','域名','DNS','端口','防火墙',
  '连通性','连通性检查','ping','traceroute','curl','连不上','502','503','504',
  // keep-ish (EN)
  'query','search','stats','report','weekly','monthly','support','ticket','triage','maintenance','ops','monitoring','document','docs',
  'organize','management','follow-up','daily','audit','update','backup','restore','migration','deploy','release','emergency','recovery',
  'rollback','oncall','incident','outage','downtime','unavailable','timeout','connection failed','connection refused','fallback','degrade',
  'circuit breaker','runbook','SOP','health check','status','restart','reload','hotfix','patch','mitigation','workaround',
  'log','logs','tail logs','check logs','rotate logs','clear cache','flush cache','scale up','scale down','autoscaling',
  'rate limit','throttle','feature flag','switch traffic','canary','rollout','roll back',
  // common error tokens useful for support triage
  'ECONNREFUSED','ETIMEDOUT','EADDRINUSE','ECONNRESET','ENOTFOUND','EACCES','permission denied'
];

lib.keywordSets['support.weak'] = [
  // keep small + less decisive context words
  '周报','月报','报告','文档','整理','管理','跟进','日常','audit','report','weekly','monthly','docs','document','organize','follow-up','daily'
];

// Keep kind name as previously set; enforce minScore=2 so weak-only won't trigger.
lib.kinds.support.name = '简单技术支持 / simple tech support';
lib.kinds.support.thresholds = { ...(lib.kinds.support.thresholds ?? {}), minScore: 2 };

// 2) style: create independent sets (NOT wired to any kind yet)
lib.keywordSets['style.answer_only'] = [
  // CN
  '只要答案','只要结果','只要最终答案','只要最终结果','只要结论','结论先行','先说结论','直接给答案','直接给结论','直给','直说',
  '不要解释','不用解释','不需要解释','别解释','不要分析','不用分析','别分析','不要推理','不用推理','省略过程','不要过程','不要步骤',
  '只给我答案','给我答案就行','只给答案','只给结果','结果即可','结论即可','不要展开','别展开','少废话','不要废话','别废话',
  '不需要过程','不要过程细节','不要细节','只要最终输出','最终输出即可',
  // EN
  'just answer','answer only','final answer only','results only','just the result','no explanation','dont explain','don\'t explain',
  'no analysis','no reasoning','skip explanation','skip the steps','no steps','no details','straight to the point','direct answer'
];

lib.keywordSets['style.concise'] = [
  // CN
  '总结','概括','概述','提炼','要点','关键点','重点','核心','一句话','一句话总结','一句总结','两句话','三句话','三点','三条','三行以内','3行内',
  '简短','简要','简明','精简','简洁','简单说','说重点','长话短说','速览','速读','快速总结','列要点','只列要点','要点即可',
  // EN
  'tl;dr','tldr','summary','summarize','brief','concise','succinct','short version','quick summary','key points','bullet points','bullets only',
  'bottom line','in a nutshell','one-liner','one sentence'
];

lib.keywordSets['style.urgency'] = [
  // CN
  '紧急','急','马上','立刻','立马','赶紧','快点','尽快','火速','优先','高优','高优先级',
  // EN
  'urgent','asap','immediately','right now','in a rush','rush','high priority','prio0','p0'
];

// Keep JSON pretty
fs.writeFileSync(PATH, JSON.stringify(lib, null, 2) + '\n');
console.log(JSON.stringify({ ok:true, support:{ strong: lib.keywordSets['support.strong'].length, weak: lib.keywordSets['support.weak'].length }, style:{ answer_only: lib.keywordSets['style.answer_only'].length, concise: lib.keywordSets['style.concise'].length, urgency: lib.keywordSets['style.urgency'].length } }, null, 2));
