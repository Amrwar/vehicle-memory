/**
 * Providers: VIN decoding, fitment feeds, payroll adjustments and files, and
 * public reviews. Phase 43.
 */

export const fr: Readonly<Record<string, string>> = {
  // Payroll
  'Saved. It goes into the file when the period is handed over.':
    'Enregistré. Cela figurera dans le fichier quand la période sera transmise.',
  'Saved. Timesheets submitted from now on use it.':
    'Enregistré. Les feuilles de temps soumises à partir de maintenant l’utilisent.',
  'Bonuses and deductions': 'Primes et retenues',
  'Added to a sheet until its period is handed over. Tax and pension are not typed here; the payroll software works them out.':
    'Ajoutées à une feuille tant que sa période n’a pas été transmise. Les impôts et la retraite ne se saisissent pas ici : le logiciel de paie les calcule.',
  'No timesheet is waiting': 'Aucune feuille de temps en attente',
  'Submit a period and it can carry a bonus or a deduction.':
    'Soumettez une période et elle pourra porter une prime ou une retenue.',
  Bonus: 'Prime',
  Deduction: 'Retenue',
  'What for': 'Pour quoi',
  'Quarter target met': 'Objectif du trimestre atteint',
  'How pay is worked out': 'Comment la paie est calculée',
  'Overtime is the hours past each person’s contracted week':
    'Les heures supplémentaires sont celles au-delà de la semaine contractuelle de chacun',
  'Overtime multiplier': 'Majoration des heures supplémentaires',
  '1.5 is time and a half. Applies to timesheets submitted from now on.':
    '1,5 correspond à une majoration de 50 %. S’applique aux feuilles de temps soumises à partir de maintenant.',
  'The file payroll gets': 'Le fichier transmis à la paie',
  'Hours split into ordinary and overtime, pay at the workshop’s own cost rate, and the bonuses and deductions added here, in the shape the payroll software imports. None of the three shapes is certified by a payroll vendor; each is mapped once on its import screen. Tax, pension and net pay are worked out there, not here.':
    'Les heures réparties entre normales et supplémentaires, la paie au taux de coût de l’atelier, et les primes et retenues ajoutées ici, dans la forme que le logiciel de paie importe. Aucune des trois formes n’est certifiée par un éditeur de paie ; chacune se configure une fois dans son écran d’import. Les impôts, la retraite et le net sont calculés là-bas, pas ici.',
  'Marking a run paid posts gross wages, bonuses included, to the ledger and out of the bank. The deductions between gross and net come from the payroll software’s own report.':
    'Marquer un traitement comme payé passe les salaires bruts, primes comprises, en comptabilité et en sortie de banque. Les retenues entre le brut et le net proviennent du rapport du logiciel de paie.',
  'Pay summary': 'Récapitulatif de paie',
  'Hours only': 'Heures seulement',
  'Pay elements': 'Éléments de paie',
  'One row per person: hours, pay for the hours, bonuses, gross, deductions and pay after deductions.':
    'Une ligne par personne : heures, paie des heures, primes, brut, retenues et paie après retenues.',
  'One row per person with hours, bonuses and deductions but no rates, for payroll software that holds the rates itself.':
    'Une ligne par personne avec les heures, les primes et les retenues mais sans taux, pour un logiciel de paie qui détient lui-même les taux.',
  'One line per person per element (ordinary, overtime, absence, each bonus and each deduction), for software that imports pay elements.':
    'Une ligne par personne et par élément (heures normales, supplémentaires, absences, chaque prime et chaque retenue), pour un logiciel qui importe des éléments de paie.',
  'That timesheet is not in this workshop.':
    'Cette feuille de temps n’appartient pas à cet atelier.',
  'That adjustment is not in this workshop.': 'Cet ajustement n’appartient pas à cet atelier.',
  'This timesheet has been handed to payroll. A bonus or deduction now goes on the next period.':
    'Cette feuille de temps a été transmise à la paie. Une prime ou une retenue va désormais sur la période suivante.',
  'An adjustment is a bonus or a deduction.': 'Un ajustement est une prime ou une retenue.',
  'Say what it is for, in a few words, so the payroll clerk can tell what they are paying.':
    'Dites en quelques mots à quoi cela correspond, pour que le gestionnaire de paie sache ce qu’il paie.',
  'The amount is more than nothing and less than a hundred thousand. Whether it adds or takes away is the kind.':
    'Le montant est supérieur à zéro et inférieur à cent mille. C’est le type qui indique s’il s’ajoute ou se retire.',
  'Overtime is paid at between 1 and 3 times the hourly rate, to two decimal places. Time and a half is 1.5.':
    'Les heures supplémentaires sont payées entre 1 et 3 fois le taux horaire, avec deux décimales. Une majoration de 50 % correspond à 1,5.',
  'There is no payroll file of that name.': 'Aucun fichier de paie ne porte ce nom.',
  'payroll bonus added': 'prime ajoutée à la paie',
  'payroll deduction added': 'retenue ajoutée à la paie',
  'payroll adjustment removed': 'ajustement de paie retiré',
  'settings payroll updated': 'réglages de paie modifiés',

  // Fitment feeds
  'Fetch from {feed}': 'Récupérer depuis {feed}',
  '{feed} has nothing new for this part.': '{feed} n’a rien de nouveau pour cette pièce.',
  '{feed}: {added} added, {removed} taken back.': '{feed} : {added} ajoutées, {removed} retirées.',
  '{unchanged} already recorded; {kept} left as somebody here recorded them. A fitment typed here is never replaced by a catalogue.':
    '{unchanged} déjà enregistrées ; {kept} laissées telles que quelqu’un d’ici les a saisies. Une compatibilité saisie ici n’est jamais remplacée par un catalogue.',
  'The sample catalogue knows the demonstration parts only. A real feed is connected per installation.':
    'Le catalogue d’exemple ne connaît que les pièces de démonstration. Un vrai flux se connecte par installation.',
  '{feed}, fetched {date}': '{feed}, récupéré le {date}',
  'Sample catalogue': 'Catalogue d’exemple',
  'No fitment feed is connected to this workshop.':
    'Aucun flux de compatibilités n’est connecté à cet atelier.',
  'fitment feed fetched': 'flux de compatibilités récupéré',

  // VIN decoding
  'Read from the VIN by {decoder}:': 'Lu dans le VIN par {decoder} :',
  '{decoder} could not name the maker from this VIN.':
    '{decoder} n’a pas pu identifier le constructeur à partir de ce VIN.',
  'Check it against the car before adding it.': 'Vérifiez-le sur la voiture avant de l’ajouter.',
  'The VIN itself names only the maker and sometimes the year. Type the model from the car.':
    'Le VIN seul n’indique que le constructeur et parfois l’année. Saisissez le modèle d’après la voiture.',
  'Read the VIN': 'Lire le VIN',
  'the built-in reader': 'le décodeur intégré',
  'NHTSA vPIC': 'NHTSA vPIC',

  // Public reviews
  'Public reviews': 'Avis publics',
  'A customer who gives five is offered a button to say so on {site}. They write it themselves, under their own name.':
    'Un client qui donne cinq se voit proposer un bouton pour le dire sur {site}. Il l’écrit lui-même, sous son propre nom.',
  'Saved. The next five-star answer is offered the link.':
    'Enregistré. La prochaine réponse à cinq étoiles recevra le lien.',
  '{went} of {invited} invited went to write one.':
    '{went} sur {invited} invités sont allés en écrire un.',
  'No review site is connected to this installation.':
    'Aucun site d’avis n’est connecté à cette installation.',
  'Not set up. Until the listing is named, a five-star customer is thanked and nothing more.':
    'Non configuré. Tant que la fiche n’est pas indiquée, un client à cinq étoiles est remercié, sans plus.',
  'Open the page customers are sent to': 'Ouvrir la page où les clients sont envoyés',
  'Google place ID': 'Identifiant de lieu Google',
  'From Google’s place ID finder, or paste a write-review link that carries it. Blank turns it off.':
    'Depuis l’outil de recherche d’identifiant de lieu de Google, ou collez un lien de rédaction d’avis qui le contient. Vide, la fonction est désactivée.',
  'Find your place ID': 'Trouver votre identifiant de lieu',
  'Write a review on {site}': 'Écrire un avis sur {site}',
  'It opens {site} in your own account. What you write there is yours; we only see that you went.':
    'Cela ouvre {site} dans votre propre compte. Ce que vous y écrivez vous appartient ; nous voyons seulement que vous y êtes allé.',
  'That is not a Google place ID. It is a code of letters and digits, usually starting ChIJ, from Google’s place ID finder.':
    'Ce n’est pas un identifiant de lieu Google. C’est un code de lettres et de chiffres, commençant généralement par ChIJ, fourni par l’outil de recherche d’identifiant de lieu de Google.',
  'settings review site updated': 'site d’avis modifié',
  'review public opened': 'avis public ouvert',
};

