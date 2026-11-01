// Redefine 2.9.0 does not rerender a query entered while search.xml is loading.
// Apply a small, version-checked correction to the generated module only.
const fs = require('fs');
const path = require('path');
hexo.extend.filter.register('after_generate', function () {
  const themeDir = path.dirname(require.resolve('hexo-theme-redefine/package.json'));
  const file = path.join(themeDir, 'source/js/build/tools/localSearch.js');
  const original = fs.readFileSync(file, 'utf8');
  const marker = `s&&(s.innerHTML='<i class="fa-solid fa-magnifying-glass fa-5x"></i>')`;
  if (!original.includes(marker)) throw new Error('Review search readiness fix for the installed Redefine version');
  const fixed = original.replace(marker, marker + ';const pendingInput=document.querySelector(".search-input");if(pendingInput?.value)renderSearchResult(pendingInput)');
  hexo.route.set('js/build/tools/localSearch.js', fixed);
});
