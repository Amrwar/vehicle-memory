/**
 * Taking everything, and being forgotten.
 *
 * The fourteen holdings are rendered as `t(holding.what)` — a variable rather
 * than a literal, which neither i18n-scan nor verify-languages can see: both
 * collect literals. So `verify-erasure` asserts each one is answered here,
 * which is the third time this gap has appeared in a different place and the
 * third check written for it.
 *
 * These words matter more than most. A person reading them is being told what
 * a business will do with their life, and a page half in English is a page
 * somebody agrees to without understanding.
 */

export const fr: Readonly<Record<string, string>> = {
  // The page
  'What they can ask for': 'Ce qu’ils peuvent demander',
  'A person may take everything the workshop holds about them, and may ask to be forgotten. Both are theirs by right.':
    'Une personne peut emporter tout ce que l’atelier détient à son sujet, et demander à être oubliée. L’un et l’autre lui reviennent de droit.',
  'Everything we hold about them': 'Tout ce que nous détenons à leur sujet',
  'Machine-readable, and complete. Give it to them before anything else.':
    'Lisible par une machine, et complet. Remettez-le-leur avant toute autre chose.',
  'This person has been forgotten. What is left is the workshop’s own record.':
    'Cette personne a été oubliée. Ce qui subsiste appartient aux archives de l’atelier.',
  'Forget this person': 'Oublier cette personne',
  'What goes': 'Ce qui disparaît',
  'What stays': 'Ce qui demeure',
  'This cannot be undone. The invoices stay, because the law says seven years, and the car’s history stays, because it belongs to the car.':
    'C’est irréversible. Les factures demeurent, car la loi impose sept ans, et l’historique du véhicule demeure, car il appartient au véhicule.',
  'Why, and who asked': 'Pourquoi, et qui l’a demandé',
  'Asked by email on 3 March': 'Demandé par courriel le 3 mars',
  'Forget them': 'Les oublier',

  // Refusals
  'That customer is not one of yours.': 'Ce client n’est pas l’un des vôtres.',
  'That person has already been erased.': 'Cette personne a déjà été effacée.',
  'Say why, so the record shows this was asked for.':
    'Dites pourquoi, afin que le registre montre que cela a été demandé.',

  // The holdings, reached through a variable
  'The customer record': 'La fiche client',
  'Their portal login': 'Leur accès à l’espace client',
  'Their signature': 'Leur signature',
  'Ownership of a vehicle': 'La propriété d’un véhicule',
  'The vehicle’s history': 'L’historique du véhicule',
  'Messages sent to them': 'Les messages qui leur ont été envoyés',
  'Messages they sent': 'Les messages qu’ils ont envoyés',
  'Their conversations': 'Leurs conversations',
  'A car offered to somebody': 'Un véhicule proposé à quelqu’un',
  'What they said about the workshop': 'Ce qu’ils ont dit de l’atelier',
  'What was recorded about the work': 'Ce qui a été consigné sur les travaux',
  'Their invoices, payments and credit notes': 'Leurs factures, règlements et avoirs',
  'Their jobs and bookings': 'Leurs ordres de réparation et rendez-vous',
  'Points, gift cards, deposits and coupons': 'Points, cartes cadeaux, acomptes et bons',
};

export const ar: Readonly<Record<string, string>> = {
  'What they can ask for': 'ما يحقّ لهم طلبه',
  'A person may take everything the workshop holds about them, and may ask to be forgotten. Both are theirs by right.':
    'يحقّ لأي شخص أن يأخذ كل ما تحتفظ به الورشة عنه، وأن يطلب أن يُنسى. وكلا الأمرين حقّ له.',
  'Everything we hold about them': 'كل ما نحتفظ به عنهم',
  'Machine-readable, and complete. Give it to them before anything else.':
    'بصيغة تقرؤها الآلة، وكاملة. سلّمها لهم قبل أي شيء آخر.',
  'This person has been forgotten. What is left is the workshop’s own record.':
    'قد نُسي هذا الشخص. وما تبقّى هو سجلّ الورشة نفسها.',
  'Forget this person': 'نسيان هذا الشخص',
  'What goes': 'ما يُحذف',
  'What stays': 'ما يبقى',
  'This cannot be undone. The invoices stay, because the law says seven years, and the car’s history stays, because it belongs to the car.':
    'لا يمكن التراجع عن هذا. تبقى الفواتير لأن القانون يفرض سبع سنوات، ويبقى سجلّ السيارة لأنه ملك السيارة.',
  'Why, and who asked': 'لماذا، ومن طلب ذلك',
  'Asked by email on 3 March': 'طُلب بالبريد في ٣ مارس',
  'Forget them': 'انسَهم',

  'That customer is not one of yours.': 'هذا العميل ليس من عملائك.',
  'That person has already been erased.': 'لقد مُحي هذا الشخص من قبل.',
  'Say why, so the record shows this was asked for.': 'اذكر السبب، ليُظهر السجلّ أن هذا قد طُلب.',

  'The customer record': 'سجلّ العميل',
  'Their portal login': 'حسابهم في بوابة العملاء',
  'Their signature': 'توقيعهم',
  'Ownership of a vehicle': 'ملكية مركبة',
  'The vehicle’s history': 'سجلّ المركبة',
  'Messages sent to them': 'الرسائل المُرسلة إليهم',
  'Messages they sent': 'الرسائل التي أرسلوها',
  'Their conversations': 'محادثاتهم',
  'A car offered to somebody': 'سيارة عُرضت على شخص ما',
  'What they said about the workshop': 'ما قالوه عن الورشة',
  'What was recorded about the work': 'ما سُجّل عن العمل',
  'Their invoices, payments and credit notes': 'فواتيرهم ومدفوعاتهم وإشعاراتهم الدائنة',
  'Their jobs and bookings': 'مهامّهم ومواعيدهم',
  'Points, gift cards, deposits and coupons': 'النقاط وبطاقات الهدايا والعرابين والقسائم',
};
