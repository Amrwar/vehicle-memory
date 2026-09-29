/**
 * The machine the job needs. Phase 89.
 *
 * Two sentences carry the phase and both must survive translation intact.
 *
 * "Certificate expired" has to read as *not permitted to be used*, not as
 * *paperwork is late*. A workshop that reads it as paperwork will keep using
 * the lift.
 *
 * And the service warning has to read as the opposite: worth doing, stops
 * nothing. If the two blur together in any language, a workshop either grounds
 * itself over a missed service or keeps working on an uninspected lift, and
 * the second is how somebody gets hurt.
 */

export const fr = {
  // The states.
  Retired: 'Retiré du service',
  'Out of service': 'Hors service',
  'Certificate expired': 'Certificat expiré',
  'In use on another job': 'Utilisé sur une autre intervention',
  Available: 'Disponible',

  // The list.
  Equipment: 'Équipements',
  'Lifts, scan tools, torque wrenches and rigs. A machine whose certificate has expired stops the jobs that need it; one late for its own service does not.':
    'Ponts, valises de diagnostic, clés dynamométriques et bancs. Un appareil dont le certificat a expiré bloque les interventions qui en dépendent ; un appareil en retard de maintenance, non.',
  '{count} machines cannot be used': '{count} appareils sont inutilisables',
  'needed by {what}': 'requis par {what}',
  'Every machine': 'Tous les appareils',
  '{count} recorded, the ones needing attention first':
    '{count} enregistrés, les plus urgents en premier',
  'No machines recorded yet. Add the ones a job cannot be done without.':
    'Aucun appareil enregistré. Ajoutez ceux sans lesquels une intervention ne peut pas se faire.',
  Machine: 'Appareil',
  State: 'État',
  Certificate: 'Certificat',
  Serviced: 'Entretenu le',
  'Needed by': 'Requis par',
  'None held': 'Aucun',
  'Expires in {count}d': 'Expire dans {count} j',
  Overdue: 'En retard',

  // Adding one.
  'Add a machine': 'Ajouter un appareil',
  'A certificate warns {count} days before it lapses, which is long enough to book the engineer.':
    'Un certificat alerte {count} jours avant son expiration, de quoi faire intervenir le technicien à temps.',
  Code: 'Code',
  'Serial number': 'Numéro de série',
  'Certificate reference': 'Référence du certificat',
  'Certified on': 'Certifié le',
  'Certificate expires': 'Certificat expirant le',
  'Certified by': 'Certifié par',
  'Service every (months)': 'Entretien tous les (mois)',
  'Add the machine': 'Ajouter l’appareil',

  // One machine.
  'What is known about it': 'Ce que l’on sait de lui',
  'Where it is': 'Emplacement',
  'Last serviced': 'Dernier entretien',
  'Next service due': 'Prochain entretien',
  'Jobs on the bench needing it': 'Interventions en cours qui en dépendent',
  'Out of service since {when}: {why}': 'Hors service depuis le {when} : {why}',
  'Its certificate expired on {when}. Jobs that need this machine cannot start until a new one is recorded.':
    'Son certificat a expiré le {when}. Aucune intervention qui en dépend ne peut démarrer avant l’enregistrement d’un nouveau certificat.',
  'Its certificate expires in {count} days. Book the engineer now.':
    'Son certificat expire dans {count} jours. Faites intervenir le technicien dès maintenant.',
  'It is overdue its own service. That is worth doing, and it does not stop any job.':
    'Son entretien est en retard. Cela mérite d’être fait, et cela ne bloque aucune intervention.',
  'Record a certificate': 'Enregistrer un certificat',
  'The one press that puts a grounded machine back to work.':
    'Le seul geste qui remet en service un appareil immobilisé.',
  // The money area owns bare `Record it` for a payment; French genders the
  // pronoun, so this one is qualified rather than fighting over the word.
  'Record it#certificate': 'Enregistrer le certificat',
  'Its condition': 'Son état',
  'Put it back in service': 'Le remettre en service',
  'What is wrong with it?': 'Qu’est-ce qui ne va pas ?',
  'Take it out of service': 'Le mettre hors service',
  'It has been serviced today': 'Il a été entretenu aujourd’hui',
  'Retire it': 'Le retirer du service',
  'Bring it back': 'Le remettre en service actif',
  'Work that needs it': 'Les interventions qui en dépendent',
  'A job of one of these kinds cannot start while this machine cannot be used.':
    'Une intervention de ce type ne peut pas démarrer tant que cet appareil est inutilisable.',
  'No kinds of work yet.': 'Aucun type d’intervention pour l’instant.',
  'Needs it': 'En dépend',
  'It does not need it': 'N’en dépend pas',
  'It needs it': 'En dépend',

  // The refusals.
  'That machine was not found.': 'Cet appareil est introuvable.',
  'A machine needs a name and a code.': 'Un appareil exige un nom et un code.',
  'A certificate cannot expire before it was issued.':
    'Un certificat ne peut pas expirer avant d’avoir été délivré.',
  'Say what is wrong with it, so somebody can fix it.':
    'Indiquez ce qui ne va pas, pour que quelqu’un puisse le réparer.',
  'That kind of work or machine was not found.':
    'Ce type d’intervention ou cet appareil est introuvable.',
  'That machine could not be saved.': 'Cet appareil n’a pas pu être enregistré.',
  'This job needs equipment that cannot be used: {v1}.':
    'Cette intervention exige un équipement inutilisable : {v1}.',
};

