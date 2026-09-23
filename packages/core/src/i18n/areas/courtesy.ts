/**
 * The courtesy car. Phase 67.
 *
 * Every key here is a phrase rather than a word, and that is not a style
 * preference. The dictionary is one flat map from English to each language,
 * shared by every page in the product, so a key is claimed by whoever writes
 * it first and means whatever they meant. "Out" was already the ledger's —
 * `Out: 'Déséquilibré'`, as in out of balance — and "Back" was already the
 * navigation's, `Back: 'Précédent'`. A courtesy car described as
 * "Déséquilibré" to a French reader is not a small mistake, and the check that
 * every sentence has an answer could not have caught it: both had answers.
 *
 * So: "With a customer", "In the yard". Phrases nobody else will want.
 */

export const fr: Readonly<Record<string, string>> = {
  // What a loan says about itself, reached through a variable
  'With a customer': 'Chez un client',
  'In the yard': 'De retour à l’atelier',
  'Promised to somebody': 'Promise à quelqu’un',
  'Due back today': 'À rendre aujourd’hui',
  '1 day overdue': '1 jour de retard pour le retour',
  '{v1} days overdue': '{v1} jours de retard pour le retour',

  // The pages
  'A car to be going on with, while the workshop has theirs.':
    'Un véhicule pour se déplacer, pendant que l’atelier a le leur.',
  'Nobody has been lent a car for this job.':
    'Aucun véhicule n’a été prêté pour cet ordre de réparation.',
  'A car already on this workshop’s records. Add it as a vehicle first if it is not there.':
    'Un véhicule déjà enregistré chez cet atelier. Ajoutez-le comme véhicule s’il n’y figure pas.',
  'Add a vehicle': 'Ajouter un véhicule',
  'Add it': 'L’ajouter',
  'Add one': 'En ajouter un',
  'Every vehicle on record is already lent, or there are none.':
    'Tous les véhicules enregistrés sont déjà prêtés, ou il n’y en a aucun.',
  'No longer lent': 'Plus prêté',
  'Stop lending it': 'Ne plus le prêter',
  'The silver Fiesta': 'La Fiesta grise',
  'What the desk calls it': 'Le nom utilisé à l’accueil',
  'Courtesy car': 'Véhicule de courtoisie',
  'Courtesy cars': 'Véhicules de courtoisie',
  'The cars this workshop lends while it has somebody’s own.':
    'Les véhicules que cet atelier prête pendant qu’il a celui du client.',
  'Nothing is lent out at the moment.': 'Aucun véhicule n’est prêté en ce moment.',
  'This workshop lends no cars yet.': 'Cet atelier ne prête encore aucun véhicule.',
  'Out with customers': 'Chez des clients',
  'Lend a car': 'Prêter un véhicule',
  'Which car': 'Quel véhicule',
  From: 'Du',
  'Back by': 'À rendre le',
  'On the clock': 'Au compteur',
  'Take it back': 'Reprendre le véhicule',
  'Free over those days': 'Libres sur cette période',
  'Already promised over those days': 'Déjà promis sur cette période',
  'Nobody has it': 'Personne ne l’a',
  'Due back {when}': 'À rendre le {when}',
  'Lent to {who}': 'Prêté à {who}',

  // Refusals
  'That car is already promised to somebody over those days.':
    'Ce véhicule est déjà promis à quelqu’un sur cette période.',
  'That car has just been promised to somebody else over those days.':
    'Ce véhicule vient d’être promis à quelqu’un d’autre sur cette période.',
  'It has to come back after it goes out.': 'Il doit revenir après être parti.',
  'That car is not on this workshop’s records.':
    'Ce véhicule ne figure pas dans les registres de cet atelier.',
  'That car is out with somebody. Take it back first.':
    'Ce véhicule est chez quelqu’un. Reprenez-le d’abord.',
  '{v1} runs out before they would bring it back.': '{v1} expire avant qu’ils ne le ramènent.',
  'Its MOT': 'Son contrôle technique',
  'Its insurance': 'Son assurance',
  'It cannot come back before it went out.': 'Il ne peut pas revenir avant d’être parti.',
  'That is not one of your courtesy cars.': 'Ce n’est pas l’un de vos véhicules de courtoisie.',
  'That customer is not one of yours.': 'Ce client n’est pas l’un des vôtres.',
  'That loan is not one of yours.': 'Ce prêt n’est pas l’un des vôtres.',
  'That car is already back.': 'Ce véhicule est déjà revenu.',
  'That loan was cancelled.': 'Ce prêt a été annulé.',
  'Say why, so the next person reading this knows.':
    'Dites pourquoi, afin que la prochaine personne qui lira ceci le sache.',
};

