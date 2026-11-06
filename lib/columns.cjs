'use strict';
const OWNER = 'xiaolu-cmd';
const REPOSITORY = `${OWNER}/${OWNER}.github.io`;
const MARKER = '<!-- xiaolu-columns:v1 -->';
function clean(value, name, max, required = false) {
  if (typeof value !== 'string') { if (value == null && !required) return ''; throw new Error(`${name}格式不正确`); }
  const text = value.replace(/\r\n/g, '\n').trim();
  if ((required && !text) || text.length > max || /\u0000/.test(text)) throw new Error(`${name}为空或超过长度限制`);
  return text;
}
function safeURL(value, required = false) {
  const text = clean(value, '网址', 2000, required);
  if (!text) return '';
  let url; try { url = new URL(text); } catch { throw new Error('请输入完整的网址，例如 https://example.com'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('网址只支持 HTTP 或 HTTPS，且不能包含账号密码');
  return url.href;
}
function normalizeRecord(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('内容格式不正确');
  const id = clean(input.id, '内容编号', 80, true);
  if (!/^(world|bloggers)-[a-z0-9-]{6,65}$/.test(id)) throw new Error('内容编号不正确');
  if (!['world', 'bloggers'].includes(input.kind) || !id.startsWith(input.kind + '-')) throw new Error('栏目不正确');
  const title = clean(input.title, input.kind === 'world' ? '标题' : '博主名称', 100, true);
  const summary = clean(input.summary, '简介', 300);
  const body = clean(input.body, input.kind === 'world' ? '观点正文' : '推荐理由', 20000, true);
  const url = safeURL(input.url, input.kind === 'bloggers');
  if (input.tags != null && !Array.isArray(input.tags)) throw new Error('标签格式不正确');
  const tags = [...new Set((input.tags || []).map(x => clean(x, '标签', 20, true)))];
  if (tags.length > 6) throw new Error('最多添加 6 个标签');
  if (input.sources != null && !Array.isArray(input.sources)) throw new Error('参考来源格式不正确');
  if ((input.sources || []).length > 8) throw new Error('最多添加 8 个参考来源');
  const sources = (input.sources || []).map(x => ({ title: clean(x.title, '来源名称', 100), url: safeURL(x.url, true) }));
  return {id, kind: input.kind, title, summary, body, url, tags, sources, pinned: input.pinned === true};
}
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function paragraphs(value) { return String(value || '').split(/\n\s*\n/).filter(Boolean).map(p => `<p>${escapeHTML(p).replace(/\n/g, '<br>')}</p>`).join(''); }
function parseIssue(body) {
  if (typeof body !== 'string' || !body.includes(MARKER) || body.length > 60000) throw new Error('不是栏目发布请求');
  const matches = [...body.matchAll(/```xiaolu-columns\s*\n([\s\S]*?)\n```/g)];
  if (matches.length !== 1) throw new Error('发布数据缺失或重复');
  const data = JSON.parse(matches[0][1]);
  if (data.version !== 1 || !['publish','hide'].includes(data.action)) throw new Error('发布操作不正确');
  return {action: data.action, record: normalizeRecord(data.record)};
}
function applyIssue(state, event) {
  if (event.repository?.full_name !== REPOSITORY || event.sender?.login !== OWNER || event.issue?.user?.login !== OWNER || event.issue?.pull_request) throw new Error('只有站长本人的栏目请求可以发布');
  if (!['opened','edited','reopened'].includes(event.action)) throw new Error('不支持的事件');
  const {action, record} = parseIssue(event.issue.body);
  if (state.version !== 1 || !Array.isArray(state.entries)) throw new Error('栏目数据版本不正确');
  const index = state.entries.findIndex(x => x.id === record.id);
  const previous = index >= 0 ? state.entries[index] : null;
  const eventTime = Date.parse(event.issue.updated_at);
  if (!Number.isFinite(eventTime) || !Number.isSafeInteger(event.issue.number)) throw new Error('发布事件时间或编号不正确');
  if (previous && Date.parse(previous.updatedAt) > eventTime) throw new Error('这是旧版本请求，不能覆盖较新的内容');
  const entry = {...record, createdAt: previous?.createdAt || event.issue.created_at, updatedAt: event.issue.updated_at, visible: action === 'publish', issueNumber: event.issue.number};
  if (!Number.isFinite(Date.parse(entry.createdAt))) throw new Error('创建时间不正确');
  const next = {version: 1, entries: [...state.entries]};
  if (index >= 0) next.entries[index] = entry; else next.entries.push(entry);
  return next;
}
module.exports = {OWNER, REPOSITORY, MARKER, normalizeRecord, safeURL, escapeHTML, paragraphs, parseIssue, applyIssue};
