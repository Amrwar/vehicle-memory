/**
 * The customer's portal.
 *
 * Keys are the English exactly as written in the product. Slots in braces
 * are kept as they are. Phase 40.5.
 */

export const fr: Readonly<Record<string, string>> = {
  // The portal: home, booking, claims, invoices, passports, rewards, account, updates, vehicles and workshops.
  'Every time below is one {workshop} can actually do. Pick one and it is in the diary.':
    'Chaque horaire ci-dessous est un horaire que {workshop} peut vraiment assurer. Choisissez-en un et il est inscrit à l’agenda.',
  'Your workshop. Any other on Carnet can take the car too.':
    'Votre atelier. N’importe quel autre sur Carnet peut aussi prendre la voiture.',
  'A workshop you have not used before. Booking makes you their customer.':
    'Un atelier que vous n’avez jamais fréquenté. Réserver fait de vous son client.',
  '(yours)': '(le vôtre)',
  'About 1 hour': 'Environ 1 heure',
  'About {hours} hours': 'Environ {hours} heures',
  'from {price}': 'à partir de {price}',
  'Times the workshop genuinely has free': 'Les horaires où l’atelier est vraiment libre',
  'The diary is full for this length of work. Ring {phone} and they will find something.':
    'L’agenda est complet pour un travail de cette durée. Appelez le {phone} et ils trouveront une solution.',
  'The diary is full for this length of work. Get in touch and they will find something.':
    'L’agenda est complet pour un travail de cette durée. Contactez-les et ils trouveront une solution.',
  'That vehicle is not one of yours.': 'Ce véhicule n’est pas à vous.',
  '← My vehicles': '← Mes véhicules',
  'Your account is ready. Check your email for the confirmation link, then add your car below.':
    'Votre compte est prêt. Consultez vos e-mails pour le lien de confirmation, puis ajoutez votre voiture ci-dessous.',
  'Enter the registration. We pass the request to the garage that last worked on it, and somebody there confirms the car is yours.':
    'Saisissez l’immatriculation. Nous transmettons la demande au garage qui a travaillé en dernier sur la voiture, et quelqu’un là-bas confirme qu’elle est à vous.',
  'Confirm your email address first. A garage is being asked to hand over a vehicle history, and they should at least know the address is real. The link is in your inbox.':
    'Confirmez d’abord votre adresse e-mail. On demande à un garage de transmettre l’historique d’un véhicule, il doit au moins savoir que l’adresse est réelle. Le lien est dans votre boîte de réception.',
  'Sent. The garage will see it on their next visit to Carnet, and you will get an email either way.':
    'Envoyé. Le garage le verra lors de sa prochaine visite sur Carnet, et vous recevrez un e-mail dans tous les cas.',
  'You have {count} requests waiting. Wait for one to be answered before asking about another.':
    'Vous avez {count} demandes en attente. Attendez qu’une réponse arrive avant d’en faire une autre.',
  'Or the 17-character VIN, if you have a private plate':
    'Ou le VIN à 17 caractères, si vous avez une plaque personnalisée',
  'Anything that helps them recognise you': 'Tout ce qui les aide à vous reconnaître',
  'Optional. A phone number or the date of your last visit saves a call.':
    'Facultatif. Un numéro de téléphone ou la date de votre dernière visite évite un appel.',
  'Serviced with you in March, under the name Maria Okafor.':
    'Entretien chez vous en mars, au nom de Maria Okafor.',
  'Ask the workshop that last worked on it':
    'Demander à l’atelier qui a travaillé dessus en dernier',
  'Your requests': 'Vos demandes',
  'Nothing asked for yet': 'Aucune demande pour l’instant',
  'Requests you make appear here, with whatever the garage said.':
    'Les demandes que vous faites apparaissent ici, avec la réponse du garage.',
  'Withdraw this request': 'Retirer cette demande',
  'One vehicle is already on your account.': 'Un véhicule est déjà sur votre compte.',
  '{count} vehicles are already on your account.': '{count} véhicules sont déjà sur votre compte.',
  'Why a person has to approve this': 'Pourquoi une personne doit approuver ceci',
  'A registration is painted on the outside of the car and a VIN is visible through the windscreen. If either opened a service history, anybody walking through a car park could read a stranger’s.':
    'L’immatriculation est inscrite à l’extérieur de la voiture et le VIN est visible à travers le pare-brise. Si l’un ou l’autre ouvrait un historique d’entretien, n’importe qui traversant un parking pourrait lire celui d’un inconnu.',
  'So the garage decides. They know you, and they are the only ones who can say the car is yours. If nothing has happened after {days} days, ringing them is usually quicker than waiting.':
    'C’est donc le garage qui décide. Il vous connaît, et lui seul peut dire que la voiture est à vous. S’il ne s’est rien passé après {days} jours, l’appeler est généralement plus rapide qu’attendre.',
  Waiting: 'En attente',
  approved: 'approuvée',
  rejected: 'refusée',
  withdrawn: 'retirée',
  'that vehicle': 'ce véhicule',
  '{registration} is on your account.': '{registration} est sur votre compte.',
  'The workshop did not confirm {registration}.': 'L’atelier n’a pas confirmé {registration}.',
  'The workshop did not confirm {registration}. {reason}':
    'L’atelier n’a pas confirmé {registration}. {reason}',
  'You withdrew the request for {registration}.':
    'Vous avez retiré la demande pour {registration}.',
  'Still waiting on {registration}, asked {days} days ago. Ringing the garage is usually quicker than waiting.':
    'Toujours en attente pour {registration}, demandé il y a {days} jours. Appeler le garage est généralement plus rapide qu’attendre.',
  'Waiting for the workshop to confirm {registration} is yours.':
    'En attente de la confirmation par l’atelier que {registration} est à vous.',
  'Nothing has been invoiced to you yet.': 'Rien ne vous a encore été facturé.',
  'Everything is settled. Nothing is owed.': 'Tout est réglé. Rien n’est dû.',
  '1 still to pay.': '1 reste à payer.',
  '{count} still to pay.': '{count} restent à payer.',
  'Paid. Thank you. Invoice {number} is settled, and a receipt is on its way to you.':
    'Payé. Merci. La facture {number} est réglée, et un reçu est en route.',
  'Paid. Thank you. The invoice is settled, and a receipt is on its way to you.':
    'Payé. Merci. La facture est réglée, et un reçu est en route.',
  'The provider did not say why.': 'Le prestataire n’a pas indiqué pourquoi.',
  'Nothing has been taken. You can try again, or pay the workshop directly.':
    'Rien n’a été prélevé. Vous pouvez réessayer, ou payer directement l’atelier.',
  '{workshop} · issued {date}': '{workshop} · émise le {date}',
  unpaid: 'impayée',
  'Counter sale': 'Vente au comptoir',
  'Pay {amount} by card': 'Payer {amount} par carte',
  'Due {date}.': 'Échéance le {date}.',
  'You can also pay the workshop directly.': 'Vous pouvez aussi payer directement l’atelier.',
  'Pay the workshop directly.': 'Payez directement l’atelier.',
  'paid with points': 'payée avec des points',
  'paid by card online': 'payée par carte en ligne',
  'paid by cash': 'payée en espèces',
  'paid by card': 'payée par carte',
  'paid by bank transfer': 'payée par virement',
  'paid by cheque': 'payée par chèque',
  'paid by account': 'payée sur compte',
  'paid by other': 'payée par un autre moyen',
  'paid by gift card': 'payée par carte cadeau',
  'paid by deposit': 'payée par acompte',
  'estimated {amount}': 'estimé à {amount}',
  '1 entry on its passport': '1 entrée sur son passeport',
  '{count} entries on its passport': '{count} entrées sur son passeport',
  'Your points and a code that brings a friend.': 'Vos points et un code pour amener un ami.',
  'Your points, workshop by workshop.': 'Vos points, atelier par atelier.',
  Draft: 'Brouillon',
  'Vehicle received': 'Véhicule réceptionné',
  Inspection: 'Contrôle',
  Diagnosis: 'Diagnostic',
  'Estimate created': 'Devis établi',
  'Customer approval': 'Accord du client',
  Repair: 'Réparation',
  'Quality control': 'Contrôle qualité',
  Completed: 'Terminé',
  Payment: 'Paiement',
  'Each car you own has a passport: its history, kept by every garage that worked on it.':
    'Chaque voiture que vous possédez a un passeport : son historique, tenu par chaque garage qui a travaillé dessus.',
  '1 car. One record does not verify; the garage that keeps it has been told.':
    '1 voiture. Un registre ne se vérifie pas ; le garage qui le tient a été prévenu.',
  '{count} cars. One record does not verify; the garage that keeps it has been told.':
    '{count} voitures. Un registre ne se vérifie pas ; le garage qui le tient a été prévenu.',
  'Nothing recorded yet.': 'Rien d’enregistré pour l’instant.',
  '1 car, 1 entry, every record sound.': '1 voiture, 1 entrée, tous les registres intègres.',
  '1 car, {entries} entries, every record sound.':
    '1 voiture, {entries} entrées, tous les registres intègres.',
  '{cars} cars, 1 entry, every record sound.':
    '{cars} voitures, 1 entrée, tous les registres intègres.',
  '{cars} cars, {entries} entries, every record sound.':
    '{cars} voitures, {entries} entrées, tous les registres intègres.',
  '1 entry from 1 garage, since {date}.': '1 entrée d’un garage, depuis {date}.',
  '{entries} entries from 1 garage, since {date}.': '{entries} entrées d’un garage, depuis {date}.',
  '{entries} entries from {garages} garages, since {date}.':
    '{entries} entrées de {garages} garages, depuis {date}.',
  '1 entry from 1 garage.': '1 entrée d’un garage.',
  '{entries} entries from 1 garage.': '{entries} entrées d’un garage.',
  '{entries} entries from {garages} garages.': '{entries} entrées de {garages} garages.',
  'Worth {amount} off your next bill.': 'Valent {amount} de réduction sur votre prochaine facture.',
  '{points} expire on {date}.': '{points} expirent le {date}.',
  'After {amount} of work, you both get {points} points.':
    'Après {amount} de travaux, vous recevez chacun {points} points.',
  'Confirmed. To change it, get in touch with a workshop you use.':
    'Confirmée. Pour la modifier, contactez un atelier que vous fréquentez.',
  'Not confirmed yet. Check your inbox for the link.':
    'Pas encore confirmée. Consultez votre boîte de réception pour le lien.',
  'At least {count} characters.': 'Au moins {count} caractères.',
  'Forgotten it? {link}.': 'Vous l’avez oublié ? {link}.',
  'today at {time}': 'aujourd’hui à {time}',
  yesterday: 'hier',
  '{days} days ago': 'il y a {days} jours',
  '1 quote needs your answer.': '1 devis attend votre réponse.',
  '{count} quotes need your answer.': '{count} devis attendent votre réponse.',
  '1 visit is under way.': '1 visite est en cours.',
  '{count} visits are under way.': '{count} visites sont en cours.',
  'Nothing is happening right now.': 'Rien ne se passe pour le moment.',
  'Promised for {date}.': 'Promis pour {date}.',
  'Any questions, ring {workshop} on {phone}.':
    'Pour toute question, appelez {workshop} au {phone}.',
  'Booked in': 'Rendez-vous pris',
  'We have your slot.': 'Nous avons votre créneau.',
  'With us': 'Chez nous',
  'Your car has arrived and is booked in.': 'Votre voiture est arrivée et est enregistrée.',
  'Being looked at': 'En cours d’examen',
  'A technician is checking it over.': 'Un technicien est en train de la contrôler.',
  'There is a quote for you to look at.': 'Un devis vous attend.',
  'Work will start shortly.': 'Les travaux vont bientôt commencer.',
  'Being worked on': 'En cours de travaux',
  'The work is under way.': 'Les travaux sont en cours.',
  'Almost ready': 'Presque prête',
  'The work is done and is being checked before you collect it.':
    'Les travaux sont terminés et en cours de vérification avant que vous la récupériez.',
  Ready: 'Prête',
  'Your car is ready to collect.': 'Votre voiture est prête à être récupérée.',
  'There is an invoice for this visit.': 'Une facture a été émise pour cette visite.',
  'Paid in full. Thank you.': 'Payée en totalité. Merci.',
  'This visit was cancelled.': 'Cette visite a été annulée.',
  'Vehicle history': 'Historique du véhicule',
  '1 entry on record': '1 entrée enregistrée',
  '{count} entries on record': '{count} entrées enregistrées',
  '1 entry · open the passport': '1 entrée · ouvrir le passeport',
  '{count} entries · open the passport': '{count} entrées · ouvrir le passeport',
  '{title}. Contact any workshop and the work is carried out free of charge by the manufacturer.':
    '{title}. Contactez n’importe quel atelier et les travaux sont réalisés gratuitement, à la charge du constructeur.',
  'at {mileage}': 'à {mileage}',
  'At {mileage}': 'À {mileage}',
  'Mileage not recorded': 'Kilométrage non enregistré',
  '{when}: handed over, {details}.': '{when} : remise, {details}.',
  '{when}: handed back, {details}.': '{when} : restituée, {details}.',
  '{km} km': '{km} km',
  'fuel {fuel}': 'carburant {fuel}',
  empty: 'vide',
  full: 'plein',
  'not noted': 'non noté',
  '1 mark noted': '1 marque relevée',
  '{count} marks noted': '{count} marques relevées',
  '1 photo': '1 photo',
  '{count} photos': '{count} photos',
  'signed by {name}': 'signé par {name}',
  ', ': ', ',
  'A buyer, an insurer, or the next garage. They see the vehicle’s record and nothing about you. You can take the link back at any time.':
    'Un acheteur, un assureur ou le garage suivant. Ils voient le registre du véhicule et rien sur vous. Vous pouvez retirer le lien à tout moment.',
  'Live until {date}': 'Actif jusqu’au {date}',
  'not opened yet': 'pas encore ouvert',
  'opened once': 'ouvert une fois',
  'opened {count} times': 'ouvert {count} fois',
  'Registration certificate': 'Certificat d’immatriculation',
  'MOT certificate': 'Certificat de contrôle technique',
  Insurance: 'Assurance',
  'Service record': 'Carnet d’entretien',
  'Purchase invoice': 'Facture d’achat',
  Other: 'Autre',
  Document: 'Document',
  'Expired {date}': 'Expiré le {date}',
  'Runs out {date}': 'Expire le {date}',
  'Valid until {date}': 'Valable jusqu’au {date}',
  'No paperwork on this vehicle yet.': 'Aucun document sur ce véhicule pour l’instant.',
  '1 document on file.': '1 document au dossier.',
  '{count} documents on file.': '{count} documents au dossier.',
  'The MOT has expired.': 'Le contrôle technique a expiré.',
  'The MOT runs out on {date}.': 'Le contrôle technique expire le {date}.',
  'The insurance has expired.': 'L’assurance a expiré.',
  'The insurance runs out on {date}.': 'L’assurance expire le {date}.',
  'Your vehicle’s passport': 'Le passeport de votre véhicule',
  '← Back to the vehicle': '← Retour au véhicule',
  'Show this to somebody': 'Montrer ceci à quelqu’un',
  'This is the document a buyer sees when you share a link, word for word. Nothing about you is on it.':
    'C’est le document qu’un acheteur voit quand vous partagez un lien, mot pour mot. Rien sur vous n’y figure.',
  'Address not given': 'Adresse non renseignée',
  'Every workshop on Carnet. Book at any of them; your car’s history goes with you.':
    'Tous les ateliers sur Carnet. Réservez dans n’importe lequel ; l’historique de votre voiture vous suit.',
  'No workshop matches that': 'Aucun atelier ne correspond',
  'No workshops yet': 'Pas encore d’ateliers',
  'Try the town or the first part of the postcode.': 'Essayez la ville ou le début du code postal.',
  'Workshops appear here as they join Carnet.':
    'Les ateliers apparaissent ici à mesure qu’ils rejoignent Carnet.',
  'Other workshops': 'Autres ateliers',
};

