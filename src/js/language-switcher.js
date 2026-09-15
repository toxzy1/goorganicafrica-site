document.addEventListener("DOMContentLoaded",function(){
  var s=document.getElementById("site-language-select"); if(!s)return;
  var saved=localStorage.getItem("goa_language")||"en"; if(Array.from(s.options).some(function(o){return o.value===saved;}))s.value=saved;
  s.addEventListener("change",function(){localStorage.setItem("goa_language",this.value);
    document.documentElement.lang=this.value; document.documentElement.dir=this.value==="ar"?"rtl":"ltr";
    // The selector is deliberately non-destructive: it changes the page/interface language now.
    // A blog article is only routed to a translated URL when a translated article is published.
    // This prevents broken /fr/blog/... URLs while the translation library is being built.

  });
});
