/**
 * Where to buy a part, and what was fitted instead. Phase 87.
 *
 * Two of these matter more than the rest. The sentence that names the cheaper
 * supplier it passed over has to read as an argument the buyer can weigh, not
 * as an apology — in all three languages somebody must be able to read it and
 * say "no, order the cheap one, the car can wait". And the five evidence
 * sentences have to stay sentences: not one of them may become a number in
 * translation, because the whole design of the substitution screen is that a
 * person can check the claim rather than trust a score.
 */

export const fr = {
  // Where to buy it.
  'Where to buy it': 'Où l’acheter',
  'What it costs, whether they have it, when it gets here and how long they stand behind it. The cheapest that arrives in time is the one marked.':
    'Ce qu’elle coûte, s’ils l’ont, quand elle arrive et combien de temps ils la garantissent. Celle qui est signalée est la moins chère arrivant à temps.',
  Supplier: 'Fournisseur',
  Price: 'Prix',
  Stock: 'Stock',
  // The stock area owns bare `Delivery` for a shipment arriving; this one is
  // how long the wait is.
  'Delivery#wait': 'Délai',
  Warranty: 'Garantie',
  'Their record': 'Leur historique',
  // The diagnosis area owns bare `Confirmed` for a cause a technician
  // confirmed; this one is a date column. Phase 83's qualifier.
  'Confirmed#date': 'Confirmé le',
  'Buy here': 'Acheter ici',
  'Not said': 'Non renseigné',
  'On their shelf': 'En rayon chez eux',
  'To order': 'Sur commande',
  '{count}d — too late': '{count} j — trop tard',
  'Never ordered': 'Jamais commandé',
  'Too few orders to say': 'Trop peu de commandes pour se prononcer',
  'On time {pct}% of {count}': 'À l’heure sur {pct} % de {count}',
  old: 'ancien',
  // `Remove` and `{count} months` are not here: the components and customers
  // areas already answer them, and one word gets one answer.

  '{supplier} is {amount} cheaper but would arrive after the car is promised.':
    '{supplier} est moins cher de {amount}, mais arriverait après la date promise au client.',
  '{supplier} is {amount} cheaper but has not said when they could deliver.':
    '{supplier} est moins cher de {amount}, mais n’a pas indiqué de délai de livraison.',
  'No supplier has been priced for this part yet.':
    'Aucun fournisseur n’a encore été tarifé pour cette pièce.',

  'Stock not said': 'Stock non renseigné',
  Days: 'Jours',
  'Warranty months': 'Garantie (mois)',
  'Save the price': 'Enregistrer le prix',

  // What else would do.
  'What else would do': 'Ce qui conviendrait aussi',
  'Alternatives for the parts on this job, each with what we know about it. Nothing is swapped until somebody here confirms it.':
    'Les équivalents des pièces de cette intervention, chacun avec ce que nous en savons. Rien n’est remplacé tant que quelqu’un ici ne l’a pas confirmé.',
  'Fitted in place of {part}': 'Monté à la place de {part}',
  'confirmed by {who}': 'confirmé par {who}',
  'Nothing on record would do instead of this part.':
    'Rien dans nos données ne conviendrait à la place de cette pièce.',
  '{count} on the shelf': '{count} en stock',
  'None on the shelf': 'Aucun en stock',
  'Fit this instead': 'Monter celle-ci',

  // The six kinds of evidence. Sentences, never scores. The first two say
  // two parts are the same thing; the rest say only that one suits a car.
  'We have fitted this in place of it before': 'Nous l’avons déjà montée à la place de celle-ci',
  'We fitted this to this car before': 'Nous l’avons déjà montée sur ce véhicule',
  'We fitted this to the same model before': 'Nous l’avons déjà montée sur le même modèle',
  'Somebody here recorded that it fits': 'Quelqu’un ici a noté qu’elle convient',
  'A catalogue says it fits': 'Un catalogue indique qu’elle convient',
  'A supplier lists both under one number': 'Un fournisseur les référence sous un même numéro',

  // The refusals.
  'That supplier or part was not found.': 'Ce fournisseur ou cette pièce est introuvable.',
  'That supplier price was not found.': 'Ce prix fournisseur est introuvable.',
  'That part was not found.': 'Cette pièce est introuvable.',
  'That part line was not found.': 'Cette ligne de pièce est introuvable.',
  'That line is not a catalogued part.': 'Cette ligne ne correspond pas à une pièce du catalogue.',
  'That is the part already on the line.': 'C’est déjà la pièce inscrite sur cette ligne.',
  'Nothing on record says that part fits this car. Record a fitment first.':
    'Rien dans nos données n’indique que cette pièce convient à ce véhicule. Enregistrez d’abord une compatibilité.',
  'That price could not be saved.': 'Ce prix n’a pas pu être enregistré.',
  'That price could not be removed.': 'Ce prix n’a pas pu être retiré.',
};