export const ar = {
  Retired: 'مسحوب من الخدمة',
  'Out of service': 'خارج الخدمة',
  'Certificate expired': 'انتهت صلاحية الشهادة',
  'In use on another job': 'مستخدَم في عمل آخر',
  Available: 'متاح',

  Equipment: 'المعدات',
  'Lifts, scan tools, torque wrenches and rigs. A machine whose certificate has expired stops the jobs that need it; one late for its own service does not.':
    'الرافعات وأجهزة الفحص ومفاتيح العزم والأجهزة. المعدة التي انتهت صلاحية شهادتها توقف الأعمال التي تحتاجها؛ أما المتأخرة عن صيانتها فلا.',
  '{count} machines cannot be used': '{count} من المعدات غير صالحة للاستخدام',
  'needed by {what}': 'يحتاجها {what}',
  'Every machine': 'كل المعدات',
  '{count} recorded, the ones needing attention first': 'مسجَّلة: {count}، والأكثر إلحاحاً أولاً',
  'No machines recorded yet. Add the ones a job cannot be done without.':
    'لا معدات مسجَّلة بعد. أضف ما لا يمكن إنجاز عمل بدونه.',
  Machine: 'المعدة',
  State: 'الحالة',
  Certificate: 'الشهادة',
  Serviced: 'تاريخ الصيانة',
  'Needed by': 'يحتاجها',
  'None held': 'لا توجد',
  'Expires in {count}d': 'تنتهي خلال {count} يوم',
  Overdue: 'متأخرة',

  'Add a machine': 'أضف معدة',
  'A certificate warns {count} days before it lapses, which is long enough to book the engineer.':
    'تُنبّه الشهادة قبل {count} يوماً من انتهائها، وهي مهلة تكفي لحجز الفني.',
  Code: 'الرمز',
  'Serial number': 'الرقم التسلسلي',
  'Certificate reference': 'مرجع الشهادة',
  'Certified on': 'تاريخ الاعتماد',
  'Certificate expires': 'انتهاء الشهادة',
  'Certified by': 'جهة الاعتماد',
  'Service every (months)': 'الصيانة كل (أشهر)',
  'Add the machine': 'أضف المعدة',

  'What is known about it': 'ما نعرفه عنها',
  'Where it is': 'مكانها',
  'Last serviced': 'آخر صيانة',
  'Next service due': 'الصيانة القادمة',
  'Jobs on the bench needing it': 'الأعمال الجارية التي تحتاجها',
  'Out of service since {when}: {why}': 'خارج الخدمة منذ {when}: {why}',
  'Its certificate expired on {when}. Jobs that need this machine cannot start until a new one is recorded.':
    'انتهت صلاحية شهادتها في {when}. لا يمكن بدء أي عمل يحتاجها حتى تُسجَّل شهادة جديدة.',
  'Its certificate expires in {count} days. Book the engineer now.':
    'تنتهي شهادتها خلال {count} يوماً. احجز الفني الآن.',
  'It is overdue its own service. That is worth doing, and it does not stop any job.':
    'تأخرت صيانتها الخاصة. الأمر يستحق الإنجاز، وهو لا يوقف أي عمل.',
  'Record a certificate': 'سجّل شهادة',
  'The one press that puts a grounded machine back to work.':
    'الإجراء الوحيد الذي يعيد معدة موقوفة إلى العمل.',
  'Record it#certificate': 'سجّل الشهادة',
  'Its condition': 'حالتها',
  'Put it back in service': 'أعدها إلى الخدمة',
  'What is wrong with it?': 'ما العطل فيها؟',
  'Take it out of service': 'أخرجها من الخدمة',
  'It has been serviced today': 'تمت صيانتها اليوم',
  'Retire it': 'اسحبها من الخدمة',
  'Bring it back': 'أعدها للعمل',
  'Work that needs it': 'الأعمال التي تحتاجها',
  'A job of one of these kinds cannot start while this machine cannot be used.':
    'لا يمكن بدء عمل من هذه الأنواع ما دامت هذه المعدة غير صالحة للاستخدام.',
  'No kinds of work yet.': 'لا أنواع عمل بعد.',
  'Needs it': 'تحتاجها',
  'It does not need it': 'لا تحتاجها',
  'It needs it': 'تحتاجها',

  'That machine was not found.': 'لم يُعثر على هذه المعدة.',
  'A machine needs a name and a code.': 'المعدة تتطلب اسماً ورمزاً.',
  'A certificate cannot expire before it was issued.':
    'لا يمكن أن تنتهي الشهادة قبل تاريخ إصدارها.',
  'Say what is wrong with it, so somebody can fix it.': 'بيّن العطل حتى يتمكن أحد من إصلاحه.',
  'That kind of work or machine was not found.': 'لم يُعثر على نوع العمل أو المعدة.',
  'That machine could not be saved.': 'تعذّر حفظ هذه المعدة.',
  'This job needs equipment that cannot be used: {v1}.':
    'يحتاج هذا العمل إلى معدة غير صالحة للاستخدام: {v1}.',
};
