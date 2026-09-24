/**
 * Sentences thrown by core when a rule refuses something, keyed with {v1},
 * {v2} slots where the sentence carries a value. Phase 40.5.
 */

export const fr: Readonly<Record<string, string>> = {
  'Say why. The reason stays on the card.':
    'Indiquez pourquoi. La raison reste inscrite sur la carte.',
  'Nothing is owed on that invoice.': 'Rien n’est dû sur cette facture.',
  'The vendor’s bill for this work is already booked.':
    'La facture du prestataire pour ce travail est déjà enregistrée.',
  'That file is {v1}MB. The limit is {v2}MB.': 'Ce fichier fait {v1} Mo. La limite est de {v2} Mo.',
  'Name the key after what will use it, so the person revoking it later knows what breaks.':
    'Nommez la clé d’après ce qui l’utilisera, pour que la personne qui la révoquera plus tard sache ce qui cessera de fonctionner.',
  'That key is not one we issued.': 'Cette clé n’a pas été émise par nous.',
  'That key was revoked.': 'Cette clé a été révoquée.',
  'That link is not one of ours, or it has been replaced by a newer one.':
    'Ce lien ne vient pas de nous, ou il a été remplacé par un lien plus récent.',
  'That link has already been used. Ask for a new one.':
    'Ce lien a déjà été utilisé. Demandez-en un nouveau.',
  'That has been asked for several times in the last hour. Check the messages already sent before asking again.':
    'Cette demande a été faite plusieurs fois au cours de la dernière heure. Consultez les messages déjà envoyés avant de redemander.',
  'A payment has to be for more than nothing.':
    'Un paiement doit porter sur un montant supérieur à zéro.',
  'Nothing is owed to this supplier that can be paid.':
    'Aucune somme payable n’est due à ce fournisseur.',
  'One of these bills belongs to a different supplier. A payment settles one supplier at a time.':
    'L’une de ces factures appartient à un autre fournisseur. Un paiement règle un seul fournisseur à la fois.',
  '{v1} is disputed. Settle the dispute, or take it out of the dispute, before paying it.':
    '{v1} fait l’objet d’un litige. Réglez le litige, ou levez-le, avant de payer.',
  'The allocation to {v1} has to be more than nothing.':
    'Le montant affecté à {v1} doit être supérieur à zéro.',
  '{v1} only has {v2} outstanding.': 'Il ne reste que {v2} à payer sur {v1}.',
  'Journal entry "{v1}" has no lines': 'L’écriture comptable « {v1} » n’a aucune ligne',
  'Account {v1} carries a debit and a credit on one line':
    'Le compte {v1} porte un débit et un crédit sur la même ligne',
  'Account {v1} has a negative amount. Reverse the side instead.':
    'Le compte {v1} a un montant négatif. Inversez plutôt le sens.',
  'Journal entry "{v1}" does not balance: debits {v2} against credits {v3}':
    'L’écriture comptable « {v1} » n’est pas équilibrée : débits {v2} contre crédits {v3}',
  'This rule does nothing. Add at least one action.':
    'Cette règle ne fait rien. Ajoutez au moins une action.',
  'More than {v1} actions in one rule and nobody can predict what it does. Split it.':
    'Au-delà de {v1} actions dans une règle, personne ne peut prévoir ce qu’elle fait. Divisez-la.',
  'A rule needs a cooldown. Without one it can act on the same person repeatedly, and by the time anybody notices the messages have gone.':
    'Une règle a besoin d’un délai de carence. Sans lui, elle peut agir sur la même personne à répétition, et le temps que quelqu’un s’en aperçoive, les messages sont partis.',
  '{v1} is not known when {v2}. This rule would never fire.':
    '{v1} n’est pas connu lorsque {v2}. Cette règle ne se déclencherait jamais.',
  '{v1} cannot be both {v2} {v3} and {v4} {v5}. This rule would never fire.':
    '{v1} ne peut pas vérifier à la fois « {v2} {v3} » et « {v4} {v5} ». Cette règle ne se déclencherait jamais.',
  'An expense needs an amount.': 'Une dépense doit avoir un montant.',
  'The tax is more than the amount. Check which box on the receipt is which.':
    'La taxe dépasse le montant. Vérifiez à quoi correspond chaque case du reçu.',
  'An expense cannot be dated in the future.': 'Une dépense ne peut pas être datée dans le futur.',
  'Anything over {v1} needs a receipt attached.': 'Au-delà de {v1}, un reçu doit être joint.',
  'You cannot approve your own claim.': 'Vous ne pouvez pas approuver votre propre note de frais.',
  'A deposit has to be for more than nothing.':
    'Un acompte doit porter sur un montant supérieur à zéro.',
  'A deposit is money the customer hands over. Not points, not a gift card, not money already held.':
    'Un acompte est de l’argent remis par le client. Pas des points, pas une carte cadeau, pas de l’argent déjà détenu.',
  'Nothing is held for this customer.': 'Aucune somme n’est détenue pour ce client.',
  'Say how much of the money held to use.': 'Indiquez quelle part de la somme détenue utiliser.',
  'Only {v1} is held for this customer.': 'La somme détenue pour ce client n’est que de {v1}.',
  'That is more than the bill. Money held stays held; use only what is owed.':
    'C’est plus que la facture. L’argent détenu reste détenu ; n’utilisez que ce qui est dû.',
  'Nothing is held to return.': 'Aucune somme détenue à rendre.',
  'Say how much to return.': 'Indiquez le montant à rendre.',
  'Only {v1} is held. Return that or less.':
    'La somme détenue n’est que de {v1}. Rendez ce montant ou moins.',
  'Money goes back the way money goes: cash, card or transfer.':
    'L’argent est rendu par les moyens habituels : espèces, carte ou virement.',
  'Say why it is going back. The reason stays on the record.':
    'Indiquez pourquoi il est rendu. La raison reste dans le dossier.',
  'Sell a card for whole pounds.': 'Vendez une carte pour un nombre entier de livres.',
  'The smallest card is {v1} pounds.': 'La plus petite carte est de {v1} livres.',
  'The largest card is {v1} pounds. Sell two.':
    'La plus grande carte est de {v1} livres. Vendez-en deux.',
  'A card is paid for with money. Not with points, and not with another card.':
    'Une carte se paie avec de l’argent. Pas avec des points, ni avec une autre carte.',
  'A card lasts a year, two years, or for good.':
    'Une carte est valable un an, deux ans, ou sans limite.',
  'That card was cancelled.': 'Cette carte a été annulée.',
  'That card lapsed on {v1}.': 'Cette carte a expiré le {v1}.',
  'That card is good at another site.': 'Cette carte est valable sur un autre site.',
  'There is nothing left on that card.': 'Il ne reste rien sur cette carte.',
  'Say how much of the card to use.': 'Indiquez le montant de la carte à utiliser.',
  'Only {v1} is left on that card.': 'Il ne reste que {v1} sur cette carte.',
  'That is more than the bill. A card does not pay out as money, so use only what is owed.':
    'C’est plus que la facture. Une carte ne se rembourse pas en argent, n’utilisez donc que ce qui est dû.',
  'Say how much to add or take off, in pounds and pence.':
    'Indiquez le montant à ajouter ou à retirer, en livres et pence.',
  'That would take the card below nothing. Only {v1} is on it.':
    'Le solde de la carte passerait sous zéro. Il n’y a que {v1} dessus.',
  'Marking something amber or red needs a measurement, a note or a recommendation. The customer sees the colour and has to be told why.':
    'Classer un point en orange ou en rouge exige une mesure, une note ou une recommandation. Le client voit la couleur et doit savoir pourquoi.',
  'This inspection has already been completed. Start a new one to record another look at the vehicle.':
    'Cette inspection est déjà terminée. Commencez-en une nouvelle pour consigner un autre examen du véhicule.',
  'Nothing has been checked yet, so there is nothing to send.':
    'Rien n’a encore été vérifié, il n’y a donc rien à envoyer.',
  'A part number. It is how the part is found when the box is in your hand.':
    'Une référence de pièce. C’est ainsi qu’on retrouve la pièce quand on a la boîte en main.',
  'A name that a customer would understand on an invoice.':
    'Un nom qu’un client comprendrait sur une facture.',
  'The {v1} has to be a number, and not below zero.':
    '« {v1} » doit être un nombre supérieur ou égal à zéro.',
  'Choose who the order is going to.': 'Choisissez le destinataire de la commande.',
  'An order with nothing on it. Add at least one line.':
    'Une commande vide. Ajoutez au moins une ligne.',
  '"{v1}" needs a quantity above zero.': '« {v1} » doit avoir une quantité supérieure à zéro.',
  '"{v1}" has a unit cost that is not a number, or is below zero.':
    '« {v1} » a un coût unitaire qui n’est pas un nombre, ou qui est inférieur à zéro.',
  'A purchase order cannot move from {v1} to {v2}. Permitted: {v3}.':
    'Un bon de commande ne peut pas passer de {v1} à {v2}. Autorisé : {v3}.',
  'Say how many of "{v1}" are going back.': 'Indiquez combien de « {v1} » sont retournés.',
  'There {v1} {v2} of "{v3}" on the shelf; a part that has been fitted cannot go back as stock.':
    'Quantité de « {v3} » en rayon : {v2} ; une pièce déjà montée ne peut pas être retournée comme stock.',
  'The credit needs the supplier’s own credit note number.':
    'L’avoir doit porter le numéro d’avoir du fournisseur.',
  'A credit note is for more than nothing, with tax of zero or more. If they credit nothing, record it as refused.':
    'Un avoir porte sur un montant supérieur à zéro, avec une taxe de zéro ou plus. S’ils ne créditent rien, enregistrez-le comme refusé.',
  'Say who is doing the work.': 'Indiquez qui effectue le travail.',
  'Say what the work is, as the customer will read it.':
    'Décrivez le travail tel que le client le lira.',
  'The cost and the charge are amounts of zero or more.':
    'Le coût et le prix facturé sont des montants de zéro ou plus.',
  'The bill needs the vendor’s own invoice number.':
    'La facture doit porter le numéro de facture du prestataire.',
  'A bill is for more than nothing, with tax of zero or more.':
    'Une facture porte sur un montant supérieur à zéro, avec une taxe de zéro ou plus.',
  'A receipt quantity must be greater than zero': 'Une quantité reçue doit être supérieure à zéro',
  'An issue quantity must be greater than zero': 'Une quantité sortie doit être supérieure à zéro',
  'A counted quantity cannot be negative': 'Une quantité comptée ne peut pas être négative',
  'A reservation must be greater than zero': 'Une réservation doit être supérieure à zéro',
  'A release must be greater than zero': 'Une libération doit être supérieure à zéro',
  'Cannot release {v1} when only {v2} is reserved':
    'Impossible de libérer {v1} alors que seulement {v2} est réservé',
  'This car has already been checked in. The record is on the job; add a note if something was missed.':
    'Cette voiture a déjà été réceptionnée. Le relevé figure sur le travail ; ajoutez une note si quelque chose a été oublié.',
  'This job is finished, so there is no car to check in. Open a new job for the same car.':
    'Ce travail est terminé, il n’y a donc aucune voiture à réceptionner. Ouvrez un nouveau travail pour la même voiture.',
  'This car has already been handed back.': 'Cette voiture a déjà été restituée.',
  'The work is not marked completed yet. Complete the job first, so the customer is handed back a finished car.':
    'Le travail n’est pas encore marqué comme terminé. Terminez d’abord le travail, pour que le client récupère une voiture prête.',
  'There is money outstanding on this job. Take the payment first, or say why the car is leaving unpaid.':
    'Un montant reste dû sur ce travail. Encaissez d’abord le paiement, ou indiquez pourquoi la voiture part sans être payée.',
  'The mileage has to be a whole number of kilometres.':
    'Le kilométrage doit être un nombre entier de kilomètres.',
  'The last reading was {v1} km. {v2} is lower, so one of the two is wrong.':
    'Le dernier relevé était de {v1} km. {v2} est inférieur, donc l’un des deux est faux.',
  'Fuel is noted in eighths, from empty to full.':
    'Le carburant se note en huitièmes, de vide à plein.',
  'Sign on the pad. A dot or an empty pad is not a signature.':
    'Signez sur le pavé. Un point ou un pavé vide n’est pas une signature.',
  'Say who signed.': 'Indiquez qui a signé.',
  'Say which hook the keys are on.': 'Indiquez à quel crochet sont les clés.',
  'The keys went back to the customer; there is nothing to take.':
    'Les clés ont été rendues au client ; il n’y a rien à prendre.',
  'This job has an invoice already. If something on it is wrong, raise a credit note against that invoice rather than issuing a second one.':
    'Ce travail a déjà une facture. Si quelque chose y est faux, émettez un avoir sur cette facture plutôt qu’une seconde facture.',
  'The job is {v1}. It has to be completed before it is invoiced, or the customer is billed for work still on the ramp.':
    'Le travail est à l’état « {v1} ». Il doit être terminé avant d’être facturé, sinon le client paie un travail encore sur le pont.',
  'There is nothing priced on this job. Add the labour and parts before invoicing it.':
    'Rien n’est chiffré sur ce travail. Ajoutez la main-d’œuvre et les pièces avant de le facturer.',
  'This invoice was voided. Nothing can be paid against it.':
    'Cette facture a été annulée. Aucun paiement ne peut y être imputé.',
  'This invoice has not been issued yet.': 'Cette facture n’a pas encore été émise.',
  'A payment has to be more than nothing.': 'Un paiement doit être supérieur à zéro.',
  'Only {v1} is outstanding. Record {v2} against the invoice and take the rest as a deposit if the customer meant to pay ahead.':
    'Il ne reste que {v1} à payer. Enregistrez {v2} sur la facture et prenez le reste en acompte si le client voulait payer d’avance.',
  'Nothing has been issued yet, so there is nothing to credit. Edit the draft instead.':
    'Rien n’a encore été émis, il n’y a donc rien à créditer. Modifiez plutôt le brouillon.',
  'This invoice was voided already.': 'Cette facture a déjà été annulée.',
  'A credit note has to be for more than nothing.':
    'Un avoir doit porter sur un montant supérieur à zéro.',
  'Say why. The reason goes on the credit note the customer receives and is the first thing an accountant asks about.':
    'Indiquez pourquoi. La raison figure sur l’avoir que reçoit le client, et c’est la première question d’un comptable.',
  'This invoice was for {v1} and {v2} has already been credited. At most {v3} more can be.':
    'Cette facture était de {v1} et {v2} a déjà été crédité. Au plus {v3} peut encore l’être.',
  'A refund has to be for more than nothing.':
    'Un remboursement doit porter sur un montant supérieur à zéro.',
  'Raise a credit note first. A refund is money going back for a reason, and the credit note is the reason.':
    'Émettez d’abord un avoir. Un remboursement, c’est de l’argent qui repart pour une raison, et l’avoir est cette raison.',
  'Give the package a name.': 'Donnez un nom au forfait.',
  'Give the package a short code.': 'Donnez un code court au forfait.',
  'A package needs at least one line of labour, parts or fees.':
    'Un forfait nécessite au moins une ligne de main-d’œuvre, de pièces ou de frais.',
  'Every line needs a description.': 'Chaque ligne doit avoir une description.',
  '"{v1}" cannot have a negative price.': '« {v1} » ne peut pas avoir un prix négatif.',
  'A fixed price cannot be negative.': 'Un prix fixe ne peut pas être négatif.',
  'Say how long the package takes, in minutes.': 'Indiquez la durée du forfait, en minutes.',
  'An interval is a whole number of months or kilometres.':
    'Un intervalle est un nombre entier de mois ou de kilomètres.',
  'There is nothing on this quote yet. Add the work before sending it.':
    'Ce devis est encore vide. Ajoutez le travail avant de l’envoyer.',
  'The total is zero. Price the lines first, or the customer will approve free work.':
    'Le total est nul. Chiffrez d’abord les lignes, sinon le client approuvera un travail gratuit.',
  'The customer has no email address or mobile number on file, so there is nowhere to send it. Add one on their record first.':
    'Le client n’a ni adresse e-mail ni numéro de mobile enregistrés, il n’y a donc nulle part où l’envoyer. Ajoutez-en un sur sa fiche d’abord.',
  'No workflow {v1}': 'Aucun flux de travail {v1}',
  'No hand-off named {v1}': 'Aucun passage de relais nommé {v1}',
  'There is an unclosed {{ or }} in this message. Placeholders look like {{firstName}}.':
    'Il y a un {{ ou }} non fermé dans ce message. Les champs variables s’écrivent ainsi : {{firstName}}.',
  'There is nothing called {{{v1}}}. You can use: {v2}.':
    'Rien ne s’appelle {{{v1}}}. Vous pouvez utiliser : {v2}.',
  'This message needs {{{v1}}} and there is nothing to put there.':
    'Ce message a besoin de {{{v1}}} et il n’y a rien à y mettre.',
  'A transfer must have two different sites.': 'Un transfert doit concerner deux sites différents.',
  'Transfer {v1} is {v2}, so nothing can be booked in against it.':
    'Le transfert {v1} est à l’état « {v2} », rien ne peut donc être réceptionné dessus.',
  '{v1}: cannot receive a negative.': '{v1} : impossible de recevoir une quantité négative.',
  '{v1}: {v2} booked in against {v3} sent. Count it again before accepting.':
    '{v1} : {v2} réceptionnés pour {v3} envoyés. Recomptez avant d’accepter.',
  'Transfer {v1} has already left. Book in what arrives, then raise a transfer back for anything being returned.':
    'Le transfert {v1} est déjà parti. Réceptionnez ce qui arrive, puis créez un transfert retour pour tout ce qui doit être renvoyé.',
  'A {v1} transfer cannot be cancelled.': 'Un transfert à l’état « {v1} » ne peut pas être annulé.',
  'Every queued action needs an id the device generated, or a retry writes it twice.':
    'Chaque action en file d’attente doit avoir un identifiant généré par l’appareil, sinon une nouvelle tentative l’enregistre deux fois.',
  '{v1} is not something a device may queue.':
    '{v1} n’est pas une action qu’un appareil peut mettre en file d’attente.',
  'A queued action has to say what it happened to.':
    'Une action en file d’attente doit indiquer à quoi elle se rapporte.',
  'This was recorded in the future. The device clock is wrong, and accepting it would put time on a job before the job existed.':
    'Ceci a été enregistré dans le futur. L’horloge de l’appareil est fausse, et l’accepter imputerait du temps à un travail avant que ce travail n’existe.',
  'This has been sitting on a device for more than {v1} days. Somebody should look at it rather than have it appear silently.':
    'Ceci est resté sur un appareil pendant plus de {v1} jours. Quelqu’un devrait l’examiner plutôt que de le laisser apparaître sans bruit.',
  'A job cannot be a comeback of itself.': 'Un travail ne peut pas être son propre retour atelier.',
  '{v1} was on a different car. A comeback is the same car coming back.':
    '{v1} concernait une autre voiture. Un retour atelier, c’est la même voiture qui revient.',
  '{v1} was never finished, so it cannot come back.':
    '{v1} n’a jamais été terminé, il ne peut donc pas revenir.',
  '{v1} was finished after this job was opened, so this cannot be it coming back.':
    '{v1} a été terminé après l’ouverture de ce travail, il ne peut donc pas s’agir de son retour.',
  '{v1} was finished more than {v2} days before this one. That is a new repair, not a comeback.':
    '{v1} a été terminé plus de {v2} jours avant celui-ci. C’est une nouvelle réparation, pas un retour atelier.',
  "{v1} is already recorded as a comeback of this job. Two jobs cannot be each other's comeback.":
    '{v1} est déjà enregistré comme retour atelier de ce travail. Deux travaux ne peuvent pas être le retour l’un de l’autre.',
  'Say what came back, such as the same noise or the same leak. A comeback with no reason is an accusation nobody can answer.':
    'Indiquez ce qui est revenu, par exemple le même bruit ou la même fuite. Un retour atelier sans raison est une accusation à laquelle personne ne peut répondre.',
  'Cannot canonicalise a non-finite number': 'Impossible de canoniser un nombre non fini',
  'Cannot canonicalise value of type {v1}': 'Impossible de canoniser une valeur de type {v1}',
  'LEDGER_CHAIN_SALT is required to write passport events':
    'LEDGER_CHAIN_SALT est requis pour écrire des événements du passeport',
  'Give the document a title somebody will recognise in a list: "MOT 2026", "Front bumper before repair".':
    'Donnez au document un titre reconnaissable dans une liste : « Contrôle technique 2026 », « Pare-chocs avant, avant réparation ».',
  'That file is empty.': 'Ce fichier est vide.',
  'A document does not expire before it was issued.':
    'Un document n’expire pas avant sa date d’émission.',
  'That document was already removed.': 'Ce document a déjà été supprimé.',
  'Only the workshop that added a document, or the vehicle’s owner, can remove it.':
    'Seul l’atelier qui a ajouté un document, ou le propriétaire du véhicule, peut le supprimer.',
  'Say why it is being removed. The removal stays on the record; the reason is what makes it readable later.':
    'Indiquez pourquoi il est supprimé. La suppression reste dans le dossier ; c’est la raison qui la rend compréhensible plus tard.',
  'No vehicle with that identifier is on the network yet. Add it, and its history starts with you.':
    'Aucun véhicule avec cet identifiant n’est encore sur le réseau. Ajoutez-le, et son historique commence avec vous.',
  'This vehicle is already on your books.': 'Ce véhicule figure déjà dans vos dossiers.',
  'Say who the vehicle is going to. A transfer with nobody on the other end is a deleted owner, not a sale.':
    'Indiquez à qui va le véhicule. Un transfert sans personne à l’autre bout, c’est un propriétaire supprimé, pas une vente.',
  'This vehicle has no current owner on record, so there is nobody to transfer it from. Record an owner first.':
    'Ce véhicule n’a aucun propriétaire actuel enregistré, il n’y a donc personne de qui le transférer. Enregistrez d’abord un propriétaire.',
  'That is the same owner. Correct the name on the existing record instead of transferring to it.':
    'C’est le même propriétaire. Corrigez le nom sur la fiche existante au lieu de lui transférer le véhicule.',
  'The sale cannot be dated before the current owner bought it. One of the two dates is wrong.':
    'La vente ne peut pas être datée avant l’achat par le propriétaire actuel. L’une des deux dates est fausse.',
  'The sale is dated in the future. Record it when it happens, or the history says the car changed hands before it did.':
    'La vente est datée dans le futur. Enregistrez-la quand elle a lieu, sinon l’historique indiquera que la voiture a changé de mains trop tôt.',
  "There {v1} {v2} open job{v3} on this vehicle. Finish or close {v4} first, or confirm the transfer anyway and the work stays with the previous owner's account.":
    'Travaux ouverts sur ce véhicule : {v2}. Terminez-les ou clôturez-les d’abord, ou confirmez quand même le transfert et le travail reste sur le compte du propriétaire précédent.',
  'Nothing is owed on this invoice.': 'Rien n’est dû sur cette facture.',
  'The amount to pay must be more than nothing.': 'Le montant à payer doit être supérieur à zéro.',
  'That is more than is owed on this invoice.': 'C’est plus que ce qui est dû sur cette facture.',
  'Scheme "{v1}" pays nothing on anything.': 'Le barème « {v1} » ne verse aucune commission.',
  'Scheme "{v1}" has a negative rate. A commission scheme cannot take money back.':
    'Le barème « {v1} » a un taux négatif. Un barème de commission ne peut pas reprendre de l’argent.',
  'Scheme "{v1}" has bands out of order at {v2}.':
    'Le barème « {v1} » a des tranches dans le désordre à {v2}.',
  'An email address or a telephone number. Without one there is no way to send them a quote or tell them the car is ready.':
    'Une adresse e-mail ou un numéro de téléphone. Sans cela, impossible de lui envoyer un devis ou de le prévenir que la voiture est prête.',
  'That email address has something wrong with it.': 'Cette adresse e-mail comporte une erreur.',
  'That mobile number is too short or too long to dial.':
    'Ce numéro de mobile est trop court ou trop long pour être composé.',
  'That telephone number is too short or too long to dial.':
    'Ce numéro de téléphone est trop court ou trop long pour être composé.',
  'A rate starting {v1} ends before it begins.':
    'Un taux commençant le {v1} se termine avant de commencer.',
  'Two pay rates cover {v1}. Close the earlier one first.':
    'Deux taux de rémunération couvrent le {v1}. Clôturez d’abord le plus ancien.',
  'There are no approved timesheets to run. Approve them first.':
    'Aucune feuille de temps approuvée à traiter. Approuvez-les d’abord.',
  '{v1} of these {v2} not approved: {v3}. Payroll runs on approved hours only.':
    'Feuilles de temps non approuvées ({v1}) : {v3}. La paie ne porte que sur les heures approuvées.',
  '{v1} {v2} already been handed to payroll for this period.':
    'Déjà transmis à la paie pour cette période : {v1}.',
  'These timesheets cover different periods. A run is one pay period, so the file reconciles to one pay date.':
    'Ces feuilles de temps couvrent des périodes différentes. Un traitement correspond à une seule période de paie, pour que le fichier se rapproche d’une seule date de paie.',
  'This run has been paid already.': 'Ce traitement de paie a déjà été payé.',
  'Export the file first. Marking a run paid before the hours have reached payroll is recording a payment that has not happened.':
    'Exportez d’abord le fichier. Marquer un traitement comme payé avant que les heures n’arrivent à la paie, c’est enregistrer un paiement qui n’a pas eu lieu.',
  'Confirm your email address first. A workshop is being asked to hand over a vehicle history, and they should at least know the address is real.':
    'Confirmez d’abord votre adresse e-mail. On demande à un atelier de transmettre l’historique d’un véhicule : il doit au moins savoir que l’adresse est réelle.',
  'That vehicle is already on your account.': 'Ce véhicule est déjà sur votre compte.',
  'You have already asked about that one. The workshop has it and will answer.':
    'Vous avez déjà fait une demande pour celui-ci. L’atelier l’a reçue et vous répondra.',
  'No workshop using Carnet has worked on that vehicle, so there is nobody who can confirm it is yours. Ask your garage whether they use Carnet.':
    'Aucun atelier utilisant Carnet n’a travaillé sur ce véhicule, personne ne peut donc confirmer qu’il est à vous. Demandez à votre garage s’il utilise Carnet.',
  'You have {v1} requests waiting. Wait for one to be answered before asking about another.':
    'Vous avez {v1} demandes en attente. Attendez qu’une réponse arrive avant d’en faire une autre.',
  'That request was already {v1}. Answering it twice would tell the customer two different things.':
    'Cette demande a déjà le statut « {v1} ». Y répondre deux fois dirait au client deux choses différentes.',
  'Say why. The customer is told the outcome, and a refusal with nothing behind it produces a phone call rather than saving one.':
    'Indiquez pourquoi. Le client est informé de la décision, et un refus sans explication provoque un appel au lieu d’en éviter un.',
  'Your workshop has sent an updated quote, so this one no longer applies.':
    'Votre atelier a envoyé un devis mis à jour, celui-ci ne s’applique donc plus.',
  'You have already answered this quote.': 'Vous avez déjà répondu à ce devis.',
  'This quote was declined. Your workshop can send a new one.':
    'Ce devis a été refusé. Votre atelier peut en envoyer un nouveau.',
  'Your workshop has not sent this quote yet.': 'Votre atelier n’a pas encore envoyé ce devis.',
  'This quote has expired. Ask your workshop to send it again and they will confirm the price.':
    'Ce devis a expiré. Demandez à votre atelier de le renvoyer et il confirmera le prix.',
  'Part of this quote has changed. Please reload it.':
    'Une partie de ce devis a changé. Veuillez le recharger.',
  'There is nothing on this sale.': 'Il n’y a rien sur cette vente.',
  'This sale has no account customer, so nothing can be put on account.':
    'Cette vente n’a pas de client en compte, rien ne peut donc être mis sur compte.',
  'A card cannot be over-tendered. Take the exact amount on the card.':
    'Une carte ne peut pas être débitée au-delà du montant. Prélevez le montant exact sur la carte.',
  'Short by {v1}.': 'Il manque {v1}.',
  'Change can only be given against cash.':
    'La monnaie ne peut être rendue que sur un paiement en espèces.',
  'This sale was voided, so there is nothing to refund.':
    'Cette vente a été annulée, il n’y a donc rien à rembourser.',
  'This sale has not been paid for. Void it instead of refunding it.':
    'Cette vente n’a pas été payée. Annulez-la au lieu de la rembourser.',
  'Only {v1} of this sale is left to refund.': 'Il ne reste que {v1} de cette vente à rembourser.',
  'Fleet terms are for a company customer. A person with two cars is a customer, not a fleet.':
    'Les conditions flotte sont réservées aux clients professionnels. Une personne avec deux voitures est un client, pas une flotte.',
  'The {v1} is a percentage between 0 and 100.': '« {v1} » est un pourcentage entre 0 et 100.',
  'Payment terms are a whole number of days, up to 120.':
    'Les conditions de paiement sont un nombre entier de jours, jusqu’à 120.',
  'Job {v1} has no purchase order number and this fleet requires one on every job. Add it to the job before invoicing the month.':
    'Le travail {v1} n’a pas de numéro de bon de commande, et cette flotte en exige un sur chaque travail. Ajoutez-le au travail avant de facturer le mois.',
  'Say how many points to use.': 'Indiquez combien de points utiliser.',
  'That is {v1} points more than they have.':
    'C’est {v1} points de plus que ce que le client possède.',
  'That is worth more than the bill. Points do not pay out as money, so use only what is owed.':
    'Cela vaut plus que la facture. Les points ne se convertissent pas en argent, n’utilisez donc que ce qui est dû.',
  'Nobody has used this code yet.': 'Personne n’a encore utilisé ce code.',
  'That is the same customer on both sides. A referral pays for bringing somebody new.':
    'C’est le même client des deux côtés. Un parrainage récompense le fait d’amener quelqu’un de nouveau.',
  'This referral has already been paid, on both sides.':
    'Ce parrainage a déjà été versé, des deux côtés.',
  'They have spent {v1} so far. A referral pays once they have actually had work done.':
    'Le client a dépensé {v1} jusqu’ici. Un parrainage est versé une fois qu’un travail a réellement été effectué.',
  'That day has gone. A plan is written into the diary for today or a day to come.':
    'Ce jour est passé. Un plan s’inscrit dans l’agenda pour aujourd’hui ou un jour à venir.',
  'Nothing was placed, so there is nothing to write.':
    'Rien n’a été placé, il n’y a donc rien à inscrire.',
  'The workshop needs a trading name. It goes on every invoice.':
    'L’atelier a besoin d’un nom commercial. Il figure sur chaque facture.',
  '"{v1}" is not an email address.': '« {v1} » n’est pas une adresse e-mail.',
  'Choose the country the workshop trades in.': 'Choisissez le pays où l’atelier exerce.',
  'That is not a currency the books can be kept in.':
    'Ce n’est pas une devise dans laquelle la comptabilité peut être tenue.',
  'That is not a language and region the product knows.':
    'Ce n’est pas une langue et une région que le produit connaît.',
  'That is not a timezone.': 'Ce n’est pas un fuseau horaire.',
  'The re-approval threshold is a percentage between 0 and 100. Zero means every increase goes back to the customer.':
    'Le seuil de réapprobation est un pourcentage entre 0 et 100. Zéro signifie que chaque hausse revient au client.',
  'A {v1} code is one to twelve letters or digits, and it is what the diary shows when there is no room for the name.':
    'Un code « {v1} » compte de une à douze lettres ou chiffres, et c’est ce qu’affiche l’agenda quand le nom ne tient pas.',
  'The site needs a name, even if there is only one.':
    'Le site a besoin d’un nom, même s’il n’y en a qu’un.',
  'Daily capacity is the technician hours the site can absorb in a day: a number from 0 to 1000.':
    'La capacité journalière correspond aux heures de technicien que le site peut absorber en une journée : un nombre de 0 à 1000.',
  'Opening hours are two times in the day, and the site opens before it closes.':
    'Les horaires d’ouverture sont deux heures de la journée, et le site ouvre avant de fermer.',
  'Name the bay the way the floor already calls it.':
    'Nommez le poste comme l’atelier l’appelle déjà.',
  'Name the rate the way it appears on an invoice: "VAT 20%", "Zero rated".':
    'Nommez le taux tel qu’il apparaît sur une facture : « TVA 20 % », « Taux zéro ».',
  'A tax rate is a percentage from 0 to 100.': 'Un taux de taxe est un pourcentage de 0 à 100.',
  'A kind of work needs a name the diary can show.':
    'Un type de travail a besoin d’un nom que l’agenda peut afficher.',
  'The colour is six hex digits, like #2a41d8. It is how the diary tells kinds of work apart.':
    'La couleur s’écrit en six chiffres hexadécimaux, comme #2a41d8. C’est ainsi que l’agenda distingue les types de travail.',
  'Default hours are how long this kind of work usually takes: a number from 0 to 100, or blank.':
    'Les heures par défaut indiquent la durée habituelle de ce type de travail : un nombre de 0 à 100, ou vide.',
  'A prefix is up to eight letters, digits or hyphens, like "INV-". It goes in front of every number in that sequence from now on; numbers already issued keep theirs.':
    'Un préfixe compte jusqu’à huit lettres, chiffres ou tirets, comme « INV- ». Il précède désormais chaque numéro de cette séquence ; les numéros déjà émis gardent le leur.',
  'That is the only {v1}. Add another before retiring it.':
    'C’est le seul élément « {v1} ». Ajoutez-en un autre avant de le retirer.',
  'Money must be whole minor units, received {v1}':
    'Un montant doit être en unités mineures entières, reçu {v1}',
  'Money amount {v1} exceeds safe integer range':
    'Le montant {v1} dépasse la plage des entiers sûrs',
  '"{v1}" is not a valid decimal amount': '« {v1} » n’est pas un montant décimal valide',
  'Cannot combine {v1} with {v2}': 'Impossible de combiner {v1} avec {v2}',
  'Cannot multiply money by {v1}': 'Impossible de multiplier un montant par {v1}',
  'Cannot allocate into {v1} parts': 'Impossible de répartir en {v1} parts',
  'Only an owner or a manager can invite somebody to the workshop.':
    'Seul un propriétaire ou un responsable peut inviter quelqu’un dans l’atelier.',
  'Customers are not staff. They get access through the portal instead.':
    'Les clients ne font pas partie du personnel. Ils accèdent au produit par le portail.',
  '{v1} cannot invite somebody as {v2}.':
    'Le rôle « {v1} » ne peut pas inviter quelqu’un en tant que {v2}.',
  'This invitation has already been used. Sign in instead.':
    'Cette invitation a déjà été utilisée. Connectez-vous plutôt.',
  'This invitation was withdrawn. Ask whoever sent it for a new one.':
    'Cette invitation a été retirée. Demandez-en une nouvelle à la personne qui l’a envoyée.',
  'Invitations last {v1} days and this one has run out. Ask for another.':
    'Les invitations sont valables {v1} jours et celle-ci a expiré. Demandez-en une autre.',
  'This invitation was sent to {v1}. Sign in with that address, or ask for one addressed to you.':
    'Cette invitation a été envoyée à {v1}. Connectez-vous avec cette adresse, ou demandez-en une qui vous est adressée.',
  'You cannot change your own role. Ask another owner.':
    'Vous ne pouvez pas modifier votre propre rôle. Demandez à un autre propriétaire.',
  'Only an owner or a manager can change a role.':
    'Seul un propriétaire ou un responsable peut modifier un rôle.',
  "{v1} cannot change an owner's role.":
    'Le rôle « {v1} » ne peut pas modifier le rôle d’un propriétaire.',
  '{v1} cannot make somebody {v2}.': 'Le rôle « {v1} » ne peut pas attribuer le rôle {v2}.',
  'An odometer reading cannot be negative':
    'Un relevé de compteur kilométrique ne peut pas être négatif',
  'There is already an open claim on this. Settle that one before raising another.':
    'Une réclamation est déjà ouverte à ce sujet. Réglez-la avant d’en créer une autre.',
  '{v1} A claim can still be raised as goodwill, but somebody has to say why.':
    '{v1} Une réclamation peut quand même être faite à titre commercial, mais quelqu’un doit en indiquer la raison.',
  'That link only lasts {v1} hour{v2}. Ask for another and it will work.':
    'Ce lien n’est valable que {v1} h. Demandez-en un autre et il fonctionnera.',
  'That link has expired. Ask for another and it will work.':
    'Ce lien a expiré. Demandez-en un autre et il fonctionnera.',
  '{v1} of the payment lands on no bill. Allocate all of it, or pay less.':
    '{v1} du paiement ne sont affectés à aucune facture. Affectez la totalité, ou payez moins.',
  'The allocations add up to more than the payment.':
    'Le total des affectations dépasse le paiement.',
  'This expense has been paid. Correct it with a credit rather than by editing it.':
    'Cette dépense a été payée. Corrigez-la par un avoir plutôt qu’en la modifiant.',
  'An expense that is {v1} cannot be approved.':
    'Une dépense à l’état « {v1} » ne peut pas être approuvée.',
  '{v1} is part of {v2}. You are on {v3}.':
    '{v1} fait partie de l’offre {v2}. Vous êtes sur l’offre {v3}.',
  '{v1} is not available on any plan.': '{v1} n’est disponible dans aucune offre.',
  '{v1} covers {v2} {v3} and you have {v4}. {v5}':
    'L’offre {v1} couvre {v2} {v3} et vous en avez {v4}. {v5}',
  'Enter the name of the workshop.': 'Saisissez le nom de l’atelier.',
  'That name is too long for an invoice.': 'Ce nom est trop long pour une facture.',
  'That name is reserved. Try the trading name you put on invoices.':
    'Ce nom est réservé. Essayez le nom commercial que vous mettez sur vos factures.',
  'That name needs at least one letter or number.':
    'Ce nom doit contenir au moins une lettre ou un chiffre.',
  'Enter your name.': 'Saisissez votre nom.',
  'Enter a valid email address.': 'Saisissez une adresse e-mail valide.',
  'That is a disposable address. Use one you will still have next month.':
    'C’est une adresse jetable. Utilisez-en une que vous aurez encore le mois prochain.',
  'This looks like a personal address. Use your workshop address if you have one, so the account is not tied to one person.':
    'Cette adresse semble personnelle. Utilisez l’adresse de l’atelier si vous en avez une, pour que le compte ne soit pas lié à une seule personne.',
  'That password is one of the first ones tried.':
    'Ce mot de passe fait partie des premiers qu’on essaie pour forcer un compte.',
  'Do not put the workshop name in the password.':
    'Ne mettez pas le nom de l’atelier dans le mot de passe.',
  'Enter how many sites you run, at least one.':
    'Indiquez combien de sites vous exploitez, au moins un.',
  'This workshop cancelled its subscription. Everything is kept and can be read and exported; choosing a plan reopens it.':
    'Cet atelier a résilié son abonnement. Tout est conservé et peut être consulté et exporté ; choisir une offre le rouvre.',
  'This workshop is suspended. Everything is kept and can be read and exported; get in touch to reopen it.':
    'Cet atelier est suspendu. Tout est conservé et peut être consulté et exporté ; contactez-nous pour le rouvrir.',
  'Cancelled. The workshop stays open for {v1} more {v2}, then becomes read-only. Nothing is deleted.':
    'Abonnement résilié. Jours d’ouverture restants : {v1}. L’atelier passe ensuite en lecture seule. Rien n’est supprimé.',
  'The last payment did not go through. Update the card on the billing page; the provider will try again.':
    'Le dernier paiement n’a pas abouti. Mettez à jour la carte sur la page de facturation ; le prestataire réessaiera.',
  'Add a card to start the {v1}-day free trial. Nothing is charged until the trial ends, and cancelling before then costs nothing.':
    'Ajoutez une carte pour démarrer l’essai gratuit de {v1} jours. Rien n’est prélevé avant la fin de l’essai, et résilier avant ne coûte rien.',
  'The trial ends today. The card on file is charged for the first month unless you cancel.':
    'L’essai se termine aujourd’hui. La carte enregistrée sera débitée du premier mois, sauf si vous résiliez.',
  '{v1} days left of the {v2}-day trial. The card on file is charged when it ends unless you cancel before.':
    'Il reste {v1} jours sur l’essai de {v2} jours. La carte enregistrée sera débitée à la fin, sauf si vous résiliez avant.',
  'The trial has ended and the first payment has not been confirmed. {v1} {v2} before the workshop goes read-only.':
    'L’essai est terminé et le premier paiement n’a pas été confirmé. Jours restants avant le passage en lecture seule : {v1}.',
  'The trial ended and no payment was made, so the workshop is read-only. Everything is kept; choosing a plan reopens it.':
    'L’essai est terminé sans paiement, l’atelier est donc en lecture seule. Tout est conservé ; choisir une offre le rouvre.',
  'is empty': 'est vide',
  'same as row {v1}': 'identique à la ligne {v1}',
  'needs a first name, a last name or a company': 'nécessite un prénom, un nom ou une société',
  'cannot be negative': 'ne peut pas être négatif',
  'needs a debit or a credit': 'nécessite un débit ou un crédit',
  'a line is a debit or a credit, not both': 'une ligne est un débit ou un crédit, pas les deux',
  'cannot be negative; swap the side instead': 'ne peut pas être négatif ; inversez plutôt le sens',
  'This line is not on the purchase order.': 'Cette ligne ne figure pas sur le bon de commande.',
  'A received quantity must be greater than zero.':
    'Une quantité reçue doit être supérieure à zéro.',
  '{v1} received but only {v2} outstanding on "{v3}".':
    '{v1} reçus alors qu’il n’en reste que {v2} à recevoir sur « {v3} ».',
  'The bill matches what was received.': 'La facture correspond à ce qui a été reçu.',
  'The bill is higher than the value of goods actually received. Check the delivery before paying.':
    'La facture dépasse la valeur des marchandises réellement reçues. Vérifiez la livraison avant de payer.',
  'The billed price is above the ordered price. Query it with the supplier.':
    'Le prix facturé dépasse le prix commandé. Interrogez le fournisseur.',
  'The bill does not reconcile against the order or the receipt.':
    'La facture ne concorde ni avec la commande ni avec la réception.',
  'Everything received of "{v1}" has already gone back.':
    'Tout ce qui a été reçu de « {v1} » a déjà été retourné.',
  'Only {v1} of "{v2}" were received and not already returned.':
    'Quantité de « {v2} » reçue et pas encore retournée : {v1} seulement.',
  'This return was refused by the supplier and is closed.':
    'Ce retour a été refusé par le fournisseur et il est clos.',
  'Nothing is refundable on this invoice: either nothing was paid, or it has all gone back already.':
    'Rien n’est remboursable sur cette facture : soit rien n’a été payé, soit tout a déjà été rendu.',
  'At most {v1} can go back: the lesser of what was paid and what has been credited, less what has already been refunded.':
    'Au plus {v1} peut être rendu : le moindre entre le montant payé et le montant crédité, moins ce qui a déjà été remboursé.',
  'A job that is {v1} cannot change status.':
    'Un travail à l’état « {v1} » ne peut pas changer de statut.',
  'A job cannot move from {v1} to {v2}. Permitted next steps: {v3}.':
    'Un travail ne peut pas passer de « {v1} » à « {v2} ». Étapes suivantes autorisées : {v3}.',
  'This job type requires a passed quality check before it can be completed.':
    'Ce type de travail exige un contrôle qualité réussi avant de pouvoir être terminé.',
  'The customer has not approved the estimate yet.': 'Le client n’a pas encore approuvé le devis.',
  'This job has no chargeable lines, so there is nothing to invoice.':
    'Ce travail n’a aucune ligne facturable, il n’y a donc rien à facturer.',
  'This quote has already been sent. If the price has changed, raise a new version rather than sending the old one twice.':
    'Ce devis a déjà été envoyé. Si le prix a changé, créez une nouvelle version plutôt que de renvoyer l’ancienne.',
  'This quote is {v1} and cannot be sent again.':
    'Ce devis est à l’état « {v1} » et ne peut pas être renvoyé.',
  'A photograph is a picture from the camera: JPEG, PNG, WebP or HEIC.':
    'Une photo est une image prise avec l’appareil : JPEG, PNG, WebP ou HEIC.',
  'A document is a PDF or a picture of the paper: JPEG, PNG, WebP or HEIC.':
    'Un document est un PDF ou une photo du papier : JPEG, PNG, WebP ou HEIC.',
  'This invoice is already paid.': 'Cette facture est déjà payée.',
  'This invoice is not open for payment.': 'Cette facture n’est pas ouverte au paiement.',
  'The provider has no record of {v1}.': 'Le prestataire n’a aucune trace de {v1}.',
  'We recorded {v1}; the provider says {v2}.':
    'Nous avons enregistré {v1} ; le prestataire indique {v2}.',
  'The provider says {v1} minor units were paid; nothing is recorded here.':
    'Le prestataire indique que {v1} unités mineures ont été payées ; rien n’est enregistré ici.',
  'We recorded {v1} minor units; the provider says {v2}.':
    'Nous avons enregistré {v1} unités mineures ; le prestataire indique {v2}.',
  'Started {v1} hours ago and the provider still says pending.':
    'Commencée il y a {v1} heures et le prestataire indique toujours en attente.',
  'No card payment through the provider paid this invoice.':
    'Aucun paiement par carte via le prestataire n’a réglé cette facture.',
  'No single card payment on this invoice has that much left to send back.':
    'Aucun paiement par carte sur cette facture n’a, à lui seul, un solde suffisant pour rendre ce montant.',
  'This timesheet has been paid. Correct it with an adjustment on the next period rather than by editing this one.':
    'Cette feuille de temps a été payée. Corrigez-la par un ajustement sur la période suivante plutôt qu’en la modifiant.',
  'A timesheet cannot go from {v1} to {v2}.':
    'Une feuille de temps ne peut pas passer de « {v1} » à « {v2} ».',
  'The company needs a name.': 'La société doit avoir un nom.',
  'A first or last name, at least. It goes on the invoice.':
    'Au moins un prénom ou un nom. Il figure sur la facture.',
  'No jobs for this fleet in that month.': 'Aucun travail pour cette flotte ce mois-là.',
  'Nothing to invoice for that month: {v1}.': 'Rien à facturer pour ce mois-là : {v1}.',
  'Thank you. If you have a moment, saying so publicly helps other people find a workshop they can trust.':
    'Merci. Si vous avez un moment, le dire publiquement aide d’autres personnes à trouver un atelier de confiance.',
  'Thank you. If there was something that would have made it a five, we would genuinely like to know.':
    'Merci. S’il a manqué quelque chose pour mériter cinq étoiles, nous aimerions sincèrement le savoir.',
  'Thank you for saying so. Somebody here will read this today and get in touch. We would rather put it right than leave it.':
    'Merci de nous l’avoir dit. Quelqu’un ici lira ce message aujourd’hui et vous contactera. Nous préférons arranger les choses plutôt que de les laisser en l’état.',
  'This bay already has {v1} at that time.': 'Ce poste a déjà {v1} à cette heure.',
  'That technician is already assigned to another job at that time.':
    'Ce technicien est déjà affecté à un autre travail à cette heure.',
  'That technician is not available on this day.': 'Ce technicien n’est pas disponible ce jour-là.',
  'This would put the day at {v1} hours against a capacity of {v2} hours.':
    'La journée atteindrait {v1} heures pour une capacité de {v2} heures.',
  'This is the only owner. Make somebody else an owner first, or nobody can administer the workshop.':
    'C’est le seul propriétaire. Nommez d’abord quelqu’un d’autre propriétaire, sinon personne ne pourra administrer l’atelier.',
  'This is the only owner, so their role cannot be lowered. Promote somebody else first.':
    'C’est le seul propriétaire, son rôle ne peut donc pas être abaissé. Promouvez d’abord quelqu’un d’autre.',
  'This reading is {v1} km lower than the previous one ({v2} km on {v3}). It has been recorded and flagged.':
    'Ce relevé est inférieur de {v1} km au précédent ({v2} km le {v3}). Il a été enregistré et signalé.',
  'This implies {v1} km per day since the previous reading, which is unusually high. It has been recorded and flagged.':
    'Cela représente {v1} km par jour depuis le relevé précédent, ce qui est inhabituellement élevé. Le relevé a été enregistré et signalé.',
  'a booking': 'une réservation',
  '{v1} bookings': '{v1} réservations',
  '{v1} raises this.': 'L’offre {v1} relève cette limite.',
  'Talk to us about a bespoke plan.': 'Parlez-nous d’une offre sur mesure.',
  'staff accounts': 'comptes employés',
  sites: 'sites',
  bays: 'postes',
  vehicles: 'véhicules',
  // Phase 41: tax, configurable.
  'Name the rate the way it appears on an invoice: "VAT 20%", "GST and PST".':
    'Nommez le taux tel qu’il apparaît sur une facture : « TVA 20 % », « TPS et TVP ».',
  'A rate needs at least one tax, even if it is at 0%.':
    'Un taux doit comporter au moins une taxe, même à 0 %.',
  'A rate carries at most {v1} taxes.': 'Un taux comporte au maximum {v1} taxes.',
  'Name tax {v1} as the authority names it: "GST", "PST".':
    'Nommez la taxe {v1} comme l’administration la nomme : « TPS », « TVP ».',
  '{v1} must be a percentage from 0 to 100.': '{v1} doit être un pourcentage entre 0 et 100.',
  '{v1} is on this rate twice.': '{v1} figure deux fois sur ce taux.',
  '{v1} is the first tax, so there is nothing before it to be charged on.':
    '{v1} est la première taxe : rien ne la précède sur quoi la calculer en cascade.',
  'An exempt customer needs the certificate or registration number that makes them exempt. It is printed on every invoice to them.':
    'Un client exonéré doit avoir le numéro de certificat ou d’immatriculation qui justifie l’exonération. Il figure sur chacune de ses factures.',
  'Choose at least one part to print a label for.':
    'Choisissez au moins une pièce pour laquelle imprimer une étiquette.',
  'That is {v1} labels. Print at most {v2} at a time.':
    'Cela fait {v1} étiquettes. Imprimez-en au plus {v2} à la fois.',

  // Asked twice. Phase 46.
  'That referral has already been paid.': 'Ce parrainage a déjà été payé.',
  'That is already going through. Give it a moment rather than pressing again.':
    'C’est déjà en cours. Laissez-lui un instant plutôt que d’appuyer à nouveau.',
};