export const ar = {
  'Where to buy it': 'من أين تُشترى',
  'What it costs, whether they have it, when it gets here and how long they stand behind it. The cheapest that arrives in time is the one marked.':
    'كم تكلّف، وهل هي لديهم، ومتى تصل، وكم يضمنونها. المميَّزة هي الأرخص التي تصل في الوقت المناسب.',
  Supplier: 'المورّد',
  Price: 'السعر',
  Stock: 'المخزون',
  'Delivery#wait': 'مدة التوريد',
  Warranty: 'الضمان',
  'Their record': 'سجلّهم',
  'Confirmed#date': 'تاريخ التأكيد',
  'Buy here': 'اشترِ من هنا',
  'Not said': 'غير مذكور',
  'On their shelf': 'متوفرة لديهم',
  'To order': 'بالطلب',
  '{count}d — too late': '{count} يوم — متأخر جداً',
  'Never ordered': 'لم يُطلب منه قط',
  'Too few orders to say': 'الطلبات أقل من أن يُحكم بها',
  'On time {pct}% of {count}': 'في الموعد في {pct}٪ من {count}',
  old: 'قديم',

  '{supplier} is {amount} cheaper but would arrive after the car is promised.':
    '{supplier} أرخص بمقدار {amount} لكنها ستصل بعد الموعد الموعود للعميل.',
  '{supplier} is {amount} cheaper but has not said when they could deliver.':
    '{supplier} أرخص بمقدار {amount} لكنه لم يذكر موعد التسليم.',
  'No supplier has been priced for this part yet.': 'لم يُسجَّل بعد سعر أي مورّد لهذه القطعة.',

  'Stock not said': 'المخزون غير مذكور',
  Days: 'أيام',
  'Warranty months': 'الضمان (أشهر)',
  'Save the price': 'احفظ السعر',

  'What else would do': 'ما الذي يصلح بديلاً',
  'Alternatives for the parts on this job, each with what we know about it. Nothing is swapped until somebody here confirms it.':
    'بدائل قطع هذا العمل، ومع كلٍّ منها ما نعرفه عنه. لا يُستبدل شيء حتى يؤكّده أحد هنا.',
  'Fitted in place of {part}': 'رُكّبت بدلاً من {part}',
  'confirmed by {who}': 'أكّدها {who}',
  'Nothing on record would do instead of this part.':
    'لا شيء في سجلاتنا يصلح بديلاً عن هذه القطعة.',
  '{count} on the shelf': '{count} في المخزون',
  'None on the shelf': 'لا شيء في المخزون',
  'Fit this instead': 'ركّب هذه بدلاً منها',

  'We have fitted this in place of it before': 'ركّبناها بدلاً منها من قبل',
  'We fitted this to this car before': 'ركّبناها على هذه السيارة من قبل',
  'We fitted this to the same model before': 'ركّبناها على الطراز نفسه من قبل',
  'Somebody here recorded that it fits': 'سجّل أحدهم هنا أنها تناسبها',
  'A catalogue says it fits': 'يذكر كتالوج أنها تناسبها',
  'A supplier lists both under one number': 'يدرجهما مورّد تحت رقم واحد',

  'That supplier or part was not found.': 'لم يُعثر على هذا المورّد أو هذه القطعة.',
  'That supplier price was not found.': 'لم يُعثر على سعر المورّد هذا.',
  'That part was not found.': 'لم يُعثر على هذه القطعة.',
  'That part line was not found.': 'لم يُعثر على سطر القطعة هذا.',
  'That line is not a catalogued part.': 'هذا السطر ليس قطعة مُفهرسة.',
  'That is the part already on the line.': 'هذه هي القطعة المسجَّلة على السطر أصلاً.',
  'Nothing on record says that part fits this car. Record a fitment first.':
    'لا شيء في سجلاتنا يفيد بأن هذه القطعة تناسب هذه السيارة. سجّل التوافق أولاً.',
  'That price could not be saved.': 'تعذّر حفظ هذا السعر.',
  'That price could not be removed.': 'تعذّرت إزالة هذا السعر.',
};