export const ar: Readonly<Record<string, string>> = {
  // Payroll
  'Saved. It goes into the file when the period is handed over.':
    'تم الحفظ. سيدخل في الملف عند تسليم الفترة.',
  'Saved. Timesheets submitted from now on use it.':
    'تم الحفظ. ستستخدمه كشوف الدوام المقدَّمة من الآن فصاعدًا.',
  'Bonuses and deductions': 'المكافآت والخصومات',
  'Added to a sheet until its period is handed over. Tax and pension are not typed here; the payroll software works them out.':
    'تُضاف إلى الكشف ما دامت فترته لم تُسلَّم بعد. الضرائب والمعاشات لا تُدخل هنا؛ برنامج الرواتب هو من يحسبها.',
  'No timesheet is waiting': 'لا يوجد كشف دوام بالانتظار',
  'Submit a period and it can carry a bonus or a deduction.':
    'قدّم فترة لتتمكن من إضافة مكافأة أو خصم عليها.',
  Bonus: 'مكافأة',
  Deduction: 'خصم',
  'What for': 'مقابل ماذا',
  'Quarter target met': 'تحقيق هدف الربع',
  'How pay is worked out': 'كيف يُحسب الأجر',
  'Overtime is the hours past each person’s contracted week':
    'العمل الإضافي هو الساعات التي تتجاوز أسبوع العمل المتعاقد عليه لكل شخص',
  'Overtime multiplier': 'معامل العمل الإضافي',
  '1.5 is time and a half. Applies to timesheets submitted from now on.':
    '1.5 تعني الأجر مرة ونصفًا. يُطبَّق على كشوف الدوام المقدَّمة من الآن فصاعدًا.',
  'The file payroll gets': 'الملف الذي يُسلَّم للرواتب',
  'Hours split into ordinary and overtime, pay at the workshop’s own cost rate, and the bonuses and deductions added here, in the shape the payroll software imports. None of the three shapes is certified by a payroll vendor; each is mapped once on its import screen. Tax, pension and net pay are worked out there, not here.':
    'الساعات مقسومة إلى عادية وإضافية، والأجر بسعر التكلفة الخاص بالورشة، والمكافآت والخصومات المضافة هنا، بالشكل الذي يستورده برنامج الرواتب. لا يعتمد أي مورّد لبرامج الرواتب أيًّا من الأشكال الثلاثة؛ ويُضبط كل منها مرة واحدة في شاشة الاستيراد. الضرائب والمعاشات وصافي الأجر تُحسب هناك، لا هنا.',
  'Marking a run paid posts gross wages, bonuses included, to the ledger and out of the bank. The deductions between gross and net come from the payroll software’s own report.':
    'عند تعليم الدفعة كمدفوعة تُقيَّد الأجور الإجمالية، شاملة المكافآت، في الدفاتر وتُخصم من البنك. أما الخصومات بين الإجمالي والصافي فتأتي من تقرير برنامج الرواتب نفسه.',
  'Pay summary': 'ملخص الأجور',
  'Hours only': 'الساعات فقط',
  'Pay elements': 'عناصر الأجر',
  'One row per person: hours, pay for the hours, bonuses, gross, deductions and pay after deductions.':
    'صف لكل شخص: الساعات، وأجر الساعات، والمكافآت، والإجمالي، والخصومات، والأجر بعد الخصومات.',
  'One row per person with hours, bonuses and deductions but no rates, for payroll software that holds the rates itself.':
    'صف لكل شخص بالساعات والمكافآت والخصومات دون أسعار، لبرامج الرواتب التي تحتفظ بالأسعار بنفسها.',
  'One line per person per element (ordinary, overtime, absence, each bonus and each deduction), for software that imports pay elements.':
    'سطر لكل شخص ولكل عنصر (الساعات العادية، والإضافية، والغياب، وكل مكافأة وكل خصم)، للبرامج التي تستورد عناصر الأجر.',
  'That timesheet is not in this workshop.': 'كشف الدوام هذا لا يتبع هذه الورشة.',
  'That adjustment is not in this workshop.': 'هذا التعديل لا يتبع هذه الورشة.',
  'This timesheet has been handed to payroll. A bonus or deduction now goes on the next period.':
    'سُلِّم كشف الدوام هذا للرواتب. أي مكافأة أو خصم الآن يُضاف إلى الفترة التالية.',
  'An adjustment is a bonus or a deduction.': 'التعديل إما مكافأة أو خصم.',
  'Say what it is for, in a few words, so the payroll clerk can tell what they are paying.':
    'اذكر سببه في كلمات قليلة، ليعرف موظف الرواتب مقابل ماذا يدفع.',
  'The amount is more than nothing and less than a hundred thousand. Whether it adds or takes away is the kind.':
    'المبلغ أكبر من صفر وأقل من مئة ألف. أما كونه يُضاف أو يُخصم فيحدده النوع.',
  'Overtime is paid at between 1 and 3 times the hourly rate, to two decimal places. Time and a half is 1.5.':
    'يُدفع العمل الإضافي بما بين 1 و3 أضعاف سعر الساعة، بمنزلتين عشريتين. الأجر مرة ونصفًا هو 1.5.',
  'There is no payroll file of that name.': 'لا يوجد ملف رواتب بهذا الاسم.',
  'payroll bonus added': 'أُضيفت مكافأة إلى الرواتب',
  'payroll deduction added': 'أُضيف خصم إلى الرواتب',
  'payroll adjustment removed': 'أُزيل تعديل من الرواتب',
  'settings payroll updated': 'عُدِّلت إعدادات الرواتب',

  // Fitment feeds
  'Fetch from {feed}': 'جلب من {feed}',
  '{feed} has nothing new for this part.': 'لا جديد لدى {feed} لهذه القطعة.',
  '{feed}: {added} added, {removed} taken back.': '{feed}: أُضيف {added}، وسُحب {removed}.',
  '{unchanged} already recorded; {kept} left as somebody here recorded them. A fitment typed here is never replaced by a catalogue.':
    '{unchanged} مسجلة من قبل؛ و{kept} تُركت كما سجّلها أحد هنا. التوافق المُدخل هنا لا يستبدله أي كتالوج.',
  'The sample catalogue knows the demonstration parts only. A real feed is connected per installation.':
    'الكتالوج التجريبي يعرف قطع العرض فقط. يُربط المصدر الحقيقي لكل تثبيت على حدة.',
  '{feed}, fetched {date}': '{feed}، جُلب في {date}',
  'Sample catalogue': 'الكتالوج التجريبي',
  'No fitment feed is connected to this workshop.': 'لا يوجد مصدر توافق قطع مربوط بهذه الورشة.',
  'fitment feed fetched': 'جُلب مصدر توافق القطع',

  // VIN decoding
  'Read from the VIN by {decoder}:': 'قُرئ من رقم الهيكل بواسطة {decoder}:',
  '{decoder} could not name the maker from this VIN.':
    'لم يتمكن {decoder} من تحديد الصانع من رقم الهيكل هذا.',
  'Check it against the car before adding it.': 'طابقه مع السيارة قبل إضافتها.',
  'The VIN itself names only the maker and sometimes the year. Type the model from the car.':
    'رقم الهيكل وحده يحدد الصانع فقط وأحيانًا السنة. اكتب الطراز من السيارة.',
  'Read the VIN': 'قراءة رقم الهيكل',
  'the built-in reader': 'القارئ المدمج',
  'NHTSA vPIC': 'NHTSA vPIC',

  // Public reviews
  'Public reviews': 'التقييمات العامة',
  'A customer who gives five is offered a button to say so on {site}. They write it themselves, under their own name.':
    'العميل الذي يمنح خمس نجوم يُعرض عليه زر ليقول ذلك على {site}. يكتب التقييم بنفسه وباسمه.',
  'Saved. The next five-star answer is offered the link.':
    'تم الحفظ. سيُعرض الرابط على صاحب الإجابة التالية بخمس نجوم.',
  '{went} of {invited} invited went to write one.':
    'ذهب {went} من أصل {invited} مدعوين لكتابة تقييم.',
  'No review site is connected to this installation.': 'لا يوجد موقع تقييمات مربوط بهذا التثبيت.',
  'Not set up. Until the listing is named, a five-star customer is thanked and nothing more.':
    'غير مُعدّ. إلى أن يُحدَّد الإدراج، يُشكر العميل صاحب النجوم الخمس ولا شيء أكثر.',
  'Open the page customers are sent to': 'افتح الصفحة التي يُرسل إليها العملاء',
  'Google place ID': 'معرّف المكان على Google',
  'From Google’s place ID finder, or paste a write-review link that carries it. Blank turns it off.':
    'من أداة البحث عن معرّف المكان في Google، أو الصق رابط كتابة تقييم يتضمنه. تركه فارغًا يوقف الميزة.',
  'Find your place ID': 'اعثر على معرّف مكانك',
  'Write a review on {site}': 'اكتب تقييمًا على {site}',
  'It opens {site} in your own account. What you write there is yours; we only see that you went.':
    'يفتح {site} في حسابك الخاص. ما تكتبه هناك ملكك؛ نحن نرى فقط أنك ذهبت.',
  'That is not a Google place ID. It is a code of letters and digits, usually starting ChIJ, from Google’s place ID finder.':
    'هذا ليس معرّف مكان على Google. إنه رمز من حروف وأرقام يبدأ عادةً بـ ChIJ، تحصل عليه من أداة البحث عن معرّف المكان في Google.',
  'settings review site updated': 'عُدِّل موقع التقييمات',
  'review public opened': 'فُتح التقييم العام',
};
