(function(){
  var LANGS=(window.GOA_LANGUAGES||[]); var DICT=(window.GOA_TRANSLATIONS||{});
  function lang(){ try{return localStorage.getItem('goa_language')||'en'}catch(e){return 'en'} }
  function setLang(code){ var ok=LANGS.some(function(x){return x.code===code}); if(!ok) code='en'; try{localStorage.setItem('goa_language',code)}catch(e){}; var m=LANGS.find(function(x){return x.code===code})||{dir:'ltr'}; document.documentElement.lang=code; document.documentElement.dir=m.dir||'ltr'; return code; }
  function lookup(text, code){ var d=DICT[code]||{}; var c=d.common||{}; if(Object.prototype.hasOwnProperty.call(c,text)) return c[text]; var x=d.calc||{}; for(var k in x) if(x[k]===text) return x[k]; var a=d.advice||{}; for(var j in a) if(a[j]===text) return a[j]; return null; }
  function translate(root,code){ if(!root)return; var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); var nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode); nodes.forEach(function(n){ var p=n.parentElement; if(!p||['SCRIPT','STYLE','OPTION'].indexOf(p.tagName)>=0)return; var raw=n.nodeValue, trim=raw.trim(); if(!trim)return; var v=lookup(trim,code); if(v&&v!==trim){ n.nodeValue=raw.replace(trim,v); }}); root.querySelectorAll('[data-i18n]').forEach(function(el){var key=el.getAttribute('data-i18n'); var d=DICT[code]||{},v=(d.calc||{})[key]||(d.common||{})[key]||(d.advice||{})[key]; if(v)el.textContent=v;}); }
  function refresh(){var code=setLang(lang()); translate(document.body,code); var s=document.getElementById('site-language-select'); if(s)s.value=code;}
  window.GOA_I18N={lang:lang,setLanguage:setLang,t:function(section,key,vars){var code=lang(),d=DICT[code]||DICT.en||{},v=(d[section]||{})[key]||((DICT.en||{})[section]||{})[key]||key; vars=vars||{}; return v.replace(/\{(\w+)\}/g,function(_,k){return vars[k]===undefined?'':vars[k]});},refresh:refresh,translate:translate};
  document.addEventListener('DOMContentLoaded',function(){
    var s=document.getElementById('site-language-select');
    if(s){s.innerHTML=''; LANGS.forEach(function(l){var o=document.createElement('option');o.value=l.code;o.textContent=l.native;o.selected=l.code===lang();s.appendChild(o);}); s.addEventListener('change',function(){setLang(this.value); location.reload();});}
    refresh();
    var obs=new MutationObserver(function(){translate(document.body,lang());}); obs.observe(document.body,{childList:true,subtree:true});
  });
})();
