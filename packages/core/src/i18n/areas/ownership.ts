/**
 * Ownership handed over, warranty at cost, and prices per site. Phase 44.
 */

export const fr: Readonly<Record<string, string>> = {
  // Handover, at the workshop
  'The handover was called off. The vehicle stays where it was.':
    'La cession a été annulée. Le véhicule reste où il était.',
  'The buyer has been invited': 'L’acheteur a été invité',
  'Nothing has changed hands yet. The buyer opens this link, sees the car and its history, and accepts it themselves.':
    'Rien n’a encore changé de mains. L’acheteur ouvre ce lien, voit le véhicule et son historique, et l’accepte lui-même.',
  'Waiting for the buyer': 'En attente de l’acheteur',
  '{name} was invited on {date} and has until {expires} to accept. Until then the vehicle has not moved.':
    '{name} a été invité le {date} et a jusqu’au {expires} pour accepter. D’ici là, le véhicule n’a pas bougé.',
  'Call it off': 'Annuler',
  'Buyer’s email': 'E-mail de l’acheteur',
  'Only needed to invite them. Blank means you pass on the link yourself.':
    'Utile seulement pour l’inviter. Vide, vous transmettez le lien vous-même.',
  'Buyer’s mobile': 'Mobile de l’acheteur',
  'Invite the buyer to accept it': 'Inviter l’acheteur à l’accepter',
  'Recording it says the sale happened, on your word. Inviting the buyer waits for theirs, and the car lands on their own account when they accept.':
    'L’enregistrer affirme que la vente a eu lieu, sur votre parole. Inviter l’acheteur attend la sienne, et le véhicule arrive sur son compte lorsqu’il accepte.',

  // Handover, the buyer's page
  'A vehicle is being handed to you': 'Un véhicule vous est cédé',
  'Turned down. The seller keeps the vehicle and nothing has changed.':
    'Refusé. Le vendeur garde le véhicule et rien n’a changé.',
  'This has been accepted already. The vehicle is on the buyer’s account.':
    'Cette cession a déjà été acceptée. Le véhicule est sur le compte de l’acheteur.',
  'This handover has run out. Ask the seller to start it again.':
    'Cette cession a expiré. Demandez au vendeur de la relancer.',
  'This handover is closed.': 'Cette cession est close.',
  'What comes with it': 'Ce qui l’accompagne',
  'The history belongs to the car, not to whoever owned it.':
    'L’historique appartient au véhicule, pas à celui qui l’a possédé.',
  'Entries in its history': 'Entrées dans son historique',
  'Changed hands': 'Changement de mains',
  'You are not shown who owned it before you, and they will not be shown anything about you. What you get is the car’s record: its services, parts, inspections and mileage.':
    'Vous ne voyez pas qui l’a possédé avant vous, et cette personne ne verra rien de vous. Ce que vous recevez, c’est le dossier du véhicule : entretiens, pièces, inspections et kilométrage.',
  'Accepting puts the vehicle on your account, signed in as {email}.':
    'En acceptant, le véhicule arrive sur votre compte, connecté en tant que {email}.',
  'Accept the vehicle': 'Accepter le véhicule',
  'It is not mine': 'Ce n’est pas le mien',
  'Sign in, or make an account, and the vehicle lands on it. The history is kept for the car; the account is how you read it.':
    'Connectez-vous, ou créez un compte, et le véhicule y sera rattaché. L’historique est conservé pour le véhicule ; le compte sert à le consulter.',
  'Sign in to accept': 'Se connecter pour accepter',
  'Make an account': 'Créer un compte',
  '{workshop} started this handover on the seller’s behalf.':
    '{workshop} a lancé cette cession pour le compte du vendeur.',
  'The seller started this handover themselves.': 'Le vendeur a lancé cette cession lui-même.',

  // Handover, in the portal
  'Selling it': 'Le vendre',
  'The history goes with the car. Invite the buyer and it lands on their account the moment they accept.':
    'L’historique suit le véhicule. Invitez l’acheteur et il arrive sur son compte dès qu’il accepte.',
  'Called off. The vehicle is still yours.': 'Annulé. Le véhicule est toujours le vôtre.',
  'Send this to the buyer.': 'Envoyez ceci à l’acheteur.',
  'It is shown once. Nothing moves until they accept it.':
    'Il n’est affiché qu’une fois. Rien ne bouge tant qu’il n’a pas accepté.',
  '{name} has been invited and has until {expires} to accept.':
    '{name} a été invité et a jusqu’au {expires} pour accepter.',
  'Who is buying it': 'Qui l’achète',
  'Their name': 'Son nom',
  'Their email': 'Son e-mail',
  'Optional. Blank means you send the link.': 'Facultatif. Vide, vous envoyez le lien vous-même.',
  'Day of the sale': 'Jour de la vente',
  'Hand it over': 'Céder le véhicule',

  // Warranty at cost
  CSV: 'CSV',
  'The work cost': 'Coût des travaux',
  'Nothing spent': 'Rien de dépensé',
  '{pct}% of what was spent': '{pct} % de ce qui a été dépensé',
  Carried: 'À la charge de l’atelier',
  'No invoices in this period': 'Aucune facture sur cette période',
  '{pct}% of turnover': '{pct} % du chiffre d’affaires',
  'Given as goodwill': 'Accordé en geste commercial',
  'Outside the cover, put right anyway': 'Hors garantie, réparé malgré tout',
  'By what failed': 'Par pièce défaillante',
  '1 claim': '1 réclamation',
  '{count} claims': '{count} réclamations',
  'By who stood behind it': 'Par garant',
  '{pct}% back': '{pct} % récupérés',
  'The remedy job has cost {parts} in parts and {labour} in hours so far.':
    'Le travail correctif a coûté jusqu’ici {parts} en pièces et {labour} en heures.',
  'No job has been put against this claim yet.':
    'Aucun travail n’a encore été rattaché à cette réclamation.',
  'The job that put it right': 'Le travail qui l’a corrigé',
  'Its cost is then read from the job, not typed.':
    'Son coût est alors lu depuis le travail, et non saisi.',
  'Job id': 'Identifiant du travail',
  Attach: 'Rattacher',
  'How it ended': 'Comment cela s’est terminé',
  Accepted: 'Acceptée',
  Rejected: 'Refusée',
  'Hours at cost': 'Heures au coût',
  Recovered: 'Récupéré',
  'Credited in full against the next invoice': 'Avoir intégral sur la prochaine facture',
  'It has failed': 'La pièce a lâché',
  'A claim is open on this.': 'Une réclamation est ouverte là-dessus.',
  'What has gone wrong': 'Ce qui ne va pas',
  'Why entertain it, out of cover': 'Pourquoi l’accepter, hors garantie',
  'Raise a claim': 'Ouvrir une réclamation',
  'Raised. Put the job that fixes it against the claim and settle it when the supplier answers.':
    'Ouverte. Rattachez-y le travail correctif et clôturez-la dès que le fournisseur répond.',
  'Attached. What that job costs is now read from the job itself.':
    'Rattaché. Le coût est désormais lu depuis le travail lui-même.',
  'Settled. It counts towards what warranty costs this workshop.':
    'Clôturée. Elle compte dans ce que la garantie coûte à cet atelier.',
  'What warranty costs': 'Ce que coûte la garantie',
  'Settled claims only, at what the work cost rather than what it would have been charged.':
    'Uniquement les réclamations clôturées, au coût des travaux et non à ce qui aurait été facturé.',

  // Prices per site
  'Labour rates': 'Tarifs horaires',
  'What an hour is charged at. A rate against this site is what new lines take here; the rest are the workshop’s.':
    'Ce qu’une heure est facturée. Un tarif rattaché à ce site s’applique ici ; les autres sont ceux de l’atelier.',
  'No rate has been set, so a quote asks for a figure every time.':
    'Aucun tarif n’a été défini, un devis demande donc un montant à chaque fois.',
  'The whole workshop': 'Tout l’atelier',
  'what new lines take': 'appliqué aux nouvelles lignes',
  'an hour': 'de l’heure',
  'What the quote will call it.': 'Le nom qui figurera sur le devis.',
  'An hour': 'De l’heure',
  'Add the rate': 'Ajouter le tarif',
  'Only at this site ({name})': 'Seulement sur ce site ({name})',
  'New lines take this rate': 'Les nouvelles lignes prennent ce tarif',
  'Price at each site': 'Prix par site',
  'Empty means the part’s own price. A figure here is what this site charges, and it does not move when the list does.':
    'Vide signifie le prix de la pièce. Un montant ici est ce que ce site facture, et il ne bouge pas quand le tarif de base change.',
  'Sells for': 'Vendue à',
  'This site’s own price. The list is {price}.':
    'Prix propre à ce site. Le tarif de base est {price}.',
  'The part’s own price.': 'Le prix de la pièce.',

  // Refusals
  'That handover link is not one we know.': 'Ce lien de cession ne nous est pas connu.',
  'That handover is not one we know.': 'Cette cession ne nous est pas connue.',
  'This handover is no longer open, so there is nothing to decline.':
    'Cette cession n’est plus ouverte, il n’y a donc rien à refuser.',
  'This handover is no longer open, so there is nothing to cancel.':
    'Cette cession n’est plus ouverte, il n’y a donc rien à annuler.',
  'This handover is no longer open. Ask the seller to start it again.':
    'Cette cession n’est plus ouverte. Demandez au vendeur de la relancer.',
  'This vehicle already has a handover waiting for the buyer to accept. Cancel that one before starting another.':
    'Ce véhicule a déjà une cession en attente d’acceptation. Annulez-la avant d’en lancer une autre.',
  'This handover has already been accepted. The vehicle is on your account.':
    'Cette cession a déjà été acceptée. Le véhicule est sur votre compte.',
  'You are the one selling this vehicle. The person buying it opens the link and accepts it themselves.':
    'C’est vous qui vendez ce véhicule. C’est l’acheteur qui ouvre le lien et l’accepte lui-même.',
  'That rate is not in this workshop.': 'Ce tarif n’appartient pas à cet atelier.',
  'That claim is not in this workshop.': 'Cette réclamation n’appartient pas à cet atelier.',
  'Give the rate a name. "Standard", "MOT" and "Diagnostic" are what a quote will say.':
    'Donnez un nom au tarif. « Standard », « Contrôle technique » et « Diagnostic » sont ce que dira le devis.',
  'An hourly rate is more than nothing and less than a hundred thousand. Charging nothing for an hour is a discount, not a rate.':
    'Un tarif horaire est supérieur à zéro et inférieur à cent mille. Ne rien facturer pour une heure est une remise, pas un tarif.',
  'A price is neither less than nothing nor more than a million. Leave it empty to use the workshop’s.':
    'Un prix n’est ni inférieur à zéro ni supérieur à un million. Laissez vide pour utiliser celui de l’atelier.',
  'Say how it was settled. A claim closed with nothing against it tells the next person nothing.':
    'Dites comment elle a été réglée. Une réclamation close sans explication n’apprend rien au suivant.',
  'Neither figure can be less than nothing.': 'Aucun des deux montants ne peut être négatif.',
  'More has been recovered than the work cost. Either the cost is understated or part of that credit belongs to another claim.':
    'Il a été récupéré plus que le coût des travaux. Soit le coût est sous-évalué, soit une partie de cet avoir relève d’une autre réclamation.',
  'That price could not be saved.': 'Ce prix n’a pas pu être enregistré.',
  'A vehicle is being handed to you.': 'Un véhicule vous est cédé.',
};

