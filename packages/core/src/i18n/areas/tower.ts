/**
 * The control tower. Phase 98.
 *
 * Three things must survive translation or the screen changes meaning.
 *
 * **"Costing you now" against "Will by tonight"** is the whole of the risk
 * band: the first is a loss already running, the second a loss that is still
 * avoidable. A translation that made both "urgent" would flatten the one
 * distinction the band exists to draw.
 *
 * **"Ours to move"** is a claim of responsibility, not a description of
 * workload. It must read as "nothing stops these but us", never as "assigned
 * to us".
 *
 * **"Nothing is at risk today."** is good news said plainly, and must stay a
 * sentence rather than a shrug. A workshop that has cleared its board should
 * be told so in words.
 */

export const fr = {
  // The sentence at the top.
  'Nothing in the building.': 'Rien dans l’atelier.',
  '{cars} in the building, and one thing is already costing you.':
    '{cars} dans l’atelier, et une chose vous coûte déjà.',
  '{cars} in the building, and {count} things are already costing you.':
    '{cars} dans l’atelier, et {count} choses vous coûtent déjà.',
  '{cars} in the building, nothing costing you yet, {count} that will by tonight.':
    '{cars} dans l’atelier, rien ne vous coûte encore, {count} qui coûteront ce soir.',
  '{cars} in the building and nothing at risk today.':
    '{cars} dans l’atelier et rien en péril aujourd’hui.',
  'As of {time}; this screen reads itself again every {minutes} minutes.':
    'À {time} ; cet écran se relit toutes les {minutes} minutes.',

  // Before the doors shut.
  'Before the doors shut': 'Avant de fermer les portes',
  'What will have cost the workshop something by closing time if nobody looks. The one already costing comes first.':
    'Ce qui aura coûté quelque chose à l’atelier à la fermeture si personne ne regarde. Ce qui coûte déjà vient en premier.',
  'The morning’s list': 'La liste du matin',
  'Nothing is at risk today.': 'Rien n’est en péril aujourd’hui.',
  'Costing you now': 'Vous coûte déjà',
  'Will by tonight': 'Vous coûtera ce soir',
  '1 car in the building is past the time it was promised back':
    '1 voiture dans l’atelier a dépassé l’heure promise',
  '{count} cars in the building are past the time they were promised back':
    '{count} voitures dans l’atelier ont dépassé l’heure promise',
  '1 car is promised back today and is not finished':
    '1 voiture est promise pour aujourd’hui et n’est pas terminée',
  '{count} cars are promised back today and are not finished':
    '{count} voitures sont promises pour aujourd’hui et ne sont pas terminées',
  '{hours} more hours are promised today than the building can do':
    '{hours} heures de plus sont promises aujourd’hui que l’atelier ne peut en faire',
  '1 part for a car on the ramps is late from the supplier':
    '1 pièce pour une voiture sur les ponts est en retard chez le fournisseur',
  '{count} parts for cars on the ramps are late from the supplier':
    '{count} pièces pour des voitures sur les ponts sont en retard chez le fournisseur',
  '{name} is expected today and has not clocked on':
    '{name} est attendu aujourd’hui et n’a pas pointé',
  '{count} people are expected today and have not clocked on':
    '{count} personnes sont attendues aujourd’hui et n’ont pas pointé',
  'A customer’s message has waited {hours} hours for an answer':
    'Le message d’un client attend une réponse depuis {hours} heures',
  '1 finished car is still here and not paid for':
    '1 voiture terminée est encore ici et n’est pas payée',
  '{count} finished cars are still here and not paid for':
    '{count} voitures terminées sont encore ici et ne sont pas payées',
  '1 thing on this morning’s list has not been done':
    '1 chose de la liste de ce matin n’a pas été faite',
  '{count} things on this morning’s list have not been done':
    '{count} choses de la liste de ce matin n’ont pas été faites',

  // In the building.
  'In the building': 'Dans l’atelier',
  'Nothing is stopping these but us': 'Rien ne les arrête, sauf nous',
  'A decision we cannot make for them': 'Une décision que nous ne pouvons pas prendre pour eux',
  'Waiting on a supplier': 'En attente d’un fournisseur',
  'A part that is not here yet': 'Une pièce qui n’est pas encore là',
  'What blocks each of them': 'Ce qui bloque chacune',
  'Every car in the building that somebody is waiting on, hardest first, with the one thing that moves it.':
    'Chaque voiture de l’atelier qui attend quelqu’un, la plus difficile en premier, avec la seule chose qui la fait avancer.',
  'The whole board': 'Tout le tableau',
  'Nothing in the building': 'Rien dans l’atelier',
  'Every car has been collected, or none has arrived yet.':
    'Toutes les voitures ont été récupérées, ou aucune n’est encore arrivée.',
  'Nothing in the building is waiting on anybody.': 'Rien dans l’atelier n’attend qui que ce soit.',
  'And 1 more on the board': 'Et 1 de plus au tableau',
  'And {count} more on the board': 'Et {count} de plus au tableau',

  // Today.
  'Hours promised': 'Heures promises',
  '{booked}h of {available}h': '{booked} h sur {available} h',
  '{hours}h more than the building can do': '{hours} h de plus que l’atelier ne peut en faire',
  'The bays are the limit today': 'Les ponts sont la limite aujourd’hui',
  'The people are the limit today': 'Les gens sont la limite aujourd’hui',
  'Room to spare': 'De la marge',
  'In today': 'Présents aujourd’hui',
  '{here} of {expected}': '{here} sur {expected}',
  'Everybody expected has clocked on': 'Tous ceux attendus ont pointé',
  'Not yet in: {names}': 'Pas encore là : {names}',
  'Next at {time}': 'Prochain à {time}',
  'Nothing more due in today': 'Plus rien d’attendu aujourd’hui',
  'Not arrived': 'Pas arrivé',
  'Booked for earlier today and not received': 'Réservé plus tôt aujourd’hui et pas reçu',

  // Customers waiting.
  'Customers waiting': 'Clients en attente',
  'Deciding on an estimate': 'Décident d’un devis',
  'The longest for {time}': 'Le plus long depuis {time}',
  'Waiting for a reply': 'Attendent une réponse',
  'Every message has been answered': 'Chaque message a reçu une réponse',
  'Ready to collect': 'Prêtes à récupérer',
  'Finished, and paid for': 'Terminées, et payées',
  '1 not yet paid for': '1 pas encore payée',
  '{count} not yet paid for': '{count} pas encore payées',
  '{hours}h {minutes}m': '{hours} h {minutes} min',
  '{minutes}m': '{minutes} min',

  // The money.
  'To invoice': 'À facturer',
  'Every finished job is billed': 'Chaque travail terminé est facturé',
  '1 finished job with no bill raised': '1 travail terminé sans facture émise',
  '{count} finished jobs with no bill raised': '{count} travaux terminés sans facture émise',

  // Parts.
  'Parts holding up cars in the building': 'Pièces qui retiennent des voitures dans l’atelier',
  'Every part on order for a car already on the ramps, with the day the supplier promised. Late first.':
    'Chaque pièce commandée pour une voiture déjà sur les ponts, avec le jour promis par le fournisseur. Les retards en premier.',
  'No car in the building is waiting on a part.':
    'Aucune voiture dans l’atelier n’attend une pièce.',
  Late: 'En retard',
  'No order found': 'Aucune commande trouvée',
  '{supplier}, promised {date}': '{supplier}, promis le {date}',
  '{supplier}, no date promised': '{supplier}, aucune date promise',
  'Marked on order, and no open order has it':
    'Marquée commandée, et aucune commande ouverte ne la contient',
} as const;

