/**
 * The end of the day. Phase 96.
 *
 * Two things have to survive translation here or the screen stops meaning what
 * it means.
 *
 * **"Not to be left overnight" is a category, not an intensity.** It names the
 * three things — keys, cash, somebody still clocked on — that are a different
 * kind of problem from the seven ordinary ones, and a translation that turned
 * it into "urgent" or "important" would put it on the same scale as the rest
 * and lose the distinction the screen is built on.
 *
 * **"A close is a record of a moment, so it cannot be edited afterwards"** is
 * a promise about the database, not an apology for a missing feature. It
 * should read as a reason, the way a notary's "this cannot be altered" reads,
 * and never as "we did not build editing".
 *
 * Where a count changes the sentence there are two keys and not one built
 * string — "1 car is still on site" and "{count} cars are still on site" —
 * which is ADR-0019 and the reason a check can see them at all.
 */

export const fr = {
  'Closing the day': 'La fermeture',
  'What is being left overnight, and the record that somebody looked. Nothing on this screen changes anything.':
    'Ce qui reste pour la nuit, et la trace que quelqu’un a regardé. Rien sur cet écran ne modifie quoi que ce soit.',
  'Not to be left overnight': 'À ne pas laisser pour la nuit',
  'Keys, cash and anybody still here. The rest can wait until morning.':
    'Les clés, la caisse et toute personne encore présente. Le reste peut attendre demain matin.',
  'Deal with it now': 'À régler maintenant',
  'Everything the close looks at': 'Tout ce que la fermeture examine',
  'All ten, whatever they say. A nought is an answer too.':
    'Les dix, quoi qu’ils disent. Un zéro est aussi une réponse.',
  Settled: 'Réglé#close',
  Outstanding: 'En suspens#close',
  'Close the day': 'Fermer la journée',
  'This records what is above, as it stands now, with your name on it. It changes nothing else.':
    'Ceci enregistre ce qui précède, tel quel, à votre nom. Rien d’autre n’est modifié.',
  'Anything worth saying about tonight': 'Quelque chose à signaler sur cette soirée',
  'Optional. The night the keys were with the valeter is the night to say so.':
    'Facultatif. Le soir où les clés sont restées chez le nettoyeur est le soir où il faut le dire.',
  'Closed by {name} at {when}.': 'Fermée par {name} à {when}.',
  'A close is a record of a moment, so it cannot be edited afterwards.':
    'Une fermeture est la trace d’un instant : elle ne peut pas être modifiée après coup.',
  'That day has already been closed. A day is closed once.':
    'Cette journée a déjà été fermée. Une journée ne se ferme qu’une fois.',
  'A close belongs to a site, and this account is not at one.':
    'Une fermeture appartient à un site, et ce compte n’est rattaché à aucun.',
  Lately: 'Ces derniers jours',
  'The last week of closes, as they were recorded.':
    'La dernière semaine de fermetures, telles qu’elles ont été enregistrées.',
  'Nothing left': 'Rien laissé',
  '{count} left overnight': '{count} laissés pour la nuit',

  // The line at the top.
  'Everything is counted, and nobody is still here.': 'Tout est compté, et il ne reste personne.',
  '1 thing should not be left overnight.': '1 chose ne devrait pas être laissée pour la nuit.',
  '{count} things should not be left overnight.':
    '{count} choses ne devraient pas être laissées pour la nuit.',
  '1 thing is outstanding, and none of it has to wait up.':
    '1 chose est en suspens, et rien de tout cela n’empêche de fermer.',
  '{count} things are outstanding, and none of it has to wait up.':
    '{count} choses sont en suspens, et rien de tout cela n’empêche de fermer.',

  // The ten readings.
  'No till was opened today.': 'Aucune caisse n’a été ouverte aujourd’hui.',
  'The till is still open and has not been counted.':
    'La caisse est encore ouverte et n’a pas été comptée.',
  'The till is out by more than {tolerance}.': 'L’écart de caisse dépasse {tolerance}.',
  'The till was counted and agrees.': 'La caisse a été comptée et concorde.',
  'Everybody has clocked out.': 'Tout le monde a pointé en sortie.',
  '1 person is still clocked on.': '1 personne est encore pointée.',
  '{count} people are still clocked on.': '{count} personnes sont encore pointées.',
  'Every key is on its hook.': 'Chaque clé est à son crochet.',
  '1 set of keys is not on a hook.': '1 jeu de clés n’est pas à un crochet.',
  '{count} sets of keys are not on a hook.': '{count} jeux de clés ne sont pas à un crochet.',
  'No customer car is left on site.': 'Aucune voiture de client ne reste sur le site.',
  '1 car is still on site.': '1 voiture est encore sur le site.',
  '{count} cars are still on site.': '{count} voitures sont encore sur le site.',
  'Every job is finished and settled.': 'Tous les travaux sont terminés et soldés.',
  '1 job is still open.': '1 travail est encore ouvert.',
  '{count} jobs are still open.': '{count} travaux sont encore ouverts.',
  'Nothing is owed.': 'Rien n’est dû.',
  '1 invoice is unpaid.': '1 facture est impayée.',
  '{count} invoices are unpaid.': '{count} factures sont impayées.',
  'No estimate is waiting on a customer.': 'Aucun devis n’attend de réponse d’un client.',
  '1 estimate is waiting on a customer.': '1 devis attend la réponse d’un client.',
  '{count} estimates are waiting on a customer.': '{count} devis attendent la réponse d’un client.',
  'No order is overdue.': 'Aucune commande n’est en retard.',
  '1 order was due and has not arrived.': '1 commande était attendue et n’est pas arrivée.',
  '{count} orders were due and have not arrived.':
    '{count} commandes étaient attendues et ne sont pas arrivées.',
  '1 bank line is unmatched.': '1 ligne bancaire n’est pas rapprochée.',
  '{count} bank lines are unmatched.': '{count} lignes bancaires ne sont pas rapprochées.',
  'No follow-up is due.': 'Aucune relance n’est à faire.',
  '1 follow-up is due.': '1 relance est à faire.',
  '{count} follow-ups are due.': '{count} relances sont à faire.',
};

