/**
 * Where a job stands. Phase 84.
 *
 * Every sentence names whose move it is and what to do, so the translations
 * keep both halves: « En attente du client » is a position, not a status, and
 * the imperative in the action stays an imperative. A verdict rendered as a
 * noun ("Relance") reads as a label rather than an instruction, and the whole
 * point of the line is that somebody can act on it without reading anything
 * else.
 *
 * Three keys are deliberately absent: `Book it in`, `Start the work` and
 * `Nothing outstanding`. The product already answers all three, in the areas
 * that own those words, and verify-dictionary refused this file until they
 * were taken out. One English sentence, one answer.
 */

export const fr = {
  'Where everything stands': 'Où en est chaque travail',
  'Every open job, hardest first. What it is waiting for, how long it has been waiting, and the one thing that moves it.':
    'Chaque travail en cours, le plus dur en premier. Ce qu’il attend, depuis combien de temps, et la seule chose qui le fait avancer.',
  'Ours to move': 'À nous de jouer',
  'With the customer': 'Chez le client',
  'With the supplier': 'Chez le fournisseur',
  'Waiting on somebody else': 'En attente de quelqu’un d’autre',
  'Nothing is stopping these but us.': 'Rien ne les retient, sinon nous.',
  'A customer or a supplier has to move before these can.':
    'Un client ou un fournisseur doit agir avant que ceux-ci puissent avancer.',
  'Still open, but nobody is waiting on anything.':
    'Toujours ouverts, mais personne n’attend quoi que ce soit.',
  'Nothing open': 'Rien en cours',
  'Every job is finished, paid and collected.':
    'Tous les travaux sont terminés, payés et les véhicules récupérés.',
  'One job is past the time it was promised back.': 'Un travail a dépassé l’heure promise.',
  '{count} jobs are past the time they were promised back.':
    '{count} travaux ont dépassé l’heure promise.',
  'Past the promise': 'Heure promise dépassée',

  'Cancelled. Nothing further is owed or expected.': 'Annulé. Plus rien n’est dû ni attendu.',
  'Not booked in yet.': 'Pas encore enregistré.',
  'Booked. The car has not arrived.': 'Réservé. Le véhicule n’est pas arrivé.',
  'Checked in, nothing started.': 'Véhicule reçu, rien de commencé.',
  'Start the inspection': 'Commencer le contrôle',
  'Being inspected.': 'Contrôle en cours.',
  'Finish the inspection': 'Terminer le contrôle',
  'Diagnosed, no estimate written.': 'Diagnostiqué, aucun devis rédigé.',
  'Write the estimate': 'Rédiger le devis',
  'Estimate written, not sent.': 'Devis rédigé, non envoyé.',
  'Send the estimate': 'Envoyer le devis',
  'Waiting for approval, but the estimate has not been sent.':
    'En attente d’accord, mais le devis n’a pas été envoyé.',
  'Waiting for the customer. {amount} sent, not opened.':
    'En attente du client. {amount} envoyé, non ouvert.',
  'Send a reminder': 'Envoyer une relance',
  'Waiting for the customer. {amount} sent, opened, no answer.':
    'En attente du client. {amount} envoyé, ouvert, sans réponse.',
  'Ring them': 'Les appeler',
  'Approved. {count} parts still to arrive, the first due {date}.':
    'Accepté. {count} pièces encore attendues, la première pour le {date}.',
  'Chase the supplier': 'Relancer le fournisseur',
  'Approved. {count} parts on order with no date.': 'Accepté. {count} pièces commandées sans date.',
  'Approved and ready to start.': 'Accepté et prêt à démarrer.',
  'Started, then stopped: {count} parts still to arrive.':
    'Commencé puis arrêté : {count} pièces encore attendues.',
  'Being worked on now.': 'En cours en ce moment.',
  'Started, nobody on it.': 'Commencé, personne dessus.',
  'Put somebody on it': 'Affecter quelqu’un',
  'Work done, waiting to be checked.': 'Travaux faits, en attente de contrôle.',
  'Do the check': 'Faire le contrôle',
  'Finished, but the quality check has not been done.':
    'Terminé, mais le contrôle qualité n’a pas été fait.',
  'Ready, not invoiced.': 'Prêt, non facturé.',
  'Raise the invoice': 'Établir la facture',
  'Invoiced, {amount} unpaid.': 'Facturé, {amount} impayé.',
  'Ask for payment': 'Demander le règlement',
  'Paid and collected, not closed.': 'Payé et récupéré, non clôturé.',
  'Close the job': 'Clôturer le travail',
  'Paid. The car is still here.': 'Payé. Le véhicule est encore ici.',
  'Tell them it is ready': 'Leur dire qu’il est prêt',
  'Paid and collected. Nothing outstanding.': 'Payé et récupéré. Rien en attente.',
  'No position recorded for this state.': 'Aucune position enregistrée pour cet état.',

  '{count}d': '{count} j',
  '{count}m': '{count} min',
  '{count}h': '{count} h',
  '{h}h {m}m': '{h} h {m} min',
};