export const ar: Readonly<Record<string, string>> = {
  // The portal: home, booking, claims, invoices, passports, rewards, account, updates, vehicles and workshops.
  'Every time below is one {workshop} can actually do. Pick one and it is in the diary.':
    'كل موعد أدناه تستطيع {workshop} الالتزام به فعلاً. اختر واحداً وسيُسجَّل في الأجندة.',
  'Your workshop. Any other on Carnet can take the car too.':
    'ورشتك. ويمكن لأي ورشة أخرى على Carnet أن تستقبل السيارة أيضاً.',
  'A workshop you have not used before. Booking makes you their customer.':
    'ورشة لم تتعامل معها من قبل. الحجز يجعلك عميلاً لديها.',
  '(yours)': '(ورشتك)',
  'About 1 hour': 'نحو ساعة واحدة',
  'About {hours} hours': 'نحو {hours} ساعات',
  'from {price}': 'ابتداءً من {price}',
  'Times the workshop genuinely has free': 'المواعيد المتاحة فعلاً لدى الورشة',
  'The diary is full for this length of work. Ring {phone} and they will find something.':
    'الأجندة ممتلئة لعمل بهذه المدة. اتصل على {phone} وسيجدون موعداً.',
  'The diary is full for this length of work. Get in touch and they will find something.':
    'الأجندة ممتلئة لعمل بهذه المدة. تواصل معهم وسيجدون موعداً.',
  'That vehicle is not one of yours.': 'هذه المركبة ليست من مركباتك.',
  '← My vehicles': '→ مركباتي',
  'Your account is ready. Check your email for the confirmation link, then add your car below.':
    'حسابك جاهز. تحقق من بريدك الإلكتروني للعثور على رابط التأكيد، ثم أضف سيارتك أدناه.',
  'Enter the registration. We pass the request to the garage that last worked on it, and somebody there confirms the car is yours.':
    'أدخل رقم اللوحة. نمرّر الطلب إلى الورشة التي عملت على السيارة آخر مرة، ويؤكد أحد العاملين هناك أنها لك.',
  'Confirm your email address first. A garage is being asked to hand over a vehicle history, and they should at least know the address is real. The link is in your inbox.':
    'أكّد عنوان بريدك الإلكتروني أولاً. يُطلب من ورشة أن تسلّم سجل مركبة، وعليها على الأقل أن تعرف أن العنوان حقيقي. الرابط في بريدك الوارد.',
  'Sent. The garage will see it on their next visit to Carnet, and you will get an email either way.':
    'أُرسل. سترى الورشة الطلب في زيارتها التالية لCarnet، وستصلك رسالة بريد إلكتروني في كل الأحوال.',
  'You have {count} requests waiting. Wait for one to be answered before asking about another.':
    'لديك {count} طلبات قيد الانتظار. انتظر الرد على أحدها قبل أن تطلب مركبة أخرى.',
  'Or the 17-character VIN, if you have a private plate':
    'أو رقم الهيكل المكوّن من 17 خانة، إن كانت لديك لوحة مميزة',
  'Anything that helps them recognise you': 'أي شيء يساعدهم على التعرف عليك',
  'Optional. A phone number or the date of your last visit saves a call.':
    'اختياري. رقم هاتف أو تاريخ آخر زيارة يوفّر اتصالاً.',
  'Serviced with you in March, under the name Maria Okafor.':
    'صيانة لديكم في مارس، باسم ماريا أوكافور.',
  'Ask the workshop that last worked on it': 'اطلب من الورشة التي عملت عليها آخر مرة',
  'Your requests': 'طلباتك',
  'Nothing asked for yet': 'لا طلبات بعد',
  'Requests you make appear here, with whatever the garage said.':
    'تظهر هنا الطلبات التي تقدّمها، مع ما قالته الورشة.',
  'Withdraw this request': 'اسحب هذا الطلب',
  'One vehicle is already on your account.': 'توجد مركبة واحدة في حسابك بالفعل.',
  '{count} vehicles are already on your account.': 'توجد {count} مركبات في حسابك بالفعل.',
  'Why a person has to approve this': 'لماذا يجب أن يوافق شخص على هذا',
  'A registration is painted on the outside of the car and a VIN is visible through the windscreen. If either opened a service history, anybody walking through a car park could read a stranger’s.':
    'رقم اللوحة مكتوب على السيارة من الخارج، ورقم الهيكل ظاهر عبر الزجاج الأمامي. لو كان أيٌّ منهما يفتح سجل الصيانة، لاستطاع أي مار في موقف سيارات أن يقرأ سجل شخص غريب.',
  'So the garage decides. They know you, and they are the only ones who can say the car is yours. If nothing has happened after {days} days, ringing them is usually quicker than waiting.':
    'لذا تقرر الورشة. فهي تعرفك، وهي الوحيدة القادرة على تأكيد أن السيارة لك. وإن لم يحدث شيء بعد {days} أيام، فالاتصال بها عادةً أسرع من الانتظار.',
  Waiting: 'قيد الانتظار',
  approved: 'مقبول',
  rejected: 'مرفوض',
  withdrawn: 'مسحوب',
  'that vehicle': 'تلك المركبة',
  '{registration} is on your account.': 'أصبحت {registration} في حسابك.',
  'The workshop did not confirm {registration}.': 'لم تؤكد الورشة {registration}.',
  'The workshop did not confirm {registration}. {reason}':
    'لم تؤكد الورشة {registration}. {reason}',
  'You withdrew the request for {registration}.': 'سحبت طلبك الخاص بـ {registration}.',
  'Still waiting on {registration}, asked {days} days ago. Ringing the garage is usually quicker than waiting.':
    'ما زلت بانتظار {registration}، طُلبت قبل {days} أيام. الاتصال بالورشة عادةً أسرع من الانتظار.',
  'Waiting for the workshop to confirm {registration} is yours.':
    'بانتظار أن تؤكد الورشة أن {registration} لك.',
  'Nothing has been invoiced to you yet.': 'لم تصدر لك أي فاتورة بعد.',
  'Everything is settled. Nothing is owed.': 'كل شيء مسدد. لا توجد مبالغ مستحقة.',
  '1 still to pay.': 'فاتورة واحدة بانتظار الدفع.',
  '{count} still to pay.': '{count} فواتير بانتظار الدفع.',
  'Paid. Thank you. Invoice {number} is settled, and a receipt is on its way to you.':
    'تم الدفع. شكراً لك. سُددت الفاتورة {number}، والإيصال في طريقه إليك.',
  'Paid. Thank you. The invoice is settled, and a receipt is on its way to you.':
    'تم الدفع. شكراً لك. سُددت الفاتورة، والإيصال في طريقه إليك.',
  'The provider did not say why.': 'لم يوضح مزوّد الدفع السبب.',
  'Nothing has been taken. You can try again, or pay the workshop directly.':
    'لم يُخصم شيء. يمكنك المحاولة مجدداً، أو الدفع للورشة مباشرة.',
  '{workshop} · issued {date}': '{workshop} · صدرت في {date}',
  unpaid: 'غير مدفوعة',
  'Counter sale': 'بيع مباشر',
  'Pay {amount} by card': 'ادفع {amount} بالبطاقة',
  'Due {date}.': 'تستحق في {date}.',
  'You can also pay the workshop directly.': 'يمكنك أيضاً الدفع للورشة مباشرة.',
  'Pay the workshop directly.': 'ادفع للورشة مباشرة.',
  'paid with points': 'دُفعت بالنقاط',
  'paid by card online': 'دُفعت بالبطاقة عبر الإنترنت',
  'paid by cash': 'دُفعت نقداً',
  'paid by card': 'دُفعت بالبطاقة',
  'paid by bank transfer': 'دُفعت بتحويل بنكي',
  'paid by cheque': 'دُفعت بشيك',
  'paid by account': 'دُفعت على الحساب',
  'paid by other': 'دُفعت بوسيلة أخرى',
  'paid by gift card': 'دُفعت ببطاقة هدية',
  'paid by deposit': 'دُفعت من العربون',
  'estimated {amount}': 'التقدير {amount}',
  '1 entry on its passport': 'قيد واحد في جوازها',
  '{count} entries on its passport': '{count} قيود في جوازها',
  'Your points and a code that brings a friend.': 'نقاطك ورمز تدعو به صديقاً.',
  'Your points, workshop by workshop.': 'نقاطك، ورشةً ورشة.',
  Draft: 'مسودة',
  'Vehicle received': 'تم استلام المركبة',
  Inspection: 'الفحص',
  Diagnosis: 'التشخيص',
  'Estimate created': 'تم إعداد عرض السعر',
  'Customer approval': 'موافقة العميل',
  Repair: 'الإصلاح',
  'Quality control': 'مراقبة الجودة',
  Completed: 'مكتمل',
  Payment: 'الدفع',
  'Each car you own has a passport: its history, kept by every garage that worked on it.':
    'لكل سيارة تملكها جواز: سجلها، تحفظه كل ورشة عملت عليها.',
  '1 car. One record does not verify; the garage that keeps it has been told.':
    'سيارة واحدة. أحد السجلات لا يجتاز التحقق؛ وقد أُبلغت الورشة التي تحفظه.',
  '{count} cars. One record does not verify; the garage that keeps it has been told.':
    '{count} سيارات. أحد السجلات لا يجتاز التحقق؛ وقد أُبلغت الورشة التي تحفظه.',
  'Nothing recorded yet.': 'لم يُسجَّل شيء بعد.',
  '1 car, 1 entry, every record sound.': 'سيارة واحدة، قيد واحد، وكل السجلات سليمة.',
  '1 car, {entries} entries, every record sound.':
    'سيارة واحدة، {entries} قيود، وكل السجلات سليمة.',
  '{cars} cars, 1 entry, every record sound.': '{cars} سيارات، قيد واحد، وكل السجلات سليمة.',
  '{cars} cars, {entries} entries, every record sound.':
    '{cars} سيارات، {entries} قيود، وكل السجلات سليمة.',
  '1 entry from 1 garage, since {date}.': 'قيد واحد من ورشة واحدة، منذ {date}.',
  '{entries} entries from 1 garage, since {date}.': '{entries} قيود من ورشة واحدة، منذ {date}.',
  '{entries} entries from {garages} garages, since {date}.':
    '{entries} قيود من {garages} ورش، منذ {date}.',
  '1 entry from 1 garage.': 'قيد واحد من ورشة واحدة.',
  '{entries} entries from 1 garage.': '{entries} قيود من ورشة واحدة.',
  '{entries} entries from {garages} garages.': '{entries} قيود من {garages} ورش.',
  'Worth {amount} off your next bill.': 'تساوي خصم {amount} من فاتورتك التالية.',
  '{points} expire on {date}.': 'تنتهي صلاحية {points} نقطة في {date}.',
  'After {amount} of work, you both get {points} points.':
    'بعد أعمال بقيمة {amount}، يحصل كل منكما على {points} نقطة.',
  'Confirmed. To change it, get in touch with a workshop you use.':
    'مؤكَّد. لتغييره، تواصل مع ورشة تتعامل معها.',
  'Not confirmed yet. Check your inbox for the link.':
    'لم يُؤكَّد بعد. ابحث عن الرابط في بريدك الوارد.',
  'At least {count} characters.': '{count} أحرف على الأقل.',
  'Forgotten it? {link}.': 'نسيتها؟ {link}.',
  'today at {time}': 'اليوم الساعة {time}',
  yesterday: 'أمس',
  '{days} days ago': 'قبل {days} أيام',
  '1 quote needs your answer.': 'عرض سعر واحد بانتظار ردك.',
  '{count} quotes need your answer.': '{count} عروض أسعار بانتظار ردك.',
  '1 visit is under way.': 'زيارة واحدة قيد التنفيذ.',
  '{count} visits are under way.': '{count} زيارات قيد التنفيذ.',
  'Nothing is happening right now.': 'لا يحدث شيء الآن.',
  'Promised for {date}.': 'موعد التسليم المتفق عليه {date}.',
  'Any questions, ring {workshop} on {phone}.': 'لأي استفسار، اتصل بـ {workshop} على {phone}.',
  'Booked in': 'تم الحجز',
  'We have your slot.': 'موعدك محجوز لدينا.',
  'With us': 'لدينا',
  'Your car has arrived and is booked in.': 'وصلت سيارتك وسُجّل دخولها.',
  'Being looked at': 'قيد الفحص',
  'A technician is checking it over.': 'يفحصها أحد الفنيين الآن.',
  'There is a quote for you to look at.': 'هناك عرض سعر بانتظار اطلاعك.',
  'Work will start shortly.': 'سيبدأ العمل قريباً.',
  'Being worked on': 'قيد العمل',
  'The work is under way.': 'العمل جارٍ.',
  'Almost ready': 'على وشك الجاهزية',
  'The work is done and is being checked before you collect it.':
    'انتهى العمل ويجري فحصه قبل أن تستلمها.',
  Ready: 'جاهزة',
  'Your car is ready to collect.': 'سيارتك جاهزة للاستلام.',
  'There is an invoice for this visit.': 'صدرت فاتورة لهذه الزيارة.',
  'Paid in full. Thank you.': 'دُفعت بالكامل. شكراً لك.',
  'This visit was cancelled.': 'أُلغيت هذه الزيارة.',
  'Vehicle history': 'سجل المركبة',
  '1 entry on record': 'قيد واحد مسجّل',
  '{count} entries on record': '{count} قيود مسجّلة',
  '1 entry · open the passport': 'قيد واحد · افتح الجواز',
  '{count} entries · open the passport': '{count} قيود · افتح الجواز',
  '{title}. Contact any workshop and the work is carried out free of charge by the manufacturer.':
    '{title}. تواصل مع أي ورشة وسيُنفَّذ العمل مجاناً على نفقة الشركة المصنّعة.',
  'at {mileage}': 'عند {mileage}',
  'At {mileage}': 'عند {mileage}',
  'Mileage not recorded': 'قراءة العداد غير مسجّلة',
  '{when}: handed over, {details}.': '{when}: سُلّمت، {details}.',
  '{when}: handed back, {details}.': '{when}: أُعيدت، {details}.',
  '{km} km': '{km} كم',
  'fuel {fuel}': 'الوقود {fuel}',
  empty: 'فارغ',
  full: 'ممتلئ',
  'not noted': 'غير مدوّن',
  '1 mark noted': 'علامة واحدة مدوّنة',
  '{count} marks noted': '{count} علامات مدوّنة',
  '1 photo': 'صورة واحدة',
  '{count} photos': '{count} صور',
  'signed by {name}': 'بتوقيع {name}',
  ', ': '، ',
  'A buyer, an insurer, or the next garage. They see the vehicle’s record and nothing about you. You can take the link back at any time.':
    'مشترٍ أو شركة تأمين أو الورشة التالية. يرون سجل المركبة ولا شيء عنك. ويمكنك سحب الرابط في أي وقت.',
  'Live until {date}': 'فعّال حتى {date}',
  'not opened yet': 'لم يُفتح بعد',
  'opened once': 'فُتح مرة واحدة',
  'opened {count} times': 'فُتح {count} مرات',
  'Registration certificate': 'شهادة التسجيل',
  'MOT certificate': 'شهادة الفحص الفني',
  Insurance: 'التأمين',
  'Service record': 'سجل الصيانة',
  'Purchase invoice': 'فاتورة الشراء',
  Other: 'أخرى',
  Document: 'مستند',
  'Expired {date}': 'انتهى في {date}',
  'Runs out {date}': 'ينتهي في {date}',
  'Valid until {date}': 'صالح حتى {date}',
  'No paperwork on this vehicle yet.': 'لا توجد مستندات لهذه المركبة بعد.',
  '1 document on file.': 'مستند واحد في الملف.',
  '{count} documents on file.': '{count} مستندات في الملف.',
  'The MOT has expired.': 'انتهت صلاحية الفحص الفني.',
  'The MOT runs out on {date}.': 'تنتهي صلاحية الفحص الفني في {date}.',
  'The insurance has expired.': 'انتهت صلاحية التأمين.',
  'The insurance runs out on {date}.': 'تنتهي صلاحية التأمين في {date}.',
  'Your vehicle’s passport': 'جواز مركبتك',
  '← Back to the vehicle': '→ العودة إلى المركبة',
  'Show this to somebody': 'اعرض هذا على شخص ما',
  'This is the document a buyer sees when you share a link, word for word. Nothing about you is on it.':
    'هذا هو المستند الذي يراه المشتري عندما تشارك رابطاً، حرفياً. ولا يوجد فيه شيء عنك.',
  'Address not given': 'العنوان غير مذكور',
  'Every workshop on Carnet. Book at any of them; your car’s history goes with you.':
    'كل الورش على Carnet. احجز لدى أيٍّ منها؛ وسجل سيارتك يرافقك.',
  'No workshop matches that': 'لا توجد ورشة مطابقة',
  'No workshops yet': 'لا توجد ورش بعد',
  'Try the town or the first part of the postcode.':
    'جرّب اسم المدينة أو الجزء الأول من الرمز البريدي.',
  'Workshops appear here as they join Carnet.': 'تظهر الورش هنا عند انضمامها إلى Carnet.',
  'Other workshops': 'ورش أخرى',
};