export const ar: Readonly<Record<string, string>> = {
  'Say why. The reason stays on the card.': 'اذكر السبب. يبقى السبب مسجلًا على البطاقة.',
  'Nothing is owed on that invoice.': 'لا يوجد مبلغ مستحق على هذه الفاتورة.',
  'The vendor’s bill for this work is already booked.': 'فاتورة المورد عن هذا العمل مسجلة بالفعل.',
  'That file is {v1}MB. The limit is {v2}MB.':
    'حجم هذا الملف {v1} ميغابايت. الحد الأقصى {v2} ميغابايت.',
  'Name the key after what will use it, so the person revoking it later knows what breaks.':
    'سمِّ المفتاح باسم ما سيستخدمه، حتى يعرف من يلغيه لاحقًا ما الذي سيتوقف عن العمل.',
  'That key is not one we issued.': 'هذا المفتاح ليس من المفاتيح التي أصدرناها.',
  'That key was revoked.': 'تم إلغاء هذا المفتاح.',
  'That link is not one of ours, or it has been replaced by a newer one.':
    'هذا الرابط ليس من روابطنا، أو استُبدل برابط أحدث.',
  'That link has already been used. Ask for a new one.':
    'تم استخدام هذا الرابط من قبل. اطلب رابطًا جديدًا.',
  'That has been asked for several times in the last hour. Check the messages already sent before asking again.':
    'طُلب هذا عدة مرات خلال الساعة الماضية. راجع الرسائل المرسلة قبل أن تطلب مجددًا.',
  'A payment has to be for more than nothing.': 'يجب أن يكون مبلغ الدفعة أكبر من صفر.',
  'Nothing is owed to this supplier that can be paid.': 'لا يوجد مبلغ مستحق لهذا المورد يمكن دفعه.',
  'One of these bills belongs to a different supplier. A payment settles one supplier at a time.':
    'إحدى هذه الفواتير تخص موردًا آخر. الدفعة الواحدة تسدد لمورد واحد فقط.',
  '{v1} is disputed. Settle the dispute, or take it out of the dispute, before paying it.':
    '{v1} محل نزاع. قم بتسوية النزاع أو إلغائه قبل الدفع.',
  'The allocation to {v1} has to be more than nothing.':
    'يجب أن يكون المبلغ المخصص لـ {v1} أكبر من صفر.',
  '{v1} only has {v2} outstanding.': 'المتبقي على {v1} هو {v2} فقط.',
  'Journal entry "{v1}" has no lines': 'القيد اليومي «{v1}» لا يحتوي على أي بنود',
  'Account {v1} carries a debit and a credit on one line':
    'الحساب {v1} يحمل مدينًا ودائنًا في البند نفسه',
  'Account {v1} has a negative amount. Reverse the side instead.':
    'الحساب {v1} به مبلغ سالب. اعكس الجانب بدلًا من ذلك.',
  'Journal entry "{v1}" does not balance: debits {v2} against credits {v3}':
    'القيد اليومي «{v1}» غير متوازن: المدين {v2} مقابل الدائن {v3}',
  'This rule does nothing. Add at least one action.':
    'هذه القاعدة لا تفعل شيئًا. أضف إجراءً واحدًا على الأقل.',
  'More than {v1} actions in one rule and nobody can predict what it does. Split it.':
    'مع أكثر من {v1} إجراءات في قاعدة واحدة لا يمكن لأحد توقع ما تفعله. قسّمها.',
  'A rule needs a cooldown. Without one it can act on the same person repeatedly, and by the time anybody notices the messages have gone.':
    'تحتاج القاعدة إلى فترة انتظار. بدونها قد تتصرف مع الشخص نفسه مرارًا، وحين يلاحظ أحد ذلك تكون الرسائل قد أُرسلت.',
  '{v1} is not known when {v2}. This rule would never fire.':
    '{v1} غير معروف عندما {v2}. لن تعمل هذه القاعدة أبدًا.',
  '{v1} cannot be both {v2} {v3} and {v4} {v5}. This rule would never fire.':
    'لا يمكن أن يحقق {v1} الشرطين «{v2} {v3}» و«{v4} {v5}» معًا. لن تعمل هذه القاعدة أبدًا.',
  'An expense needs an amount.': 'يجب أن يكون للمصروف مبلغ.',
  'The tax is more than the amount. Check which box on the receipt is which.':
    'الضريبة أكبر من المبلغ. تحقق مما تمثله كل خانة في الإيصال.',
  'An expense cannot be dated in the future.': 'لا يمكن أن يكون تاريخ المصروف في المستقبل.',
  'Anything over {v1} needs a receipt attached.': 'أي مبلغ يتجاوز {v1} يحتاج إلى إرفاق إيصال.',
  'You cannot approve your own claim.': 'لا يمكنك اعتماد مطالبتك الخاصة.',
  'A deposit has to be for more than nothing.': 'يجب أن يكون مبلغ العربون أكبر من صفر.',
  'A deposit is money the customer hands over. Not points, not a gift card, not money already held.':
    'العربون مال يسلّمه العميل. ليس نقاطًا، ولا بطاقة هدية، ولا مالًا محتجزًا بالفعل.',
  'Nothing is held for this customer.': 'لا يوجد مبلغ محتجز لهذا العميل.',
  'Say how much of the money held to use.': 'حدد المبلغ الذي تريد استخدامه من المال المحتجز.',
  'Only {v1} is held for this customer.': 'المبلغ المحتجز لهذا العميل {v1} فقط.',
  'That is more than the bill. Money held stays held; use only what is owed.':
    'هذا أكثر من قيمة الفاتورة. يبقى المال المحتجز محتجزًا؛ استخدم المستحق فقط.',
  'Nothing is held to return.': 'لا يوجد مبلغ محتجز لإعادته.',
  'Say how much to return.': 'حدد المبلغ المراد إعادته.',
  'Only {v1} is held. Return that or less.': 'المبلغ المحتجز {v1} فقط. أعد هذا المبلغ أو أقل.',
  'Money goes back the way money goes: cash, card or transfer.':
    'يُعاد المال بطرق الدفع المعتادة: نقدًا أو بالبطاقة أو بالتحويل.',
  'Say why it is going back. The reason stays on the record.':
    'اذكر سبب إعادته. يبقى السبب في السجل.',
  'Sell a card for whole pounds.': 'بع البطاقة بعدد صحيح من الجنيهات.',
  'The smallest card is {v1} pounds.': 'أصغر بطاقة بقيمة {v1} جنيه.',
  'The largest card is {v1} pounds. Sell two.': 'أكبر بطاقة بقيمة {v1} جنيه. بع بطاقتين.',
  'A card is paid for with money. Not with points, and not with another card.':
    'تُدفع قيمة البطاقة بالمال، لا بالنقاط ولا ببطاقة أخرى.',
  'A card lasts a year, two years, or for good.': 'صلاحية البطاقة سنة أو سنتان أو بلا انتهاء.',
  'That card was cancelled.': 'تم إلغاء هذه البطاقة.',
  'That card lapsed on {v1}.': 'انتهت صلاحية هذه البطاقة في {v1}.',
  'That card is good at another site.': 'هذه البطاقة صالحة في فرع آخر.',
  'There is nothing left on that card.': 'لم يتبقَّ أي رصيد على هذه البطاقة.',
  'Say how much of the card to use.': 'حدد المبلغ المراد استخدامه من البطاقة.',
  'Only {v1} is left on that card.': 'المتبقي على هذه البطاقة {v1} فقط.',
  'That is more than the bill. A card does not pay out as money, so use only what is owed.':
    'هذا أكثر من قيمة الفاتورة. لا تُصرف البطاقة نقدًا، لذا استخدم المستحق فقط.',
  'Say how much to add or take off, in pounds and pence.':
    'حدد المبلغ المراد إضافته أو خصمه، بالجنيه والبنس.',
  'That would take the card below nothing. Only {v1} is on it.':
    'سيصبح رصيد البطاقة أقل من صفر. رصيدها {v1} فقط.',
  'Marking something amber or red needs a measurement, a note or a recommendation. The customer sees the colour and has to be told why.':
    'وضع علامة برتقالية أو حمراء يتطلب قياسًا أو ملاحظة أو توصية. يرى العميل اللون ويجب أن يُبلَّغ بالسبب.',
  'This inspection has already been completed. Start a new one to record another look at the vehicle.':
    'اكتمل هذا الفحص بالفعل. ابدأ فحصًا جديدًا لتسجيل معاينة أخرى للمركبة.',
  'Nothing has been checked yet, so there is nothing to send.':
    'لم يُفحص أي شيء بعد، لذا لا يوجد ما يُرسل.',
  'A part number. It is how the part is found when the box is in your hand.':
    'رقم القطعة. به يُعثر على القطعة حين تكون العلبة في يدك.',
  'A name that a customer would understand on an invoice.': 'اسم يفهمه العميل على الفاتورة.',
  'The {v1} has to be a number, and not below zero.':
    'يجب أن تكون قيمة «{v1}» رقمًا لا يقل عن صفر.',
  'Choose who the order is going to.': 'اختر الجهة التي ستُرسل إليها الطلبية.',
  'An order with nothing on it. Add at least one line.': 'طلبية فارغة. أضف بندًا واحدًا على الأقل.',
  '"{v1}" needs a quantity above zero.': 'يجب أن تكون كمية «{v1}» أكبر من صفر.',
  '"{v1}" has a unit cost that is not a number, or is below zero.':
    'تكلفة الوحدة لـ«{v1}» ليست رقمًا أو أقل من صفر.',
  'A purchase order cannot move from {v1} to {v2}. Permitted: {v3}.':
    'لا يمكن نقل أمر الشراء من {v1} إلى {v2}. المسموح: {v3}.',
  'Say how many of "{v1}" are going back.': 'حدد عدد «{v1}» المُعادة.',
  'There {v1} {v2} of "{v3}" on the shelf; a part that has been fitted cannot go back as stock.':
    'الكمية الموجودة على الرف من «{v3}»: {v2}؛ لا يمكن إعادة قطعة تم تركيبها كمخزون.',
  'The credit needs the supplier’s own credit note number.':
    'يحتاج الإشعار الدائن إلى رقم الإشعار الخاص بالمورد.',
  'A credit note is for more than nothing, with tax of zero or more. If they credit nothing, record it as refused.':
    'يكون الإشعار الدائن بمبلغ أكبر من صفر، وبضريبة صفر أو أكثر. إن لم يُقيَّد أي مبلغ، سجّله على أنه مرفوض.',
  'Say who is doing the work.': 'حدد من سيقوم بالعمل.',
  'Say what the work is, as the customer will read it.': 'صف العمل كما سيقرؤه العميل.',
  'The cost and the charge are amounts of zero or more.':
    'التكلفة والسعر المُحتسب مبالغ لا تقل عن صفر.',
  'The bill needs the vendor’s own invoice number.': 'تحتاج الفاتورة إلى رقم فاتورة المورد.',
  'A bill is for more than nothing, with tax of zero or more.':
    'تكون الفاتورة بمبلغ أكبر من صفر، وبضريبة صفر أو أكثر.',
  'A receipt quantity must be greater than zero': 'يجب أن تكون الكمية المستلمة أكبر من صفر',
  'An issue quantity must be greater than zero': 'يجب أن تكون الكمية المصروفة أكبر من صفر',
  'A counted quantity cannot be negative': 'لا يمكن أن تكون الكمية المعدودة سالبة',
  'A reservation must be greater than zero': 'يجب أن يكون الحجز أكبر من صفر',
  'A release must be greater than zero': 'يجب أن يكون الإفراج أكبر من صفر',
  'Cannot release {v1} when only {v2} is reserved':
    'لا يمكن الإفراج عن {v1} بينما المحجوز {v2} فقط',
  'This car has already been checked in. The record is on the job; add a note if something was missed.':
    'تم تسجيل استلام هذه السيارة بالفعل. السجل موجود في العمل؛ أضف ملاحظة إذا فات شيء.',
  'This job is finished, so there is no car to check in. Open a new job for the same car.':
    'هذا العمل منتهٍ، فلا توجد سيارة لتسجيل استلامها. افتح عملًا جديدًا للسيارة نفسها.',
  'This car has already been handed back.': 'تم تسليم هذه السيارة بالفعل.',
  'The work is not marked completed yet. Complete the job first, so the customer is handed back a finished car.':
    'لم يُحدَّد العمل كمكتمل بعد. أكمل العمل أولًا، حتى يستلم العميل سيارة جاهزة.',
  'There is money outstanding on this job. Take the payment first, or say why the car is leaving unpaid.':
    'يوجد مبلغ مستحق على هذا العمل. استلم الدفعة أولًا، أو اذكر سبب مغادرة السيارة دون دفع.',
  'The mileage has to be a whole number of kilometres.':
    'يجب أن تكون قراءة العداد عددًا صحيحًا من الكيلومترات.',
  'The last reading was {v1} km. {v2} is lower, so one of the two is wrong.':
    'كانت القراءة الأخيرة {v1} كم. القراءة {v2} أقل منها، لذا إحداهما خاطئة.',
  'Fuel is noted in eighths, from empty to full.':
    'يُسجَّل الوقود بالأثمان، من الفارغ إلى الممتلئ.',
  'Sign on the pad. A dot or an empty pad is not a signature.':
    'وقّع على لوحة التوقيع. النقطة أو اللوحة الفارغة ليست توقيعًا.',
  'Say who signed.': 'حدد من وقّع.',
  'Say which hook the keys are on.': 'حدد الخطاف الذي عُلّقت عليه المفاتيح.',
  'The keys went back to the customer; there is nothing to take.':
    'أُعيدت المفاتيح إلى العميل؛ لا يوجد ما يُؤخذ.',
  'This job has an invoice already. If something on it is wrong, raise a credit note against that invoice rather than issuing a second one.':
    'لهذا العمل فاتورة بالفعل. إذا كان فيها خطأ، فأصدر إشعارًا دائنًا مقابلها بدلًا من إصدار فاتورة ثانية.',
  'The job is {v1}. It has to be completed before it is invoiced, or the customer is billed for work still on the ramp.':
    'حالة العمل «{v1}». يجب أن يكتمل قبل إصدار الفاتورة، وإلا دفع العميل مقابل عمل ما زال على الرافعة.',
  'There is nothing priced on this job. Add the labour and parts before invoicing it.':
    'لا يوجد شيء مسعّر في هذا العمل. أضف العمالة والقطع قبل إصدار الفاتورة.',
  'This invoice was voided. Nothing can be paid against it.':
    'تم إلغاء هذه الفاتورة. لا يمكن تسجيل أي دفعة عليها.',
  'This invoice has not been issued yet.': 'لم تُصدر هذه الفاتورة بعد.',
  'A payment has to be more than nothing.': 'يجب أن تكون الدفعة أكبر من صفر.',
  'Only {v1} is outstanding. Record {v2} against the invoice and take the rest as a deposit if the customer meant to pay ahead.':
    'المستحق {v1} فقط. سجّل {v2} على الفاتورة وخذ الباقي كعربون إذا كان العميل يقصد الدفع مقدمًا.',
  'Nothing has been issued yet, so there is nothing to credit. Edit the draft instead.':
    'لم يُصدر شيء بعد، فلا يوجد ما يُصدر له إشعار دائن. عدّل المسودة بدلًا من ذلك.',
  'This invoice was voided already.': 'تم إلغاء هذه الفاتورة من قبل.',
  'A credit note has to be for more than nothing.': 'يجب أن يكون مبلغ الإشعار الدائن أكبر من صفر.',
  'Say why. The reason goes on the credit note the customer receives and is the first thing an accountant asks about.':
    'اذكر السبب. يظهر السبب في الإشعار الدائن الذي يستلمه العميل، وهو أول ما يسأل عنه المحاسب.',
  'This invoice was for {v1} and {v2} has already been credited. At most {v3} more can be.':
    'كانت هذه الفاتورة بقيمة {v1} وصدر إشعار دائن بمبلغ {v2} بالفعل. يمكن إضافة {v3} كحد أقصى.',
  'A refund has to be for more than nothing.': 'يجب أن يكون مبلغ الاسترداد أكبر من صفر.',
  'Raise a credit note first. A refund is money going back for a reason, and the credit note is the reason.':
    'أصدر إشعارًا دائنًا أولًا. الاسترداد مال يُعاد لسبب، والإشعار الدائن هو ذلك السبب.',
  'Give the package a name.': 'أعطِ الباقة اسمًا.',
  'Give the package a short code.': 'أعطِ الباقة رمزًا قصيرًا.',
  'A package needs at least one line of labour, parts or fees.':
    'تحتاج الباقة إلى بند واحد على الأقل من العمالة أو القطع أو الرسوم.',
  'Every line needs a description.': 'يحتاج كل بند إلى وصف.',
  '"{v1}" cannot have a negative price.': 'لا يمكن أن يكون سعر «{v1}» سالبًا.',
  'A fixed price cannot be negative.': 'لا يمكن أن يكون السعر الثابت سالبًا.',
  'Say how long the package takes, in minutes.': 'حدد مدة الباقة بالدقائق.',
  'An interval is a whole number of months or kilometres.':
    'الفاصل عدد صحيح من الأشهر أو الكيلومترات.',
  'There is nothing on this quote yet. Add the work before sending it.':
    'لا يوجد شيء في عرض السعر هذا بعد. أضف العمل قبل إرساله.',
  'The total is zero. Price the lines first, or the customer will approve free work.':
    'الإجمالي صفر. سعّر البنود أولًا، وإلا سيوافق العميل على عمل مجاني.',
  'The customer has no email address or mobile number on file, so there is nowhere to send it. Add one on their record first.':
    'لا يوجد لدى العميل بريد إلكتروني أو رقم جوال مسجل، فلا توجد وسيلة لإرساله. أضف أحدهما إلى سجله أولًا.',
  'No workflow {v1}': 'لا يوجد سير عمل {v1}',
  'No hand-off named {v1}': 'لا يوجد تسليم باسم {v1}',
  'There is an unclosed {{ or }} in this message. Placeholders look like {{firstName}}.':
    'توجد {{ أو }} غير مغلقة في هذه الرسالة. تُكتب العناصر النائبة هكذا: {{firstName}}.',
  'There is nothing called {{{v1}}}. You can use: {v2}.':
    'لا يوجد شيء باسم {{{v1}}}. يمكنك استخدام: {v2}.',
  'This message needs {{{v1}}} and there is nothing to put there.':
    'تحتاج هذه الرسالة إلى {{{v1}}} ولا توجد قيمة لوضعها.',
  'A transfer must have two different sites.': 'يجب أن يكون النقل بين فرعين مختلفين.',
  'Transfer {v1} is {v2}, so nothing can be booked in against it.':
    'حالة النقل {v1} هي «{v2}»، لذا لا يمكن تسجيل استلام أي شيء عليه.',
  '{v1}: cannot receive a negative.': '{v1}: لا يمكن استلام كمية سالبة.',
  '{v1}: {v2} booked in against {v3} sent. Count it again before accepting.':
    '{v1}: تم تسجيل استلام {v2} مقابل {v3} مُرسلة. أعد العد قبل القبول.',
  'Transfer {v1} has already left. Book in what arrives, then raise a transfer back for anything being returned.':
    'غادر النقل {v1} بالفعل. سجّل استلام ما يصل، ثم أنشئ نقلًا عكسيًا لكل ما سيُعاد.',
  'A {v1} transfer cannot be cancelled.': 'لا يمكن إلغاء نقل حالته «{v1}».',
  'Every queued action needs an id the device generated, or a retry writes it twice.':
    'تحتاج كل عملية في قائمة الانتظار إلى معرّف أنشأه الجهاز، وإلا ستُسجَّل مرتين عند إعادة المحاولة.',
  '{v1} is not something a device may queue.': '{v1} ليس مما يُسمح للجهاز بوضعه في قائمة الانتظار.',
  'A queued action has to say what it happened to.':
    'يجب أن تحدد العملية في قائمة الانتظار ما الذي تخصه.',
  'This was recorded in the future. The device clock is wrong, and accepting it would put time on a job before the job existed.':
    'سُجّل هذا في المستقبل. ساعة الجهاز غير صحيحة، وقبوله سيضيف وقتًا إلى عمل قبل وجود ذلك العمل.',
  'This has been sitting on a device for more than {v1} days. Somebody should look at it rather than have it appear silently.':
    'بقي هذا على جهاز لأكثر من {v1} يومًا. يجب أن يراجعه أحد بدلًا من أن يظهر بصمت.',
  'A job cannot be a comeback of itself.': 'لا يمكن أن يكون العمل مرتجعًا لنفسه.',
  '{v1} was on a different car. A comeback is the same car coming back.':
    '{v1} كان على سيارة مختلفة. العمل المرتجع يعني عودة السيارة نفسها.',
  '{v1} was never finished, so it cannot come back.': '{v1} لم يكتمل أبدًا، لذا لا يمكن أن يعود.',
  '{v1} was finished after this job was opened, so this cannot be it coming back.':
    '{v1} اكتمل بعد فتح هذا العمل، لذا لا يمكن أن يكون هذا عودة له.',
  '{v1} was finished more than {v2} days before this one. That is a new repair, not a comeback.':
    '{v1} اكتمل قبل هذا العمل بأكثر من {v2} يومًا. هذا إصلاح جديد، وليس عملًا مرتجعًا.',
  "{v1} is already recorded as a comeback of this job. Two jobs cannot be each other's comeback.":
    '{v1} مسجل بالفعل كعمل مرتجع لهذا العمل. لا يمكن أن يكون عملان مرتجعين أحدهما للآخر.',
  'Say what came back, such as the same noise or the same leak. A comeback with no reason is an accusation nobody can answer.':
    'اذكر ما الذي عاد، مثل الصوت نفسه أو التسريب نفسه. العمل المرتجع بلا سبب اتهام لا يستطيع أحد الرد عليه.',
  'Cannot canonicalise a non-finite number': 'لا يمكن توحيد صيغة رقم غير منتهٍ',
  'Cannot canonicalise value of type {v1}': 'لا يمكن توحيد صيغة قيمة من النوع {v1}',
  'LEDGER_CHAIN_SALT is required to write passport events':
    'المتغير LEDGER_CHAIN_SALT مطلوب لكتابة أحداث الجواز',
  'Give the document a title somebody will recognise in a list: "MOT 2026", "Front bumper before repair".':
    'أعطِ المستند عنوانًا يسهل التعرف عليه في قائمة: «الفحص الدوري 2026»، «الصدام الأمامي قبل الإصلاح».',
  'That file is empty.': 'هذا الملف فارغ.',
  'A document does not expire before it was issued.': 'لا تنتهي صلاحية المستند قبل تاريخ إصداره.',
  'That document was already removed.': 'تمت إزالة هذا المستند من قبل.',
  'Only the workshop that added a document, or the vehicle’s owner, can remove it.':
    'لا يمكن إزالة المستند إلا من الورشة التي أضافته أو من مالك المركبة.',
  'Say why it is being removed. The removal stays on the record; the reason is what makes it readable later.':
    'اذكر سبب إزالته. تبقى الإزالة في السجل، والسبب هو ما يجعلها مفهومة لاحقًا.',
  'No vehicle with that identifier is on the network yet. Add it, and its history starts with you.':
    'لا توجد مركبة بهذا المعرّف على الشبكة بعد. أضفها، وسيبدأ سجلها معك.',
  'This vehicle is already on your books.': 'هذه المركبة مسجلة لديك بالفعل.',
  'Say who the vehicle is going to. A transfer with nobody on the other end is a deleted owner, not a sale.':
    'حدد لمن ستنتقل المركبة. النقل بلا طرف آخر هو حذف للمالك، وليس بيعًا.',
  'This vehicle has no current owner on record, so there is nobody to transfer it from. Record an owner first.':
    'لا يوجد مالك حالي مسجل لهذه المركبة، فلا يوجد من تُنقل منه. سجّل مالكًا أولًا.',
  'That is the same owner. Correct the name on the existing record instead of transferring to it.':
    'هذا هو المالك نفسه. صحّح الاسم في السجل الحالي بدلًا من النقل إليه.',
  'The sale cannot be dated before the current owner bought it. One of the two dates is wrong.':
    'لا يمكن أن يسبق تاريخ البيع تاريخ شراء المالك الحالي. أحد التاريخين خاطئ.',
  'The sale is dated in the future. Record it when it happens, or the history says the car changed hands before it did.':
    'تاريخ البيع في المستقبل. سجّله عند حدوثه، وإلا سيُظهر السجل أن ملكية السيارة انتقلت قبل موعدها.',
  "There {v1} {v2} open job{v3} on this vehicle. Finish or close {v4} first, or confirm the transfer anyway and the work stays with the previous owner's account.":
    'عدد الأعمال المفتوحة على هذه المركبة: {v2}. أنهِها أو أغلقها أولًا، أو أكّد النقل على أي حال وسيبقى العمل على حساب المالك السابق.',
  'Nothing is owed on this invoice.': 'لا يوجد مبلغ مستحق على هذه الفاتورة.',
  'The amount to pay must be more than nothing.': 'يجب أن يكون المبلغ المراد دفعه أكبر من صفر.',
  'That is more than is owed on this invoice.': 'هذا أكثر من المستحق على هذه الفاتورة.',
  'Scheme "{v1}" pays nothing on anything.': 'نظام العمولة «{v1}» لا يدفع أي عمولة.',
  'Scheme "{v1}" has a negative rate. A commission scheme cannot take money back.':
    'نظام العمولة «{v1}» به نسبة سالبة. لا يمكن لنظام العمولة استرداد المال.',
  'Scheme "{v1}" has bands out of order at {v2}.':
    'نظام العمولة «{v1}» به شرائح غير مرتبة عند {v2}.',
  'An email address or a telephone number. Without one there is no way to send them a quote or tell them the car is ready.':
    'بريد إلكتروني أو رقم هاتف. بدونهما لا توجد طريقة لإرسال عرض سعر أو إبلاغ العميل بأن السيارة جاهزة.',
  'That email address has something wrong with it.': 'يوجد خطأ في عنوان البريد الإلكتروني هذا.',
  'That mobile number is too short or too long to dial.':
    'رقم الجوال هذا أقصر أو أطول من أن يُتصل به.',
  'That telephone number is too short or too long to dial.':
    'رقم الهاتف هذا أقصر أو أطول من أن يُتصل به.',
  'A rate starting {v1} ends before it begins.': 'معدل يبدأ في {v1} ينتهي قبل أن يبدأ.',
  'Two pay rates cover {v1}. Close the earlier one first.':
    'يغطي معدلا أجر تاريخ {v1}. أغلق المعدل الأقدم أولًا.',
  'There are no approved timesheets to run. Approve them first.':
    'لا توجد جداول دوام معتمدة لتشغيل الرواتب. اعتمدها أولًا.',
  '{v1} of these {v2} not approved: {v3}. Payroll runs on approved hours only.':
    'جداول دوام غير معتمدة ({v1}): {v3}. تُحتسب الرواتب على الساعات المعتمدة فقط.',
  '{v1} {v2} already been handed to payroll for this period.':
    'تم تسليم ما يلي إلى الرواتب لهذه الفترة بالفعل: {v1}.',
  'These timesheets cover different periods. A run is one pay period, so the file reconciles to one pay date.':
    'تغطي جداول الدوام هذه فترات مختلفة. مسير الرواتب الواحد يخص فترة أجر واحدة، حتى يطابق الملف تاريخ دفع واحدًا.',
  'This run has been paid already.': 'تم دفع مسير الرواتب هذا بالفعل.',
  'Export the file first. Marking a run paid before the hours have reached payroll is recording a payment that has not happened.':
    'صدّر الملف أولًا. تحديد مسير الرواتب كمدفوع قبل وصول الساعات إلى الرواتب يعني تسجيل دفعة لم تحدث.',
  'Confirm your email address first. A workshop is being asked to hand over a vehicle history, and they should at least know the address is real.':
    'أكّد بريدك الإلكتروني أولًا. يُطلب من الورشة مشاركة سجل مركبة، ويجب أن تعرف على الأقل أن العنوان حقيقي.',
  'That vehicle is already on your account.': 'هذه المركبة موجودة في حسابك بالفعل.',
  'You have already asked about that one. The workshop has it and will answer.':
    'لقد سألت عن هذه المركبة من قبل. الطلب لدى الورشة وسترد عليك.',
  'No workshop using Carnet has worked on that vehicle, so there is nobody who can confirm it is yours. Ask your garage whether they use Carnet.':
    'لم تعمل أي ورشة تستخدم Carnet على هذه المركبة، فلا يوجد من يؤكد أنها لك. اسأل ورشتك إن كانت تستخدم Carnet.',
  'You have {v1} requests waiting. Wait for one to be answered before asking about another.':
    'لديك {v1} طلبات قيد الانتظار. انتظر الرد على أحدها قبل السؤال عن غيره.',
  'That request was already {v1}. Answering it twice would tell the customer two different things.':
    'حالة هذا الطلب «{v1}» بالفعل. الرد عليه مرتين سيخبر العميل بأمرين مختلفين.',
  'Say why. The customer is told the outcome, and a refusal with nothing behind it produces a phone call rather than saving one.':
    'اذكر السبب. يُبلَّغ العميل بالنتيجة، والرفض بلا سبب يؤدي إلى مكالمة هاتفية بدلًا من تجنبها.',
  'Your workshop has sent an updated quote, so this one no longer applies.':
    'أرسلت ورشتك عرض سعر محدّثًا، لذا لم يعد هذا العرض ساريًا.',
  'You have already answered this quote.': 'لقد رددت على عرض السعر هذا من قبل.',
  'This quote was declined. Your workshop can send a new one.':
    'تم رفض عرض السعر هذا. يمكن لورشتك إرسال عرض جديد.',
  'Your workshop has not sent this quote yet.': 'لم ترسل ورشتك عرض السعر هذا بعد.',
  'This quote has expired. Ask your workshop to send it again and they will confirm the price.':
    'انتهت صلاحية عرض السعر هذا. اطلب من ورشتك إرساله مجددًا وستؤكد السعر.',
  'Part of this quote has changed. Please reload it.':
    'تغيّر جزء من عرض السعر هذا. يُرجى إعادة تحميله.',
  'There is nothing on this sale.': 'لا يوجد شيء في عملية البيع هذه.',
  'This sale has no account customer, so nothing can be put on account.':
    'لا يوجد عميل بحساب آجل لعملية البيع هذه، لذا لا يمكن تسجيل شيء على الحساب.',
  'A card cannot be over-tendered. Take the exact amount on the card.':
    'لا يمكن الدفع بالبطاقة بأكثر من المبلغ. خذ المبلغ المحدد بالبطاقة.',
  'Short by {v1}.': 'ينقص {v1}.',
  'Change can only be given against cash.': 'لا يمكن إعطاء الباقي إلا عند الدفع نقدًا.',
  'This sale was voided, so there is nothing to refund.':
    'تم إلغاء عملية البيع هذه، فلا يوجد ما يُسترد.',
  'This sale has not been paid for. Void it instead of refunding it.':
    'لم تُدفع عملية البيع هذه. ألغها بدلًا من استرداد مبلغها.',
  'Only {v1} of this sale is left to refund.': 'المتبقي للاسترداد من عملية البيع هذه {v1} فقط.',
  'Fleet terms are for a company customer. A person with two cars is a customer, not a fleet.':
    'شروط الأسطول مخصصة للعملاء من الشركات. الشخص الذي يملك سيارتين عميل وليس أسطولًا.',
  'The {v1} is a percentage between 0 and 100.': '«{v1}» نسبة مئوية بين 0 و100.',
  'Payment terms are a whole number of days, up to 120.':
    'شروط الدفع عدد صحيح من الأيام، بحد أقصى 120.',
  'Job {v1} has no purchase order number and this fleet requires one on every job. Add it to the job before invoicing the month.':
    'العمل {v1} بلا رقم أمر شراء، وهذا الأسطول يشترطه في كل عمل. أضفه إلى العمل قبل إصدار فاتورة الشهر.',
  'Say how many points to use.': 'حدد عدد النقاط المراد استخدامها.',
  'That is {v1} points more than they have.': 'هذا يزيد بـ{v1} نقطة عن رصيد العميل.',
  'That is worth more than the bill. Points do not pay out as money, so use only what is owed.':
    'قيمة ذلك أكبر من الفاتورة. لا تُصرف النقاط نقدًا، لذا استخدم المستحق فقط.',
  'Nobody has used this code yet.': 'لم يستخدم أحد هذا الرمز بعد.',
  'That is the same customer on both sides. A referral pays for bringing somebody new.':
    'هذا هو العميل نفسه في الطرفين. الإحالة تُكافئ على جلب شخص جديد.',
  'This referral has already been paid, on both sides.':
    'تم دفع مكافأة هذه الإحالة بالفعل، للطرفين.',
  'They have spent {v1} so far. A referral pays once they have actually had work done.':
    'أنفق العميل {v1} حتى الآن. تُدفع مكافأة الإحالة بعد أن يُنجز له عمل فعلًا.',
  'That day has gone. A plan is written into the diary for today or a day to come.':
    'انقضى ذلك اليوم. تُكتب الخطة في الأجندة لليوم أو ليوم قادم.',
  'Nothing was placed, so there is nothing to write.': 'لم يُوضع شيء، فلا يوجد ما يُكتب.',
  'The workshop needs a trading name. It goes on every invoice.':
    'تحتاج الورشة إلى اسم تجاري. يظهر على كل فاتورة.',
  '"{v1}" is not an email address.': '«{v1}» ليس عنوان بريد إلكتروني.',
  'Choose the country the workshop trades in.': 'اختر الدولة التي تعمل فيها الورشة.',
  'That is not a currency the books can be kept in.': 'هذه ليست عملة يمكن مسك الدفاتر بها.',
  'That is not a language and region the product knows.': 'هذه ليست لغة ومنطقة يعرفها النظام.',
  'That is not a timezone.': 'هذه ليست منطقة زمنية.',
  'The re-approval threshold is a percentage between 0 and 100. Zero means every increase goes back to the customer.':
    'حد إعادة الموافقة نسبة مئوية بين 0 و100. الصفر يعني أن كل زيادة تعود إلى العميل.',
  'A {v1} code is one to twelve letters or digits, and it is what the diary shows when there is no room for the name.':
    'رمز «{v1}» من حرف إلى اثني عشر حرفًا أو رقمًا، وهو ما تعرضه الأجندة حين لا يتسع المكان للاسم.',
  'The site needs a name, even if there is only one.': 'يحتاج الفرع إلى اسم، حتى لو كان الوحيد.',
  'Daily capacity is the technician hours the site can absorb in a day: a number from 0 to 1000.':
    'السعة اليومية هي ساعات الفنيين التي يستوعبها الفرع في اليوم: رقم من 0 إلى 1000.',
  'Opening hours are two times in the day, and the site opens before it closes.':
    'ساعات العمل وقتان في اليوم، ويفتح الفرع قبل أن يغلق.',
  'Name the bay the way the floor already calls it.': 'سمِّ المنصة كما يسميها العاملون في الورشة.',
  'Name the rate the way it appears on an invoice: "VAT 20%", "Zero rated".':
    'سمِّ النسبة كما تظهر على الفاتورة: «ضريبة القيمة المضافة 20%»، «خاضع لنسبة صفر».',
  'A tax rate is a percentage from 0 to 100.': 'نسبة الضريبة نسبة مئوية من 0 إلى 100.',
  'A kind of work needs a name the diary can show.': 'يحتاج نوع العمل إلى اسم يمكن للأجندة عرضه.',
  'The colour is six hex digits, like #2a41d8. It is how the diary tells kinds of work apart.':
    'اللون ستة أرقام سداسية عشرية، مثل #2a41d8. به تميز الأجندة بين أنواع العمل.',
  'Default hours are how long this kind of work usually takes: a number from 0 to 100, or blank.':
    'الساعات الافتراضية هي المدة المعتادة لهذا النوع من العمل: رقم من 0 إلى 100، أو فارغ.',
  'A prefix is up to eight letters, digits or hyphens, like "INV-". It goes in front of every number in that sequence from now on; numbers already issued keep theirs.':
    'البادئة حتى ثمانية أحرف أو أرقام أو شرطات، مثل «INV-». تُضاف من الآن أمام كل رقم في هذا التسلسل؛ وتحتفظ الأرقام الصادرة سابقًا ببادئتها.',
  'That is the only {v1}. Add another before retiring it.':
    'هذا هو العنصر الوحيد من «{v1}». أضف غيره قبل إيقافه.',
  'Money must be whole minor units, received {v1}':
    'يجب أن يكون المبلغ بوحدات فرعية صحيحة، القيمة المستلمة {v1}',
  'Money amount {v1} exceeds safe integer range': 'المبلغ {v1} يتجاوز نطاق الأعداد الصحيحة الآمن',
  '"{v1}" is not a valid decimal amount': '«{v1}» ليس مبلغًا عشريًا صالحًا',
  'Cannot combine {v1} with {v2}': 'لا يمكن جمع {v1} مع {v2}',
  'Cannot multiply money by {v1}': 'لا يمكن ضرب المبلغ في {v1}',
  'Cannot allocate into {v1} parts': 'لا يمكن التوزيع على {v1} أجزاء',
  'Only an owner or a manager can invite somebody to the workshop.':
    'لا يمكن دعوة أحد إلى الورشة إلا من المالك أو المدير.',
  'Customers are not staff. They get access through the portal instead.':
    'العملاء ليسوا من الموظفين. يحصلون على الوصول عبر البوابة.',
  '{v1} cannot invite somebody as {v2}.': 'لا يمكن لدور «{v1}» دعوة شخص بصفة {v2}.',
  'This invitation has already been used. Sign in instead.':
    'تم استخدام هذه الدعوة بالفعل. سجّل الدخول بدلًا من ذلك.',
  'This invitation was withdrawn. Ask whoever sent it for a new one.':
    'تم سحب هذه الدعوة. اطلب دعوة جديدة ممن أرسلها.',
  'Invitations last {v1} days and this one has run out. Ask for another.':
    'صلاحية الدعوات {v1} أيام وقد انتهت صلاحية هذه الدعوة. اطلب دعوة أخرى.',
  'This invitation was sent to {v1}. Sign in with that address, or ask for one addressed to you.':
    'أُرسلت هذه الدعوة إلى {v1}. سجّل الدخول بهذا العنوان، أو اطلب دعوة موجهة إليك.',
  'You cannot change your own role. Ask another owner.':
    'لا يمكنك تغيير دورك بنفسك. اطلب ذلك من مالك آخر.',
  'Only an owner or a manager can change a role.': 'لا يمكن تغيير الدور إلا من المالك أو المدير.',
  "{v1} cannot change an owner's role.": 'لا يمكن لدور «{v1}» تغيير دور المالك.',
  '{v1} cannot make somebody {v2}.': 'لا يمكن لدور «{v1}» منح دور {v2}.',
  'An odometer reading cannot be negative': 'لا يمكن أن تكون قراءة عداد المسافات سالبة',
  'There is already an open claim on this. Settle that one before raising another.':
    'توجد مطالبة مفتوحة بالفعل بهذا الشأن. قم بتسويتها قبل إنشاء أخرى.',
  '{v1} A claim can still be raised as goodwill, but somebody has to say why.':
    '{v1} لا يزال بالإمكان رفع مطالبة على سبيل حسن النية، لكن يجب أن يذكر أحد السبب.',
  'That link only lasts {v1} hour{v2}. Ask for another and it will work.':
    'هذا الرابط صالح لمدة {v1} ساعة فقط. اطلب رابطًا آخر وسيعمل.',
  'That link has expired. Ask for another and it will work.':
    'انتهت صلاحية هذا الرابط. اطلب رابطًا آخر وسيعمل.',
  '{v1} of the payment lands on no bill. Allocate all of it, or pay less.':
    '{v1} من الدفعة غير مخصص لأي فاتورة. خصّص المبلغ كله، أو ادفع أقل.',
  'The allocations add up to more than the payment.': 'مجموع المبالغ المخصصة يتجاوز الدفعة.',
  'This expense has been paid. Correct it with a credit rather than by editing it.':
    'تم دفع هذا المصروف. صحّحه بقيد دائن بدلًا من تعديله.',
  'An expense that is {v1} cannot be approved.': 'لا يمكن اعتماد مصروف حالته «{v1}».',
  '{v1} is part of {v2}. You are on {v3}.': '{v1} ضمن خطة {v2}. أنت مشترك في خطة {v3}.',
  '{v1} is not available on any plan.': '{v1} غير متاح في أي خطة.',
  '{v1} covers {v2} {v3} and you have {v4}. {v5}':
    'تغطي خطة {v1} عدد {v2} من {v3} ولديك {v4}. {v5}',
  'Enter the name of the workshop.': 'أدخل اسم الورشة.',
  'That name is too long for an invoice.': 'هذا الاسم أطول من أن يظهر على فاتورة.',
  'That name is reserved. Try the trading name you put on invoices.':
    'هذا الاسم محجوز. جرّب الاسم التجاري الذي تضعه على فواتيرك.',
  'That name needs at least one letter or number.':
    'يجب أن يحتوي الاسم على حرف أو رقم واحد على الأقل.',
  'Enter your name.': 'أدخل اسمك.',
  'Enter a valid email address.': 'أدخل عنوان بريد إلكتروني صالحًا.',
  'That is a disposable address. Use one you will still have next month.':
    'هذا عنوان مؤقت. استخدم عنوانًا سيبقى لديك الشهر القادم.',
  'This looks like a personal address. Use your workshop address if you have one, so the account is not tied to one person.':
    'يبدو هذا عنوانًا شخصيًا. استخدم عنوان الورشة إن وُجد، حتى لا يرتبط الحساب بشخص واحد.',
  'That password is one of the first ones tried.':
    'كلمة المرور هذه من أولى الكلمات التي تُجرَّب عند محاولة اختراق الحسابات.',
  'Do not put the workshop name in the password.': 'لا تضع اسم الورشة في كلمة المرور.',
  'Enter how many sites you run, at least one.': 'أدخل عدد الفروع التي تديرها، فرع واحد على الأقل.',
  'This workshop cancelled its subscription. Everything is kept and can be read and exported; choosing a plan reopens it.':
    'ألغت هذه الورشة اشتراكها. كل شيء محفوظ ويمكن قراءته وتصديره؛ واختيار خطة يعيد فتحها.',
  'This workshop is suspended. Everything is kept and can be read and exported; get in touch to reopen it.':
    'هذه الورشة موقوفة. كل شيء محفوظ ويمكن قراءته وتصديره؛ تواصل معنا لإعادة فتحها.',
  'Cancelled. The workshop stays open for {v1} more {v2}, then becomes read-only. Nothing is deleted.':
    'أُلغي الاشتراك. الأيام المتبقية قبل أن تصبح الورشة للقراءة فقط: {v1}. لا يُحذف شيء.',
  'The last payment did not go through. Update the card on the billing page; the provider will try again.':
    'لم تنجح الدفعة الأخيرة. حدّث البطاقة في صفحة الفوترة؛ وسيعيد مزوّد الدفع المحاولة.',
  'Add a card to start the {v1}-day free trial. Nothing is charged until the trial ends, and cancelling before then costs nothing.':
    'أضف بطاقة لبدء التجربة المجانية لمدة {v1} يومًا. لا يُخصم أي مبلغ حتى نهاية التجربة، والإلغاء قبل ذلك لا يكلف شيئًا.',
  'The trial ends today. The card on file is charged for the first month unless you cancel.':
    'تنتهي التجربة اليوم. ستُخصم قيمة الشهر الأول من البطاقة المسجلة ما لم تلغِ الاشتراك.',
  '{v1} days left of the {v2}-day trial. The card on file is charged when it ends unless you cancel before.':
    'بقي {v1} يومًا من التجربة البالغة {v2} يومًا. ستُخصم القيمة من البطاقة المسجلة عند انتهائها ما لم تلغِ قبل ذلك.',
  'The trial has ended and the first payment has not been confirmed. {v1} {v2} before the workshop goes read-only.':
    'انتهت التجربة ولم يتأكد الدفع الأول بعد. الأيام المتبقية قبل أن تصبح الورشة للقراءة فقط: {v1}.',
  'The trial ended and no payment was made, so the workshop is read-only. Everything is kept; choosing a plan reopens it.':
    'انتهت التجربة دون دفع، لذا أصبحت الورشة للقراءة فقط. كل شيء محفوظ؛ واختيار خطة يعيد فتحها.',
  'is empty': 'فارغ',
  'same as row {v1}': 'مطابق للصف {v1}',
  'needs a first name, a last name or a company': 'يحتاج إلى اسم أول أو اسم عائلة أو اسم شركة',
  'cannot be negative': 'لا يمكن أن يكون سالبًا',
  'needs a debit or a credit': 'يحتاج إلى مدين أو دائن',
  'a line is a debit or a credit, not both': 'البند إما مدين أو دائن، وليس كليهما',
  'cannot be negative; swap the side instead': 'لا يمكن أن يكون سالبًا؛ اعكس الجانب بدلًا من ذلك',
  'This line is not on the purchase order.': 'هذا البند غير موجود في أمر الشراء.',
  'A received quantity must be greater than zero.': 'يجب أن تكون الكمية المستلمة أكبر من صفر.',
  '{v1} received but only {v2} outstanding on "{v3}".':
    'تم استلام {v1} بينما المتبقي من «{v3}» {v2} فقط.',
  'The bill matches what was received.': 'الفاتورة مطابقة لما تم استلامه.',
  'The bill is higher than the value of goods actually received. Check the delivery before paying.':
    'الفاتورة أعلى من قيمة البضائع المستلمة فعلًا. تحقق من التوريد قبل الدفع.',
  'The billed price is above the ordered price. Query it with the supplier.':
    'السعر في الفاتورة أعلى من سعر الطلب. استفسر من المورد.',
  'The bill does not reconcile against the order or the receipt.':
    'الفاتورة لا تتطابق مع الطلب أو مع الاستلام.',
  'Everything received of "{v1}" has already gone back.': 'كل ما استُلم من «{v1}» أُعيد بالفعل.',
  'Only {v1} of "{v2}" were received and not already returned.':
    'الكمية المستلمة من «{v2}» وغير المُعادة {v1} فقط.',
  'This return was refused by the supplier and is closed.': 'رفض المورد هذا الإرجاع وتم إغلاقه.',
  'Nothing is refundable on this invoice: either nothing was paid, or it has all gone back already.':
    'لا يوجد ما يمكن استرداده من هذه الفاتورة: إما لم يُدفع شيء، أو أُعيد كل شيء بالفعل.',
  'At most {v1} can go back: the lesser of what was paid and what has been credited, less what has already been refunded.':
    'يمكن إعادة {v1} كحد أقصى: الأقل بين المدفوع والمقيد بإشعار دائن، مطروحًا منه ما استُرد بالفعل.',
  'A job that is {v1} cannot change status.': 'لا يمكن تغيير حالة عمل حالته «{v1}».',
  'A job cannot move from {v1} to {v2}. Permitted next steps: {v3}.':
    'لا يمكن نقل العمل من «{v1}» إلى «{v2}». الخطوات التالية المسموح بها: {v3}.',
  'This job type requires a passed quality check before it can be completed.':
    'يتطلب هذا النوع من العمل اجتياز فحص الجودة قبل إكماله.',
  'The customer has not approved the estimate yet.': 'لم يوافق العميل على عرض السعر بعد.',
  'This job has no chargeable lines, so there is nothing to invoice.':
    'لا يحتوي هذا العمل على بنود قابلة للفوترة، لذا لا يوجد ما يُفوتر.',
  'This quote has already been sent. If the price has changed, raise a new version rather than sending the old one twice.':
    'تم إرسال عرض السعر هذا بالفعل. إذا تغيّر السعر، فأنشئ نسخة جديدة بدلًا من إرسال القديمة مرة ثانية.',
  'This quote is {v1} and cannot be sent again.':
    'حالة عرض السعر هذا «{v1}» ولا يمكن إرساله مرة أخرى.',
  'A photograph is a picture from the camera: JPEG, PNG, WebP or HEIC.':
    'الصورة لقطة من الكاميرا: JPEG أو PNG أو WebP أو HEIC.',
  'A document is a PDF or a picture of the paper: JPEG, PNG, WebP or HEIC.':
    'المستند ملف PDF أو صورة للورقة: JPEG أو PNG أو WebP أو HEIC.',
  'This invoice is already paid.': 'هذه الفاتورة مدفوعة بالفعل.',
  'This invoice is not open for payment.': 'هذه الفاتورة غير متاحة للدفع.',
  'The provider has no record of {v1}.': 'لا يوجد لدى مزوّد الدفع سجل لـ {v1}.',
  'We recorded {v1}; the provider says {v2}.': 'سجّلنا {v1}؛ ويفيد مزوّد الدفع بـ {v2}.',
  'The provider says {v1} minor units were paid; nothing is recorded here.':
    'يفيد مزوّد الدفع بأنه دُفعت {v1} وحدة صغرى؛ ولا شيء مسجل هنا.',
  'We recorded {v1} minor units; the provider says {v2}.':
    'سجّلنا {v1} وحدة صغرى؛ ويفيد مزوّد الدفع بـ {v2}.',
  'Started {v1} hours ago and the provider still says pending.':
    'بدأت قبل {v1} ساعة ولا يزال مزوّد الدفع يفيد بأنها معلقة.',
  'No card payment through the provider paid this invoice.':
    'لم تُسدَّد هذه الفاتورة بأي دفعة بطاقة عبر مزوّد الدفع.',
  'No single card payment on this invoice has that much left to send back.':
    'لا توجد دفعة بطاقة واحدة على هذه الفاتورة يتبقى منها ما يكفي لإعادة هذا المبلغ.',
  'This timesheet has been paid. Correct it with an adjustment on the next period rather than by editing this one.':
    'تم دفع جدول الدوام هذا. صحّحه بتسوية في الفترة التالية بدلًا من تعديله.',
  'A timesheet cannot go from {v1} to {v2}.': 'لا يمكن نقل جدول الدوام من «{v1}» إلى «{v2}».',
  'The company needs a name.': 'يجب أن يكون للشركة اسم.',
  'A first or last name, at least. It goes on the invoice.':
    'اسم أول أو اسم عائلة على الأقل. يظهر على الفاتورة.',
  'No jobs for this fleet in that month.': 'لا توجد أعمال لهذا الأسطول في ذلك الشهر.',
  'Nothing to invoice for that month: {v1}.': 'لا يوجد ما يُفوتر لذلك الشهر: {v1}.',
  'Thank you. If you have a moment, saying so publicly helps other people find a workshop they can trust.':
    'شكرًا لك. إن كان لديك وقت، فمشاركة رأيك علنًا تساعد الآخرين على إيجاد ورشة يثقون بها.',
  'Thank you. If there was something that would have made it a five, we would genuinely like to know.':
    'شكرًا لك. إن كان هناك ما كان سيجعل تقييمك خمسة، فنحن نود معرفته حقًا.',
  'Thank you for saying so. Somebody here will read this today and get in touch. We would rather put it right than leave it.':
    'شكرًا لإخبارنا. سيقرأ أحد فريقنا هذا اليوم وسيتواصل معك. نفضّل إصلاح الأمر على تركه.',
  'This bay already has {v1} at that time.': 'لدى هذه المنصة بالفعل {v1} في ذلك الوقت.',
  'That technician is already assigned to another job at that time.':
    'هذا الفني مكلّف بالفعل بعمل آخر في ذلك الوقت.',
  'That technician is not available on this day.': 'هذا الفني غير متاح في هذا اليوم.',
  'This would put the day at {v1} hours against a capacity of {v2} hours.':
    'سيصل اليوم بذلك إلى {v1} ساعة مقابل سعة {v2} ساعة.',
  'This is the only owner. Make somebody else an owner first, or nobody can administer the workshop.':
    'هذا هو المالك الوحيد. اجعل شخصًا آخر مالكًا أولًا، وإلا فلن يتمكن أحد من إدارة الورشة.',
  'This is the only owner, so their role cannot be lowered. Promote somebody else first.':
    'هذا هو المالك الوحيد، لذا لا يمكن خفض دوره. رقِّ شخصًا آخر أولًا.',
  'This reading is {v1} km lower than the previous one ({v2} km on {v3}). It has been recorded and flagged.':
    'هذه القراءة أقل بـ {v1} كم من السابقة ({v2} كم في {v3}). تم تسجيلها ووضع علامة عليها.',
  'This implies {v1} km per day since the previous reading, which is unusually high. It has been recorded and flagged.':
    'هذا يعني {v1} كم يوميًا منذ القراءة السابقة، وهو معدل مرتفع على نحو غير معتاد. تم تسجيل القراءة ووضع علامة عليها.',
  'a booking': 'حجز',
  '{v1} bookings': '{v1} حجوزات',
  '{v1} raises this.': 'خطة {v1} ترفع هذا الحد.',
  'Talk to us about a bespoke plan.': 'تواصل معنا بشأن خطة مخصصة.',
  'staff accounts': 'حسابات الموظفين',
  sites: 'الفروع',
  bays: 'المنصات',
  vehicles: 'المركبات',
  // Phase 41: tax, configurable.
  'Name the rate the way it appears on an invoice: "VAT 20%", "GST and PST".':
    'سمِّ المعدل كما يظهر في الفاتورة: «ضريبة القيمة المضافة 20%»، «ضريبتان اتحادية وإقليمية».',
  'A rate needs at least one tax, even if it is at 0%.':
    'يحتاج المعدل إلى ضريبة واحدة على الأقل، ولو بنسبة 0%.',
  'A rate carries at most {v1} taxes.': 'يحمل المعدل {v1} ضرائب كحد أقصى.',
  'Name tax {v1} as the authority names it: "GST", "PST".':
    'سمِّ الضريبة {v1} كما تسميها الجهة المختصة.',
  '{v1} must be a percentage from 0 to 100.': 'يجب أن تكون {v1} نسبة مئوية بين 0 و100.',
  '{v1} is on this rate twice.': '{v1} مذكورة مرتين في هذا المعدل.',
  '{v1} is the first tax, so there is nothing before it to be charged on.':
    '{v1} هي الضريبة الأولى، فلا شيء قبلها لتُحتسب فوقه.',
  'An exempt customer needs the certificate or registration number that makes them exempt. It is printed on every invoice to them.':
    'يحتاج العميل المعفى إلى رقم الشهادة أو التسجيل الذي يثبت إعفاءه. يُطبع على كل فاتورة تصدر له.',
  'Choose at least one part to print a label for.': 'اختر قطعة واحدة على الأقل لطباعة ملصق لها.',
  'That is {v1} labels. Print at most {v2} at a time.':
    'هذه {v1} ملصقات. اطبع {v2} كحد أقصى في كل مرة.',

  // Asked twice. Phase 46.
  'That referral has already been paid.': 'تم دفع هذه الإحالة بالفعل.',
  'That is already going through. Give it a moment rather than pressing again.':
    'هذا قيد التنفيذ بالفعل. امهله لحظة بدلًا من الضغط مرة أخرى.',
};
