const fs = require('fs');
const path = require('path');
const {normalizeRecord, escapeHTML: e, paragraphs} = require('../lib/columns.cjs');
const root = path.resolve(__dirname, '..');
const label = {world: '锐评世界', bloggers: '优秀博主资源推荐'};
const date = value => new Date(value).toLocaleDateString('zh-CN', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit'});
const chips = tags => tags.map(t=>`<span class="column-tag">${e(t)}</span>`).join('');
const empty = kind => `<div class="column-empty"><div class="column-empty-icon" aria-hidden="true">${kind==='world'?'✳':'↗'}</div><h2>${kind==='world'?'想法，还在路上。':'把值得读的人，留在这里。'}</h2><p>${kind==='world'?'这里将记录我对世界的观察、判断和思考。':'遇到值得长期阅读的博主，我会写下推荐的理由。'}</p><a class="column-text-link" href="/editor/?kind=${kind}">编辑这个栏目 <span aria-hidden="true">→</span></a></div>`;
hexo.extend.generator.register('columns', function () {
  const raw = JSON.parse(fs.readFileSync(path.join(root,'content/columns.json'),'utf8'));
  const entries = raw.entries.filter(x=>x.visible===true).map(x=>({...x,...normalizeRecord(x)})).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||Date.parse(b.createdAt)-Date.parse(a.createdAt));
  const routes=[];
  for (const kind of ['world','bloggers']) {
    const list=entries.filter(x=>x.kind===kind);
    const top=`<div class="column-shell" data-column="${kind}"><div class="column-intro"><div class="column-eyebrow">${kind==='world'?'THOUGHTS & PERSPECTIVES':'PEOPLE WORTH READING'}</div><p class="column-lead">${kind==='world'?'观察世界，表达观点，也给新的理解留一点位置。':'把值得反复阅读的人和资源，认真推荐给你。'}</p><div class="column-intro-bottom"><span>${list.length} ${kind==='world'?'篇观察':'位博主'}</span><a href="/editor/?kind=${kind}" class="column-text-link">栏目编辑 ↗</a></div></div>`;
    const filter=kind==='bloggers'&&list.length?`<div class="column-filter"><label for="blogger-search">查找博主或关键词</label><input id="blogger-search" type="search" placeholder="搜索名称、方向或推荐理由…"><div class="column-filter-tags"><button type="button" class="active" data-filter="">全部</button>${[...new Set(list.flatMap(x=>x.tags))].map(t=>`<button type="button" data-filter="${e(t)}">${e(t)}</button>`).join('')}</div></div>`:'';
    const cards=list.map(x=>kind==='world'?`<article class="column-world-card"><div class="column-card-top"><time datetime="${e(x.createdAt)}">${date(x.createdAt)}</time>${x.pinned?'<span class="column-pin">置顶</span>':''}</div><h2><a href="/world/${e(x.id)}/">${e(x.title)}</a></h2><p>${e(x.summary||x.body.slice(0,160))}</p><div class="column-card-bottom"><div>${chips(x.tags)}</div><a href="/world/${e(x.id)}/" class="column-text-link">读这篇观察 →</a></div></article>`:`<article class="column-blogger-card" data-tags="${e(JSON.stringify(x.tags))}" data-search="${e([x.title,x.summary,x.body,...x.tags].join(' ').toLowerCase())}"><div class="column-blogger-top"><span class="column-monogram" aria-hidden="true">${e(Array.from(x.title)[0])}</span><div><h2><a href="${e(x.url)}" target="_blank" rel="noopener noreferrer">${e(x.title)} <span aria-hidden="true">↗</span></a></h2><span class="column-domain">${e(new URL(x.url).hostname)}</span></div>${x.pinned?'<span class="column-pin">常读</span>':''}</div>${x.summary?`<p class="column-blogger-subtitle">${e(x.summary)}</p>`:''}<div class="column-reason">${paragraphs(x.body)}</div><div class="column-card-bottom"><div>${chips(x.tags)}</div><a class="column-text-link" href="${e(x.url)}" target="_blank" rel="noopener noreferrer">去看看 ↗</a></div></article>`).join('');
    const content=top+filter+(list.length?`<div class="column-${kind==='world'?'world-list':'blogger-grid'}">${cards}</div><p class="column-no-results" hidden>暂时没有匹配的推荐，换个关键词试试。</p>`:empty(kind))+'</div><script src="/assets/columns/public.js" defer></script>';
    routes.push({path:`${kind==='world'?'world':'bloggers'}/index.html`,layout:['page'],data:{title:label[kind],content,description:kind==='world'?'关于世界的观察、观点与思考。':'优秀博主与值得长期阅读的资源推荐。'}});
  }
  for (const x of entries.filter(x=>x.kind==='world')) {
    const content=`<div class="column-shell column-detail"><div class="column-detail-meta"><a href="/world/">← 返回锐评世界</a><time datetime="${e(x.createdAt)}">${date(x.createdAt)}</time></div>${x.summary?`<p class="column-detail-summary">${e(x.summary)}</p>`:''}<div class="column-body">${paragraphs(x.body)}</div>${x.sources.length?`<section class="column-sources"><h2>参考来源</h2><ol>${x.sources.map(s=>`<li><a href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.title||new URL(s.url).hostname)} ↗</a></li>`).join('')}</ol></section>`:''}<div class="column-detail-footer"><div>${chips(x.tags)}</div><a href="/editor/?id=${e(x.id)}">编辑这篇观察 ↗</a></div></div>`;
    routes.push({path:`world/${x.id}/index.html`,layout:['page'],data:{title:e(x.title),content,description:x.summary||x.body.slice(0,160)}});
  }
  routes.push({path:'assets/columns/data.json',data:JSON.stringify({version:1,entries})});
  routes.push({path:'.github/workflows/publish-site.yml',data:fs.readFileSync(path.join(root,'.github/workflows/publish-site.yml'),'utf8')});
  return routes;
});
hexo.extend.filter.register('after_render:html',function(html){
 if(!html.includes('class="home-banner-container'))return html;
 const cards='<div class="column-home-links"><a href="/world/"><span class="column-eyebrow">THOUGHTS</span><strong>锐评世界 <span>↗</span></strong><p>观察、表达，保留自己的判断。</p></a><a href="/bloggers/"><span class="column-eyebrow">DISCOVER</span><strong>博主推荐 <span>↗</span></strong><p>值得读的人，值得收藏的内容。</p></a></div>';
 return html.replace('<div class="home-content-container">','<div class="home-content-container">'+cards);
});
