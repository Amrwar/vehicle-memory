/**
 * Sentences thrown by the web libraries when something is refused, keyed
 * with {v1}, {v2} slots where the sentence carries a value.
 *
 * Keys are the English exactly as written in the product. Slots in braces
 * are kept as they are. Phase 40.5.
 */

export const fr: Readonly<Record<string, string>> = {
  'Period "{v1}" is closed. Post the correction into the open period instead.':
    'La période « {v1} » est clôturée. Passez la correction dans la période ouverte.',
  'No account for code {v1}. Run the chart of accounts setup.':
    'Aucun compte pour le code {v1}. Lancez la configuration du plan comptable.',
  'Send the key as "Authorization: Bearer cn_…".':
    'Envoyez la clé sous la forme « Authorization: Bearer cn_… ».',
  'This key has made its {v1} calls this hour. Try again after {v2}.':
    'Cette clé a déjà effectué ses {v1} appels de l’heure. Réessayez après {v2}.',
  'That job is not here.': 'Ce travail n’est pas ici.',
  'No such check on this job.': 'Ce contrôle n’existe pas sur ce travail.',
  'Ask something.': 'Posez une question.',
  'That is not a kind of message the assistant drafts.':
    'L’assistant ne rédige pas ce type de message.',
  'That job is not in this workshop.': 'Ce travail n’appartient pas à cet atelier.',
  'That draft is not on record.': 'Ce brouillon est introuvable.',
  'That draft has already been sent.': 'Ce brouillon a déjà été envoyé.',
  'There is nothing to send.': 'Il n’y a rien à envoyer.',
  'The customer has no mobile number or email address on file, so there is nowhere to send it.':
    'Le client n’a ni numéro de mobile ni adresse e-mail enregistrés : il n’y a donc nulle part où l’envoyer.',
  'The budget is a whole number of tokens, from 0 to 100,000,000.':
    'Le budget est un nombre entier de jetons, de 0 à 100 000 000.',
  'Password must be at least 10 characters':
    'Le mot de passe doit comporter au moins 10 caractères',
  'This campaign is {v1}, and a campaign cannot be sent twice.':
    'Cette campagne est à l’état « {v1} », et une campagne ne peut pas être envoyée deux fois.',
  'Nobody in this segment can be written to on this channel right now.':
    'Personne dans ce segment ne peut être contacté sur ce canal pour le moment.',
  'That is not one of the plans.': 'Ce n’est pas l’une des formules.',
  'That day filled up while you were choosing. Please pick another.':
    'Cette journée s’est remplie pendant votre choix. Veuillez en choisir une autre.',
  'Somebody took that slot a moment ago. Please pick another.':
    'Quelqu’un vient de prendre ce créneau. Veuillez en choisir un autre.',
  'This booking is already a job. Change the job instead.':
    'Ce rendez-vous est déjà devenu un travail. Modifiez plutôt le travail.',
  'That booking no longer exists.': 'Ce rendez-vous n’existe plus.',
  'This booking was closed. Book the car in again, or open a job from the vehicle.':
    'Ce rendez-vous a été clôturé. Reprenez un rendez-vous pour la voiture, ou ouvrez un travail depuis le véhicule.',
  'That invoice is not yours to pay.': 'Ce n’est pas à vous de régler cette facture.',
  '{v1} is already in the catalogue as "{v2}". Open that one rather than adding it twice: two rows for one part means two stock figures, both wrong.':
    '{v1} figure déjà au catalogue sous le nom « {v2} ». Ouvrez cette fiche plutôt que de l’ajouter deux fois : deux lignes pour une même pièce, ce sont deux chiffres de stock, tous deux faux.',
  'That supplier is not one of yours.': 'Ce fournisseur ne fait pas partie des vôtres.',
  'Tell us your name.': 'Indiquez-nous votre nom.',
  'That does not look like an email address.': 'Cela ne ressemble pas à une adresse e-mail.',
  'There is already an account on that address. Sign in, or use the forgotten password link.':
    'Un compte existe déjà pour cette adresse. Connectez-vous, ou utilisez le lien de mot de passe oublié.',
  'That is neither a registration nor a VIN. A VIN is exactly 17 characters.':
    'Ce n’est ni une immatriculation ni un VIN. Un VIN comporte exactement 17 caractères.',
  'There is no customer record against that vehicle here any more, so there is nothing to attach them to.':
    'Il n’y a plus de fiche client liée à ce véhicule ici : il n’y a donc rien à quoi le rattacher.',
  'Somebody else already holds the portal account for that customer. Settle which of them it should be before approving this.':
    'Quelqu’un d’autre détient déjà le compte portail de ce client. Déterminez lequel des deux doit l’avoir avant d’approuver cette demande.',
  'Somebody else answered that request a moment ago. Reload to see what they said.':
    'Quelqu’un d’autre vient de répondre à cette demande. Rechargez la page pour voir sa réponse.',
  'That conversation is not here.': 'Cette conversation n’est pas ici.',
  'This thread has no customer to write to.': 'Cette conversation n’a aucun client à qui écrire.',
  'Write something first.': 'Écrivez d’abord quelque chose.',
  '{v1} cannot be reached by {v2}: there is no {v3} on file.':
    'Impossible de joindre {v1} par {v2} : aucun(e) {v3} n’est enregistré(e).',
  '{v1} is {v2}MB; the limit is {v3}MB.': '{v1} fait {v2} Mo ; la limite est de {v3} Mo.',
  'The store refused {v1} ({v2}).': 'Le stockage a refusé {v1} ({v2}).',
  'That person is not on this team.': 'Cette personne ne fait pas partie de cette équipe.',
  'A template needs a name and a message.': 'Un modèle doit avoir un nom et un message.',
  'That customer is not in this workshop.': 'Ce client n’appartient pas à cet atelier.',
  'That person is not a technician here.': 'Cette personne n’est pas technicien ici.',
  'Say why it is safe to send there again. The database will refuse it blank.':
    'Indiquez pourquoi il est sûr d’envoyer de nouveau à cette adresse. La base de données refusera un motif vide.',
  'That job is not this customer’s.': 'Ce travail n’appartient pas à ce client.',
  'That invoice is not in this workshop.': 'Cette facture n’appartient pas à cet atelier.',
  'That deposit is not this customer’s, or nothing is left on it.':
    'Cet acompte n’appartient pas à ce client, ou il n’en reste rien.',
  'That deposit is not in this workshop.': 'Cet acompte n’appartient pas à cet atelier.',
  'That booking is closed, so there is nowhere to move it to.':
    'Ce rendez-vous est clôturé : il ne peut donc être déplacé nulle part.',
  'That document is not on record.': 'Ce document est introuvable.',
  'Say what the extra work is.': 'Indiquez en quoi consiste le travail supplémentaire.',
  'Say how many, or how many hours.': 'Indiquez la quantité, ou le nombre d’heures.',
  'This job is closed, so extra work goes on a new job for the same car.':
    'Ce travail est clôturé : le travail supplémentaire va donc sur un nouveau travail pour la même voiture.',
  'No part {v1} on your books. Leave the part number blank to quote it as a line, or add the part first.':
    'Aucune pièce {v1} dans vos références. Laissez la référence vide pour la chiffrer comme une simple ligne, ou ajoutez d’abord la pièce.',
  'There is nothing on this quote yet. Add the work first.':
    'Ce devis est encore vide. Ajoutez d’abord les travaux.',
  'The total is zero. Price the lines before recording an approval.':
    'Le total est nul. Chiffrez les lignes avant d’enregistrer une approbation.',
  'This quote is {v1}; it cannot be approved again.':
    'Ce devis est à l’état « {v1} » ; il ne peut pas être approuvé de nouveau.',
  'This fleet has no agreement yet. Save the terms first, so the invoice knows what discount and payment terms to apply.':
    'Cette flotte n’a pas encore de contrat. Enregistrez d’abord les conditions, pour que la facture sache quelle remise et quelles conditions de paiement appliquer.',
  'No gift card paid this invoice, so there is no card to put the money back on.':
    'Aucune carte cadeau n’a réglé cette facture : il n’y a donc aucune carte sur laquelle recréditer l’argent.',
  'The card that paid this bill was cancelled.':
    'La carte qui a réglé cette facture a été annulée.',
  'That site is not in this workshop.': 'Ce site n’appartient pas à cet atelier.',
  'Could not find an unused code. Try again.':
    'Impossible de trouver un code inutilisé. Réessayez.',
  'That is not one of our card numbers.': 'Ce n’est pas l’un de nos numéros de carte.',
  'No card has that number.': 'Aucune carte ne porte ce numéro.',
  'That card is not in this workshop.': 'Cette carte n’appartient pas à cet atelier.',
  'That card was already cancelled.': 'Cette carte a déjà été annulée.',
  'That is not something that can be imported.': 'Cet élément ne peut pas être importé.',
  'The file has no rows under its header line.':
    'Le fichier ne contient aucune ligne sous sa ligne d’en-tête.',
  'That is {v1} rows; split the file at {v2}.':
    'Cela fait {v1} lignes ; découpez le fichier par tranches de {v2}.',
  'No such import.': 'Cette importation n’existe pas.',
  'That import has already run.': 'Cette importation a déjà été exécutée.',
  'Map {v1} first.': 'Associez d’abord {v1}.',
  'This inspection has been sent to the customer and cannot be changed. Start a new one.':
    'Cette inspection a été envoyée au client et ne peut plus être modifiée. Commencez-en une nouvelle.',
  'That inspection does not exist.': 'Cette inspection n’existe pas.',
  'This inspection has gone to the customer, so nothing more can be added to it.':
    'Cette inspection est partie chez le client : plus rien ne peut donc y être ajouté.',
  'A stock adjustment requires a reason': 'Un ajustement de stock exige un motif',
  'Say whose car it is.': 'Indiquez à qui appartient la voiture.',
  'Say which vehicle.': 'Indiquez quel véhicule.',
  'Say what it is in for. A job with no description is one nobody can pick up without asking.':
    'Indiquez le motif de la visite. Un travail sans description, personne ne peut le prendre en charge sans poser de questions.',
  'That vehicle is not on record.': 'Ce véhicule est introuvable.',
  'This workshop has no active site.': 'Cet atelier n’a aucun site actif.',
  'The last reading on this vehicle was {v1} km. {v2} is lower, so one of the two is wrong.':
    'Le dernier relevé de ce véhicule était de {v1} km. {v2} est inférieur : l’un des deux est donc faux.',
  'Say how many points, as a whole number.':
    'Indiquez le nombre de points, sous forme de nombre entier.',
  'Say why. The reason is what the customer sees.':
    'Indiquez pourquoi. Le motif est ce que voit le client.',
  'Say how many points to use, as a whole number.':
    'Indiquez le nombre de points à utiliser, sous forme de nombre entier.',
  'That credit note is not on this invoice.': 'Cet avoir ne se rapporte pas à cette facture.',
  'That is neither a registration nor a 17-character VIN.':
    'Ce n’est ni une immatriculation ni un VIN de 17 caractères.',
  'That registration has been on {v1} vehicles. Enter the VIN instead; it is on the windscreen and the door frame.':
    'Cette immatriculation a été portée par {v1} véhicules. Saisissez plutôt le VIN ; il figure sur le pare-brise et le montant de la portière.',
  'A VIN is exactly 17 characters, with no I, O or Q.':
    'Un VIN comporte exactement 17 caractères, sans I, O ni Q.',
  'That VIN is already on the network. Find it rather than adding it again.':
    'Ce VIN est déjà sur le réseau. Recherchez-le plutôt que de l’ajouter à nouveau.',
  'That job was not found.': 'Ce travail est introuvable.',
  'Choose the earlier job that this work came back from.':
    'Choisissez le travail précédent dont ce retour découle.',
  'A part on this package is not one of your products.':
    'Une pièce de ce forfait ne fait pas partie de vos produits.',
  'That kind of work is not this workshop’s.': 'Ce type de travail n’appartient pas à cet atelier.',
  'That package is not this workshop’s.': 'Ce forfait n’appartient pas à cet atelier.',
  'There is already a package with the code {v1}.': 'Un forfait avec le code {v1} existe déjà.',
  'That package is not one of yours, or is retired.':
    'Ce forfait ne fait pas partie des vôtres, ou il a été retiré.',
  'This job is closed; a package goes on a new job.':
    'Ce travail est clôturé ; un forfait doit aller sur un nouveau travail.',
  'appendEvents expects every draft to belong to one vehicle':
    'appendEvents attend que chaque brouillon appartienne à un seul véhicule',
  'Vehicle {v1} does not exist': 'Le véhicule {v1} n’existe pas',
  'The bill needs the supplier’s own invoice number on it.':
    'La facture fournisseur doit porter le numéro de facture du fournisseur lui-même.',
  'A bill has to be for more than nothing.':
    'Une facture fournisseur doit porter sur un montant supérieur à zéro.',
  'A bill with reference {v1} is already booked. A supplier invoice booked twice is a supplier paid twice.':
    'Une facture fournisseur avec la référence {v1} est déjà enregistrée. Une facture enregistrée deux fois, c’est un fournisseur payé deux fois.',
  'Say what is wrong with it. The supplier will be asked.':
    'Indiquez ce qui ne va pas. La question sera posée au fournisseur.',
  'This bill has been paid. Take it up with the supplier as a credit rather than a dispute.':
    'Cette facture fournisseur a été réglée. Voyez avec le fournisseur pour un avoir plutôt qu’un litige.',
  'Only {v1} is owed on approved bills. Pay that, or approve the rest first.':
    'Seuls {v1} sont dus sur les factures fournisseur approuvées. Réglez ce montant, ou approuvez d’abord le reste.',
  'Stripe is not configured: STRIPE_SECRET_KEY is missing.':
    'Stripe n’est pas configuré : STRIPE_SECRET_KEY est manquante.',
  'Stripe could not be reached: {v1}': 'Impossible de joindre Stripe : {v1}',
  'Stripe opened a session with nowhere to send the customer.':
    'Stripe a ouvert une session sans adresse vers laquelle envoyer le client.',
  'Stripe has no charge on that checkout to refund.':
    'Stripe n’a aucun débit à rembourser sur ce paiement.',
  'Stripe opened a session with nowhere to send the owner.':
    'Stripe a ouvert une session sans adresse vers laquelle envoyer le propriétaire.',
  'The provider has no successful payment to refund.':
    'Le prestataire n’a aucun paiement abouti à rembourser.',
  'The provider says that is more than was taken.':
    'Le prestataire indique que ce montant dépasse ce qui a été encaissé.',
  'That event is not readable.': 'Cet événement est illisible.',
  'That event is not one we read.': 'Nous ne traitons pas ce type d’événement.',
  'No such subscription.': 'Cet abonnement n’existe pas.',
  'No checkout was opened.': 'Aucun paiement n’a été ouvert.',
  'No subscription.': 'Aucun abonnement.',
  '{v1} already has a {v2} timesheet for this period.':
    '{v1} a déjà une feuille de temps à l’état « {v2} » pour cette période.',
  'That person or skill is not in this workshop.':
    'Cette personne ou cette compétence n’appartient pas à cet atelier.',
  'A skill needs a name.': 'Une compétence doit avoir un nom.',
  'That person is not in this workshop.': 'Cette personne n’appartient pas à cet atelier.',
  'Your name cannot be empty.': 'Votre nom ne peut pas être vide.',
  'The current password is not right.': 'Le mot de passe actuel est incorrect.',
  'Use at least {v1} characters.': 'Utilisez au moins {v1} caractères.',
  'That is not one of your workshops.': 'Ce n’est pas l’un de vos ateliers.',
  'That part is not in this workshop.': 'Cette pièce n’appartient pas à cet atelier.',
  'A fitment has to name a make.': 'Une compatibilité doit indiquer une marque.',
  'The first year is after the last one. One of the two is the wrong way round.':
    'La première année est postérieure à la dernière. Les deux sont inversées.',
  'That fitment is not in this workshop.': 'Cette compatibilité n’appartient pas à cet atelier.',
  'That is not one of our codes.': 'Ce n’est pas l’un de nos codes.',
  'Nobody has that code.': 'Personne n’a ce code.',
  'That code has already been used.': 'Ce code a déjà été utilisé.',
  'Somebody already introduced this customer. A person is brought in once.':
    'Quelqu’un a déjà parrainé ce client. Une personne ne peut être parrainée qu’une fois.',
  'Say what happened. "Resolved" with nothing against it means nothing later.':
    'Indiquez ce qui s’est passé. « Résolu » sans explication ne voudra rien dire plus tard.',
  'That is their own code. A referral pays for bringing somebody new.':
    'C’est son propre code. Un parrainage récompense le fait d’amener quelqu’un de nouveau.',
  'That order is not here.': 'Cette commande n’est pas ici.',
  'Say what is going back, and how many.': 'Indiquez ce qui est retourné, et en quelle quantité.',
  'A line on that return is not on the order.':
    'Une ligne de ce retour ne figure pas sur la commande.',
  'That return is not here.': 'Ce retour n’est pas ici.',
  'This return has already been credited.': 'Ce retour a déjà fait l’objet d’un avoir.',
  'Say why the supplier refused it.': 'Indiquez pourquoi le fournisseur l’a refusé.',
  'This return is already closed.': 'Ce retour est déjà clôturé.',
  'This job is invoiced or closed; sublet work goes on a new job.':
    'Ce travail est facturé ou clôturé ; la sous-traitance doit aller sur un nouveau travail.',
  'That vendor is not one of your suppliers.':
    'Ce prestataire ne fait pas partie de vos fournisseurs.',
  'That sublet is not here.': 'Cette sous-traitance n’est pas ici.',
  'A bill with reference {v1} is already booked. A bill booked twice is a vendor paid twice.':
    'Une facture fournisseur avec la référence {v1} est déjà enregistrée. Une facture enregistrée deux fois, c’est un prestataire payé deux fois.',
  'There is already a {v1} with that name or code.':
    'Un élément de type « {v1} » porte déjà ce nom ou ce code.',
  'That numbering sequence is not this workshop’s.':
    'Cette séquence de numérotation n’appartient pas à cet atelier.',
  'That site is not this workshop’s.': 'Ce site n’appartient pas à cet atelier.',
  'That bay is not at this site.': 'Ce poste ne se trouve pas sur ce site.',
  'That bay is not this workshop’s.': 'Ce poste n’appartient pas à cet atelier.',
  'That tax rate is not this workshop’s.': 'Ce taux de taxe n’appartient pas à cet atelier.',
  'That rate is on {v1} invoice line{v2}. Add a new rate at {v3}% and retire this one, so what was invoiced keeps reading the way it was.':
    'Ce taux figure sur des lignes de facture (nombre : {v1}). Ajoutez un nouveau taux à {v3} % et retirez celui-ci, pour que ce qui a été facturé reste tel quel.',
  'That tax rate is not one this workshop can use.':
    'Ce taux de taxe n’est pas utilisable par cet atelier.',
  'That is the default rate. Make another the default first.':
    'C’est le taux par défaut. Définissez d’abord un autre taux par défaut.',
  'This job is waiting on the customer. Starting work now risks doing something they have not agreed to pay for.':
    'Ce travail attend le client. Commencer maintenant risque de réaliser quelque chose qu’il n’a pas accepté de payer.',
  'The file store is set to s3 and has no endpoint or keys. Set S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.':
    'Le stockage de fichiers est réglé sur s3 mais n’a ni point de terminaison ni clés. Définissez S3_ENDPOINT, S3_ACCESS_KEY_ID et S3_SECRET_ACCESS_KEY.',
  'The file store has no bucket. Set S3_BUCKET.':
    'Le stockage de fichiers n’a pas de bucket. Définissez S3_BUCKET.',
  'There is already a supplier called {v1}. Two with the same name means half your orders go against one and half against the other.':
    'Un fournisseur nommé {v1} existe déjà. Deux fournisseurs du même nom, c’est la moitié de vos commandes sur l’un et l’autre moitié sur l’autre.',
  'Transfer {v1} has already been sent.': 'Le transfert {v1} a déjà été envoyé.',
  'That claim has already been closed.': 'Cette réclamation a déjà été clôturée.',
  'Say what happened. "Settled" with nothing against it means nothing to whoever reads it next.':
    'Indiquez ce qui s’est passé. « Réglé » sans explication ne voudra rien dire pour la prochaine personne qui le lira.',
  'The request could not be completed.': 'La requête n’a pas pu aboutir.',
  'No vehicle with that VIN has been worked on by a workshop using Carnet yet. Book it in at any workshop on Carnet and it joins with the job.':
    'Aucun véhicule portant ce VIN n’a encore été pris en charge par un atelier utilisant Carnet. Prenez rendez-vous dans n’importe quel atelier sur Carnet, et il rejoindra le réseau avec le travail.',
  'No vehicle on that registration has been worked on by a workshop using Carnet yet. Book it in at any workshop on Carnet and it joins with the job.':
    'Aucun véhicule portant cette immatriculation n’a encore été pris en charge par un atelier utilisant Carnet. Prenez rendez-vous dans n’importe quel atelier sur Carnet, et il rejoindra le réseau avec le travail.',
  'account {v1} is not in your chart of accounts':
    'le compte {v1} ne figure pas dans votre plan comptable',
  'could not be written': 'n’a pas pu être enregistré',
  'There is already an account on that address. Sign in instead.':
    'Un compte existe déjà pour cette adresse. Connectez-vous plutôt.',
  '{v1} is not a PDF or a picture of the paper.':
    '{v1} n’est ni un PDF ni une photo du document papier.',
  '{v1} is not a photograph. Use a picture from the camera.':
    '{v1} n’est pas une photographie. Utilisez une photo prise avec l’appareil.',
  // Phase 41: tax, configurable.
  'That customer is not this workshop’s.': 'Ce client n’appartient pas à cet atelier.',
  'That rate is on {v1} invoice lines. Add a new rate with these taxes and retire this one, so what was invoiced keeps reading the way it was.':
    'Ce taux figure sur {v1} lignes de facture. Ajoutez un nouveau taux avec ces taxes et retirez celui-ci, afin que ce qui a été facturé se lise toujours de la même façon.',
};

