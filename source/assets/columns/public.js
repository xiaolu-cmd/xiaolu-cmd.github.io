(() => {
 const input=document.querySelector('#blogger-search');
 if(!input)return;
 let tag='';
 const cards=[...document.querySelectorAll('.column-blogger-card')];
 const update=()=>{let count=0;const q=input.value.trim().toLowerCase();cards.forEach(card=>{const tags=JSON.parse(card.dataset.tags);const visible=(!q||card.dataset.search.includes(q))&&(!tag||tags.includes(tag));card.hidden=!visible;if(visible)count++;});document.querySelector('.column-no-results').hidden=count>0;};
 input.addEventListener('input',update);
 document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{tag=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===button));update();}));
})();
