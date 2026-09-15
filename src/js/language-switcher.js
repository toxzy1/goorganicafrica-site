document.addEventListener("DOMContentLoaded", function () {
  const selector = document.getElementById("site-language-select");

  if (!selector) {
    console.warn("GoOrganicAfrica: language selector not found.");
    return;
  }

  /*
   * GoOrganicAfrica Homepage Translation System
   * Languages:
   * English = en
   * French  = fr
   * Arabic  = ar
   * Portuguese = pt
   * Swahili = sw
   */

  const translations = {

    fr: {
      "Free Farming Tool": "Outil agricole gratuit",
      "Know Your Farm Profit Before You Plant":
        "Connaissez le bénéfice de votre ferme avant de planter",
      "Calculate your cost of production, expected revenue, profit, ROI and break-even point — free, across Nigeria and Africa, in your own currency.":
        "Calculez gratuitement vos coûts de production, revenus prévus, bénéfices, ROI et seuil de rentabilité au Nigeria et en Afrique, dans votre propre devise.",
      "Crops, livestock & more — continuously expanding":
        "Cultures, élevage et plus — en expansion continue",
      "Enter farm size in acres, plots or hectares":
        "Entrez la superficie en acres, parcelles ou hectares",
      "Override any figure with your own local numbers":
        "Remplacez les chiffres par vos propres données locales",
      "Conservative, Expected & Optimistic profit scenarios":
        "Scénarios de bénéfice prudent, prévu et optimiste",
      "Calculate My Farm Profit":
        "Calculer le bénéfice de ma ferme",
      "Browse Farming Guides":
        "Parcourir les guides agricoles",

      "FREE TOOL": "OUTIL GRATUIT",
      "Farm Profit Calculator Africa":
        "Calculateur de bénéfice agricole Afrique",
      "Plan Your Farm. Calculate Your Profit.":
        "Planifiez votre ferme. Calculez votre bénéfice.",
      "Crops & growing":
        "Cultures",
      "Livestock & growing":
        "Élevage",
      "100% Free":
        "100 % gratuit",
      "Open Calculator":
        "Ouvrir le calculateur",

      "Farming enterprises":
        "Entreprises agricoles",
      "African countries":
        "Pays africains",
      "States / regions / provinces":
        "États / régions / provinces",
      "Free to use":
        "Gratuit à utiliser",

      "How it works":
        "Comment ça marche",
      "Three Steps to Your Farm Profit Report":
        "Trois étapes pour votre rapport de bénéfice",
      "No sign-up. No payment. Just your numbers.":
        "Aucune inscription. Aucun paiement. Seulement vos chiffres.",

      "1. Pick Your Country & Crop":
        "1. Choisissez votre pays et votre culture",
      "Select your African country, your region, and the crop or livestock you plan to farm. Currency and data adjust automatically.":
        "Sélectionnez votre pays africain, votre région et la culture ou l'élevage que vous souhaitez pratiquer. La devise et les données s'adaptent automatiquement.",

      "2. Enter Your Farm Details":
        "2. Entrez les détails de votre ferme",
      "Choose farm size in acres, plots or hectares. Use our researched cost and price estimates, or enter your own local figures.":
        "Choisissez la superficie en acres, parcelles ou hectares. Utilisez nos estimations de coûts et de prix ou saisissez vos propres chiffres locaux.",

      "3. Get Your Profit Report":
        "3. Obtenez votre rapport de bénéfice",
      "See your total investment, expected revenue, estimated profit, ROI, and break-even price — plus 3 scenarios and personalised advice.":
        "Consultez votre investissement total, vos revenus prévus, votre bénéfice estimé, votre ROI et votre seuil de rentabilité — avec 3 scénarios et des conseils personnalisés.",

      "Try the Calculator — It's Free":
        "Essayer le calculateur — c'est gratuit",

      "Farming Guides":
        "Guides agricoles",
      "Go Deeper With Expert Guides":
        "Approfondissez avec nos guides",
      "Step-by-step organic farming guides — written from real research and farm experience, not theory.":
        "Des guides agricoles biologiques étape par étape, basés sur de vraies recherches et expériences agricoles.",
      "View Guide →":
        "Voir le guide →",
      "See All Guides":
        "Voir tous les guides",

      "About GoOrganicAfrica":
        "À propos de GoOrganicAfrica",
      "Built from the Farm, Not the Classroom":
        "Créé à partir de la ferme, pas de la salle de classe",
      "Read More":
        "En savoir plus",

      "Practical guides":
        "Guides pratiques",
      "Calculator countries":
        "Pays du calculateur",
      "Farm-tested":
        "Testé sur le terrain",
      "Calculator tool":
        "Outil de calcul",

      "From the Blog":
        "Depuis le blog",
      "Farming Insights & Market Analysis":
        "Conseils agricoles et analyse du marché",
      "Practical articles across categories — written to help African farmers make better decisions.":
        "Des articles pratiques pour aider les agriculteurs africains à prendre de meilleures décisions.",
      "Blog categories":
        "Catégories du blog",
      "Read article":
        "Lire l'article",
      "Explore All Articles":
        "Explorer tous les articles",
      "Explore Blog":
        "Explorer le blog"
    },

    ar: {
      "Free Farming Tool": "أداة زراعية مجانية",
      "Know Your Farm Profit Before You Plant":
        "اعرف ربح مزرعتك قبل أن تزرع",
      "Calculate your cost of production, expected revenue, profit, ROI and break-even point — free, across Nigeria and Africa, in your own currency.":
        "احسب تكلفة الإنتاج والإيرادات المتوقعة والربح والعائد على الاستثمار ونقطة التعادل مجانًا في نيجيريا وأفريقيا وبعملتك المحلية.",
      "Crops, livestock & more — continuously expanding":
        "المحاصيل والثروة الحيوانية والمزيد — في توسع مستمر",
      "Enter farm size in acres, plots or hectares":
        "أدخل مساحة المزرعة بالفدان أو القطع أو الهكتار",
      "Override any figure with your own local numbers":
        "يمكنك استبدال أي رقم بأرقامك المحلية",
      "Conservative, Expected & Optimistic profit scenarios":
        "سيناريوهات ربح متحفظ ومتوقع ومتفائل",
      "Calculate My Farm Profit":
        "احسب ربح مزرعتي",
      "Browse Farming Guides":
        "تصفح الأدلة الزراعية",

      "FREE TOOL": "أداة مجانية",
      "Farm Profit Calculator Africa":
        "حاسبة أرباح المزارع في أفريقيا",
      "Plan Your Farm. Calculate Your Profit.":
        "خطط لمزرعتك. احسب أرباحك.",
      "Crops & growing":
        "المحاصيل والزراعة",
      "Livestock & growing":
        "الثروة الحيوانية",
      "100% Free":
        "مجانية 100٪",
      "Open Calculator":
        "فتح الحاسبة",

      "Farming enterprises":
        "المشاريع الزراعية",
      "African countries":
        "الدول الأفريقية",
      "States / regions / provinces":
        "الولايات / المناطق / المقاطعات",
      "Free to use":
        "مجانية للاستخدام",

      "How it works":
        "كيف تعمل",
      "Three Steps to Your Farm Profit Report":
        "ثلاث خطوات للحصول على تقرير أرباح مزرعتك",
      "No sign-up. No payment. Just your numbers.":
        "لا حاجة للتسجيل. لا يوجد دفع. فقط أدخل أرقامك.",

      "1. Pick Your Country & Crop":
        "1. اختر الدولة والمحصول",
      "Select your African country, your region, and the crop or livestock you plan to farm. Currency and data adjust automatically.":
        "اختر دولتك الأفريقية ومنطقتك والمحصول أو الثروة الحيوانية التي تخطط لإنتاجها. يتم تعديل العملة والبيانات تلقائيًا.",

      "2. Enter Your Farm Details":
        "2. أدخل تفاصيل مزرعتك",
      "Choose farm size in acres, plots or hectares. Use our researched cost and price estimates, or enter your own local figures.":
        "اختر مساحة المزرعة بالفدان أو القطع أو الهكتار. استخدم تقديرات التكلفة والأسعار التي قمنا بالبحث عنها أو أدخل أرقامك المحلية.",

      "3. Get Your Profit Report":
        "3. احصل على تقرير الأرباح",
      "See your total investment, expected revenue, estimated profit, ROI, and break-even price — plus 3 scenarios and personalised advice.":
        "شاهد إجمالي الاستثمار والإيرادات المتوقعة والربح المقدر والعائد على الاستثمار وسعر التعادل، بالإضافة إلى 3 سيناريوهات ونصائح مخصصة.",

      "Try the Calculator — It's Free":
        "جرب الحاسبة — إنها مجانية",

      "Farming Guides":
        "الأدلة الزراعية",
      "Go Deeper With Expert Guides":
        "تعمق من خلال الأدلة المتخصصة",
      "Step-by-step organic farming guides — written from real research and farm experience, not theory.":
        "أدلة زراعية عضوية خطوة بخطوة مبنية على البحث الحقيقي والخبرة الزراعية.",
      "View Guide →":
        "عرض الدليل ←",
      "See All Guides":
        "عرض جميع الأدلة",

      "About GoOrganicAfrica":
        "عن GoOrganicAfrica",
      "Built from the Farm, Not the Classroom":
        "بُنيت من المزرعة وليس من الفصل الدراسي",
      "Read More":
        "اقرأ المزيد",

      "Practical guides":
        "أدلة عملية",
      "Calculator countries":
        "دول الحاسبة",
      "Farm-tested":
        "تم اختبارها في المزرعة",
      "Calculator tool":
        "أداة الحاسبة",

      "From the Blog":
        "من المدونة",
      "Farming Insights & Market Analysis":
        "رؤى زراعية وتحليل السوق",
      "Practical articles across categories — written to help African farmers make better decisions.":
        "مقالات عملية تساعد المزارعين الأفارقة على اتخاذ قرارات أفضل.",
      "Blog categories":
        "تصنيفات المدونة",
      "Read article":
        "اقرأ المقال",
      "Explore All Articles":
        "استكشف جميع المقالات",
      "Explore Blog":
        "استكشف المدونة"
    },

    pt: {
      "Free Farming Tool": "Ferramenta agrícola gratuita",
      "Know Your Farm Profit Before You Plant":
        "Saiba o lucro da sua fazenda antes de plantar",
      "Calculate your cost of production, expected revenue, profit, ROI and break-even point — free, across Nigeria and Africa, in your own currency.":
        "Calcule gratuitamente os custos de produção, receita esperada, lucro, ROI e ponto de equilíbrio na Nigéria e em África, na sua própria moeda.",
      "Crops, livestock & more — continuously expanding":
        "Culturas, pecuária e muito mais — em expansão contínua",
      "Enter farm size in acres, plots or hectares":
        "Informe o tamanho da fazenda em acres, parcelas ou hectares",
      "Override any figure with your own local numbers":
        "Substitua qualquer valor pelos seus números locais",
      "Conservative, Expected & Optimistic profit scenarios":
        "Cenários de lucro conservador, esperado e otimista",
      "Calculate My Farm Profit":
        "Calcular o lucro da minha fazenda",
      "Browse Farming Guides":
        "Explorar guias agrícolas",

      "FREE TOOL": "FERRAMENTA GRATUITA",
      "Farm Profit Calculator Africa":
        "Calculadora de Lucro Agrícola da África",
      "Plan Your Farm. Calculate Your Profit.":
        "Planeje sua fazenda. Calcule seu lucro.",
      "Crops & growing":
        "Culturas e produção",
      "Livestock & growing":
        "Pecuária e produção",
      "100% Free":
        "100% gratuito",
      "Open Calculator":
        "Abrir calculadora",

      "Farming enterprises":
        "Empreendimentos agrícolas",
      "African countries":
        "Países africanos",
      "States / regions / provinces":
        "Estados / regiões / províncias",
      "Free to use":
        "Gratuito para usar",

      "How it works":
        "Como funciona",
      "Three Steps to Your Farm Profit Report":
        "Três passos para o seu relatório de lucro",
      "No sign-up. No payment. Just your numbers.":
        "Sem cadastro. Sem pagamento. Apenas os seus números.",

      "1. Pick Your Country & Crop":
        "1. Escolha o país e a cultura",
      "Select your African country, your region, and the crop or livestock you plan to farm. Currency and data adjust automatically.":
        "Selecione seu país africano, sua região e a cultura ou criação que pretende produzir. A moeda e os dados são ajustados automaticamente.",

      "2. Enter Your Farm Details":
        "2. Informe os detalhes da sua fazenda",
      "Choose farm size in acres, plots or hectares. Use our researched cost and price estimates, or enter your own local figures.":
        "Escolha o tamanho em acres, parcelas ou hectares. Use nossas estimativas pesquisadas de custos e preços ou informe seus próprios valores locais.",

      "3. Get Your Profit Report":
        "3. Obtenha seu relatório de lucro",
      "See your total investment, expected revenue, estimated profit, ROI, and break-even price — plus 3 scenarios and personalised advice.":
        "Veja seu investimento total, receita esperada, lucro estimado, ROI e preço de equilíbrio — além de 3 cenários e recomendações personalizadas.",

      "Try the Calculator — It's Free":
        "Experimentar a calculadora — é grátis",

      "Farming Guides":
        "Guias agrícolas",
      "Go Deeper With Expert Guides":
        "Aprofunde seus conhecimentos com nossos guias",
      "Step-by-step organic farming guides — written from real research and farm experience, not theory.":
        "Guias de agricultura orgânica passo a passo, baseados em pesquisas reais e experiência agrícola.",
      "View Guide →":
        "Ver guia →",
      "See All Guides":
        "Ver todos os guias",

      "About GoOrganicAfrica":
        "Sobre a GoOrganicAfrica",
      "Built from the Farm, Not the Classroom":
        "Construída na fazenda, não na sala de aula",
      "Read More":
        "Leia mais",

      "Practical guides":
        "Guias práticos",
      "Calculator countries":
        "Países da calculadora",
      "Farm-tested":
        "Testado na fazenda",
      "Calculator tool":
        "Ferramenta de cálculo",

      "From the Blog":
        "Do blog",
      "Farming Insights & Market Analysis":
        "Informações agrícolas e análise de mercado",
      "Practical articles across categories — written to help African farmers make better decisions.":
        "Artigos práticos para ajudar os agricultores africanos a tomar decisões melhores.",
      "Blog categories":
        "Categorias do blog",
      "Read article":
        "Ler artigo",
      "Explore All Articles":
        "Explorar todos os artigos",
      "Explore Blog":
        "Explorar blog"
    },

    sw: {
      "Free Farming Tool": "Zana la Kilimo Bure",
      "Know Your Farm Profit Before You Plant":
        "Jua Faida ya Shamba Lako Kabla ya Kupanda",
      "Calculate your cost of production, expected revenue, profit, ROI and break-even point — free, across Nigeria and Africa, in your own currency.":
        "Hesabu gharama za uzalishaji, mapato yanayotarajiwa, faida, ROI na kiwango cha kuvunja hasara bila malipo nchini Nigeria na Afrika kwa sarafu yako mwenyewe.",
      "Crops, livestock & more — continuously expanding":
        "Mazao, mifugo na zaidi — yanaendelea kuongezeka",
      "Enter farm size in acres, plots or hectares":
        "Weka ukubwa wa shamba kwa ekari, vitalu au hekta",
      "Override any figure with your own local numbers":
        "Badilisha takwimu yoyote kwa namba zako za eneo lako",
      "Conservative, Expected & Optimistic profit scenarios":
        "Hali za faida ya tahadhari, inayotarajiwa na yenye matumaini",
      "Calculate My Farm Profit":
        "Hesabu Faida ya Shamba Langu",
      "Browse Farming Guides":
        "Vinjari Miongozo ya Kilimo",

      "FREE TOOL": "ZANA BURE",
      "Farm Profit Calculator Africa":
        "Kikokotoo cha Faida ya Kilimo Afrika",
      "Plan Your Farm. Calculate Your Profit.":
        "Panga Shamba Lako. Hesabu Faida Yako.",
      "Crops & growing":
        "Mazao na uzalishaji",
      "Livestock & growing":
        "Mifugo na uzalishaji",
      "100% Free":
        "Bure 100%",
      "Open Calculator":
        "Fungua Kikokotoo",

      "Farming enterprises":
        "Biashara za kilimo",
      "African countries":
        "Nchi za Afrika",
      "States / regions / provinces":
        "Majimbo / mikoa / provinces",
      "Free to use":
        "Bure kutumia",

      "How it works":
        "Jinsi inavyofanya kazi",
      "Three Steps to Your Farm Profit Report":
        "Hatua Tatu za Kupata Ripoti ya Faida ya Shamba",
      "No sign-up. No payment. Just your numbers.":
        "Hakuna usajili. Hakuna malipo. Namba zako tu.",

      "1. Pick Your Country & Crop":
        "1. Chagua Nchi na Zao",
      "Select your African country, your region, and the crop or livestock you plan to farm. Currency and data adjust automatically.":
        "Chagua nchi yako ya Afrika, eneo lako na zao au mifugo unayopanga kufuga. Sarafu na data hubadilika moja kwa moja.",

      "2. Enter Your Farm Details":
        "2. Weka Maelezo ya Shamba Lako",
      "Choose farm size in acres, plots or hectares. Use our researched cost and price estimates, or enter your own local figures.":
        "Chagua ukubwa wa shamba kwa ekari, vitalu au hekta. Tumia makadirio yetu ya gharama na bei au weka takwimu zako za eneo lako.",

      "3. Get Your Profit Report":
        "3. Pata Ripoti ya Faida",
      "See your total investment, expected revenue, estimated profit, ROI, and break-even price — plus 3 scenarios and personalised advice.":
        "Angalia uwekezaji wako wote, mapato yanayotarajiwa, faida iliyokadiriwa, ROI na bei ya kuvunja hasara — pamoja na hali 3 na ushauri maalum.",

      "Try the Calculator — It's Free":
        "Jaribu Kikokotoo — Ni Bure",

      "Farming Guides":
        "Miongozo ya Kilimo",
      "Go Deeper With Expert Guides":
        "Jifunze Zaidi Kupitia Miongozo ya Wataalamu",
      "Step-by-step organic farming guides — written from real research and farm experience, not theory.":
        "Miongozo ya kilimo hai ya hatua kwa hatua, iliyoandikwa kutokana na utafiti halisi na uzoefu wa shambani.",
      "View Guide →":
        "Tazama Mwongozo →",
      "See All Guides":
        "Tazama Miongozo Yote",

      "About GoOrganicAfrica":
        "Kuhusu GoOrganicAfrica",
      "Built from the Farm, Not the Classroom":
        "Imejengwa Kutoka Shambani, Sio Darasani",
      "Read More":
        "Soma Zaidi",

      "Practical guides":
        "Miongozo ya vitendo",
      "Calculator countries":
        "Nchi za kikokotoo",
      "Farm-tested":
        "Imejaribiwa shambani",
      "Calculator tool":
        "Zana ya kikokotoo",

      "From the Blog":
        "Kutoka kwenye Blogu",
      "Farming Insights & Market Analysis":
        "Maarifa ya Kilimo na Uchambuzi wa Soko",
      "Practical articles across categories — written to help African farmers make better decisions.":
        "Makala za vitendo zinazowasaidia wakulima wa Afrika kufanya maamuzi bora.",
      "Blog categories":
        "Makundi ya blogu",
      "Read article":
        "Soma makala",
      "Explore All Articles":
        "Chunguza Makala Zote",
      "Explore Blog":
        "Chunguza Blogu"
    }
  };


  /*
   * Save the original English text of every text node.
   * This allows the user to switch back to English correctly.
   */

  const originalTextNodes = new Map();

  function collectTextNodes() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {

          if (!node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT;
          }

          const parent = node.parentElement;

          if (!parent) {
            return NodeFilter.FILTER_REJECT;
          }

          /*
           * Do not translate scripts, styles or the language selector itself.
           */
          const tag = parent.tagName.toLowerCase();

          if (
            tag === "script" ||
            tag === "style" ||
            tag === "noscript" ||
            parent.closest("#site-language-select")
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;

    while ((node = walker.nextNode())) {
      if (!originalTextNodes.has(node)) {
        originalTextNodes.set(node, node.nodeValue);
      }
    }
  }


  function normalise(text) {
    return text.replace(/\s+/g, " ").trim();
  }


  function applyLanguage(language) {

    collectTextNodes();

    /*
     * English = restore original page text.
     */
    if (language === "en") {

      originalTextNodes.forEach(function (originalText, node) {
        if (node.isConnected) {
          node.nodeValue = originalText;
        }
      });

      document.documentElement.lang = "en";
      document.documentElement.dir = "ltr";

      localStorage.setItem("goa_language", "en");

      return;
    }


    const dictionary = translations[language];

    if (!dictionary) {
      return;
    }


    originalTextNodes.forEach(function (originalText, node) {

      if (!node.isConnected) {
        return;
      }

      const cleanText = normalise(originalText);

      if (dictionary[cleanText]) {

        /*
         * Preserve leading/trailing spaces where necessary.
         */
        const leading =
          originalText.match(/^\s*/)?.[0] || "";

        const trailing =
          originalText.match(/\s*$/)?.[0] || "";

        node.nodeValue =
          leading +
          dictionary[cleanText] +
          trailing;
      }

    });


    document.documentElement.lang = language;

    /*
     * Arabic requires right-to-left page direction.
     */
    document.documentElement.dir =
      language === "ar" ? "rtl" : "ltr";

    localStorage.setItem("goa_language", language);
  }


  /*
   * Restore saved language when the page opens.
   */
  const savedLanguage =
    localStorage.getItem("goa_language") || "en";


  const languageExists = Array.from(
    selector.options
  ).some(function (option) {
    return option.value === savedLanguage;
  });


  if (languageExists) {
    selector.value = savedLanguage;
  } else {
    selector.value = "en";
  }


  /*
   * Translate immediately when the user changes the dropdown.
   */
  selector.addEventListener("change", function () {

    const selectedLanguage = this.value;

    applyLanguage(selectedLanguage);

  });


  /*
   * Apply saved language on page load.
   */
  applyLanguage(selector.value);

});