export const ar: Readonly<Record<string, string>> = {
  // Handover, at the workshop
  'The handover was called off. The vehicle stays where it was.':
    'أُلغيت عملية النقل. تبقى المركبة كما كانت.',
  'The buyer has been invited': 'تمت دعوة المشتري',
  'Nothing has changed hands yet. The buyer opens this link, sees the car and its history, and accepts it themselves.':
    'لم تنتقل الملكية بعد. يفتح المشتري هذا الرابط، ويرى السيارة وسجلها، ويقبلها بنفسه.',
  'Waiting for the buyer': 'في انتظار المشتري',
  '{name} was invited on {date} and has until {expires} to accept. Until then the vehicle has not moved.':
    'دُعي {name} في {date} وأمامه حتى {expires} للقبول. وحتى ذلك الحين لم تنتقل المركبة.',
  'Call it off': 'إلغاء',
  'Buyer’s email': 'بريد المشتري',
  'Only needed to invite them. Blank means you pass on the link yourself.':
    'لازم فقط لدعوته. إن تُرك فارغًا فأنت من يمرر الرابط بنفسك.',
  'Buyer’s mobile': 'جوال المشتري',
  'Invite the buyer to accept it': 'دعوة المشتري لقبولها',
  'Recording it says the sale happened, on your word. Inviting the buyer waits for theirs, and the car lands on their own account when they accept.':
    'تسجيلها يعني أن البيع تم بشهادتك أنت. أما دعوة المشتري فتنتظر شهادته، وتصل السيارة إلى حسابه عند قبوله.',

  // Handover, the buyer's page
  'A vehicle is being handed to you': 'تُنقل إليك مركبة',
  'Turned down. The seller keeps the vehicle and nothing has changed.':
    'تم الرفض. يحتفظ البائع بالمركبة ولم يتغير شيء.',
  'This has been accepted already. The vehicle is on the buyer’s account.':
    'قُبلت هذه العملية من قبل. المركبة على حساب المشتري.',
  'This handover has run out. Ask the seller to start it again.':
    'انتهت صلاحية عملية النقل هذه. اطلب من البائع إعادة بدئها.',
  'This handover is closed.': 'عملية النقل هذه مغلقة.',
  'What comes with it': 'ما يأتي معها',
  'The history belongs to the car, not to whoever owned it.': 'السجل ملك للسيارة، لا لمن امتلكها.',
  'Entries in its history': 'عدد مدخلات سجلها',
  'Changed hands': 'تاريخ انتقال الملكية',
  'You are not shown who owned it before you, and they will not be shown anything about you. What you get is the car’s record: its services, parts, inspections and mileage.':
    'لا يُعرض عليك من امتلكها قبلك، ولن يُعرض عليه شيء عنك. ما تحصل عليه هو سجل السيارة: صياناتها وقطعها وفحوصها وقراءات عدادها.',
  'Accepting puts the vehicle on your account, signed in as {email}.':
    'القبول يضع المركبة على حسابك، بتسجيل الدخول باسم {email}.',
  'Accept the vehicle': 'قبول المركبة',
  'It is not mine': 'ليست لي',
  'Sign in, or make an account, and the vehicle lands on it. The history is kept for the car; the account is how you read it.':
    'سجّل الدخول أو أنشئ حسابًا، وستصل المركبة إليه. السجل محفوظ للسيارة؛ والحساب هو وسيلتك لقراءته.',
  'Sign in to accept': 'سجّل الدخول للقبول',
  'Make an account': 'إنشاء حساب',
  '{workshop} started this handover on the seller’s behalf.':
    'بدأت {workshop} عملية النقل هذه نيابةً عن البائع.',
  'The seller started this handover themselves.': 'بدأ البائع عملية النقل هذه بنفسه.',

  // Handover, in the portal
  'Selling it': 'بيعها',
  'The history goes with the car. Invite the buyer and it lands on their account the moment they accept.':
    'السجل يتبع السيارة. ادعُ المشتري ليصل إلى حسابه لحظة قبوله.',
  'Called off. The vehicle is still yours.': 'أُلغيت. المركبة ما زالت لك.',
  'Send this to the buyer.': 'أرسل هذا إلى المشتري.',
  'It is shown once. Nothing moves until they accept it.':
    'يُعرض مرة واحدة. ولا ينتقل شيء حتى يقبل.',
  '{name} has been invited and has until {expires} to accept.':
    'دُعي {name} وأمامه حتى {expires} للقبول.',
  'Who is buying it': 'من يشتريها',
  'Their name': 'اسمه',
  'Their email': 'بريده الإلكتروني',
  'Optional. Blank means you send the link.': 'اختياري. إن تُرك فارغًا فأنت من يرسل الرابط.',
  'Day of the sale': 'يوم البيع',
  'Hand it over': 'نقل الملكية',

  // Warranty at cost
  CSV: 'CSV',
  'The work cost': 'تكلفة العمل',
  'Nothing spent': 'لم يُنفق شيء',
  '{pct}% of what was spent': '{pct}% مما أُنفق',
  Carried: 'تحمّلته الورشة',
  'No invoices in this period': 'لا فواتير في هذه الفترة',
  '{pct}% of turnover': '{pct}% من الإيرادات',
  'Given as goodwill': 'مُنح على سبيل حسن النية',
  'Outside the cover, put right anyway': 'خارج التغطية، وأُصلح رغم ذلك',
  'By what failed': 'حسب القطعة التي تعطلت',
  '1 claim': 'مطالبة واحدة',
  '{count} claims': '{count} مطالبات',
  'By who stood behind it': 'حسب الجهة الضامنة',
  '{pct}% back': 'استُرد {pct}%',
  'The remedy job has cost {parts} in parts and {labour} in hours so far.':
    'كلّف العمل التصحيحي حتى الآن {parts} قطعًا و{labour} ساعات.',
  'No job has been put against this claim yet.': 'لم يُربط أي عمل بهذه المطالبة بعد.',
  'The job that put it right': 'العمل الذي أصلحها',
  'Its cost is then read from the job, not typed.':
    'عندها تُقرأ التكلفة من العمل نفسه، دون إدخالها يدويًا.',
  'Job id': 'معرّف العمل',
  Attach: 'ربط',
  'How it ended': 'كيف انتهت',
  Accepted: 'مقبولة',
  Rejected: 'مرفوضة',
  'Hours at cost': 'الساعات بالتكلفة',
  Recovered: 'المسترد',
  'Credited in full against the next invoice': 'إشعار دائن كامل على الفاتورة التالية',
  'It has failed': 'تعطلت',
  'A claim is open on this.': 'هناك مطالبة مفتوحة على هذه.',
  'What has gone wrong': 'ما الذي حدث',
  'Why entertain it, out of cover': 'لماذا تُقبل رغم انتهاء التغطية',
  'Raise a claim': 'فتح مطالبة',
  'Raised. Put the job that fixes it against the claim and settle it when the supplier answers.':
    'فُتحت. اربط بها العمل الذي يصلحها وأغلقها عندما يرد المورّد.',
  'Attached. What that job costs is now read from the job itself.':
    'تم الربط. تكلفة ذلك العمل تُقرأ الآن من العمل نفسه.',
  'Settled. It counts towards what warranty costs this workshop.':
    'أُغلقت. وتُحتسب ضمن ما تكلفه الضمانات هذه الورشة.',
  'What warranty costs': 'ما تكلفه الضمانات',
  'Settled claims only, at what the work cost rather than what it would have been charged.':
    'المطالبات المغلقة فقط، بتكلفة العمل لا بما كان سيُحتسب على العميل.',

  // Prices per site
  'Labour rates': 'أسعار ساعة العمل',
  'What an hour is charged at. A rate against this site is what new lines take here; the rest are the workshop’s.':
    'سعر الساعة المحتسب. السعر المرتبط بهذا الفرع هو ما تأخذه البنود الجديدة هنا؛ والباقي أسعار الورشة.',
  'No rate has been set, so a quote asks for a figure every time.':
    'لم يُحدَّد أي سعر، لذا يطلب عرض السعر رقمًا في كل مرة.',
  'The whole workshop': 'الورشة كلها',
  'what new lines take': 'تأخذه البنود الجديدة',
  'an hour': 'للساعة',
  'What the quote will call it.': 'الاسم الذي سيظهر في عرض السعر.',
  'An hour': 'للساعة',
  'Add the rate': 'إضافة السعر',
  'Only at this site ({name})': 'في هذا الفرع فقط ({name})',
  'New lines take this rate': 'تأخذ البنود الجديدة هذا السعر',
  'Price at each site': 'السعر في كل فرع',
  'Empty means the part’s own price. A figure here is what this site charges, and it does not move when the list does.':
    'الفراغ يعني سعر القطعة نفسه. والرقم هنا هو ما يحتسبه هذا الفرع، ولا يتغير بتغير سعر القائمة.',
  'Sells for': 'تُباع بـ',
  'This site’s own price. The list is {price}.': 'سعر خاص بهذا الفرع. وسعر القائمة {price}.',
  'The part’s own price.': 'سعر القطعة نفسه.',

  // Refusals
  'That handover link is not one we know.': 'رابط النقل هذا غير معروف لدينا.',
  'That handover is not one we know.': 'عملية النقل هذه غير معروفة لدينا.',
  'This handover is no longer open, so there is nothing to decline.':
    'عملية النقل هذه لم تعد مفتوحة، فلا شيء لرفضه.',
  'This handover is no longer open, so there is nothing to cancel.':
    'عملية النقل هذه لم تعد مفتوحة، فلا شيء لإلغائه.',
  'This handover is no longer open. Ask the seller to start it again.':
    'عملية النقل هذه لم تعد مفتوحة. اطلب من البائع إعادة بدئها.',
  'This vehicle already has a handover waiting for the buyer to accept. Cancel that one before starting another.':
    'لهذه المركبة عملية نقل قائمة تنتظر قبول المشتري. ألغِها قبل بدء أخرى.',
  'This handover has already been accepted. The vehicle is on your account.':
    'قُبلت عملية النقل هذه بالفعل. المركبة على حسابك.',
  'You are the one selling this vehicle. The person buying it opens the link and accepts it themselves.':
    'أنت من يبيع هذه المركبة. المشتري هو من يفتح الرابط ويقبلها بنفسه.',
  'That rate is not in this workshop.': 'هذا السعر لا يتبع هذه الورشة.',
  'That claim is not in this workshop.': 'هذه المطالبة لا تتبع هذه الورشة.',
  'Give the rate a name. "Standard", "MOT" and "Diagnostic" are what a quote will say.':
    'امنح السعر اسمًا. «قياسي» و«الفحص الدوري» و«تشخيص» هي ما سيظهر في عرض السعر.',
  'An hourly rate is more than nothing and less than a hundred thousand. Charging nothing for an hour is a discount, not a rate.':
    'سعر الساعة أكبر من صفر وأقل من مئة ألف. واحتساب لا شيء مقابل ساعة خصمٌ لا سعر.',
  'A price is neither less than nothing nor more than a million. Leave it empty to use the workshop’s.':
    'السعر ليس أقل من صفر ولا أكثر من مليون. اتركه فارغًا لاستخدام سعر الورشة.',
  'Say how it was settled. A claim closed with nothing against it tells the next person nothing.':
    'اذكر كيف أُغلقت. مطالبة تُغلق دون بيان لا تفيد من يقرؤها لاحقًا.',
  'Neither figure can be less than nothing.': 'لا يمكن أن يكون أي من الرقمين أقل من صفر.',
  'More has been recovered than the work cost. Either the cost is understated or part of that credit belongs to another claim.':
    'المسترد أكبر من تكلفة العمل. فإما أن التكلفة أقل مما ينبغي، أو أن جزءًا من هذا الإشعار يخص مطالبة أخرى.',
  'That price could not be saved.': 'تعذّر حفظ هذا السعر.',
  'A vehicle is being handed to you.': 'تُنقل إليك مركبة.',
};