export const ar: Readonly<Record<string, string>> = {
  'With a customer': 'لدى أحد العملاء',
  'In the yard': 'عاد إلى الورشة',
  'Promised to somebody': 'موعود به لشخص ما',
  'Due back today': 'يجب إعادته اليوم',
  '1 day overdue': 'تأخّر يومًا واحدًا عن موعد الإعادة',
  '{v1} days overdue': 'تأخّر {v1} أيام عن موعد الإعادة',

  'A car to be going on with, while the workshop has theirs.':
    'مركبة للتنقّل بها، بينما سيارتهم لدى الورشة.',
  'Nobody has been lent a car for this job.': 'لم تُعَر أي مركبة لهذه المهمة.',
  'A car already on this workshop’s records. Add it as a vehicle first if it is not there.':
    'مركبة مسجّلة لدى هذه الورشة بالفعل. أضفها كمركبة أولًا إن لم تكن موجودة.',
  'Add a vehicle': 'إضافة مركبة',
  'Add it': 'أضفها',
  'Add one': 'أضف واحدة',
  'Every vehicle on record is already lent, or there are none.':
    'كل المركبات المسجّلة معارة بالفعل، أو لا توجد أي مركبة.',
  'No longer lent': 'لم تعد تُعار',
  'Stop lending it': 'التوقف عن إعارتها',
  'The silver Fiesta': 'الفييستا الفضية',
  'What the desk calls it': 'الاسم المستخدم في الاستقبال',
  'Courtesy car': 'مركبة بديلة',
  'Courtesy cars': 'المركبات البديلة',
  'The cars this workshop lends while it has somebody’s own.':
    'المركبات التي تعيرها هذه الورشة بينما سيارة العميل لديها.',
  'Nothing is lent out at the moment.': 'لا توجد مركبة معارة في الوقت الحالي.',
  'This workshop lends no cars yet.': 'لا تعير هذه الورشة أي مركبة بعد.',
  'Out with customers': 'لدى العملاء',
  'Lend a car': 'إعارة مركبة',
  'Which car': 'أي مركبة',
  From: 'من',
  'Back by': 'تُعاد بحلول',
  'On the clock': 'قراءة العداد',
  'Take it back': 'استلام المركبة',
  'Free over those days': 'متاحة خلال تلك الأيام',
  'Already promised over those days': 'موعود بها بالفعل خلال تلك الأيام',
  'Nobody has it': 'ليست لدى أحد',
  'Due back {when}': 'تُعاد في {when}',
  'Lent to {who}': 'مُعارة إلى {who}',

  'That car is already promised to somebody over those days.':
    'هذه المركبة موعود بها لشخص آخر خلال تلك الأيام.',
  'That car has just been promised to somebody else over those days.':
    'لقد وُعد بهذه المركبة لشخص آخر للتو خلال تلك الأيام.',
  'It has to come back after it goes out.': 'يجب أن تعود بعد خروجها.',
  'That car is not on this workshop’s records.': 'هذه المركبة ليست في سجلات هذه الورشة.',
  'That car is out with somebody. Take it back first.': 'هذه المركبة لدى شخص ما. استلمها أولًا.',
  '{v1} runs out before they would bring it back.': 'ينتهي {v1} قبل أن يعيدوها.',
  'Its MOT': 'فحصها الفني',
  'Its insurance': 'تأمينها',
  'It cannot come back before it went out.': 'لا يمكن أن تعود قبل أن تخرج.',
  'That is not one of your courtesy cars.': 'هذه ليست إحدى مركباتك البديلة.',
  'That customer is not one of yours.': 'هذا العميل ليس من عملائك.',
  'That loan is not one of yours.': 'هذه الإعارة ليست من إعاراتك.',
  'That car is already back.': 'لقد عادت هذه المركبة بالفعل.',
  'That loan was cancelled.': 'أُلغيت هذه الإعارة.',
  'Say why, so the next person reading this knows.': 'اذكر السبب، ليعرفه من يقرأ هذا بعدك.',
};
