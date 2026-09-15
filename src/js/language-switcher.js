document.addEventListener("DOMContentLoaded", function () {
  const selector = document.getElementById("site-language-select");

  if (!selector) {
    console.warn("GoOrganicAfrica: language selector not found.");
    return;
  }

  const translations = {
    en: {
      free_tool: "Free Farming Tool",
      hero_title: "Know Your Farm Profit Before You Plant",
      hero_description:
        "Calculate your cost of production, expected revenue, profit, ROI and break-even point — free, across Nigeria and Africa, in your own currency.",
      crops_livestock: "Crops, livestock & more — continuously expanding",
      farm_size: "Enter farm size in acres, plots or hectares",
      local_numbers: "Override any figure with your own local numbers",
      profit_scenarios: "Conservative, Expected & Optimistic profit scenarios",
      calculate_profit: "Calculate My Farm Profit",
      browse_guides: "Browse Farming Guides",

      free_tool_upper: "FREE TOOL",
      calculator_title: "Farm Profit Calculator Africa",
      calculator_tagline: "Plan Your Farm. Calculate Your Profit.",
      crops_growing: "Crops & growing",
      livestock_growing: "Livestock & growing",
      free_100: "100% Free",
      open_calculator: "Open Calculator",

      farming_enterprises: "Farming enterprises",
      african_countries: "African countries",
      regions: "States / regions / provinces",
      free_to_use: "Free to use",

      how_it_works: "How it works",
      three_steps: "Three Steps to Your Farm Profit Report",
      no_signup: "No sign-up. No payment. Just your numbers.",

      step1_title: "1. Pick Your Country & Crop",
      step1_text:
        "Select your African country, your region, and the crop or livestock you plan to farm. Currency and data adjust automatically.",

      step2_title: "2. Enter Your Farm Details",
      step2_text:
        "Choose farm size in acres, plots or hectares. Use our researched cost and price estimates, or enter your own local figures.",

      step3_title: "3. Get Your Profit Report",
      step3_text:
        "See your total investment, expected revenue, estimated profit, ROI, and break-even price — plus 3 scenarios and personalised advice.",

      try_calculator: "Try the Calculator — It's Free",

      farming_guides: "Farming Guides",
      expert_guides: "Go Deeper With Expert Guides",
      guides_description:
        "Step-by-step organic farming guides — written from real research and farm experience, not theory.",
      view_guide: "View Guide →",
      see_all_guides: "See All Guides",

      about_goa: "About GoOrganicAfrica",
      about_title: "Built from the Farm, Not the Classroom",
      about_text:
        "GoOrganicAfrica is built by Amoo Oluwatoyin Owolabi — farmer, agricultural researcher, and organic bio-fertilizer producer with a certificate in Agriculture since 2001. Every tool and guide here comes from real production experience across Nigeria, Cameroon and beyond.",
      read_more: "Read More",

      practical_guides: "Practical guides",
      calculator_countries: "Calculator countries",
      farm_tested: "Farm-tested",
      calculator_tool: "Calculator tool",

      from_blog: "From the Blog",
      blog_title: "Farming Insights & Market Analysis",
      blog_description:
        "Practical articles across categories — written to help African farmers make better decisions.",
      blog_categories: "Blog categories",
      read_article: "Read article",
      explore_articles: "Explore All Articles",
      articles_future:
        "Articles will appear here automatically when published from the admin panel.",
      explore_blog: "Explore Blog"
    },

    fr: {
      free_tool: "Outil agricole gratuit",
      hero_title: "Connaissez le bénéfice de votre ferme avant de planter",
      hero_description:
        "Calculez gratuitement vos coûts de production, revenus prévus, bénéfices, ROI et seuil de rentabilité au Nigeria et en Afrique, dans votre propre devise.",
      crops_livestock: "Cultures, élevage et plus — en expansion continue",
      farm_size: "Entrez la superficie en acres, parcelles ou hectares",
      local_numbers: "Remplacez les chiffres par vos propres données locales",
      profit_scenarios: "Scénarios de bénéfice prudent, prévu et optimiste",
      calculate_profit: "Calculer le bénéfice de ma ferme",
      browse_guides: "Parcourir les guides agricoles",

      free_tool_upper: "OUTIL GRATUIT",
      calculator_title: "Calculateur de bénéfice agricole Afrique",
      calculator_tagline: "Planifiez votre ferme. Calculez votre bénéfice.",
      crops_growing: "Cultures",
      livestock_growing: "Élevage",
      free_100: "100 % gratuit",
      open_calculator: "Ouvrir le calculateur",

      farming_enterprises: "Entreprises agricoles",
      african_countries: "Pays africains",
      regions: "États / régions / provinces",
      free_to_use: "Gratuit à utiliser",

      how_it_works: "Comment ça marche",
      three_steps: "Trois étapes pour votre rapport de bénéfice",
      no_signup: "Aucune inscription. Aucun paiement. Seulement vos chiffres.",

      step1_title: "1. Choisissez votre pays et votre culture",
      step1_text:
        "Sélectionnez votre pays africain, votre région et la culture ou l'élevage que vous souhaitez pratiquer. La devise et les données s'adaptent automatiquement.",

      step2_title: "2. Entrez les détails de votre ferme",
      step2_text:
        "Choisissez la superficie en acres, parcelles ou hectares. Utilisez nos estimations de coûts et de prix ou saisissez vos propres chiffres locaux.",

      step3_title: "3. Obtenez votre rapport de bénéfice",
      step3_text:
        "Consultez votre investissement total, vos revenus prévus, votre bénéfice estimé, votre ROI et votre seuil de rentabilité — avec 3 scénarios et des conseils personnalisés.",

      try_calculator: "Essayer le calculateur — c'est gratuit",

      farming_guides: "Guides agricoles",
      expert_guides: "Approfondissez avec nos guides",
      guides_description:
        "Des guides agricoles biologiques étape par étape, basés sur de vraies recherches et expériences agricoles.",
      view_guide: "Voir le guide →",
      see_all_guides: "Voir tous les guides",

      about_goa: "À propos de GoOrganicAfrica",
      about_title: "Créé à partir de la ferme, pas de la salle de classe",
      about_text:
        "GoOrganicAfrica est créé par Amoo Oluwatoyin Owolabi — agriculteur, chercheur agricole et producteur de biofertilisants biologiques, titulaire d'un certificat en agriculture depuis 2001. Chaque outil et chaque guide provient d'une expérience réelle de production au Nigeria, au Cameroun et au-delà.",
      read_more: "En savoir plus",

      practical_guides: "Guides pratiques",
      calculator_countries: "Pays du calculateur",
      farm_tested: "Testé sur le terrain",
      calculator_tool: "Outil de calcul",

      from_blog: "Depuis le blog",
      blog_title: "Conseils agricoles et analyse du marché",
      blog_description:
        "Des articles pratiques pour aider les agriculteurs africains à prendre de meilleures décisions.",
      blog_categories: "Catégories du blog",
      read_article: "Lire l'article",
      explore_articles: "Explorer tous les articles",
      articles_future:
        "Les articles apparaîtront automatiquement ici lorsqu'ils seront publiés depuis le panneau d'administration.",
      explore_blog: "Explorer le blog"
    },

    ar: {
      free_tool: "أداة زراعية مجانية",
      hero_title: "اعرف ربح مزرعتك قبل أن تزرع",
      hero_description:
        "احسب تكلفة الإنتاج والإيرادات المتوقعة والربح والعائد على الاستثمار ونقطة التعادل مجانًا في نيجيريا وأفريقيا وبعملتك المحلية.",
      crops_livestock: "المحاصيل والثروة الحيوانية والمزيد — في توسع مستمر",
      farm_size: "أدخل مساحة المزرعة بالفدان أو القطع أو الهكتار",
      local_numbers: "يمكنك استبدال أي رقم بأرقامك المحلية",
      profit_scenarios: "سيناريوهات ربح متحفظ ومتوقع ومتفائل",
      calculate_profit: "احسب ربح مزرعتي",
      browse_guides: "تصفح الأدلة الزراعية",

      free_tool_upper: "أداة مجانية",
      calculator_title: "حاسبة أرباح المزارع في أفريقيا",
      calculator_tagline: "خطط لمزرعتك. احسب أرباحك.",
      crops_growing: "المحاصيل والزراعة",
      livestock_growing: "الثروة الحيوانية",
      free_100: "مجانية 100٪",
      open_calculator: "فتح الحاسبة",

      farming_enterprises: "المشاريع الزراعية",
      african_countries: "الدول الأفريقية",
      regions: "الولايات / المناطق / المقاطعات",
      free_to_use: "مجانية للاستخدام",

      how_it_works: "كيف تعمل",
      three_steps: "ثلاث خطوات للحصول على تقرير أرباح مزرعتك",
      no_signup: "لا حاجة للتسجيل. لا يوجد دفع. فقط أدخل أرقامك.",

      step1_title: "1. اختر الدولة والمحصول",
      step1_text:
        "اختر دولتك الأفريقية ومنطقتك والمحصول أو الثروة الحيوانية التي تخطط لإنتاجها. يتم تعديل العملة والبيانات تلقائيًا.",

      step2_title: "2. أدخل تفاصيل مزرعتك",
      step2_text:
        "اختر مساحة المزرعة بالفدان أو القطع أو الهكتار. استخدم تقديرات التكلفة والأسعار التي قمنا بالبحث عنها أو أدخل أرقامك المحلية.",

      step3_title: "3. احصل على تقرير الأرباح",
      step3_text:
        "شاهد إجمالي الاستثمار والإيرادات المتوقعة والربح المقدر والعائد على الاستثمار وسعر التعادل، بالإضافة إلى 3 سيناريوهات ونصائح مخصصة.",

      try_calculator: "جرب الحاسبة — إنها مجانية",

      farming_guides: "الأدلة الزراعية",
      expert_guides: "تعمق من خلال الأدلة المتخصصة",
      guides_description:
        "أدلة زراعية عضوية خطوة بخطوة مبنية على البحث الحقيقي والخبرة الزراعية.",
      view_guide: "عرض الدليل ←",
      see_all_guides: "عرض جميع الأدلة",

      about_goa: "عن GoOrganicAfrica",
      about_title: "بُنيت من المزرعة وليس من الفصل الدراسي",
      about_text:
        "تم إنشاء GoOrganicAfrica بواسطة Amoo Oluwatoyin Owolabi — مزارع وباحث زراعي ومنتج للأسمدة الحيوية العضوية، حاصل على شهادة في الزراعة منذ عام 2001. كل أداة ودليل هنا مبني على خبرة إنتاج حقيقية في نيجيريا والكاميرون وما وراءهما.",
      read_more: "اقرأ المزيد",

      practical_guides: "أدلة عملية",
      calculator_countries: "دول الحاسبة",
      farm_tested: "تم اختبارها في المزرعة",
      calculator_tool: "أداة الحاسبة",

      from_blog: "من المدونة",
      blog_title: "رؤى زراعية وتحليل السوق",
      blog_description:
        "مقالات عملية تساعد المزارعين الأفارقة على اتخاذ قرارات أفضل.",
      blog_categories: "تصنيفات المدونة",
      read_article: "اقرأ المقال",
      explore_articles: "استكشف جميع المقالات",
      articles_future:
        "ستظهر المقالات هنا تلقائيًا عند نشرها من لوحة الإدارة.",
      explore_blog: "استكشف المدونة"
    },

    pt: {
      free_tool: "Ferramenta agrícola gratuita",
      hero_title: "Saiba o lucro da sua fazenda antes de plantar",
      hero_description:
        "Calcule gratuitamente os custos de produção, receita esperada, lucro, ROI e ponto de equilíbrio na Nigéria e em África, na sua própria moeda.",
      crops_livestock: "Culturas, pecuária e muito mais — em expansão contínua",
      farm_size: "Informe o tamanho da fazenda em acres, parcelas ou hectares",
      local_numbers: "Substitua qualquer valor pelos seus números locais",
      profit_scenarios: "Cenários de lucro conservador, esperado e otimista",
      calculate_profit: "Calcular o lucro da minha fazenda",
      browse_guides: "Explorar guias agrícolas",

      free_tool_upper: "FERRAMENTA GRATUITA",
      calculator_title: "Calculadora de Lucro Agrícola da África",
      calculator_tagline: "Planeje sua fazenda. Calcule seu lucro.",
      crops_growing: "Culturas e produção",
      livestock_growing: "Pecuária e produção",
      free_100: "100% gratuito",
      open_calculator: "Abrir calculadora",

      farming_enterprises: "Empreendimentos agrícolas",
      african_countries: "Países africanos",
      regions: "Estados / regiões / províncias",
      free_to_use: "Gratuito para usar",

      how_it_works: "Como funciona",
      three_steps: "Três passos para o seu relatório de lucro",
      no_signup: "Sem cadastro. Sem pagamento. Apenas os seus números.",

      step1_title: "1. Escolha o país e a cultura",
      step1_text:
        "Selecione seu país africano, sua região e a cultura ou criação que pretende produzir. A moeda e os dados são ajustados automaticamente.",

      step2_title: "2. Informe os detalhes da sua fazenda",
      step2_text:
        "Escolha o tamanho em acres, parcelas ou hectares. Use nossas estimativas pesquisadas de custos e preços ou informe seus próprios valores locais.",

      step3_title: "3. Obtenha seu relatório de lucro",
      step3_text:
        "Veja seu investimento total, receita esperada, lucro estimado, ROI e preço de equilíbrio — além de 3 cenários e recomendações personalizadas.",

      try_calculator: "Experimentar a calculadora — é grátis",

      farming_guides: "Guias agrícolas",
      expert_guides: "Aprofunde seus conhecimentos com nossos guias",
      guides_description:
        "Guias de agricultura orgânica passo a passo, baseados em pesquisas reais e experiência agrícola.",
      view_guide: "Ver guia →",
      see_all_guides: "Ver todos os guias",

      about_goa: "Sobre a GoOrganicAfrica",
      about_title: "Construída na fazenda, não na sala de aula",
      about_text:
        "A GoOrganicAfrica foi criada por Amoo Oluwatoyin Owolabi — agricultor, pesquisador agrícola e produtor de biofertilizantes orgânicos, com certificado em Agricultura desde 2001. Todas as ferramentas e guias são baseados em experiência real de produção na Nigéria, Camarões e além.",
      read_more: "Leia mais",

      practical_guides: "Guias práticos",
      calculator_countries: "Países da calculadora",
      farm_tested: "Testado na fazenda",
      calculator_tool: "Ferramenta de cálculo",

      from_blog: "Do blog",
      blog_title: "Informações agrícolas e análise de mercado",
      blog_description:
        "Artigos práticos para ajudar os agricultores africanos a tomar decisões melhores.",
      blog_categories: "Categorias do blog",
      read_article: "Ler artigo",
      explore_articles: "Explorar todos os artigos",
      articles_future:
        "Os artigos aparecerão aqui automaticamente quando forem publicados pelo painel de administração.",
      explore_blog: "Explorar blog"
    },

    sw: {
      free_tool: "Zana la Kilimo Bure",
      hero_title: "Jua Faida ya Shamba Lako Kabla ya Kupanda",
      hero_description:
        "Hesabu gharama za uzalishaji, mapato yanayotarajiwa, faida, ROI na kiwango cha kuvunja hasara bila malipo nchini Nigeria na Afrika kwa sarafu yako mwenyewe.",
      crops_livestock: "Mazao, mifugo na zaidi — yanaendelea kuongezeka",
      farm_size: "Weka ukubwa wa shamba kwa ekari, vitalu au hekta",
      local_numbers: "Badilisha takwimu yoyote kwa namba zako za eneo lako",
      profit_scenarios: "Hali za faida ya tahadhari, inayotarajiwa na yenye matumaini",
      calculate_profit: "Hesabu Faida ya Shamba Langu",
      browse_guides: "Vinjari Miongozo ya Kilimo",

      free_tool_upper: "ZANA BURE",
      calculator_title: "Kikokotoo cha Faida ya Kilimo Afrika",
      calculator_tagline: "Panga Shamba Lako. Hesabu Faida Yako.",
      crops_growing: "Mazao na uzalishaji",
      livestock_growing: "Mifugo na uzalishaji",
      free_100: "Bure 100%",
      open_calculator: "Fungua Kikokotoo",

      farming_enterprises: "Biashara za kilimo",
      african_countries: "Nchi za Afrika",
      regions: "Majimbo / mikoa / provinces",
      free_to_use: "Bure kutumia",

      how_it_works: "Jinsi inavyofanya kazi",
      three_steps: "Hatua Tatu za Kupata Ripoti ya Faida ya Shamba",
      no_signup: "Hakuna usajili. Hakuna malipo. Namba zako tu.",

      step1_title: "1. Chagua Nchi na Zao",
      step1_text:
        "Chagua nchi yako ya Afrika, eneo lako na zao au mifugo unayopanga kufuga. Sarafu na data hubadilika moja kwa moja.",

      step2_title: "2. Weka Maelezo ya Shamba Lako",
      step2_text:
        "Chagua ukubwa wa shamba kwa ekari, vitalu au hekta. Tumia makadirio yetu ya gharama na bei au weka takwimu zako za eneo lako.",

      step3_title: "3. Pata Ripoti ya Faida",
      step3_text:
        "Angalia uwekezaji wako wote, mapato yanayotarajiwa, faida iliyokadiriwa, ROI na bei ya kuvunja hasara — pamoja na hali 3 na ushauri maalum.",

      try_calculator: "Jaribu Kikokotoo — Ni Bure",

      farming_guides: "Miongozo ya Kilimo",
      expert_guides: "Jifunze Zaidi Kupitia Miongozo ya Wataalamu",
      guides_description:
        "Miongozo ya kilimo hai ya hatua kwa hatua, iliyoandikwa kutokana na utafiti halisi na uzoefu wa shambani.",
      view_guide: "Tazama Mwongozo →",
      see_all_guides: "Tazama Miongozo Yote",

      about_goa: "Kuhusu GoOrganicAfrica",
      about_title: "Imejengwa Kutoka Shambani, Sio Darasani",
      about_text:
        "GoOrganicAfrica imejengwa na Amoo Oluwatoyin Owolabi — mkulima, mtafiti wa kilimo na mtengenezaji wa mbolea hai, mwenye cheti cha Kilimo tangu 2001. Kila zana na mwongozo hapa unatokana na uzoefu halisi wa uzalishaji nchini Nigeria, Cameroon na maeneo mengine.",
      read_more: "Soma Zaidi",

      practical_guides: "Miongozo ya vitendo",
      calculator_countries: "Nchi za kikokotoo",
      farm_tested: "Imejaribiwa shambani",
      calculator_tool: "Zana ya kikokotoo",

      from_blog: "Kutoka kwenye Blogu",
      blog_title: "Maarifa ya Kilimo na Uchambuzi wa Soko",
      blog_description:
        "Makala za vitendo zinazowasaidia wakulima wa Afrika kufanya maamuzi bora.",
      blog_categories: "Makundi ya blogu",
      read_article: "Soma makala",
      explore_articles: "Chunguza Makala Zote",
      articles_future:
        "Makala zitaonekana hapa moja kwa moja zitakapochapishwa kutoka kwenye paneli ya usimamizi.",
      explore_blog: "Chunguza Blogu"
    }
  };

  function applyLanguage(language) {
    const dictionary = translations[language] || translations.en;

    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";

    document.querySelectorAll("[data-i18n]").forEach(function (element) {
      const key = element.getAttribute("data-i18n");

      if (Object.prototype.hasOwnProperty.call(dictionary, key)) {
        element.textContent = dictionary[key];
      }
    });

    localStorage.setItem("goa_language", language);
  }

  const savedLanguage =
    localStorage.getItem("goa_language") || selector.value || "en";

  if (
    Array.from(selector.options).some(
      function (option) {
        return option.value === savedLanguage;
      }
    )
  ) {
    selector.value = savedLanguage;
  } else {
    selector.value = "en";
  }

  selector.addEventListener("change", function () {
    applyLanguage(this.value);
  });

  applyLanguage(selector.value);
});