export const ar = {
  'Closing the day': 'إغلاق اليوم',
  'What is being left overnight, and the record that somebody looked. Nothing on this screen changes anything.':
    'ما سيُترك طوال الليل، وإثبات أن أحداً قد تحقق. لا شيء في هذه الشاشة يغيّر شيئاً.',
  'Not to be left overnight': 'ما لا يُترك طوال الليل',
  'Keys, cash and anybody still here. The rest can wait until morning.':
    'المفاتيح والنقد وكل من لا يزال هنا. وما عدا ذلك يمكن أن ينتظر الصباح.',
  'Deal with it now': 'عالجه الآن',
  'Everything the close looks at': 'كل ما يفحصه الإغلاق',
  'All ten, whatever they say. A nought is an answer too.':
    'العشرة جميعاً، مهما كانت النتيجة. والصفر إجابة أيضاً.',
  Settled: 'مُسوّى',
  Outstanding: 'معلّق',
  'Close the day': 'أغلق اليوم',
  'This records what is above, as it stands now, with your name on it. It changes nothing else.':
    'يسجّل هذا ما ورد أعلاه كما هو الآن، باسمك. ولا يغيّر شيئاً آخر.',
  'Anything worth saying about tonight': 'ما يستحق الذكر عن هذه الليلة',
  'Optional. The night the keys were with the valeter is the night to say so.':
    'اختياري. الليلة التي بقيت فيها المفاتيح لدى عامل التنظيف هي الليلة التي يجب ذكر ذلك فيها.',
  'Closed by {name} at {when}.': 'أغلقها {name} في {when}.',
  'A close is a record of a moment, so it cannot be edited afterwards.':
    'الإغلاق سجلّ للحظة بعينها، فلا يمكن تعديله بعد ذلك.',
  'That day has already been closed. A day is closed once.':
    'أُغلق ذلك اليوم بالفعل. واليوم يُغلق مرة واحدة.',
  'A close belongs to a site, and this account is not at one.':
    'الإغلاق يخصّ موقعاً، وهذا الحساب غير مرتبط بأي موقع.',
  Lately: 'في الأيام الأخيرة',
  'The last week of closes, as they were recorded.': 'إغلاقات الأسبوع الماضي كما سُجّلت.',
  'Nothing left': 'لم يُترك شيء',
  '{count} left overnight': '{count} تُركت طوال الليل',

  'Everything is counted, and nobody is still here.': 'كل شيء محسوب، ولم يبق أحد.',
  '1 thing should not be left overnight.': 'أمر واحد لا ينبغي تركه طوال الليل.',
  '{count} things should not be left overnight.': '{count} أمور لا ينبغي تركها طوال الليل.',
  '1 thing is outstanding, and none of it has to wait up.':
    'أمر واحد معلّق، ولا شيء منه يستدعي السهر.',
  '{count} things are outstanding, and none of it has to wait up.':
    '{count} أمور معلّقة، ولا شيء منها يستدعي السهر.',

  'No till was opened today.': 'لم تُفتح أي صندوق نقدية اليوم.',
  'The till is still open and has not been counted.': 'صندوق النقدية ما زال مفتوحاً ولم يُحصَ.',
  'The till is out by more than {tolerance}.': 'فرق الصندوق يتجاوز {tolerance}.',
  'The till was counted and agrees.': 'أُحصي الصندوق وتطابق.',
  'Everybody has clocked out.': 'سجّل الجميع خروجهم.',
  '1 person is still clocked on.': 'ما زال شخص واحد مسجّلاً في الدوام.',
  '{count} people are still clocked on.': 'ما زال {count} أشخاص مسجّلين في الدوام.',
  'Every key is on its hook.': 'كل مفتاح في مكانه.',
  '1 set of keys is not on a hook.': 'طقم مفاتيح واحد ليس في مكانه.',
  '{count} sets of keys are not on a hook.': '{count} أطقم مفاتيح ليست في أماكنها.',
  'No customer car is left on site.': 'لم تبق أي سيارة عميل في الموقع.',
  '1 car is still on site.': 'ما زالت سيارة واحدة في الموقع.',
  '{count} cars are still on site.': 'ما زالت {count} سيارات في الموقع.',
  'Every job is finished and settled.': 'كل الأعمال منتهية ومسوّاة.',
  '1 job is still open.': 'ما زال عمل واحد مفتوحاً.',
  '{count} jobs are still open.': 'ما زال {count} عملاً مفتوحاً.',
  'Nothing is owed.': 'لا شيء مستحق.',
  '1 invoice is unpaid.': 'فاتورة واحدة غير مسددة.',
  '{count} invoices are unpaid.': '{count} فواتير غير مسددة.',
  'No estimate is waiting on a customer.': 'لا يوجد عرض سعر ينتظر رد عميل.',
  '1 estimate is waiting on a customer.': 'عرض سعر واحد ينتظر رد عميل.',
  '{count} estimates are waiting on a customer.': '{count} عروض أسعار تنتظر رد العملاء.',
  'No order is overdue.': 'لا توجد طلبية متأخرة.',
  '1 order was due and has not arrived.': 'طلبية واحدة كانت مستحقة ولم تصل.',
  '{count} orders were due and have not arrived.': '{count} طلبيات كانت مستحقة ولم تصل.',
  '1 bank line is unmatched.': 'سطر بنكي واحد غير مطابق.',
  '{count} bank lines are unmatched.': '{count} أسطر بنكية غير مطابقة.',
  'No follow-up is due.': 'لا توجد متابعة مستحقة.',
  '1 follow-up is due.': 'متابعة واحدة مستحقة.',
  '{count} follow-ups are due.': '{count} متابعات مستحقة.',
};