export const ar = {
  'Where everything stands': 'أين وصل كل عمل',
  'Every open job, hardest first. What it is waiting for, how long it has been waiting, and the one thing that moves it.':
    'كل عمل مفتوح، الأصعب أولاً. ما ينتظره، ومنذ متى، والشيء الوحيد الذي يحرّكه.',
  'Ours to move': 'الدور علينا',
  'With the customer': 'عند العميل',
  'With the supplier': 'عند المورّد',
  'Waiting on somebody else': 'في انتظار طرف آخر',
  'Nothing is stopping these but us.': 'لا شيء يعطّلها سوانا.',
  'A customer or a supplier has to move before these can.':
    'على عميل أو مورّد أن يتحرّك قبل أن تتقدّم هذه.',
  'Still open, but nobody is waiting on anything.': 'ما زالت مفتوحة، لكن لا أحد ينتظر شيئاً.',
  'Nothing open': 'لا شيء مفتوح',
  'Every job is finished, paid and collected.': 'كل الأعمال منتهية ومدفوعة والمركبات مستلَمة.',
  'One job is past the time it was promised back.': 'عمل واحد تجاوز الموعد الموعود.',
  '{count} jobs are past the time they were promised back.': '{count} أعمال تجاوزت الموعد الموعود.',
  'Past the promise': 'تجاوز الموعد',

  'Cancelled. Nothing further is owed or expected.': 'ملغى. لم يعد هناك مستحق أو منتظَر.',
  'Not booked in yet.': 'لم يُسجَّل بعد.',
  'Booked. The car has not arrived.': 'محجوز. لم تصل السيارة.',
  'Checked in, nothing started.': 'استُلمت السيارة، ولم يبدأ شيء.',
  'Start the inspection': 'ابدأ الفحص',
  'Being inspected.': 'قيد الفحص.',
  'Finish the inspection': 'أنهِ الفحص',
  'Diagnosed, no estimate written.': 'تم التشخيص، ولم يُكتب عرض سعر.',
  'Write the estimate': 'اكتب عرض السعر',
  'Estimate written, not sent.': 'كُتب عرض السعر ولم يُرسل.',
  'Send the estimate': 'أرسل عرض السعر',
  'Waiting for approval, but the estimate has not been sent.':
    'بانتظار الموافقة، لكن عرض السعر لم يُرسل.',
  'Waiting for the customer. {amount} sent, not opened.':
    'بانتظار العميل. أُرسل {amount} ولم يُفتح.',
  'Send a reminder': 'أرسل تذكيراً',
  'Waiting for the customer. {amount} sent, opened, no answer.':
    'بانتظار العميل. أُرسل {amount} وفُتح دون ردّ.',
  'Ring them': 'اتصل بهم',
  'Approved. {count} parts still to arrive, the first due {date}.':
    'تمت الموافقة. ما زالت {count} قطع في الطريق، وأولها في {date}.',
  'Chase the supplier': 'تابع مع المورّد',
  'Approved. {count} parts on order with no date.': 'تمت الموافقة. {count} قطع مطلوبة دون تاريخ.',
  'Approved and ready to start.': 'تمت الموافقة والعمل جاهز للبدء.',
  'Started, then stopped: {count} parts still to arrive.':
    'بدأ ثم توقف: ما زالت {count} قطع في الطريق.',
  'Being worked on now.': 'العمل جارٍ الآن.',
  'Started, nobody on it.': 'بدأ، ولا أحد يعمل عليه.',
  'Put somebody on it': 'كلّف أحداً به',
  'Work done, waiting to be checked.': 'انتهى العمل، بانتظار الفحص.',
  'Do the check': 'نفّذ الفحص',
  'Finished, but the quality check has not been done.': 'انتهى، لكن فحص الجودة لم يُنفَّذ.',
  'Ready, not invoiced.': 'جاهز وغير مفوتر.',
  'Raise the invoice': 'أصدر الفاتورة',
  'Invoiced, {amount} unpaid.': 'مفوتر، و{amount} غير مدفوع.',
  'Ask for payment': 'اطلب السداد',
  'Paid and collected, not closed.': 'مدفوع ومستلَم وغير مقفل.',
  'Close the job': 'أقفل العمل',
  'Paid. The car is still here.': 'مدفوع. السيارة ما زالت هنا.',
  'Tell them it is ready': 'أخبرهم أنها جاهزة',
  'Paid and collected. Nothing outstanding.': 'مدفوع ومستلَم. لا شيء معلّق.',
  'No position recorded for this state.': 'لا توجد حالة مسجّلة لهذا الوضع.',

  '{count}d': '{count} ي',
  '{count}m': '{count} د',
  '{count}h': '{count} س',
  '{h}h {m}m': '{h} س {m} د',
};
