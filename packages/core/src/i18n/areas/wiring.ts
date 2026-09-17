/**
 * The things that were built and could not be reached.
 *
 * Correcting a customer, and moving stock between sites: two capabilities the
 * product had written, tested and never offered a way into. Their words live
 * together because they arrived together, in the sweep that went looking for
 * anything else in the same state.
 */

export const fr: Readonly<Record<string, string>> = {
  // Correcting a customer
  'Correct a customer': 'Corriger un client',
  'Correct their details': 'Corriger ses coordonnées',
  'The same record, not a second one. Their history stays with them.':
    'La même fiche, pas une seconde. Son historique reste avec lui.',
  'Changing a marketing consent here is recorded with the date and who changed it, and shows on their own page.':
    'Toute modification d’un consentement marketing est enregistrée avec la date et l’auteur, et apparaît sur sa propre fiche.',
  'Save the corrections': 'Enregistrer les corrections',
  'Leave it as it was': 'Laisser tel quel',
  'Saved. The same record, with their history still on it.':
    'Enregistré. La même fiche, avec tout son historique.',
  'You cannot change a customer.': 'Vous ne pouvez pas modifier un client.',

  // Stock between sites
  'Start this transfer': 'Lancer ce transfert',
  'Sent. The parts are off the first shelf and counted as in transit until they land.':
    'Envoyé. Les pièces ont quitté le premier rayonnage et sont comptées en transit jusqu’à leur arrivée.',
  'Booked in. What arrived is on the shelf at {to}.':
    'Réceptionné. Ce qui est arrivé est en rayon à {to}.',
  'What is on it': 'Ce qu’il contient',
  'Count each line in as it comes off the van':
    'Comptez chaque ligne à mesure qu’elle sort du véhicule',
  'What was put on this transfer': 'Ce qui a été mis sur ce transfert',
  'Counting in': 'Reçu à l’instant',
  'Anything still missing is not coming. Close the transfer short and write the difference off.':
    'Ce qui manque encore n’arrivera pas. Clôturer le transfert en écart et passer la différence en perte.',
  'Book in what arrived': 'Réceptionner ce qui est arrivé',
  'The journey': 'Le trajet',
  'Not yet': 'Pas encore',
  'The parts come off the shelf at {from} now, and count as in transit until they are booked in.':
    'Les pièces quittent le rayonnage de {from} dès maintenant et sont comptées en transit jusqu’à leur réception.',
  'Send the transfer': 'Envoyer le transfert',
  'Nothing has left a shelf yet, so there is nothing to undo.':
    'Rien n’a encore quitté un rayonnage, il n’y a donc rien à annuler.',
  'Cancel this transfer': 'Annuler ce transfert',
  'These parts are counted in the group’s stock while they are in the van. They belong to neither shelf until somebody books them in, which is why the difference is worth watching.':
    'Ces pièces sont comptées dans le stock du groupe pendant le trajet. Elles n’appartiennent à aucun rayonnage tant que personne ne les réceptionne : c’est pourquoi l’écart mérite d’être surveillé.',
  '{from} to {to}': 'De {from} à {to}',
  'Still to arrive': 'Reste à arriver',

  // Refusals from the transfer rules
  'A transfer goes between two different sites.':
    'Un transfert va d’un site à un autre, différent.',
  'There is nothing on this transfer to send.': 'Ce transfert ne contient rien à envoyer.',
  'One of those sites is not in this workshop.':
    'L’un de ces sites n’appartient pas à cet atelier.',
  // Standing behind a job
  'Stand behind a job': 'Se porter garant d’une intervention',
  'What the workshop is covering, for how long, and whether a supplier is behind it too':
    'Ce que l’atelier garantit, pour combien de temps, et si un fournisseur le garantit aussi',
  'Fixes the date and the mileage it counts from': 'Détermine la date et le kilométrage de départ',
  'Choose a finished job': 'Choisissez une intervention terminée',
  'What is covered': 'Ce qui est garanti',
  'Gearbox, reconditioned': 'Boîte de vitesses reconditionnée',
  'Part or labour': 'Pièce ou main-d’œuvre',
  'A part': 'Une pièce',
  'The work': 'La main-d’œuvre',
  Months: 'Mois',
  'Mileage allowance': 'Kilométrage couvert',
  'Optional. Whose warranty backs yours.': 'Facultatif. La garantie de qui soutient la vôtre.',
  'Nobody but us': 'Personne d’autre que nous',
  'Their months': 'Leurs mois',
  'Theirs often outlasts yours, which is the point of recording it.':
    'La leur dépasse souvent la vôtre, et c’est tout l’intérêt de la noter.',
  'Record the cover': 'Enregistrer la garantie',
  'Recorded. It is on the vehicle and in what the workshop is carrying, and a claim can be raised against it.':
    'Enregistrée. Elle figure sur le véhicule et dans ce que l’atelier porte, et une réclamation peut y être rattachée.',
  'Choose the job the work was done on.':
    'Choisissez l’intervention sur laquelle le travail a été fait.',
  'A mileage allowance counts from a reading, and this vehicle has none. Record the mileage on the job first, or leave the allowance blank.':
    'Un kilométrage couvert se compte à partir d’un relevé, et ce véhicule n’en a aucun. Notez d’abord le kilométrage sur l’intervention, ou laissez le champ vide.',
  // Putting a shelf right
  'Put the shelf right': 'Remettre le rayonnage d’aplomb',
  'A count says what is there; an adjustment says what moved and why. Both leave a movement behind.':
    'Un comptage dit ce qui est là ; un ajustement dit ce qui a bougé et pourquoi. Les deux laissent un mouvement.',
  'Counted on the shelf': 'Compté en rayon',
  'What is actually there, not the difference': 'Ce qui s’y trouve réellement, pas l’écart',
  'Record the count': 'Enregistrer le comptage',
  'Adjust by': 'Ajuster de',
  'Negative to take some off': 'Négatif pour en retirer',
  'Two damaged in the rack': 'Deux abîmées dans le rayonnage',
  'Record the adjustment': 'Enregistrer l’ajustement',
  'Count it again: that is not a number of parts.': 'Recomptez : ce n’est pas un nombre de pièces.',
  'Say how many, up or down.': 'Indiquez combien, en plus ou en moins.',
  'An adjustment carries a reason, or the balance cannot be explained later.':
    'Un ajustement porte un motif, sans quoi le solde ne pourra pas être expliqué plus tard.',
  'Counted. The shelf says what you counted, and the difference is a movement.':
    'Compté. Le rayonnage indique ce que vous avez compté, et l’écart devient un mouvement.',
  'Adjusted, with the reason against it.': 'Ajusté, avec le motif en regard.',

  // The number their own system knows the job by
  'Their PO number': 'Leur numéro de commande',
  'Saved. It goes on the invoice, which is what their accounts department matches against.':
    'Enregistré. Il figure sur la facture, ce sur quoi leur comptabilité fait le rapprochement.',

  // Cashing up
  'Till closed, and the drawer agreed to the penny.':
    'Caisse clôturée, et le tiroir tombait au centime près.',
  'Till closed. The drawer is {amount} over what it should hold.':
    'Caisse clôturée. Le tiroir présente un excédent de {amount}.',
  'Till closed. The drawer is {amount} short of what it should hold.':
    'Caisse clôturée. Il manque {amount} dans le tiroir.',

  // Elsewhere
  'Cancelled. Nothing had left a shelf, so nothing has to be put back.':
    'Annulé. Rien n’avait quitté un rayonnage, il n’y a donc rien à remettre.',
  'Thank you. The workshop has your answer and will carry on from there.':
    'Merci. L’atelier a votre réponse et poursuit à partir de là.',
  'The vehicle is yours. Its history came with it and is on your account now.':
    'Le véhicule est à vous. Son historique l’a suivi et se trouve désormais sur votre compte.',
  'Your password is set. Sign in with the new one.':
    'Votre mot de passe est défini. Connectez-vous avec le nouveau.',
  'Handed over. The vehicle is off your books, and its history went with it rather than staying here.':
    'Cédé. Le véhicule ne figure plus dans vos registres, et son historique l’a suivi plutôt que de rester ici.',
  'Tag the job': 'Étiqueter l’intervention',
  'They have agreed to marketing emails.': 'Ils ont accepté les e-mails marketing.',
  'They have not agreed to marketing emails.': 'Ils n’ont pas accepté les e-mails marketing.',
  'Consent is theirs to give and is changed where a reason is recorded against it, not on this form. It is not asked for here so that nobody can put somebody back on a list by correcting their postcode.':
    'Le consentement leur appartient et se modifie là où un motif est consigné, pas sur ce formulaire. Il n’est pas demandé ici afin que personne ne puisse remettre quelqu’un sur une liste en corrigeant son code postal.',
};

