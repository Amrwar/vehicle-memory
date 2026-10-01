/**
 * The list you clear before you open anything else. Phase 95.
 *
 * Two kinds of sentence here and they have opposite jobs.
 *
 * The four costs are a ranking, and the ranking is an argument: somebody could
 * be hurt, then a promise to a customer, then money, then an incomplete
 * history. A translation that softened "somebody could be hurt" into something
 * about compliance would move it down that list in a reader's head, which is
 * the one thing it must not do.
 *
 * And "Nothing to miss this morning" has to read as finished, not as empty. A
 * workshop that has cleared its list should be told so plainly; a sentence that
 * sounded like a failure to load would have people reaching for another screen
 * to check.
 */

export const fr = {
  'Do not miss': 'À ne pas manquer',
  'What acting on this morning changes. Ordered by what it costs to miss, and short enough to finish.':
    'Ce que le fait d’agir ce matin change. Classé par ce qu’il en coûte de l’oublier, et assez court pour être terminé.',
  'In the order they cost to miss': 'Par ordre de ce qu’il en coûte de les manquer',
  'Each one is a single thing to do.': 'Chacun est une seule chose à faire.',
  '1 thing to deal with.': '1 chose à traiter.',
  '{count} things to deal with.': '{count} choses à traiter.',
  '{count} · {cost}': '{count} · {cost}',

  // The four costs, in the order they are ranked.
  'Somebody could be hurt': 'Quelqu’un pourrait être blessé',
  'A promise to a customer': 'Une promesse faite à un client',
  Money: 'Argent',
  'An incomplete history': 'Un historique incomplet',

  'Nothing to miss this morning.': 'Rien à ne pas manquer ce matin.',
  'Nothing is late, nothing is unusable, and nothing is waiting on somebody here.':
    'Rien n’est en retard, rien n’est inutilisable, et rien n’attend après quelqu’un ici.',
  'And {count} more behind these. That is more than a morning: the ones above are the ones that cost most to miss.':
    'Et {count} autres derrière. Cela dépasse une matinée : celles ci-dessus sont les plus coûteuses à manquer.',

  // What the rows say.
  '{machine} cannot be used, and {work} needs it':
    '{machine} est inutilisable, et {work} en a besoin',
  'Put it right': 'Y remédier',
  '{machine}’s certificate runs out': 'Le certificat de {machine} arrive à expiration',
  'Book the engineer': 'Convoquer le technicien',
  '{what}: {machine} is already promised to somebody else':
    '{what} : {machine} est déjà réservé pour quelqu’un d’autre',
  '{what}: {machine} will not be usable that day':
    '{what} : {machine} ne sera pas utilisable ce jour-là',
  'Move the booking': 'Déplacer le rendez-vous',
  '#{number} {vehicle} is finished and not signed off':
    'n° {number} {vehicle} est terminé et non validé',
  'Sign it off': 'Le valider',
  '{customer} has not paid #{number}': '{customer} n’a pas réglé la facture n° {number}',
  'Chase it': 'Relancer',
  'Order #{number} from {supplier} was due and has not arrived':
    'La commande n° {number} chez {supplier} était attendue et n’est pas arrivée',
  'Ring the supplier': 'Appeler le fournisseur',
  '#{number} {vehicle} came back and nobody has said why':
    'n° {number} {vehicle} est revenu et personne n’a dit pourquoi',
};

export const ar = {
  'Do not miss': 'ما لا يجب إغفاله',
  'What acting on this morning changes. Ordered by what it costs to miss, and short enough to finish.':
    'ما يُحدث التصرف فيه هذا الصباح فرقاً. مرتَّب بحسب كلفة إغفاله، وقصير بما يكفي لإنهائه.',
  'In the order they cost to miss': 'بترتيب كلفة إغفالها',
  'Each one is a single thing to do.': 'كل بند منها إجراء واحد.',
  '1 thing to deal with.': 'أمر واحد يلزم التعامل معه.',
  '{count} things to deal with.': '{count} أمور تلزم التعامل معها.',
  '{count} · {cost}': '{count} · {cost}',

  'Somebody could be hurt': 'قد يُصاب أحدهم',
  'A promise to a customer': 'وعد لعميل',
  Money: 'المال',
  'An incomplete history': 'سجل ناقص',

  'Nothing to miss this morning.': 'لا شيء يُخشى إغفاله هذا الصباح.',
  'Nothing is late, nothing is unusable, and nothing is waiting on somebody here.':
    'لا شيء متأخر، ولا شيء غير صالح للاستخدام، ولا شيء ينتظر أحداً هنا.',
  'And {count} more behind these. That is more than a morning: the ones above are the ones that cost most to miss.':
    'وخلفها {count} أخرى. هذا أكثر من صباح واحد: وما في الأعلى هو الأعلى كلفةً عند إغفاله.',

  '{machine} cannot be used, and {work} needs it': '{machine} غير صالحة للاستخدام، و{work} يحتاجها',
  'Put it right': 'عالج الأمر',
  '{machine}’s certificate runs out': 'شهادة {machine} على وشك الانتهاء',
  'Book the engineer': 'استدعِ الفني',
  '{what}: {machine} is already promised to somebody else':
    '{what}: {machine} محجوزة بالفعل لشخص آخر',
  '{what}: {machine} will not be usable that day':
    '{what}: لن تكون {machine} صالحة للاستخدام في ذلك اليوم',
  'Move the booking': 'انقل الحجز',
  '#{number} {vehicle} is finished and not signed off': 'رقم {number} {vehicle} مكتمل ولم يُعتمد',
  'Sign it off': 'اعتمده',
  '{customer} has not paid #{number}': 'لم يسدد {customer} الفاتورة رقم {number}',
  'Chase it': 'تابعها',
  'Order #{number} from {supplier} was due and has not arrived':
    'الطلب رقم {number} من {supplier} كان مستحقاً ولم يصل',
  'Ring the supplier': 'اتصل بالمورّد',
  '#{number} {vehicle} came back and nobody has said why':
    'عادت رقم {number} {vehicle} ولم يذكر أحد السبب',
};
