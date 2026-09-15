document.addEventListener("DOMContentLoaded", function () {
  const select = document.getElementById("site-language-select");
  if (!select) return;

  const translations = {
    en: {
      Home: "Home",
      Calculator: "Calculator",
      Guides: "Guides",
      Blog: "Blog",
      About: "About",
      Contact: "Contact",
      Language: "Language",
      "Free Farming Tool": "Free Farming Tool",
      "Know Your Farm Profit Before You Plant":
        "Know Your Farm Profit Before You Plant",
      "Calculate your cost of production, expected revenue, profit, ROI and break-even point — free, across Nigeria and Africa, in your own currency.":
        "Calculate your cost of production, expected revenue, profit, ROI and break-even point — free, across Nigeria and Africa, in your own currency.",
      "Crops, livestock & more — continuously expanding":
        "Crops, livestock & more — continuously expanding",
      "Enter farm size in acres, plots or hectares":
        "Enter farm size in acres, plots or hectares",
      "Override any figure with your own local numbers":
        "Override any figure with your own local numbers",
      "Conservative, Expected & Optimistic profit scenarios":
        "Conservative, Expected & Optimistic profit scenarios",
      "Calculate My Farm Profit": "Calculate My Farm Profit",
      "Browse Farming Guides": "Browse Farming Guides",
      "Plan Your Farm. Calculate Your Profit.":
        "Plan Your Farm. Calculate Your Profit.",
      "100% Free": "100% Free",
      "Open Calculator": "Open Calculator",
      "How it works": "How it works",
      "Three Steps to Your Farm Profit Report":
        "Three Steps to Your Farm Profit Report",
      "No sign-up. No payment. Just your numbers.":
        "No sign-up. No payment. Just your numbers.",
      "Farming Guides": "Farming Guides",
      "Go Deeper With Expert Guides":
        "Go Deeper With Expert Guides",
      "About GoOrganicAfrica": "About GoOrganicAfrica",
      "From the Blog": "From the Blog",
      "Farming Insights & Market Analysis":
        "Farming Insights & Market Analysis"
    },

    fr: {
      Home: "Accueil",
      Calculator: "Calculateur",
      Guides: "Guides",
      Blog: "Blog",
      About: "À propos",
      Contact: "Contact",
      Language: "Langue",
      "Free Farming Tool": "Outil agricole gratuit",
      "Know Your Farm Profit Before You Plant":
        "Connaissez votre bénéfice avant de planter",
      "Calculate My Farm Profit": "Calculer le bénéfice de ma ferme",
      "Browse Farming Guides": "Parcourir les guides agricoles",
      "Plan Your Farm. Calculate Your Profit.":
        "Planifiez votre ferme. Calculez votre bénéfice.",
      "100% Free": "100 % gratuit",
      "Open Calculator": "Ouvrir le calculateur",
      "How it works": "Comment ça marche",
      "Three Steps to Your Farm Profit Report":
        "Trois étapes pour votre rapport de bénéfice",
      "No sign-up. No payment. Just your numbers.":
        "Aucune inscription. Aucun paiement. Seulement vos chiffres.",
      "Farming Guides": "Guides agricoles",
      "Go Deeper With Expert Guides":
        "Allez plus loin avec nos guides spécialisés",
      "About GoOrganicAfrica": "À propos de GoOrganicAfrica",
      "From the Blog": "Depuis le blog",
      "Farming Insights & Market Analysis":
        "Conseils agricoles et analyse du marché"
    },

    ar: {
      Home: "الرئيسية",
      Calculator: "حاسبة الأرباح",
      Guides: "الأدلة",
      Blog: "المدونة",
      About: "من نحن",
      Contact: "اتصل بنا",
      Language: "اللغة",
      "Free Farming Tool": "أداة زراعية مجانية",
      "Know Your Farm Profit Before You Plant":
        "اعرف ربح مزرعتك قبل أن تزرع",
      "Calculate My Farm Profit": "احسب ربح مزرعتي",
      "Browse Farming Guides": "تصفح الأدلة الزراعية",
      "Plan Your Farm. Calculate Your Profit.":
        "خطط لمزرعتك واحسب أرباحك",
      "100% Free": "مجاني 100%",
      "Open Calculator": "افتح الحاسبة",
      "How it works": "كيف تعمل",
      "Three Steps to Your Farm Profit Report":
        "ثلاث خطوات للحصول على تقرير أرباح مزرعتك",
      "No sign-up. No payment. Just your numbers.":
        "لا تسجيل ولا دفع، فقط أرقام مزرعتك",
      "Farming Guides": "الأدلة الزراعية",
      "Go Deeper With Expert Guides":
        "تعرف أكثر من خلال أدلتنا المتخصصة",
      "About GoOrganicAfrica": "عن GoOrganicAfrica",
      "From the Blog": "من المدونة",
      "Farming Insights & Market Analysis":
        "رؤى زراعية وتحليل السوق"
    },

    pt: {
      Home: "Início",
      Calculator: "Calculadora",
      Guides: "Guias",
      Blog: "Blog",
      About: "Sobre",
      Contact: "Contacto",
      Language: "Idioma",
      "Free Farming Tool": "Ferramenta agrícola gratuita",
      "Know Your Farm Profit Before You Plant":
        "Conheça o lucro da sua fazenda antes de plantar",
      "Calculate My Farm Profit": "Calcular o lucro da minha fazenda",
      "Browse Farming Guides": "Ver guias agrícolas",
      "Plan Your Farm. Calculate Your Profit.":
        "Planeje sua fazenda. Calcule seu lucro.",
      "100% Free": "100% gratuito",
      "Open Calculator": "Abrir calculadora",
      "How it works": "Como funciona",
      "Three Steps to Your Farm Profit Report":
        "Três passos para o seu relatório de lucro",
      "No sign-up. No payment. Just your numbers.":
        "Sem cadastro. Sem pagamento. Apenas os seus números.",
      "Farming Guides": "Guias agrícolas",
      "Go Deeper With Expert Guides":
        "Aprofunde-se com nossos guias especializados",
      "About GoOrganicAfrica": "Sobre a GoOrganicAfrica",
      "From the Blog": "Do blog",
      "Farming Insights & Market Analysis":
        "Informações agrícolas e análise de mercado"
    },

    sw: {
      Home: "Nyumbani",
      Calculator: "Kikokotoo",
      Guides: "Miongozo",
      Blog: "Blogu",
      About: "Kuhusu",
      Contact: "Wasiliana",
      Language: "Lugha",
      "Free Farming Tool": "Zana ya Kilimo ya Bure",
      "Know Your Farm Profit Before You Plant":
        "Jua faida ya shamba lako kabla ya kupanda",
      "Calculate My Farm Profit": "Hesabu Faida ya Shamba Langu",
      "Browse Farming Guides": "Vinjari Miongozo ya Kilimo",
      "Plan Your Farm. Calculate Your Profit.":
        "Panga Shamba Lako. Hesabu Faida Yako.",
      "100% Free": "Bure 100%",
      "Open Calculator": "Fungua Kikokotoo",
      "How it works": "Jinsi inavyofanya kazi",
      "Three Steps to Your Farm Profit Report":
        "Hatua tatu za kupata ripoti ya faida ya shamba",
      "No sign-up. No payment. Just your numbers.":
        "Hakuna usajili. Hakuna malipo. Nambari zako tu.",
      "Farming Guides": "Miongozo ya Kilimo",
      "Go Deeper With Expert Guides":
        "Jifunze zaidi kupitia miongozo yetu ya kitaalamu",
      "About GoOrganicAfrica": "Kuhusu GoOrganicAfrica",
      "From the Blog": "Kutoka kwenye Blogu",
      "Farming Insights & Market Analysis":
        "Maarifa ya kilimo na uchambuzi wa soko"
    }
  };

  const originalText = new Map();

  function translateElement(element, lang) {
    const text = element.textContent.trim();

    if (!originalText.has(element)) {
      originalText.set(element, text);
    }

    const original = originalText.get(element);
    const translated = translations[lang] && translations[lang][original];

    if (translated) {
      element.textContent = translated;
    } else if (lang === "en") {
      element.textContent = original;
    }
  }

  function applyLanguage(lang) {
    if (!translations[lang]) lang = "en";

    localStorage.setItem("goa_language", lang);

    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

    document.querySelectorAll(
      "nav a, nav label, .hero .eyebrow, .hero h1, .hero p, .hero li, .hero .btn, " +
      ".packet-title, .packet-tagline, .packet-price, .packet-footer .btn, " +
      ".section-head .eyebrow, .section-head h2, .section-head .lede, " +
      ".trust-item .label, section h2, section h3, section p, section .btn"
    ).forEach(function (element) {
      translateElement(element, lang);
    });
  }

  const saved = localStorage.getItem("goa_language") || "en";

  if (Array.from(select.options).some(function (option) {
    return option.value === saved;
  })) {
    select.value = saved;
  }

  select.addEventListener("change", function () {
    applyLanguage(this.value);
  });

  applyLanguage(saved);
});