export const ar = {
  // The sentence at the top.
  'Nothing in the building.': 'لا شيء في الورشة.',
  '{cars} in the building, and one thing is already costing you.':
    '{cars} في الورشة، وشيء واحد يكلّفك بالفعل.',
  '{cars} in the building, and {count} things are already costing you.':
    '{cars} في الورشة، و{count} أشياء تكلّفك بالفعل.',
  '{cars} in the building, nothing costing you yet, {count} that will by tonight.':
    '{cars} في الورشة، لا شيء يكلّفك بعد، و{count} ستكلّفك الليلة.',
  '{cars} in the building and nothing at risk today.': '{cars} في الورشة ولا شيء مهدَّد اليوم.',
  'As of {time}; this screen reads itself again every {minutes} minutes.':
    'حتى الساعة {time}؛ تعيد هذه الشاشة قراءة نفسها كل {minutes} دقائق.',

  // Before the doors shut.
  'Before the doors shut': 'قبل إغلاق الأبواب',
  'What will have cost the workshop something by closing time if nobody looks. The one already costing comes first.':
    'ما سيكلّف الورشة شيئًا بحلول موعد الإغلاق إن لم ينظر إليه أحد. ما يكلّف بالفعل يأتي أولًا.',
  'The morning’s list': 'قائمة الصباح',
  'Nothing is at risk today.': 'لا شيء مهدَّد اليوم.',
  'Costing you now': 'يكلّفك الآن',
  'Will by tonight': 'سيكلّفك الليلة',
  '1 car in the building is past the time it was promised back':
    'سيارة واحدة في الورشة تجاوزت الموعد الذي وُعد به',
  '{count} cars in the building are past the time they were promised back':
    '{count} سيارات في الورشة تجاوزت الموعد الذي وُعدت به',
  '1 car is promised back today and is not finished': 'سيارة واحدة موعودة بالتسليم اليوم ولم تنتهِ',
  '{count} cars are promised back today and are not finished':
    '{count} سيارات موعودة بالتسليم اليوم ولم تنتهِ',
  '{hours} more hours are promised today than the building can do':
    'الموعود اليوم يزيد {hours} ساعات عمّا تستطيع الورشة إنجازه',
  '1 part for a car on the ramps is late from the supplier':
    'قطعة واحدة لسيارة على الرافعات متأخرة من المورّد',
  '{count} parts for cars on the ramps are late from the supplier':
    '{count} قطع لسيارات على الرافعات متأخرة من المورّد',
  '{name} is expected today and has not clocked on': '{name} متوقَّع اليوم ولم يسجّل حضوره',
  '{count} people are expected today and have not clocked on':
    '{count} أشخاص متوقَّعون اليوم ولم يسجّلوا حضورهم',
  'A customer’s message has waited {hours} hours for an answer':
    'رسالة عميل تنتظر ردًا منذ {hours} ساعات',
  '1 finished car is still here and not paid for': 'سيارة واحدة منتهية ما زالت هنا ولم تُدفع',
  '{count} finished cars are still here and not paid for':
    '{count} سيارات منتهية ما زالت هنا ولم تُدفع',
  '1 thing on this morning’s list has not been done': 'بند واحد من قائمة هذا الصباح لم يُنجز',
  '{count} things on this morning’s list have not been done':
    '{count} بنود من قائمة هذا الصباح لم تُنجز',

  // In the building.
  'In the building': 'في الورشة',
  'Nothing is stopping these but us': 'لا يوقفها شيء سوانا',
  'A decision we cannot make for them': 'قرار لا نستطيع اتخاذه نيابةً عنهم',
  'Waiting on a supplier': 'بانتظار مورّد',
  'A part that is not here yet': 'قطعة لم تصل بعد',
  'What blocks each of them': 'ما يعطّل كلًّا منها',
  'Every car in the building that somebody is waiting on, hardest first, with the one thing that moves it.':
    'كل سيارة في الورشة بانتظار أحد، الأصعب أولًا، مع الشيء الوحيد الذي يحرّكها.',
  'The whole board': 'اللوحة كاملة',
  'Nothing in the building': 'لا شيء في الورشة',
  'Every car has been collected, or none has arrived yet.':
    'استُلمت كل السيارات، أو لم تصل أي منها بعد.',
  'Nothing in the building is waiting on anybody.': 'لا شيء في الورشة بانتظار أحد.',
  'And 1 more on the board': 'وواحدة أخرى على اللوحة',
  'And {count} more on the board': 'و{count} أخرى على اللوحة',

  // Today.
  'Hours promised': 'الساعات الموعودة',
  '{booked}h of {available}h': '{booked} س من {available} س',
  '{hours}h more than the building can do': '{hours} س أكثر مما تستطيع الورشة إنجازه',
  'The bays are the limit today': 'الرافعات هي الحد اليوم',
  'The people are the limit today': 'الأشخاص هم الحد اليوم',
  'Room to spare': 'ثمة متّسع',
  'In today': 'الحاضرون اليوم',
  '{here} of {expected}': '{here} من {expected}',
  'Everybody expected has clocked on': 'كل المتوقَّعين سجّلوا حضورهم',
  'Not yet in: {names}': 'لم يصل بعد: {names}',
  'Next at {time}': 'التالي في {time}',
  'Nothing more due in today': 'لا شيء آخر متوقَّع اليوم',
  'Not arrived': 'لم تصل',
  'Booked for earlier today and not received': 'محجوزة لوقت سابق اليوم ولم تُستلم',

  // Customers waiting.
  'Customers waiting': 'عملاء ينتظرون',
  'Deciding on an estimate': 'يقرّرون بشأن تقدير',
  'The longest for {time}': 'الأطول منذ {time}',
  'Waiting for a reply': 'بانتظار رد',
  'Every message has been answered': 'كل رسالة أُجيب عليها',
  'Ready to collect': 'جاهزة للاستلام',
  'Finished, and paid for': 'منتهية ومدفوعة',
  '1 not yet paid for': 'واحدة لم تُدفع بعد',
  '{count} not yet paid for': '{count} لم تُدفع بعد',
  '{hours}h {minutes}m': '{hours} س {minutes} د',
  '{minutes}m': '{minutes} د',

  // The money.
  'To invoice': 'للفوترة',
  'Every finished job is billed': 'كل عمل منتهٍ مفوتَر',
  '1 finished job with no bill raised': 'عمل واحد منتهٍ بلا فاتورة',
  '{count} finished jobs with no bill raised': '{count} أعمال منتهية بلا فاتورة',

  // Parts.
  'Parts holding up cars in the building': 'قطع تعطّل سيارات في الورشة',
  'Every part on order for a car already on the ramps, with the day the supplier promised. Late first.':
    'كل قطعة مطلوبة لسيارة على الرافعات بالفعل، مع اليوم الذي وعد به المورّد. المتأخر أولًا.',
  'No car in the building is waiting on a part.': 'لا سيارة في الورشة بانتظار قطعة.',
  Late: 'متأخرة',
  'No order found': 'لم يُعثر على طلب',
  '{supplier}, promised {date}': '{supplier}، موعود في {date}',
  '{supplier}, no date promised': '{supplier}، لا موعد موعود',
  'Marked on order, and no open order has it': 'مُعلَّمة كمطلوبة، ولا طلب مفتوح يحتويها',
} as const;
