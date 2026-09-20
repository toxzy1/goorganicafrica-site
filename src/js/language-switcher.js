(function(){
  'use strict';
  var LANGS=Array.isArray(window.GOA_LANGUAGES)?window.GOA_LANGUAGES:[];
  var DICT=window.GOA_TRANSLATIONS||{};
  function lang(){try{return localStorage.getItem('goa_language')||'en'}catch(e){return 'en'}}
  function setLang(code){
    if(!DICT[code]) code='en';
    try{localStorage.setItem('goa_language',code)}catch(e){}
    var m=LANGS.find(function(x){return x.code===code})||{dir:code==='ar'?'rtl':'ltr'};
    document.documentElement.lang=code; document.documentElement.dir=m.dir||'ltr'; return code;
  }
  function lookup(text,code){
    var target=DICT[code]||{}, base=DICT.en||{};
    var sections=['common','calc','analysis','advice'];
    for(var i=0;i<sections.length;i++){
      var sec=sections[i], b=base[sec]||{}, t=target[sec]||{};
      for(var key in b){
        if(Object.prototype.hasOwnProperty.call(b,key) && b[key]===text && Object.prototype.hasOwnProperty.call(t,key)) return t[key];
      }
    }
    return null;
  }
  function translate(root,code){
    if(!root)return;
    root.querySelectorAll('[data-i18n]').forEach(function(el){
      var key=el.getAttribute('data-i18n'), d=DICT[code]||{}, v=null;
      ['common','calc','analysis','advice'].some(function(sec){v=(d[sec]||{})[key];return v!==undefined;});
      if(v!==undefined && v!==null) el.textContent=v;
    });
    var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT), nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(n){
      var p=n.parentElement;
      if(!p||['SCRIPT','STYLE','OPTION','TEXTAREA','INPUT'].indexOf(p.tagName)>=0)return;
      var raw=n.nodeValue, trim=raw.trim(); if(!trim)return;
      var v=lookup(trim,code); if(v&&v!==trim)n.nodeValue=raw.replace(trim,v);
    });
  }
  function refresh(){var code=setLang(lang()); translate(document.body,code); var s=document.getElementById('site-language-select'); if(s)s.value=code;}
  window.GOA_I18N={lang:lang,setLanguage:setLang,t:function(section,key,vars){
    var code=lang(),d=DICT[code]||DICT.en||{},v=(d[section]||{})[key]||((DICT.en||{})[section]||{})[key]||key;
    vars=vars||{}; return String(v).replace(/\{(\w+)\}/g,function(_,k){return vars[k]===undefined?'':vars[k]});
  },refresh:refresh,translate:translate};
  document.addEventListener('DOMContentLoaded',function(){
    var s=document.getElementById('site-language-select');
    if(s){s.innerHTML=''; LANGS.forEach(function(l){var o=document.createElement('option');o.value=l.code;o.textContent=l.native;o.selected=l.code===lang();s.appendChild(o);}); s.addEventListener('change',function(){setLang(this.value); refresh();});}
    refresh();
    var obs=new MutationObserver(function(){translate(document.body,lang());}); obs.observe(document.body,{childList:true,subtree:true});
  });
})();