export const ar: Readonly<Record<string, string>> = {
  // Correcting a customer
  'Correct a customer': 'تصحيح بيانات عميل',
  'Correct their details': 'تصحيح بياناته',
  'The same record, not a second one. Their history stays with them.':
    'السجلّ نفسه، لا سجلّ ثانٍ. ويبقى تاريخه معه.',
  'Changing a marketing consent here is recorded with the date and who changed it, and shows on their own page.':
    'تغيير موافقة تسويقية هنا يُسجَّل بتاريخه وبمن غيّره، ويظهر في صفحة العميل نفسه.',
  'Save the corrections': 'حفظ التصحيحات',
  'Leave it as it was': 'اتركه كما كان',
  'Saved. The same record, with their history still on it.':
    'تم الحفظ. السجلّ نفسه، وتاريخه ما زال عليه.',
  'You cannot change a customer.': 'لا يمكنك تعديل بيانات عميل.',

  // Stock between sites
  'Start this transfer': 'ابدأ هذا النقل',
  'Sent. The parts are off the first shelf and counted as in transit until they land.':
    'تم الإرسال. غادرت القطع الرفّ الأول وتُحتسب في الطريق حتى تصل.',
  'Booked in. What arrived is on the shelf at {to}.': 'تم الاستلام. ما وصل صار على الرفّ في {to}.',
  'What is on it': 'ما عليه',
  'Count each line in as it comes off the van': 'عُدّ كل بند وهو ينزل من المركبة',
  'What was put on this transfer': 'ما وُضع على هذا النقل',
  'Counting in': 'المستلَم الآن',
  'Anything still missing is not coming. Close the transfer short and write the difference off.':
    'ما زال ناقصًا لن يصل. أغلِق النقل بعجز واشطب الفرق.',
  'Book in what arrived': 'استلام ما وصل',
  'The journey': 'الرحلة',
  'Not yet': 'ليس بعد',
  'The parts come off the shelf at {from} now, and count as in transit until they are booked in.':
    'تغادر القطع الرفّ في {from} الآن، وتُحتسب في الطريق حتى تُستلَم.',
  'Send the transfer': 'إرسال النقل',
  'Nothing has left a shelf yet, so there is nothing to undo.':
    'لم يغادر شيء أي رفّ بعد، فليس هناك ما يُلغى.',
  'Cancel this transfer': 'إلغاء هذا النقل',
  'These parts are counted in the group’s stock while they are in the van. They belong to neither shelf until somebody books them in, which is why the difference is worth watching.':
    'تُحتسب هذه القطع ضمن مخزون المجموعة وهي في الطريق. ولا تخصّ أي رفّ حتى يستلمها أحد، ولهذا يستحق الفرق المتابعة.',
  '{from} to {to}': 'من {from} إلى {to}',
  'Still to arrive': 'ما زال في الطريق',

  // Refusals from the transfer rules
  'A transfer goes between two different sites.': 'النقل يكون بين موقعين مختلفين.',
  'There is nothing on this transfer to send.': 'لا يوجد على هذا النقل ما يُرسَل.',
  'One of those sites is not in this workshop.': 'أحد هذين الموقعين ليس في هذه الورشة.',
  // Standing behind a job
  'Stand behind a job': 'الضمان على عمل مُنجز',
  'What the workshop is covering, for how long, and whether a supplier is behind it too':
    'ما تضمنه الورشة، ولأي مدة، وهل يقف خلفه مورّد أيضًا',
  'Fixes the date and the mileage it counts from': 'يحدّد تاريخ البدء والعدّاد الذي يُحسب منه',
  'Choose a finished job': 'اختر عملًا منتهيًا',
  'What is covered': 'ما هو مضمون',
  'Gearbox, reconditioned': 'صندوق تروس مُجدَّد',
  'Part or labour': 'قطعة أم أجرة عمل',
  'A part': 'قطعة',
  'The work': 'أجرة العمل',
  Months: 'عدد الأشهر',
  'Mileage allowance': 'المسافة المشمولة',
  'Optional. Whose warranty backs yours.': 'اختياري. ضمان من يدعم ضمانك.',
  'Nobody but us': 'لا أحد سوانا',
  'Their months': 'أشهرهم',
  'Theirs often outlasts yours, which is the point of recording it.':
    'ضمانهم غالبًا يمتدّ أطول من ضمانك، وهذا هو سبب تسجيله.',
  'Record the cover': 'تسجيل الضمان',
  'Recorded. It is on the vehicle and in what the workshop is carrying, and a claim can be raised against it.':
    'تم التسجيل. صار على المركبة وضمن ما تحمله الورشة، ويمكن رفع مطالبة عليه.',
  'Choose the job the work was done on.': 'اختر العمل الذي نُفِّذ عليه.',
  'A mileage allowance counts from a reading, and this vehicle has none. Record the mileage on the job first, or leave the allowance blank.':
    'المسافة المشمولة تُحتسب من قراءة عدّاد، وهذه المركبة ليس لها أي قراءة. سجّل العدّاد على العمل أولًا، أو اترك الحقل فارغًا.',
  // Putting a shelf right
  'Put the shelf right': 'ضبط الرفّ',
  'A count says what is there; an adjustment says what moved and why. Both leave a movement behind.':
    'الجرد يقول ما هو موجود؛ والتسوية تقول ما تحرّك ولماذا. وكلاهما يترك حركة مسجَّلة.',
  'Counted on the shelf': 'المعدود على الرفّ',
  'What is actually there, not the difference': 'ما هو موجود فعلًا، لا الفرق',
  'Record the count': 'تسجيل الجرد',
  'Adjust by': 'التسوية بمقدار',
  'Negative to take some off': 'بالسالب للخصم',
  'Two damaged in the rack': 'قطعتان تلفتا على الرفّ',
  'Record the adjustment': 'تسجيل التسوية',
  'Count it again: that is not a number of parts.': 'أعِد العدّ: هذا ليس عددًا من القطع.',
  'Say how many, up or down.': 'حدّد الكمية، زيادةً أو نقصًا.',
  'An adjustment carries a reason, or the balance cannot be explained later.':
    'التسوية تحمل سببًا، وإلا تعذّر تفسير الرصيد لاحقًا.',
  'Counted. The shelf says what you counted, and the difference is a movement.':
    'تم الجرد. الرفّ يقول ما عددته، والفرق صار حركة مسجَّلة.',
  'Adjusted, with the reason against it.': 'تمت التسوية، ومعها سببها.',

  // The number their own system knows the job by
  'Their PO number': 'رقم أمر الشراء لديهم',
  'Saved. It goes on the invoice, which is what their accounts department matches against.':
    'تم الحفظ. يظهر على الفاتورة، وهو ما تطابق عليه إدارة حساباتهم.',

  // Cashing up
  'Till closed, and the drawer agreed to the penny.': 'أُغلقت الخزينة، وطابق الدرج إلى آخر قرش.',
  'Till closed. The drawer is {amount} over what it should hold.':
    'أُغلقت الخزينة. في الدرج زيادة قدرها {amount}.',
  'Till closed. The drawer is {amount} short of what it should hold.':
    'أُغلقت الخزينة. ينقص الدرج {amount}.',

  // Elsewhere
  'Cancelled. Nothing had left a shelf, so nothing has to be put back.':
    'تم الإلغاء. لم يغادر شيء أي رفّ، فليس هناك ما يُعاد.',
  'Thank you. The workshop has your answer and will carry on from there.':
    'شكرًا لك. وصلت إجابتك إلى الورشة وستكمل على أساسها.',
  'The vehicle is yours. Its history came with it and is on your account now.':
    'المركبة لك. وقد جاء تاريخها معها وصار على حسابك.',
  'Your password is set. Sign in with the new one.':
    'تم تعيين كلمة المرور. سجّل الدخول بالكلمة الجديدة.',
  'Handed over. The vehicle is off your books, and its history went with it rather than staying here.':
    'تمت الحوالة. خرجت المركبة من سجلاتك، وذهب تاريخها معها بدل أن يبقى هنا.',
  'Tag the job': 'وسم العمل',
  'They have agreed to marketing emails.': 'وافقوا على رسائل التسويق بالبريد.',
  'They have not agreed to marketing emails.': 'لم يوافقوا على رسائل التسويق بالبريد.',
  'Consent is theirs to give and is changed where a reason is recorded against it, not on this form. It is not asked for here so that nobody can put somebody back on a list by correcting their postcode.':
    'الموافقة حقّهم هم، وتُغيَّر حيث يُسجَّل سببها، لا في هذه الاستمارة. ولا تُطلب هنا كي لا يعيد أحدٌ شخصًا إلى قائمة بمجرد تصحيح رمزه البريدي.',
};