export const ar: Readonly<Record<string, string>> = {
  'Period "{v1}" is closed. Post the correction into the open period instead.':
    'الفترة «{v1}» مقفلة. سجّل التصحيح في الفترة المفتوحة بدلًا من ذلك.',
  'No account for code {v1}. Run the chart of accounts setup.':
    'لا يوجد حساب للرمز {v1}. شغّل إعداد دليل الحسابات.',
  'Send the key as "Authorization: Bearer cn_…".':
    'أرسل المفتاح بالصيغة "Authorization: Bearer cn_…".',
  'This key has made its {v1} calls this hour. Try again after {v2}.':
    'استنفد هذا المفتاح طلباته البالغة {v1} في هذه الساعة. حاول مرة أخرى بعد {v2}.',
  'That job is not here.': 'هذا العمل غير موجود هنا.',
  'No such check on this job.': 'لا يوجد هذا الفحص في هذا العمل.',
  'Ask something.': 'اطرح سؤالًا.',
  'That is not a kind of message the assistant drafts.':
    'هذا ليس نوعًا من الرسائل التي يصوغها المساعد.',
  'That job is not in this workshop.': 'هذا العمل لا يتبع هذه الورشة.',
  'That draft is not on record.': 'هذه المسودة غير موجودة في السجل.',
  'That draft has already been sent.': 'أُرسلت هذه المسودة بالفعل.',
  'There is nothing to send.': 'لا يوجد ما يُرسل.',
  'The customer has no mobile number or email address on file, so there is nowhere to send it.':
    'لا يوجد للعميل رقم جوال ولا بريد إلكتروني مسجّل، لذا لا توجد جهة يُرسل إليها.',
  'The budget is a whole number of tokens, from 0 to 100,000,000.':
    'الميزانية عدد صحيح من الرموز، من 0 إلى 100,000,000.',
  'Password must be at least 10 characters': 'يجب ألا تقل كلمة المرور عن 10 أحرف',
  'This campaign is {v1}, and a campaign cannot be sent twice.':
    'حالة هذه الحملة «{v1}»، ولا يمكن إرسال الحملة مرتين.',
  'Nobody in this segment can be written to on this channel right now.':
    'لا يمكن مراسلة أي أحد في هذه الشريحة عبر هذه القناة حاليًا.',
  'That is not one of the plans.': 'هذه ليست إحدى الباقات.',
  'That day filled up while you were choosing. Please pick another.':
    'امتلأ هذا اليوم أثناء اختيارك. يرجى اختيار يوم آخر.',
  'Somebody took that slot a moment ago. Please pick another.':
    'حجز شخص آخر هذا الموعد قبل لحظات. يرجى اختيار موعد آخر.',
  'This booking is already a job. Change the job instead.':
    'تحوّل هذا الحجز إلى عمل بالفعل. عدّل العمل بدلًا من ذلك.',
  'That booking no longer exists.': 'هذا الحجز لم يعد موجودًا.',
  'This booking was closed. Book the car in again, or open a job from the vehicle.':
    'أُغلق هذا الحجز. احجز موعدًا جديدًا للسيارة، أو افتح عملًا من صفحة المركبة.',
  'That invoice is not yours to pay.': 'هذه الفاتورة ليست مستحقة عليك.',
  '{v1} is already in the catalogue as "{v2}". Open that one rather than adding it twice: two rows for one part means two stock figures, both wrong.':
    '{v1} موجودة بالفعل في الكتالوج باسم «{v2}». افتحها بدلًا من إضافتها مرتين: سطران لقطعة واحدة يعنيان رقمين للمخزون، وكلاهما خاطئ.',
  'That supplier is not one of yours.': 'هذا المورد ليس من مورديك.',
  'Tell us your name.': 'أخبرنا باسمك.',
  'That does not look like an email address.': 'لا يبدو هذا عنوان بريد إلكتروني.',
  'There is already an account on that address. Sign in, or use the forgotten password link.':
    'يوجد حساب بهذا العنوان بالفعل. سجّل الدخول، أو استخدم رابط نسيان كلمة المرور.',
  'That is neither a registration nor a VIN. A VIN is exactly 17 characters.':
    'هذا ليس رقم لوحة ولا رقم هيكل (VIN). يتكوّن رقم الهيكل من 17 حرفًا بالضبط.',
  'There is no customer record against that vehicle here any more, so there is nothing to attach them to.':
    'لم يعد هناك سجل عميل مرتبط بهذه المركبة هنا، لذا لا يوجد ما يُربط به.',
  'Somebody else already holds the portal account for that customer. Settle which of them it should be before approving this.':
    'يمتلك شخص آخر حساب البوابة لهذا العميل بالفعل. حدّد أيهما يجب أن يمتلكه قبل الموافقة على هذا الطلب.',
  'Somebody else answered that request a moment ago. Reload to see what they said.':
    'ردّ شخص آخر على هذا الطلب قبل لحظات. أعد تحميل الصفحة لترى رده.',
  'That conversation is not here.': 'هذه المحادثة غير موجودة هنا.',
  'This thread has no customer to write to.': 'لا يوجد في هذه المحادثة عميل يمكن مراسلته.',
  'Write something first.': 'اكتب شيئًا أولًا.',
  '{v1} cannot be reached by {v2}: there is no {v3} on file.':
    'لا يمكن التواصل مع {v1} عبر {v2}: لا يوجد {v3} مسجّل.',
  '{v1} is {v2}MB; the limit is {v3}MB.': 'حجم {v1} هو {v2} ميغابايت؛ والحد الأقصى {v3} ميغابايت.',
  'The store refused {v1} ({v2}).': 'رفض مخزن الملفات {v1} ({v2}).',
  'That person is not on this team.': 'هذا الشخص ليس ضمن هذا الفريق.',
  'A template needs a name and a message.': 'يحتاج القالب إلى اسم ورسالة.',
  'That customer is not in this workshop.': 'هذا العميل لا يتبع هذه الورشة.',
  'That person is not a technician here.': 'هذا الشخص ليس فنيًا هنا.',
  'Say why it is safe to send there again. The database will refuse it blank.':
    'اذكر لماذا أصبح الإرسال إلى هذا العنوان آمنًا مجددًا. سترفض قاعدة البيانات السبب الفارغ.',
  'That job is not this customer’s.': 'هذا العمل لا يخص هذا العميل.',
  'That invoice is not in this workshop.': 'هذه الفاتورة لا تتبع هذه الورشة.',
  'That deposit is not this customer’s, or nothing is left on it.':
    'هذه الدفعة المقدمة لا تخص هذا العميل، أو لم يتبقَّ منها شيء.',
  'That deposit is not in this workshop.': 'هذه الدفعة المقدمة لا تتبع هذه الورشة.',
  'That booking is closed, so there is nowhere to move it to.':
    'هذا الحجز مغلق، لذا لا يمكن نقله إلى أي موعد.',
  'That document is not on record.': 'هذا المستند غير موجود في السجل.',
  'Say what the extra work is.': 'اذكر ما هو العمل الإضافي.',
  'Say how many, or how many hours.': 'اذكر الكمية، أو عدد الساعات.',
  'This job is closed, so extra work goes on a new job for the same car.':
    'هذا العمل مغلق، لذا يُسجَّل العمل الإضافي في عمل جديد للسيارة نفسها.',
  'No part {v1} on your books. Leave the part number blank to quote it as a line, or add the part first.':
    'لا توجد قطعة {v1} في سجلاتك. اترك رقم القطعة فارغًا لتسعيرها كسطر عادي، أو أضف القطعة أولًا.',
  'There is nothing on this quote yet. Add the work first.':
    'لا يوجد شيء في عرض السعر هذا بعد. أضف الأعمال أولًا.',
  'The total is zero. Price the lines before recording an approval.':
    'الإجمالي صفر. سعّر السطور قبل تسجيل الموافقة.',
  'This quote is {v1}; it cannot be approved again.':
    'حالة عرض السعر هذا «{v1}»؛ ولا يمكن الموافقة عليه مرة أخرى.',
  'This fleet has no agreement yet. Save the terms first, so the invoice knows what discount and payment terms to apply.':
    'لا توجد اتفاقية لهذا الأسطول بعد. احفظ الشروط أولًا، حتى تعرف الفاتورة الخصم وشروط الدفع الواجب تطبيقها.',
  'No gift card paid this invoice, so there is no card to put the money back on.':
    'لم تُدفع هذه الفاتورة ببطاقة هدية، لذا لا توجد بطاقة لإعادة المبلغ إليها.',
  'The card that paid this bill was cancelled.': 'أُلغيت البطاقة التي دُفعت بها هذه الفاتورة.',
  'That site is not in this workshop.': 'هذا الفرع لا يتبع هذه الورشة.',
  'Could not find an unused code. Try again.': 'تعذّر العثور على رمز غير مستخدم. حاول مرة أخرى.',
  'That is not one of our card numbers.': 'هذا ليس أحد أرقام بطاقاتنا.',
  'No card has that number.': 'لا توجد بطاقة بهذا الرقم.',
  'That card is not in this workshop.': 'هذه البطاقة لا تتبع هذه الورشة.',
  'That card was already cancelled.': 'أُلغيت هذه البطاقة بالفعل.',
  'That is not something that can be imported.': 'هذا ليس شيئًا يمكن استيراده.',
  'The file has no rows under its header line.': 'لا يحتوي الملف على أي صفوف تحت سطر العناوين.',
  'That is {v1} rows; split the file at {v2}.': 'هذه {v1} صفًا؛ قسّم الملف إلى أجزاء من {v2}.',
  'No such import.': 'لا توجد عملية استيراد كهذه.',
  'That import has already run.': 'نُفّذت عملية الاستيراد هذه بالفعل.',
  'Map {v1} first.': 'طابق {v1} أولًا.',
  'This inspection has been sent to the customer and cannot be changed. Start a new one.':
    'أُرسل هذا الفحص إلى العميل ولا يمكن تغييره. ابدأ فحصًا جديدًا.',
  'That inspection does not exist.': 'هذا الفحص غير موجود.',
  'This inspection has gone to the customer, so nothing more can be added to it.':
    'وصل هذا الفحص إلى العميل، لذا لا يمكن إضافة أي شيء إليه.',
  'A stock adjustment requires a reason': 'تعديل المخزون يتطلب سببًا',
  'Say whose car it is.': 'اذكر صاحب السيارة.',
  'Say which vehicle.': 'اذكر المركبة.',
  'Say what it is in for. A job with no description is one nobody can pick up without asking.':
    'اذكر سبب دخولها. العمل الذي بلا وصف لا يستطيع أحد تولّيه دون أن يسأل.',
  'That vehicle is not on record.': 'هذه المركبة غير موجودة في السجل.',
  'This workshop has no active site.': 'لا يوجد لهذه الورشة فرع نشط.',
  'The last reading on this vehicle was {v1} km. {v2} is lower, so one of the two is wrong.':
    'كانت آخر قراءة لهذه المركبة {v1} كم. القراءة {v2} أقل منها، لذا إحداهما خاطئة.',
  'Say how many points, as a whole number.': 'اذكر عدد النقاط، كعدد صحيح.',
  'Say why. The reason is what the customer sees.': 'اذكر السبب. السبب هو ما يراه العميل.',
  'Say how many points to use, as a whole number.': 'اذكر عدد النقاط المراد استخدامها، كعدد صحيح.',
  'That credit note is not on this invoice.': 'إشعار الدائن هذا لا يخص هذه الفاتورة.',
  'That is neither a registration nor a 17-character VIN.':
    'هذا ليس رقم لوحة ولا رقم هيكل (VIN) من 17 حرفًا.',
  'That registration has been on {v1} vehicles. Enter the VIN instead; it is on the windscreen and the door frame.':
    'استُخدم رقم اللوحة هذا على {v1} مركبات. أدخل رقم الهيكل (VIN) بدلًا منه؛ ستجده على الزجاج الأمامي وإطار الباب.',
  'A VIN is exactly 17 characters, with no I, O or Q.':
    'يتكوّن رقم الهيكل (VIN) من 17 حرفًا بالضبط، دون الأحرف I أو O أو Q.',
  'That VIN is already on the network. Find it rather than adding it again.':
    'رقم الهيكل هذا موجود على الشبكة بالفعل. ابحث عنه بدلًا من إضافته مرة أخرى.',
  'That job was not found.': 'لم يُعثر على هذا العمل.',
  'Choose the earlier job that this work came back from.':
    'اختر العمل السابق الذي عادت منه هذه المشكلة.',
  'A part on this package is not one of your products.':
    'إحدى القطع في هذه الباقة ليست من منتجاتك.',
  'That kind of work is not this workshop’s.': 'هذا النوع من العمل لا يخص هذه الورشة.',
  'That package is not this workshop’s.': 'هذه الباقة لا تخص هذه الورشة.',
  'There is already a package with the code {v1}.': 'توجد باقة بالرمز {v1} بالفعل.',
  'That package is not one of yours, or is retired.': 'هذه الباقة ليست من باقاتك، أو أنها موقوفة.',
  'This job is closed; a package goes on a new job.': 'هذا العمل مغلق؛ تُضاف الباقة إلى عمل جديد.',
  'appendEvents expects every draft to belong to one vehicle':
    'تتوقع appendEvents أن تنتمي كل المسودات إلى مركبة واحدة',
  'Vehicle {v1} does not exist': 'المركبة {v1} غير موجودة',
  'The bill needs the supplier’s own invoice number on it.':
    'يجب أن تحمل فاتورة المورد رقم الفاتورة الخاص بالمورد نفسه.',
  'A bill has to be for more than nothing.': 'يجب أن تكون قيمة فاتورة المورد أكبر من صفر.',
  'A bill with reference {v1} is already booked. A supplier invoice booked twice is a supplier paid twice.':
    'فاتورة المورد ذات المرجع {v1} مسجّلة بالفعل. فاتورة المورد المسجّلة مرتين تعني موردًا يُدفع له مرتين.',
  'Say what is wrong with it. The supplier will be asked.':
    'اذكر ما الخطأ فيها. سيُسأل المورد عن ذلك.',
  'This bill has been paid. Take it up with the supplier as a credit rather than a dispute.':
    'دُفعت فاتورة المورد هذه. راجع المورد لطلب إشعار دائن بدلًا من فتح نزاع.',
  'Only {v1} is owed on approved bills. Pay that, or approve the rest first.':
    'المستحق على فواتير الموردين المعتمدة {v1} فقط. ادفع هذا المبلغ، أو اعتمد الباقي أولًا.',
  'Stripe is not configured: STRIPE_SECRET_KEY is missing.':
    'لم يُهيّأ Stripe: المتغير STRIPE_SECRET_KEY مفقود.',
  'Stripe could not be reached: {v1}': 'تعذّر الاتصال بـ Stripe: {v1}',
  'Stripe opened a session with nowhere to send the customer.':
    'فتح Stripe جلسة دون عنوان لتوجيه العميل إليه.',
  'Stripe has no charge on that checkout to refund.':
    'لا توجد لدى Stripe عملية خصم في عملية الدفع هذه لاستردادها.',
  'Stripe opened a session with nowhere to send the owner.':
    'فتح Stripe جلسة دون عنوان لتوجيه المالك إليه.',
  'The provider has no successful payment to refund.':
    'لا توجد لدى مزوّد الدفع عملية دفع ناجحة لاستردادها.',
  'The provider says that is more than was taken.':
    'يفيد مزوّد الدفع بأن هذا المبلغ أكبر مما تم تحصيله.',
  'That event is not readable.': 'تعذّرت قراءة هذا الحدث.',
  'That event is not one we read.': 'هذا ليس من الأحداث التي نعالجها.',
  'No such subscription.': 'لا يوجد اشتراك كهذا.',
  'No checkout was opened.': 'لم تُفتح أي عملية دفع.',
  'No subscription.': 'لا يوجد اشتراك.',
  '{v1} already has a {v2} timesheet for this period.':
    'لدى {v1} بالفعل سجل دوام بحالة «{v2}» لهذه الفترة.',
  'That person or skill is not in this workshop.': 'هذا الشخص أو هذه المهارة لا يتبعان هذه الورشة.',
  'A skill needs a name.': 'تحتاج المهارة إلى اسم.',
  'That person is not in this workshop.': 'هذا الشخص لا يتبع هذه الورشة.',
  'Your name cannot be empty.': 'لا يمكن أن يكون اسمك فارغًا.',
  'The current password is not right.': 'كلمة المرور الحالية غير صحيحة.',
  'Use at least {v1} characters.': 'استخدم {v1} أحرف على الأقل.',
  'That is not one of your workshops.': 'هذه ليست إحدى ورشك.',
  'That part is not in this workshop.': 'هذه القطعة لا تتبع هذه الورشة.',
  'A fitment has to name a make.': 'يجب أن يحدد التوافق الشركة المصنّعة.',
  'The first year is after the last one. One of the two is the wrong way round.':
    'السنة الأولى بعد السنة الأخيرة. السنتان مقلوبتان.',
  'That fitment is not in this workshop.': 'هذا التوافق لا يتبع هذه الورشة.',
  'That is not one of our codes.': 'هذا ليس أحد رموزنا.',
  'Nobody has that code.': 'لا أحد يملك هذا الرمز.',
  'That code has already been used.': 'استُخدم هذا الرمز بالفعل.',
  'Somebody already introduced this customer. A person is brought in once.':
    'سبق أن أحال شخص آخر هذا العميل. يُحال الشخص مرة واحدة فقط.',
  'Say what happened. "Resolved" with nothing against it means nothing later.':
    'اذكر ما حدث. كلمة «تم الحل» دون تفاصيل لن تعني شيئًا لاحقًا.',
  'That is their own code. A referral pays for bringing somebody new.':
    'هذا رمزه الخاص. مكافأة الإحالة تُمنح مقابل جلب شخص جديد.',
  'That order is not here.': 'هذا الطلب غير موجود هنا.',
  'Say what is going back, and how many.': 'اذكر ما سيُرجَع، وكميته.',
  'A line on that return is not on the order.': 'أحد سطور هذا المرتجع غير موجود في الطلب.',
  'That return is not here.': 'هذا المرتجع غير موجود هنا.',
  'This return has already been credited.': 'صدر إشعار دائن لهذا المرتجع بالفعل.',
  'Say why the supplier refused it.': 'اذكر سبب رفض المورد له.',
  'This return is already closed.': 'هذا المرتجع مغلق بالفعل.',
  'This job is invoiced or closed; sublet work goes on a new job.':
    'هذا العمل مفوتر أو مغلق؛ تُسجَّل الأعمال المسندة لجهات خارجية في عمل جديد.',
  'That vendor is not one of your suppliers.': 'هذه الجهة ليست من مورديك.',
  'That sublet is not here.': 'هذا العمل المسند لجهة خارجية غير موجود هنا.',
  'A bill with reference {v1} is already booked. A bill booked twice is a vendor paid twice.':
    'فاتورة المورد ذات المرجع {v1} مسجّلة بالفعل. الفاتورة المسجّلة مرتين تعني جهة يُدفع لها مرتين.',
  'There is already a {v1} with that name or code.':
    'يوجد بالفعل عنصر من نوع «{v1}» بهذا الاسم أو الرمز.',
  'That numbering sequence is not this workshop’s.': 'تسلسل الترقيم هذا لا يخص هذه الورشة.',
  'That site is not this workshop’s.': 'هذا الفرع لا يخص هذه الورشة.',
  'That bay is not at this site.': 'هذه المنصة ليست في هذا الفرع.',
  'That bay is not this workshop’s.': 'هذه المنصة لا تخص هذه الورشة.',
  'That tax rate is not this workshop’s.': 'نسبة الضريبة هذه لا تخص هذه الورشة.',
  'That rate is on {v1} invoice line{v2}. Add a new rate at {v3}% and retire this one, so what was invoiced keeps reading the way it was.':
    'هذه النسبة مستخدمة في سطور فواتير (العدد: {v1}). أضف نسبة جديدة بقيمة {v3}% وأوقف هذه، حتى تبقى الفواتير السابقة كما صدرت.',
  'That tax rate is not one this workshop can use.':
    'لا يمكن لهذه الورشة استخدام نسبة الضريبة هذه.',
  'That is the default rate. Make another the default first.':
    'هذه هي النسبة الافتراضية. اجعل نسبة أخرى افتراضية أولًا.',
  'This job is waiting on the customer. Starting work now risks doing something they have not agreed to pay for.':
    'هذا العمل بانتظار العميل. البدء الآن قد يعني تنفيذ شيء لم يوافق على دفع ثمنه.',
  'The file store is set to s3 and has no endpoint or keys. Set S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.':
    'مخزن الملفات مضبوط على s3 دون نقطة اتصال أو مفاتيح. اضبط S3_ENDPOINT وS3_ACCESS_KEY_ID وS3_SECRET_ACCESS_KEY.',
  'The file store has no bucket. Set S3_BUCKET.': 'لا توجد حاوية لمخزن الملفات. اضبط S3_BUCKET.',
  'There is already a supplier called {v1}. Two with the same name means half your orders go against one and half against the other.':
    'يوجد مورد باسم {v1} بالفعل. موردان بالاسم نفسه يعنيان أن نصف طلباتك يُسجَّل على أحدهما والنصف الآخر على الآخر.',
  'Transfer {v1} has already been sent.': 'أُرسل التحويل {v1} بالفعل.',
  'That claim has already been closed.': 'أُغلقت هذه المطالبة بالفعل.',
  'Say what happened. "Settled" with nothing against it means nothing to whoever reads it next.':
    'اذكر ما حدث. كلمة «تمت التسوية» دون تفاصيل لن تعني شيئًا لمن يقرؤها لاحقًا.',
  'The request could not be completed.': 'تعذّر إتمام الطلب.',
  'No vehicle with that VIN has been worked on by a workshop using Carnet yet. Book it in at any workshop on Carnet and it joins with the job.':
    'لم تعمل أي ورشة تستخدم Carnet على مركبة بهذا الرقم (VIN) بعد. احجز لها موعدًا في أي ورشة على Carnet وستنضم مع العمل.',
  'No vehicle on that registration has been worked on by a workshop using Carnet yet. Book it in at any workshop on Carnet and it joins with the job.':
    'لم تعمل أي ورشة تستخدم Carnet على مركبة برقم اللوحة هذا بعد. احجز لها موعدًا في أي ورشة على Carnet وستنضم مع العمل.',
  'account {v1} is not in your chart of accounts': 'الحساب {v1} غير موجود في دليل حساباتك',
  'could not be written': 'تعذّر حفظه',
  'There is already an account on that address. Sign in instead.':
    'يوجد حساب بهذا العنوان بالفعل. سجّل الدخول بدلًا من ذلك.',
  '{v1} is not a PDF or a picture of the paper.': '{v1} ليس ملف PDF ولا صورة للمستند الورقي.',
  '{v1} is not a photograph. Use a picture from the camera.':
    '{v1} ليس صورة فوتوغرافية. استخدم صورة من الكاميرا.',
  // Phase 41: tax, configurable.
  'That customer is not this workshop’s.': 'هذا العميل لا يتبع هذه الورشة.',
  'That rate is on {v1} invoice lines. Add a new rate with these taxes and retire this one, so what was invoiced keeps reading the way it was.':
    'هذا المعدل موجود في {v1} من أسطر الفواتير. أضف معدلاً جديداً بهذه الضرائب وأوقف هذا، ليبقى ما صدر مقروءاً كما كان.',
};
