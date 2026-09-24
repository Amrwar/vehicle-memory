/**
 * Shared components and the UI package.
 *
 * Keys are the English exactly as written in the product. Slots in braces
 * are kept as they are. Phase 40.5.
 *
 * Order matters for keys with slots whose longest fixed piece is the same
 * (the sync summaries): the key with more pieces comes first, so a finished
 * sentence is read back through the key that fits all of it.
 */

export const fr: Readonly<Record<string, string>> = {
  // Job statuses as the offline sync sentence writes them, lower case.
  booked: 'réservé',
  inspecting: 'en inspection',
  diagnosed: 'diagnostiqué',
  estimated: 'chiffré',
  'awaiting approval': 'en attente d’accord',
  'quality check': 'contrôle qualité',
  invoiced: 'facturé',

  // Access notice, and the permissions it names.
  'That page needs {permission}, which your role does not carry. You have been brought back to your own workspace. Ask an owner or manager if you need it.':
    'Cette page nécessite {permission}, que votre rôle n’inclut pas. Vous avez été ramené à votre propre espace. Demandez à un propriétaire ou à un responsable si vous en avez besoin.',
  'permission to view {subject}': 'l’autorisation de consulter {subject}',
  'permission to change {subject}': 'l’autorisation de modifier {subject}',
  'permission to approve {subject}': 'l’autorisation d’approuver {subject}',
  'permission to send {subject}': 'l’autorisation d’envoyer {subject}',
  'permission to see financial reporting': 'l’autorisation de voir les rapports financiers',
  'permission to see operational reporting': 'l’autorisation de voir les rapports d’activité',
  'the {permission} permission': 'l’autorisation {permission}',
  'the booking diary': 'l’agenda des rendez-vous',
  'employee records': 'les fiches employés',
  payroll: 'la paie',
  'stock transfers': 'les transferts de stock',
  'customer records': 'les fiches clients',
  'vehicle records': 'les fiches véhicules',
  jobs: 'les travaux',
  inspections: 'les contrôles',
  estimates: 'les devis',
  invoices: 'les factures',
  payments: 'les paiements',
  'time entries': 'les saisies de temps',
  'quality checks': 'les contrôles qualité',
  reporting: 'les rapports',
  'the general ledger': 'le grand livre',
  'the parts catalogue': 'le catalogue de pièces',
  purchasing: 'les achats',
  'the vehicle passport': 'le passeport du véhicule',
  settings: 'les réglages',
  'the audit log': 'le journal d’audit',
  'the organisation': 'l’organisation',
  'user accounts': 'les comptes utilisateurs',

  // Roles.
  Owner: 'Propriétaire',
  Manager: 'Responsable',
  'Service advisor': 'Conseiller de service',
  Bookkeeper: 'Comptable',

  // Small controls.
  Back: 'Retour',
  Print: 'Imprimer',
  'Print the receipt': 'Imprimer le reçu',
  Loading: 'Chargement',
  'Getting this from the workshop': 'Récupération auprès de l’atelier',
  // The other loading boundaries, Phase 55: the customer's own side, the
  // shared links a person opens on a telephone, and the operator's pages.
  'Getting your records': 'Récupération de vos documents',
  'Opening this vehicle’s history': 'Ouverture de l’historique du véhicule',
  'Opening your quote': 'Ouverture de votre devis',
  'One moment': 'Un instant',
  'Working out the condition of this vehicle': 'Évaluation de l’état de ce véhicule',
  'Colour theme': 'Thème de couleur',
  Light: 'Clair',
  Auto: 'Auto',
  Dark: 'Sombre',
  'A line drawing of a car stopped at the end of a road, resting on a flat tyre':
    'Dessin au trait d’une voiture arrêtée au bout d’une route, posée sur un pneu à plat',
  'The road stops here': 'La route s’arrête ici',

  // Uploads and photographs.
  'Sending…': 'Envoi…',
  'Add photos ({count} so far)': 'Ajouter des photos ({count} pour l’instant)',
  'Photograph the car': 'Photographier la voiture',
  'Photo ({count})': 'Photo ({count})',
  'Take a photo': 'Prendre une photo',
  'The store would not take it.': 'Le stockage ne l’a pas accepté.',
  'The store refused the file ({status}).': 'Le stockage a refusé le fichier ({status}).',
  'Uploaded, but not recorded.': 'Envoyé, mais pas enregistré.',
  'That did not upload.': 'L’envoi n’a pas abouti.',
  'Choose a file first.': 'Choisissez d’abord un fichier.',
  'Not removed.': 'Non supprimé.',
  'Registration certificate': 'Certificat d’immatriculation',
  'MOT certificate': 'Certificat de contrôle technique',
  Insurance: 'Assurance',
  'Service record': 'Carnet d’entretien',
  'Purchase invoice': 'Facture d’achat',
  Other: 'Autre',
  'What it is': 'De quoi il s’agit',
  Title: 'Titre',
  'Front bumper before repair': 'Pare-chocs avant avant réparation',
  'MOT certificate 2026': 'Contrôle technique 2026',
  Reference: 'Référence',
  '(optional)': '(facultatif)',
  'Policy or certificate number': 'Numéro de police ou de certificat',
  'Runs out on': 'Expire le',
  File: 'Fichier',
  '(PDF or a picture, up to 12MB)': '(PDF ou image, jusqu’à 12 Mo)',
  'Add to the vehicle': 'Ajouter au véhicule',
  '{name} added.': '{name} ajouté.',
  Remove: 'Supprimer',
  'Removing…': 'Suppression…',
  'Why? Kept on the record.': 'Pourquoi ? Conservé dans le registre.',
  'Reason for removing': 'Motif de la suppression',
  Keep: 'Conserver',

  // Diary board.
  Move: 'Déplacer',
  'Drag a card to another bay, or use Move on the card. A clash is refused and says why.':
    'Faites glisser une carte vers un autre poste, ou utilisez Déplacer sur la carte. Un conflit est refusé, avec la raison.',
  'Drag a card to another person, or use Move on the card. A clash is refused and says why.':
    'Faites glisser une carte vers une autre personne, ou utilisez Déplacer sur la carte. Un conflit est refusé, avec la raison.',

  // Signature.
  'Signature pad': 'Zone de signature',
  'Sign here': 'Signez ici',
  'Signed. Clear to start again.': 'Signé. Effacez pour recommencer.',
  'A finger, a stylus or a mouse all work.': 'Un doigt, un stylet ou une souris conviennent.',
  Clear: 'Effacer',
  Signature: 'Signature',

  // Health dial.
  'Not enough on record to score this vehicle.':
    'Pas assez d’informations enregistrées pour évaluer ce véhicule.',
  'Health {score} out of 100, which is {band}.': 'Santé : {score} sur 100, niveau {band}.',
  excellent: 'excellent',
  good: 'bon',
  fair: 'moyen',
  poor: 'faible',
  'not scored': 'non évalué',

  // Estimate review.
  'A quote for your {vehicle}': 'Un devis pour votre {vehicle}',
  'A quote for your vehicle': 'Un devis pour votre véhicule',
  'That did not go through': 'Cela n’a pas abouti',
  'This quote is closed': 'Ce devis est clos',
  'This quote is closed.': 'Ce devis est clos.',
  'You can call them on {phone}.': 'Vous pouvez les appeler au {phone}.',
  'What we recommend': 'Ce que nous recommandons',
  'Tick what you would like done. Anything left unticked will not be carried out.':
    'Cochez ce que vous souhaitez faire réaliser. Ce qui n’est pas coché ne sera pas effectué.',
  safety: 'sécurité',
  optional: 'facultatif',
  'The technician noted: {note}': 'Le technicien a noté : {note}',
  'Before tax, if you take everything': 'Hors taxes, si vous prenez tout',
  Tax: 'Taxe',
  Total: 'Total',
  'You will only be charged for what you tick.': 'Seul ce que vous cochez vous sera facturé.',
  'This price holds until {date}.': 'Ce prix est valable jusqu’au {date}.',
  'From the workshop': 'De la part de l’atelier',
  'So the workshop knows who agreed to the work.':
    'Pour que l’atelier sache qui a accepté les travaux.',
  'Anything to add?': 'Quelque chose à ajouter ?',
  'Optional.': 'Facultatif.',
  'Sending this tells the workshop exactly which items to carry out. Anything you have left unticked will not be done, and will stay on the vehicle’s record as recommended work that was turned down.':
    'En envoyant ceci, vous indiquez à l’atelier exactement quels éléments réaliser. Ce que vous n’avez pas coché ne sera pas fait, et restera dans le registre du véhicule comme travail recommandé refusé.',
  'Send my answer': 'Envoyer ma réponse',

  // Outbox.
  Connected: 'Connecté',
  'No signal. Carry on; nothing is lost.': 'Pas de réseau. Continuez ; rien n’est perdu.',
  '{waiting} waiting to send, {problems} needing a decision':
    '{waiting} en attente d’envoi, {problems} demandant une décision',
  '{waiting} waiting to send': '{waiting} en attente d’envoi',
  'Send now': 'Envoyer maintenant',
  'Could not reach the workshop. Everything is still here.':
    'Impossible de joindre l’atelier. Tout est toujours ici.',
  'Refused.': 'Refusé.',
  'Nothing was waiting.': 'Rien n’était en attente.',
  '{applied} saved, {duplicates} already here, {conflicts} needs a decision, kept on the device.':
    '{applied} enregistrés, {duplicates} déjà présents, {conflicts} demande une décision, conservé sur l’appareil.',
  '{applied} saved, {duplicates} already here, {conflicts} need a decision, kept on the device.':
    '{applied} enregistrés, {duplicates} déjà présents, {conflicts} demandent une décision, conservés sur l’appareil.',
  '{applied} saved, {conflicts} needs a decision, kept on the device.':
    '{applied} enregistrés, {conflicts} demande une décision, conservé sur l’appareil.',
  '{applied} saved, {conflicts} need a decision, kept on the device.':
    '{applied} enregistrés, {conflicts} demandent une décision, conservés sur l’appareil.',
  '{duplicates} already here, {conflicts} needs a decision, kept on the device.':
    '{duplicates} déjà présents, {conflicts} demande une décision, conservé sur l’appareil.',
  '{duplicates} already here, {conflicts} need a decision, kept on the device.':
    '{duplicates} déjà présents, {conflicts} demandent une décision, conservés sur l’appareil.',
  '{conflicts} needs a decision, kept on the device.':
    '{conflicts} demande une décision, conservé sur l’appareil.',
  '{conflicts} need a decision, kept on the device.':
    '{conflicts} demandent une décision, conservés sur l’appareil.',
  '{applied} saved, {duplicates} already here.':
    '{applied} enregistrés, {duplicates} déjà présents.',
  '{applied} saved.': '{applied} enregistrés.',
  'That job is no longer here.': 'Ce travail n’est plus ici.',
  'Nothing knows how to apply that.': 'Rien ne sait appliquer cela.',
  'That could not be read.': 'Cela n’a pas pu être lu.',
  'That could not be saved. It is still on the device.':
    'Cela n’a pas pu être enregistré. C’est toujours sur l’appareil.',
  'This job was invoiced while the device was offline. Nothing can be added to it now without reissuing the bill, so somebody has to decide.':
    'Ce travail a été facturé pendant que l’appareil était hors ligne. Rien ne peut plus y être ajouté sans réémettre la facture : quelqu’un doit décider.',
  'This inspection was completed and sent to the customer while the device was offline. A finding recorded now would change a document they have already read.':
    'Ce contrôle a été terminé et envoyé au client pendant que l’appareil était hors ligne. Un constat enregistré maintenant modifierait un document qu’il a déjà lu.',
  'The job moved to {from} while the device was offline, and it cannot go from there to {to}.':
    'Le travail est passé à « {from} » pendant que l’appareil était hors ligne, et il ne peut pas passer de là à « {to} ».',

  // Plan wall.
  'Not on this plan': 'Pas dans cette formule',
  '{feature} is not part of {plan}': 'La formule {plan} ne comprend pas {feature}',
  'It comes with {plan}, at £{price} per bay per month billed annually. Everything already in {current} stays exactly as it is.':
    'C’est inclus dans {plan}, à {price} £ par poste et par mois, facturé annuellement. Tout ce qui est déjà dans {current} reste exactement tel quel.',
  '{plan} adds': '{plan} ajoute',
  'This is not available on any plan yet.': 'Ce n’est encore disponible dans aucune formule.',
  'Compare plans': 'Comparer les formules',
  'Back to the workshop': 'Retour à l’atelier',
  'Nothing you have recorded is affected by which plan you are on. The work, the invoices and every vehicle passport stay where they are.':
    'Rien de ce que vous avez enregistré ne dépend de votre formule. Les travaux, les factures et chaque passeport de véhicule restent où ils sont.',
  'digital inspections': 'les contrôles numériques',
  'estimates and approvals': 'les devis et les approbations',
  'purchase orders': 'les bons de commande',
  'financial statements': 'les états financiers',
  'timesheets and payroll': 'les feuilles de temps et la paie',
  'commission schemes': 'les régimes de commission',
  'more than one site': 'plus d’un site',
  'stock transfers between sites': 'les transferts de stock entre sites',
  'the API': 'l’API',
  'single sign-on': 'l’authentification unique',
  'Diary, jobs, inspections and estimates': 'Agenda, travaux, contrôles et devis',
  'Vehicle passport on every car you touch':
    'Passeport du véhicule sur chaque voiture que vous traitez',
  'Invoicing, payments and parts': 'Facturation, paiements et pièces',
  'Customer portal': 'Portail client',
  'Everything in Core': 'Tout ce qui est dans Core',
  'Double-entry ledger, posted from the work itself':
    'Comptabilité en partie double, passée à partir du travail lui-même',
  'Profit and loss, balance sheet, VAT position': 'Compte de résultat, bilan, position de TVA',
  'Purchase orders and three-way bill matching':
    'Bons de commande et rapprochement des factures à trois voies',
  'Timesheets, pay history and commission': 'Feuilles de temps, historique de paie et commissions',
  'Everything in Complete, at every site': 'Tout ce qui est dans Complete, sur chaque site',
  'Consolidated reporting that carries its spread':
    'Rapports consolidés qui conservent leur dispersion',
  'Stock transfers, with what is on the road counted':
    'Transferts de stock, en comptant ce qui est en route',
  'Per-site permissions and single sign-on': 'Autorisations par site et authentification unique',

  // Sign-up pricing.
  Country: 'Pays',
  'Sets the currency you are billed in and keep your books in ({currency}), the language and the clock. Changeable in settings.':
    'Définit la monnaie de facturation et de votre comptabilité ({currency}), la langue et le format horaire. Modifiable dans les réglages.',
  Plan: 'Formule',
  'Changeable at any point during the trial': 'Modifiable à tout moment pendant l’essai',
  '{plan} — {price} per bay, per month, paid monthly':
    '{plan} — {price} par poste, par mois, payé mensuellement',
  'I have read the {terms}.': 'J’ai lu les {terms}.',
  terms: 'conditions',
  'The trial is free for {days} days. On the day it ends, the card I add next is charged {price} per bay per month for the {plan} plan, in {currency}, and monthly after that, unless I cancel before then. I can cancel at any time from Settings.':
    'L’essai est gratuit pendant {days} jours. Le jour où il se termine, la carte que j’ajoute ensuite est prélevée de {price} par poste et par mois pour la formule {plan}, en {currency}, puis chaque mois, sauf si je résilie avant. Je peux résilier à tout moment depuis les Réglages.',
  'United Kingdom': 'Royaume-Uni',
  Ireland: 'Irlande',
  Canada: 'Canada',
  'United States': 'États-Unis',
  Australia: 'Australie',
  'New Zealand': 'Nouvelle-Zélande',
  France: 'France',
  Germany: 'Allemagne',
  Netherlands: 'Pays-Bas',
  Belgium: 'Belgique',
  Spain: 'Espagne',
  Portugal: 'Portugal',
  Italy: 'Italie',
  'United Arab Emirates': 'Émirats arabes unis',
  'Saudi Arabia': 'Arabie saoudite',
  Egypt: 'Égypte',
  'South Africa': 'Afrique du Sud',
  India: 'Inde',

  // Verification banner.
  'A confirmation link is on its way to {email}. It lasts three days.':
    'Un lien de confirmation est en route vers {email}. Il est valable trois jours.',
  'Your email address has not been confirmed yet. Until it is, we cannot tell you when a message to a customer bounces.':
    'Votre adresse e-mail n’est pas encore confirmée. Tant qu’elle ne l’est pas, nous ne pouvons pas vous prévenir quand un message à un client est rejeté.',
  'Your email address still has not been confirmed. Anything sent on your behalf may be treated as spam, and you will not hear about it.':
    'Votre adresse e-mail n’est toujours pas confirmée. Tout ce qui est envoyé en votre nom risque d’être traité comme spam, sans que vous le sachiez.',

  // The passport booklet on the home page.
  'The vehicle': 'Le véhicule',
  Type: 'Type',
  'Make and model': 'Marque et modèle',
  Year: 'Année',
  Registration: 'Immatriculation',
  VIN: 'VIN',
  'Owners on record': 'Propriétaires enregistrés',
  Entries: 'Entrées',
  Contradiction: 'Contradiction',
  Advisory: 'Recommandation',
  Recorded: 'Enregistré',
  'Issued to the vehicle, not the owner': 'Délivré au véhicule, pas au propriétaire',
  'Every workshop that services this car writes to the same pages. Sell it and the pages go with it.':
    'Chaque atelier qui entretient cette voiture écrit sur les mêmes pages. Vendez-la et les pages partent avec elle.',
  'Close the passport': 'Fermer le passeport',
  'Drag the car to turn it. Tap a mark to read the entry.':
    'Faites glisser la voiture pour la tourner. Touchez une marque pour lire l’entrée.',
  'A real vehicle, and its real record.': 'Un vrai véhicule, et son vrai registre.',
  'Entries on the demonstration vehicle': 'Entrées du véhicule de démonstration',
  'Full service, 58,940 miles': 'Révision complète, 58 940 miles',
  'Oil, filters and a 30-point inspection. Written to the chain the moment the job closed, and readable by every workshop the car visits afterwards.':
    'Huile, filtres et contrôle en 30 points. Inscrit dans la chaîne dès la clôture du travail, et lisible par chaque atelier que la voiture visite ensuite.',
  'Nearside front tyre at 2.4mm': 'Pneu avant côté trottoir à 2,4 mm',
  'Recorded as an advisory rather than sold as urgent. The next garage sees the measurement, not somebody else’s opinion of it.':
    'Enregistré comme recommandation plutôt que vendu comme urgent. Le garage suivant voit la mesure, pas l’avis de quelqu’un d’autre à son sujet.',
  'Mar 2024': 'mars 2024',
  'Rear pads replaced': 'Plaquettes arrière remplacées',
  'Quoted from an inspection, approved by the customer line by line from a text message, and fitted the same afternoon.':
    'Chiffré à partir d’un contrôle, approuvé par le client ligne par ligne depuis un SMS, et posé le même après-midi.',
  'Sep 2024': 'sept. 2024',
  'The odometer went backwards': 'Le compteur a reculé',
  'It read 67,410 in April and 62,000 in September. Every reading since has been consistent, so a garage comparing its own last two sees nothing wrong. Only the whole sequence shows it.':
    'Il affichait 67 410 en avril et 62 000 en septembre. Chaque relevé depuis est cohérent, donc un garage qui compare ses deux derniers ne voit rien d’anormal. Seule la séquence entière le montre.',
  'Recorded between owners': 'Enregistré entre deux propriétaires',

  // UI package.
  'Workshop capacity used': 'Capacité de l’atelier utilisée',
  Flagged: 'Signalé',
  'Lower than a previously recorded reading': 'Inférieur à un relevé précédent',
  'Implies an unusually high daily distance':
    'Suppose une distance quotidienne anormalement élevée',
  Pass: 'Conforme',
  Critical: 'Critique',
  'Not checked': 'Non vérifié',
  '(skipped)': '(ignorée)',
  '(current stage)': '(étape en cours)',
  'Reported by the vehicle owner': 'Déclaré par le propriétaire du véhicule',
  'Recorded by a workshop during work': 'Enregistré par un atelier pendant les travaux',
  Evidenced: 'Preuves à l’appui',
  'Recorded by a workshop with photographic evidence':
    'Enregistré par un atelier avec preuves photographiques',
  Official: 'Officiel',
  'Supplied by a registry, manufacturer or insurer':
    'Fourni par un registre, un constructeur ou un assureur',
  Superseded: 'Remplacé',
  'History intact': 'Historique intact',
  'History integrity check failed': 'Échec du contrôle d’intégrité de l’historique',
  Chain: 'Chaîne',
  'A record that belongs to the car': 'Un registre qui appartient à la voiture',
  Page: 'Page',
  'Page {number}': 'Page {number}',
  'Machine readable zone': 'Zone de lecture automatique',
  'Seal: history intact': 'Sceau : historique intact',
  'Seal: history broken': 'Sceau : historique rompu',
  'History broken': 'Historique rompu',

  // The vehicle passport.
  'Particulars of the vehicle': 'Caractéristiques du véhicule',
  Code: 'Code',
  'Passport number': 'Numéro de passeport',
  'Vehicle identification number': 'Numéro d’identification du véhicule',
  Make: 'Marque',
  Model: 'Modèle',
  'First registered': 'Première immatriculation',
  'Entries on record': 'Entrées enregistrées',
  'Workshops contributing': 'Ateliers contributeurs',
  'Latest odometer': 'Dernier relevé du compteur',
  'Mileage anomalies': 'Anomalies de kilométrage',
  '1 contradiction': '1 contradiction',
  '{count} contradictions': '{count} contradictions',
  None: 'Aucune',
  'Open recalls': 'Rappels en cours',
  'This record is append-only. Each entry is linked to the one before it, so an entry cannot be altered or removed without breaking the chain. The seal recomputes it.':
    'Ce registre fonctionne en ajout seulement. Chaque entrée est liée à la précédente : une entrée ne peut être modifiée ou supprimée sans rompre la chaîne. Le sceau la recalcule.',
  Observations: 'Observations',
  'What this record amounts to': 'Ce que vaut ce registre',
  'What it does not cover': 'Ce qu’il ne couvre pas',
  'Worth asking the seller': 'À demander au vendeur',
  'What a buyer will ask': 'Ce qu’un acheteur demandera',
  'Who has owned it': 'Qui l’a possédé',
  'Owner {position}, kept it {months} month and still has it.':
    'Propriétaire {position}, l’a gardé {months} mois et l’a toujours.',
  'Owner {position}, kept it {months} month.': 'Propriétaire {position}, l’a gardé {months} mois.',
  'Owner {position}, kept it {months} months and still has it.':
    'Propriétaire {position}, l’a gardé {months} mois et l’a toujours.',
  'Owner {position}, kept it {months} months.': 'Propriétaire {position}, l’a gardé {months} mois.',
  'Owner {position}, kept it {years} years and still has it.':
    'Propriétaire {position}, l’a gardé {years} ans et l’a toujours.',
  'Owner {position}, kept it {years} years.': 'Propriétaire {position}, l’a gardé {years} ans.',
  'No ownership on record.': 'Aucune propriété enregistrée.',
  'No owner is named on these pages, past or present. That is theirs, not the vehicle’s.':
    'Aucun propriétaire, passé ou actuel, n’est nommé sur ces pages. Cela leur appartient, pas au véhicule.',
  'Outstanding recall': 'Rappel en cours',
  Mileage: 'Kilométrage',
  'No entries have been recorded for this vehicle yet. The pages are blank, and that is itself the record.':
    'Aucune entrée n’a encore été enregistrée pour ce véhicule. Les pages sont vierges, et c’est cela même le registre.',
  'Entries · {year}': 'Entrées · {year}',
  'Newest first. Each stamp names who pressed it and how well evidenced the entry is.':
    'Les plus récentes d’abord. Chaque tampon indique qui l’a apposé et le niveau de preuve de l’entrée.',
  Manufacturer: 'Constructeur',
  Registry: 'Registre',
  'The owner': 'Le propriétaire',
  Ownership: 'Propriété',
  Service: 'Entretien',
  Repair: 'Réparation',
  Part: 'Pièce',
  Inspection: 'Contrôle',
  Tires: 'Pneus',
  Accident: 'Accident',
  'Recall issued': 'Rappel émis',
  'Recall done': 'Rappel effectué',
  Modification: 'Modification',
  Maintenance: 'Maintenance',
  Import: 'Importation',
  'Write-off': 'Épave',
  Note: 'Note',

  // What the record says (from the passport report).
  'Do not rely on this record.': 'Ne vous fiez pas à ce registre.',
  'The record is intact, and it has things in it to ask about.':
    'Le registre est intact, et il contient des points à éclaircir.',
  'There is nothing on record for this vehicle.': 'Rien n’est enregistré pour ce véhicule.',
  'A full record, intact, with nothing outstanding on it.':
    'Un registre complet, intact, sans rien en suspens.',
  'Intact, but thin. Read what it does not cover as carefully as what it does.':
    'Intact, mais mince. Lisez ce qu’il ne couvre pas aussi attentivement que ce qu’il couvre.',
  'The record starts in {start}, and the vehicle was first registered in {registered}. About {count} year before that is not covered here at all.':
    'Le registre commence en {start}, et le véhicule a été immatriculé pour la première fois en {registered}. Environ {count} an avant cela n’est pas couvert du tout.',
  'The record starts in {start}, and the vehicle was first registered in {registered}. About {count} years before that is not covered here at all.':
    'Le registre commence en {start}, et le véhicule a été immatriculé pour la première fois en {registered}. Environ {count} ans avant cela ne sont pas couverts du tout.',
  'Nothing is recorded for this vehicle yet.': 'Rien n’est encore enregistré pour ce véhicule.',
  'No service has been recorded, which is not the same as none having been done.':
    'Aucun entretien n’a été enregistré, ce qui ne veut pas dire qu’aucun n’a été fait.',
  'Nothing here was inspected by a workshop, so the condition of the vehicle is not part of this record.':
    'Rien ici n’a été contrôlé par un atelier : l’état du véhicule ne fait donc pas partie de ce registre.',
  'This covers what participating workshops recorded. Work done elsewhere, or by the owner, does not appear.':
    'Ceci couvre ce que les ateliers participants ont enregistré. Les travaux faits ailleurs, ou par le propriétaire, n’apparaissent pas.',
  '{count} critical item was found and has not been recorded as put right. Ask for the invoice, not a description.':
    '{count} point critique a été relevé et n’est pas enregistré comme réparé. Demandez la facture, pas une description.',
  '{count} critical items were found and have not been recorded as put right. Ask for the invoice, not a description.':
    '{count} points critiques ont été relevés et ne sont pas enregistrés comme réparés. Demandez la facture, pas une description.',
  '{count} manufacturer recall shows as outstanding. A franchised dealer does these free; ask whether it has been done and is simply unrecorded.':
    '{count} rappel constructeur apparaît en cours. Un concessionnaire agréé le fait gratuitement ; demandez s’il a été fait sans être enregistré.',
  '{count} manufacturer recalls shows as outstanding. A franchised dealer does these free; ask whether it has been done and is simply unrecorded.':
    '{count} rappels constructeur apparaissent en cours. Un concessionnaire agréé les fait gratuitement ; demandez s’ils ont été faits sans être enregistrés.',
  '{count} odometer reading did not follow the one before it. That has innocent explanations, and it also has one that is not. Ask.':
    '{count} relevé du compteur ne suit pas le précédent. Il y a des explications innocentes, et une qui ne l’est pas. Demandez.',
  '{count} odometer readings did not follow the one before it. That has innocent explanations, and it also has one that is not. Ask.':
    '{count} relevés du compteur ne suivent pas le précédent. Il y a des explications innocentes, et une qui ne l’est pas. Demandez.',
  'The last recorded service was {date}. Ask what has been done since and where.':
    'Le dernier entretien enregistré date de {date}. Demandez ce qui a été fait depuis, et où.',
  '{count} owners is a lot for one vehicle. Not a fault in itself, and worth a question.':
    '{count} propriétaires, c’est beaucoup pour un véhicule. Ce n’est pas un défaut en soi, mais cela mérite une question.',

  // The mileage record.
  'The mileage record': 'Le registre kilométrique',
  'Checked across every workshop that has recorded a reading. {count} on file.':
    'Vérifié auprès de chaque atelier ayant enregistré un relevé. {count} au dossier.',
  arithmetic: 'calcul',
  likely: 'probable',
  'worth asking': 'à demander',
  'About the record itself': 'À propos du registre lui-même',
  'This checks the readings against each other. It cannot see mileage covered while nobody was writing anything down, and it is not a warranty.':
    'Ceci compare les relevés entre eux. Cela ne peut pas voir les kilomètres parcourus quand personne ne notait rien, et ce n’est pas une garantie.',
  'The mileage record contradicts itself. One reading is impossible given the others.':
    'Le registre kilométrique se contredit. Un relevé est impossible au vu des autres.',
  'The mileage record contradicts itself. {count} readings are impossible given the others.':
    'Le registre kilométrique se contredit. {count} relevés sont impossibles au vu des autres.',
  'Nothing in the record is impossible, but there is one thing worth asking about.':
    'Rien dans le registre n’est impossible, mais un point mérite une question.',
  'Nothing in the record is impossible, but there are {count} things worth asking about.':
    'Rien dans le registre n’est impossible, mais {count} points méritent une question.',
  'Too few readings to say much. One reading on record.':
    'Trop peu de relevés pour en dire beaucoup. Un relevé enregistré.',
  'Too few readings to say much. {count} readings on record.':
    'Trop peu de relevés pour en dire beaucoup. {count} relevés enregistrés.',
  'Nothing inconsistent across {count} readings. That is as much as the record can show; it cannot speak for time nobody wrote anything down.':
    'Rien d’incohérent sur {count} relevés. C’est tout ce que le registre peut montrer ; il ne peut rien dire du temps où personne n’a rien noté.',
  'The odometer read {lost} fewer miles on {later} than it had on {earlier}.':
    'Le compteur affichait {lost} miles de moins le {later} que le {earlier}.',
  'The reading fell from {high} to {low}, then later rose above the earlier figure again. Because the most recent readings are consistent with each other, a check that only compares the last two would show nothing wrong.':
    'Le relevé est passé de {high} à {low}, puis est remonté au-dessus du chiffre précédent. Comme les relevés les plus récents sont cohérents entre eux, une vérification qui ne compare que les deux derniers ne montrerait rien d’anormal.',
  'The reading fell from {high} to {low}. An odometer does not go backwards on its own. Either the instrument cluster was replaced, which a workshop should have recorded, or the reading was altered.':
    'Le relevé est passé de {high} à {low}. Un compteur ne recule pas tout seul. Soit le combiné d’instruments a été remplacé, ce qu’un atelier aurait dû enregistrer, soit le relevé a été modifié.',
  '{rate} miles a day between {from} and {to}.':
    '{rate} miles par jour entre le {from} et le {to}.',
  'The reading rose by {distance} miles in {days} days. Sustained over that period it is not a distance a road vehicle covers, so one of the two readings is wrong.':
    'Le relevé a augmenté de {distance} miles en {days} jours. Soutenue sur cette période, ce n’est pas une distance qu’un véhicule routier parcourt : l’un des deux relevés est faux.',
  'Recent use is about {recent} miles a year, against {overall} over its life.':
    'L’usage récent est d’environ {recent} miles par an, contre {overall} sur toute sa vie.',
  'This is worth asking the seller about, and it is not evidence of anything on its own. A change of job, retirement, illness or a second car all produce exactly this pattern. So does an altered odometer.':
    'Cela mérite une question au vendeur, et ce n’est la preuve de rien à soi seul. Un changement d’emploi, la retraite, une maladie ou une seconde voiture produisent exactement ce profil. Un compteur trafiqué aussi.',
  'Two workshops recorded readings {gap} miles apart within a fortnight.':
    'Deux ateliers ont enregistré des relevés distants de {gap} miles en moins de quinze jours.',
  '{first} recorded {firstReading} on {firstDate} and {second} recorded {secondReading} on {secondDate}. One of them is wrong, and a typed digit is the most common reason.':
    '{first} a enregistré {firstReading} le {firstDate} et {second} a enregistré {secondReading} le {secondDate}. L’un des deux est faux, et un chiffre mal saisi en est la cause la plus courante.',
  'One workshop': 'Un atelier',
  another: 'un autre',
  'Nothing recorded between {from} and {to}.': 'Rien d’enregistré entre le {from} et le {to}.',
  'A gap of about {months} months. This says only that nobody wrote anything down, which is ordinary for a vehicle serviced outside the network. It is not a finding against the vehicle.':
    'Un intervalle d’environ {months} mois. Cela dit seulement que personne n’a rien noté, ce qui est courant pour un véhicule entretenu hors du réseau. Ce n’est pas un constat contre le véhicule.',
  'Nothing recorded since {date}.': 'Rien d’enregistré depuis le {date}.',
  'The most recent entry is about {months} months old, so the current mileage is unknown rather than unchanged.':
    'L’entrée la plus récente date d’environ {months} mois : le kilométrage actuel est donc inconnu, et non inchangé.',
};

export const ar: Readonly<Record<string, string>> = {
  booked: 'محجوز',
  inspecting: 'قيد الفحص',
  diagnosed: 'تم التشخيص',
  estimated: 'تم التسعير',
  'awaiting approval': 'بانتظار الموافقة',
  'quality check': 'فحص الجودة',
  invoiced: 'مفوتر',

  'Page {number}': 'الصفحة {number}',
  // Access notice, and the permissions it names.
  'That page needs {permission}, which your role does not carry. You have been brought back to your own workspace. Ask an owner or manager if you need it.':
    'تتطلب تلك الصفحة {permission}، ودورك لا يتضمنها. أُعدت إلى مساحة عملك. اطلبها من المالك أو المدير إن كنت تحتاجها.',
  'permission to view {subject}': 'صلاحية عرض {subject}',
  'permission to change {subject}': 'صلاحية تعديل {subject}',
  'permission to approve {subject}': 'صلاحية اعتماد {subject}',
  'permission to send {subject}': 'صلاحية إرسال {subject}',
  'permission to see financial reporting': 'صلاحية الاطلاع على التقارير المالية',
  'permission to see operational reporting': 'صلاحية الاطلاع على التقارير التشغيلية',
  'the {permission} permission': 'صلاحية {permission}',
  'the booking diary': 'أجندة الحجوزات',
  'employee records': 'سجلات الموظفين',
  payroll: 'الرواتب',
  'stock transfers': 'تحويلات المخزون',
  'customer records': 'سجلات العملاء',
  'vehicle records': 'سجلات السيارات',
  jobs: 'الأعمال',
  inspections: 'الفحوصات',
  estimates: 'عروض الأسعار',
  invoices: 'الفواتير',
  payments: 'المدفوعات',
  'time entries': 'قيود الوقت',
  'quality checks': 'فحوصات الجودة',
  reporting: 'التقارير',
  'the general ledger': 'دفتر الأستاذ العام',
  'the parts catalogue': 'كتالوج القطع',
  purchasing: 'المشتريات',
  'the vehicle passport': 'جواز السيارة',
  settings: 'الإعدادات',
  'the audit log': 'سجل التدقيق',
  'the organisation': 'المؤسسة',
  'user accounts': 'حسابات المستخدمين',

  // Roles.
  Owner: 'المالك',
  Manager: 'المدير',
  'Service advisor': 'مستشار الخدمة',
  Bookkeeper: 'المحاسب',

  // Small controls.
  Back: 'رجوع',
  Print: 'طباعة',
  'Print the receipt': 'اطبع الإيصال',
  Loading: 'جارٍ التحميل',
  'Getting this from the workshop': 'جارٍ جلب البيانات من الورشة',
  'Getting your records': 'جارٍ جلب سجلّاتك',
  'Opening this vehicle’s history': 'جارٍ فتح سجلّ المركبة',
  'Opening your quote': 'جارٍ فتح عرض السعر',
  'One moment': 'لحظة من فضلك',
  'Working out the condition of this vehicle': 'جارٍ تقييم حالة هذه السيارة',
  'Colour theme': 'سمة الألوان',
  Light: 'فاتح',
  Auto: 'تلقائي',
  Dark: 'داكن',
  'A line drawing of a car stopped at the end of a road, resting on a flat tyre':
    'رسم خطي لسيارة متوقفة في نهاية طريق، مستقرة على إطار مثقوب',
  'The road stops here': 'الطريق ينتهي هنا',

  // Uploads and photographs.
  'Sending…': 'جارٍ الإرسال…',
  'Add photos ({count} so far)': 'أضف صوراً ({count} حتى الآن)',
  'Photograph the car': 'صوّر السيارة',
  'Photo ({count})': 'صورة ({count})',
  'Take a photo': 'التقط صورة',
  'The store would not take it.': 'لم يقبله التخزين.',
  'The store refused the file ({status}).': 'رفض التخزين الملف ({status}).',
  'Uploaded, but not recorded.': 'رُفع، لكنه لم يُسجَّل.',
  'That did not upload.': 'لم يتم الرفع.',
  'Choose a file first.': 'اختر ملفاً أولاً.',
  'Not removed.': 'لم يُحذف.',
  'Registration certificate': 'رخصة تسجيل السيارة',
  'MOT certificate': 'شهادة الفحص الفني',
  Insurance: 'التأمين',
  'Service record': 'سجل الصيانة',
  'Purchase invoice': 'فاتورة الشراء',
  Other: 'أخرى',
  'What it is': 'نوع المستند',
  Title: 'العنوان',
  'Front bumper before repair': 'الصدام الأمامي قبل الإصلاح',
  'MOT certificate 2026': 'شهادة الفحص الفني 2026',
  Reference: 'المرجع',
  '(optional)': '(اختياري)',
  'Policy or certificate number': 'رقم الوثيقة أو الشهادة',
  'Runs out on': 'تنتهي في',
  File: 'الملف',
  '(PDF or a picture, up to 12MB)': '(ملف PDF أو صورة، حتى 12 ميغابايت)',
  'Add to the vehicle': 'أضف إلى السيارة',
  '{name} added.': 'أُضيف {name}.',
  Remove: 'حذف',
  'Removing…': 'جارٍ الحذف…',
  'Why? Kept on the record.': 'لماذا؟ يُحفظ في السجل.',
  'Reason for removing': 'سبب الحذف',
  Keep: 'إبقاء',

  // Diary board.
  Move: 'نقل',
  'Drag a card to another bay, or use Move on the card. A clash is refused and says why.':
    'اسحب البطاقة إلى منصة أخرى، أو استخدم «نقل» على البطاقة. يُرفض أي تعارض مع ذكر السبب.',
  'Drag a card to another person, or use Move on the card. A clash is refused and says why.':
    'اسحب البطاقة إلى شخص آخر، أو استخدم «نقل» على البطاقة. يُرفض أي تعارض مع ذكر السبب.',

  // Signature.
  'Signature pad': 'لوحة التوقيع',
  'Sign here': 'وقّع هنا',
  'Signed. Clear to start again.': 'تم التوقيع. امسح للبدء من جديد.',
  'A finger, a stylus or a mouse all work.': 'يمكنك استخدام الإصبع أو القلم أو الفأرة.',
  Clear: 'مسح',
  Signature: 'التوقيع',

  // Health dial.
  'Not enough on record to score this vehicle.': 'لا توجد بيانات كافية لتقييم هذه السيارة.',
  'Health {score} out of 100, which is {band}.': 'الحالة {score} من 100، أي {band}.',
  excellent: 'ممتازة',
  good: 'جيدة',
  fair: 'مقبولة',
  poor: 'ضعيفة',
  'not scored': 'غير مقيّمة',

  // Estimate review.
  'A quote for your {vehicle}': 'عرض سعر لسيارتك {vehicle}',
  'A quote for your vehicle': 'عرض سعر لسيارتك',
  'That did not go through': 'لم تتم العملية',
  'This quote is closed': 'عرض السعر هذا مغلق',
  'This quote is closed.': 'عرض السعر هذا مغلق.',
  'You can call them on {phone}.': 'يمكنك الاتصال بهم على {phone}.',
  'What we recommend': 'ما نوصي به',
  'Tick what you would like done. Anything left unticked will not be carried out.':
    'ضع علامة على ما تريد تنفيذه. ما لا تضع عليه علامة لن يُنفَّذ.',
  safety: 'سلامة',
  optional: 'اختياري',
  'The technician noted: {note}': 'ملاحظة الفني: {note}',
  'Before tax, if you take everything': 'قبل الضريبة، إن اخترت كل شيء',
  Tax: 'الضريبة',
  Total: 'الإجمالي',
  'You will only be charged for what you tick.': 'لن تُحاسَب إلا على ما تضع عليه علامة.',
  'This price holds until {date}.': 'هذا السعر ساري حتى {date}.',
  'From the workshop': 'من الورشة',
  'So the workshop knows who agreed to the work.': 'لتعرف الورشة من وافق على العمل.',
  'Anything to add?': 'هل تود إضافة شيء؟',
  'Optional.': 'اختياري.',
  'Sending this tells the workshop exactly which items to carry out. Anything you have left unticked will not be done, and will stay on the vehicle’s record as recommended work that was turned down.':
    'بإرسال هذا تُبلغ الورشة بالبنود التي تنفذها بالضبط. ما تركته دون علامة لن يُنفَّذ، وسيبقى في سجل السيارة كعمل موصى به تم رفضه.',
  'Send my answer': 'أرسل ردي',

  // Outbox.
  Connected: 'متصل',
  'No signal. Carry on; nothing is lost.': 'لا توجد إشارة. تابع عملك؛ لن يضيع شيء.',
  '{waiting} waiting to send, {problems} needing a decision':
    '{waiting} بانتظار الإرسال، {problems} بحاجة إلى قرار',
  '{waiting} waiting to send': '{waiting} بانتظار الإرسال',
  'Send now': 'أرسل الآن',
  'Could not reach the workshop. Everything is still here.':
    'تعذر الوصول إلى الورشة. كل شيء لا يزال هنا.',
  'Refused.': 'مرفوض.',
  'Nothing was waiting.': 'لم يكن هناك شيء بالانتظار.',
  '{applied} saved, {duplicates} already here, {conflicts} needs a decision, kept on the device.':
    'حُفظ {applied}، و{duplicates} موجود مسبقاً، و{conflicts} بحاجة إلى قرار ومحفوظ على الجهاز.',
  '{applied} saved, {duplicates} already here, {conflicts} need a decision, kept on the device.':
    'حُفظ {applied}، و{duplicates} موجود مسبقاً، و{conflicts} بحاجة إلى قرار ومحفوظة على الجهاز.',
  '{applied} saved, {conflicts} needs a decision, kept on the device.':
    'حُفظ {applied}، و{conflicts} بحاجة إلى قرار ومحفوظ على الجهاز.',
  '{applied} saved, {conflicts} need a decision, kept on the device.':
    'حُفظ {applied}، و{conflicts} بحاجة إلى قرار ومحفوظة على الجهاز.',
  '{duplicates} already here, {conflicts} needs a decision, kept on the device.':
    '{duplicates} موجود مسبقاً، و{conflicts} بحاجة إلى قرار ومحفوظ على الجهاز.',
  '{duplicates} already here, {conflicts} need a decision, kept on the device.':
    '{duplicates} موجود مسبقاً، و{conflicts} بحاجة إلى قرار ومحفوظة على الجهاز.',
  '{conflicts} needs a decision, kept on the device.':
    '{conflicts} بحاجة إلى قرار ومحفوظ على الجهاز.',
  '{conflicts} need a decision, kept on the device.':
    '{conflicts} بحاجة إلى قرار ومحفوظة على الجهاز.',
  '{applied} saved, {duplicates} already here.': 'حُفظ {applied}، و{duplicates} موجود مسبقاً.',
  '{applied} saved.': 'حُفظ {applied}.',
  'That job is no longer here.': 'هذا العمل لم يعد موجوداً.',
  'Nothing knows how to apply that.': 'لا توجد طريقة لتطبيق ذلك.',
  'That could not be read.': 'تعذرت قراءة ذلك.',
  'That could not be saved. It is still on the device.': 'تعذر حفظ ذلك. لا يزال على الجهاز.',
  'This job was invoiced while the device was offline. Nothing can be added to it now without reissuing the bill, so somebody has to decide.':
    'صدرت فاتورة هذا العمل بينما كان الجهاز غير متصل. لا يمكن إضافة شيء إليه الآن دون إعادة إصدار الفاتورة، لذا يجب أن يقرر أحد.',
  'This inspection was completed and sent to the customer while the device was offline. A finding recorded now would change a document they have already read.':
    'اكتمل هذا الفحص وأُرسل إلى العميل بينما كان الجهاز غير متصل. تسجيل ملاحظة الآن سيغيّر مستنداً قرأه بالفعل.',
  'The job moved to {from} while the device was offline, and it cannot go from there to {to}.':
    'انتقل العمل إلى «{from}» بينما كان الجهاز غير متصل، ولا يمكن نقله من هناك إلى «{to}».',

  // Plan wall.
  'Not on this plan': 'غير متاح في هذه الباقة',
  '{feature} is not part of {plan}': 'باقة {plan} لا تشمل {feature}',
  'It comes with {plan}, at £{price} per bay per month billed annually. Everything already in {current} stays exactly as it is.':
    'متاح ضمن باقة {plan}، بسعر {price} جنيه إسترليني لكل منصة شهرياً مع الفوترة السنوية. كل ما هو موجود في {current} يبقى كما هو تماماً.',
  '{plan} adds': 'تضيف {plan}',
  'This is not available on any plan yet.': 'هذا غير متاح في أي باقة بعد.',
  'Compare plans': 'قارن الباقات',
  'Back to the workshop': 'العودة إلى الورشة',
  'Nothing you have recorded is affected by which plan you are on. The work, the invoices and every vehicle passport stay where they are.':
    'لا يتأثر أي شيء سجلته بالباقة التي تستخدمها. الأعمال والفواتير وكل جواز سيارة تبقى في مكانها.',
  'digital inspections': 'الفحوصات الرقمية',
  'estimates and approvals': 'عروض الأسعار والموافقات',
  'purchase orders': 'أوامر الشراء',
  'financial statements': 'القوائم المالية',
  'timesheets and payroll': 'سجلات الدوام والرواتب',
  'commission schemes': 'أنظمة العمولات',
  'more than one site': 'أكثر من موقع',
  'stock transfers between sites': 'تحويلات المخزون بين المواقع',
  'the API': 'واجهة برمجة التطبيقات',
  'single sign-on': 'تسجيل الدخول الموحد',
  'Diary, jobs, inspections and estimates': 'الأجندة والأعمال والفحوصات وعروض الأسعار',
  'Vehicle passport on every car you touch': 'جواز لكل سيارة تعمل عليها',
  'Invoicing, payments and parts': 'الفوترة والمدفوعات والقطع',
  'Customer portal': 'بوابة العملاء',
  'Everything in Core': 'كل ما في Core',
  'Double-entry ledger, posted from the work itself': 'دفتر قيد مزدوج، يُرحَّل من العمل نفسه',
  'Profit and loss, balance sheet, VAT position':
    'الأرباح والخسائر، والميزانية العمومية، وموقف ضريبة القيمة المضافة',
  'Purchase orders and three-way bill matching': 'أوامر الشراء ومطابقة الفواتير الثلاثية',
  'Timesheets, pay history and commission': 'سجلات الدوام وسجل الرواتب والعمولات',
  'Everything in Complete, at every site': 'كل ما في Complete، في كل موقع',
  'Consolidated reporting that carries its spread': 'تقارير موحدة تحتفظ بتفاصيل كل موقع',
  'Stock transfers, with what is on the road counted': 'تحويلات المخزون، مع احتساب ما هو في الطريق',
  'Per-site permissions and single sign-on': 'صلاحيات لكل موقع وتسجيل دخول موحد',

  // Sign-up pricing.
  Country: 'الدولة',
  'Sets the currency you are billed in and keep your books in ({currency}), the language and the clock. Changeable in settings.':
    'تحدد عملة الفوترة وعملة دفاترك ({currency})، واللغة وتنسيق الوقت. يمكن تغييرها من الإعدادات.',
  Plan: 'الباقة',
  'Changeable at any point during the trial': 'يمكن تغييرها في أي وقت خلال التجربة',
  '{plan} — {price} per bay, per month, paid monthly':
    '{plan} — {price} لكل منصة شهرياً، تُدفع شهرياً',
  'I have read the {terms}.': 'لقد قرأت {terms}.',
  terms: 'الشروط',
  'The trial is free for {days} days. On the day it ends, the card I add next is charged {price} per bay per month for the {plan} plan, in {currency}, and monthly after that, unless I cancel before then. I can cancel at any time from Settings.':
    'التجربة مجانية لمدة {days} يوماً. في يوم انتهائها، يُخصم من البطاقة التي سأضيفها {price} لكل منصة شهرياً مقابل باقة {plan}، بعملة {currency}، ثم شهرياً بعد ذلك، ما لم ألغِ قبل ذلك. يمكنني الإلغاء في أي وقت من الإعدادات.',
  'United Kingdom': 'المملكة المتحدة',
  Ireland: 'أيرلندا',
  Canada: 'كندا',
  'United States': 'الولايات المتحدة',
  Australia: 'أستراليا',
  'New Zealand': 'نيوزيلندا',
  France: 'فرنسا',
  Germany: 'ألمانيا',
  Netherlands: 'هولندا',
  Belgium: 'بلجيكا',
  Spain: 'إسبانيا',
  Portugal: 'البرتغال',
  Italy: 'إيطاليا',
  'United Arab Emirates': 'الإمارات العربية المتحدة',
  'Saudi Arabia': 'السعودية',
  Egypt: 'مصر',
  'South Africa': 'جنوب أفريقيا',
  India: 'الهند',

  // Verification banner.
  'A confirmation link is on its way to {email}. It lasts three days.':
    'رابط التأكيد في طريقه إلى {email}. صالح لمدة ثلاثة أيام.',
  'Your email address has not been confirmed yet. Until it is, we cannot tell you when a message to a customer bounces.':
    'لم يتم تأكيد بريدك الإلكتروني بعد. إلى أن يتم ذلك، لا يمكننا إبلاغك عندما ترتد رسالة إلى أحد العملاء.',
  'Your email address still has not been confirmed. Anything sent on your behalf may be treated as spam, and you will not hear about it.':
    'لم يتم تأكيد بريدك الإلكتروني حتى الآن. قد يُعامل أي شيء يُرسل باسمك كرسائل مزعجة، دون أن تعلم بذلك.',

  // The passport booklet on the home page.
  'The vehicle': 'السيارة',
  Type: 'النوع',
  'Make and model': 'الطراز والموديل',
  Year: 'السنة',
  Registration: 'رقم اللوحة',
  VIN: 'رقم الهيكل',
  'Owners on record': 'الملاك المسجلون',
  Entries: 'القيود',
  Contradiction: 'تناقض',
  Advisory: 'توصية',
  Recorded: 'مسجل',
  'Issued to the vehicle, not the owner': 'صادر للسيارة، لا للمالك',
  'Every workshop that services this car writes to the same pages. Sell it and the pages go with it.':
    'كل ورشة تصون هذه السيارة تكتب في الصفحات نفسها. بعها وستذهب الصفحات معها.',
  'Close the passport': 'أغلق الجواز',
  'Drag the car to turn it. Tap a mark to read the entry.':
    'اسحب السيارة لتدويرها. انقر على علامة لقراءة القيد.',
  'A real vehicle, and its real record.': 'سيارة حقيقية، وسجلها الحقيقي.',
  'Entries on the demonstration vehicle': 'قيود السيارة التجريبية',
  'Full service, 58,940 miles': 'صيانة شاملة، 58,940 ميلاً',
  'Oil, filters and a 30-point inspection. Written to the chain the moment the job closed, and readable by every workshop the car visits afterwards.':
    'زيت وفلاتر وفحص من 30 نقطة. سُجّل في السلسلة لحظة إغلاق العمل، ويمكن لكل ورشة تزورها السيارة بعد ذلك قراءته.',
  'Nearside front tyre at 2.4mm': 'الإطار الأمامي جهة الرصيف عند 2.4 مم',
  'Recorded as an advisory rather than sold as urgent. The next garage sees the measurement, not somebody else’s opinion of it.':
    'سُجّل كتوصية بدلاً من بيعه كأمر عاجل. الورشة التالية ترى القياس، لا رأي غيرها فيه.',
  'Mar 2024': 'مارس 2024',
  'Rear pads replaced': 'استُبدلت فحمات الفرامل الخلفية',
  'Quoted from an inspection, approved by the customer line by line from a text message, and fitted the same afternoon.':
    'سُعّر بناءً على فحص، ووافق عليه العميل بنداً بنداً من رسالة نصية، ورُكّب في العصر نفسه.',
  'Sep 2024': 'سبتمبر 2024',
  'The odometer went backwards': 'عداد المسافة رجع إلى الخلف',
  'It read 67,410 in April and 62,000 in September. Every reading since has been consistent, so a garage comparing its own last two sees nothing wrong. Only the whole sequence shows it.':
    'كانت القراءة 67,410 في أبريل و62,000 في سبتمبر. كل قراءة بعدها كانت متسقة، لذا فالورشة التي تقارن آخر قراءتين لديها لا ترى خطأ. وحده التسلسل الكامل يكشف ذلك.',
  'Recorded between owners': 'سُجّل بين مالكَين',

  // UI package.
  'Workshop capacity used': 'الطاقة المستخدمة في الورشة',
  Flagged: 'مُعلَّم',
  'Lower than a previously recorded reading': 'أقل من قراءة مسجلة سابقاً',
  'Implies an unusually high daily distance': 'يشير إلى مسافة يومية مرتفعة على نحو غير معتاد',
  Pass: 'سليم',
  Critical: 'حرج',
  'Not checked': 'لم يُفحص',
  '(skipped)': '(تم تخطيها)',
  '(current stage)': '(المرحلة الحالية)',
  'Reported by the vehicle owner': 'أبلغ عنه مالك السيارة',
  'Recorded by a workshop during work': 'سجلته ورشة أثناء العمل',
  Evidenced: 'موثّق',
  'Recorded by a workshop with photographic evidence': 'سجلته ورشة مع دليل مصوّر',
  Official: 'رسمي',
  'Supplied by a registry, manufacturer or insurer':
    'مقدَّم من جهة تسجيل أو شركة مصنّعة أو شركة تأمين',
  Superseded: 'مُستبدَل',
  'History intact': 'السجل سليم',
  'History integrity check failed': 'فشل التحقق من سلامة السجل',
  Chain: 'السلسلة',
  'A record that belongs to the car': 'سجل ملك للسيارة',
  Page: 'صفحة',
  'Machine readable zone': 'منطقة القراءة الآلية',
  'Seal: history intact': 'الختم: السجل سليم',
  'Seal: history broken': 'الختم: السجل مكسور',
  'History broken': 'السجل مكسور',

  // The vehicle passport.
  'Particulars of the vehicle': 'بيانات السيارة',
  Code: 'الرمز',
  'Passport number': 'رقم الجواز',
  'Vehicle identification number': 'رقم تعريف السيارة (رقم الهيكل)',
  Make: 'الشركة المصنّعة',
  Model: 'الطراز',
  'First registered': 'أول تسجيل',
  'Entries on record': 'القيود المسجلة',
  'Workshops contributing': 'الورش المساهمة',
  'Latest odometer': 'آخر قراءة للعداد',
  'Mileage anomalies': 'حالات شذوذ في المسافة المقطوعة',
  '1 contradiction': 'تناقض واحد',
  '{count} contradictions': '{count} تناقضات',
  None: 'لا يوجد',
  'Open recalls': 'الاستدعاءات المفتوحة',
  'This record is append-only. Each entry is linked to the one before it, so an entry cannot be altered or removed without breaking the chain. The seal recomputes it.':
    'هذا السجل يقبل الإضافة فقط. كل قيد مرتبط بالقيد الذي قبله، فلا يمكن تعديل قيد أو حذفه دون كسر السلسلة. الختم يعيد حسابها.',
  Observations: 'الملاحظات',
  'What this record amounts to': 'ما يعنيه هذا السجل',
  'What it does not cover': 'ما لا يغطيه',
  'Worth asking the seller': 'يستحق سؤال البائع',
  'What a buyer will ask': 'ما سيسأل عنه المشتري',
  'Who has owned it': 'من امتلكها',
  'Owner {position}, kept it {months} month and still has it.':
    'المالك {position}، احتفظ بها {months} شهر ولا تزال لديه.',
  'Owner {position}, kept it {months} month.': 'المالك {position}، احتفظ بها {months} شهر.',
  'Owner {position}, kept it {months} months and still has it.':
    'المالك {position}، احتفظ بها {months} أشهر ولا تزال لديه.',
  'Owner {position}, kept it {months} months.': 'المالك {position}، احتفظ بها {months} أشهر.',
  'Owner {position}, kept it {years} years and still has it.':
    'المالك {position}، احتفظ بها {years} سنوات ولا تزال لديه.',
  'Owner {position}, kept it {years} years.': 'المالك {position}، احتفظ بها {years} سنوات.',
  'No ownership on record.': 'لا توجد ملكية مسجلة.',
  'No owner is named on these pages, past or present. That is theirs, not the vehicle’s.':
    'لا يُذكر اسم أي مالك في هذه الصفحات، سابقاً أو حالياً. فذلك يخصهم، لا السيارة.',
  'Outstanding recall': 'استدعاء قائم',
  Mileage: 'المسافة المقطوعة',
  'No entries have been recorded for this vehicle yet. The pages are blank, and that is itself the record.':
    'لم تُسجل أي قيود لهذه السيارة بعد. الصفحات فارغة، وهذا بحد ذاته هو السجل.',
  'Entries · {year}': 'القيود · {year}',
  'Newest first. Each stamp names who pressed it and how well evidenced the entry is.':
    'الأحدث أولاً. كل ختم يذكر من وضعه ومدى توثيق القيد.',
  Manufacturer: 'الشركة المصنّعة',
  Registry: 'جهة التسجيل',
  'The owner': 'المالك',
  Ownership: 'الملكية',
  Service: 'صيانة',
  Repair: 'إصلاح',
  Part: 'قطعة',
  Inspection: 'فحص',
  Tires: 'إطارات',
  Accident: 'حادث',
  'Recall issued': 'صدر استدعاء',
  'Recall done': 'نُفّذ الاستدعاء',
  Modification: 'تعديل',
  Maintenance: 'صيانة دورية',
  Import: 'استيراد',
  'Write-off': 'شطب',
  Note: 'ملاحظة',

  // What the record says (from the passport report).
  'Do not rely on this record.': 'لا تعتمد على هذا السجل.',
  'The record is intact, and it has things in it to ask about.':
    'السجل سليم، وفيه أمور تستحق السؤال.',
  'There is nothing on record for this vehicle.': 'لا يوجد شيء مسجل لهذه السيارة.',
  'A full record, intact, with nothing outstanding on it.': 'سجل كامل وسليم، دون أي أمور معلقة.',
  'Intact, but thin. Read what it does not cover as carefully as what it does.':
    'سليم، لكنه محدود. اقرأ ما لا يغطيه بعناية قراءتك لما يغطيه.',
  'The record starts in {start}, and the vehicle was first registered in {registered}. About {count} year before that is not covered here at all.':
    'يبدأ السجل في {start}، وسُجّلت السيارة لأول مرة في {registered}. نحو {count} سنة قبل ذلك غير مغطاة هنا إطلاقاً.',
  'The record starts in {start}, and the vehicle was first registered in {registered}. About {count} years before that is not covered here at all.':
    'يبدأ السجل في {start}، وسُجّلت السيارة لأول مرة في {registered}. نحو {count} سنوات قبل ذلك غير مغطاة هنا إطلاقاً.',
  'Nothing is recorded for this vehicle yet.': 'لم يُسجل شيء لهذه السيارة بعد.',
  'No service has been recorded, which is not the same as none having been done.':
    'لم تُسجل أي صيانة، وهذا لا يعني أنه لم تُجرَ أي صيانة.',
  'Nothing here was inspected by a workshop, so the condition of the vehicle is not part of this record.':
    'لم تفحص أي ورشة شيئاً هنا، لذا فحالة السيارة ليست جزءاً من هذا السجل.',
  'This covers what participating workshops recorded. Work done elsewhere, or by the owner, does not appear.':
    'يغطي هذا ما سجلته الورش المشاركة. الأعمال المنجزة في مكان آخر، أو من قبل المالك، لا تظهر.',
  '{count} critical item was found and has not been recorded as put right. Ask for the invoice, not a description.':
    'وُجد {count} بند حرج ولم يُسجل إصلاحه. اطلب الفاتورة، لا الوصف.',
  '{count} critical items were found and have not been recorded as put right. Ask for the invoice, not a description.':
    'وُجدت {count} بنود حرجة ولم يُسجل إصلاحها. اطلب الفاتورة، لا الوصف.',
  '{count} manufacturer recall shows as outstanding. A franchised dealer does these free; ask whether it has been done and is simply unrecorded.':
    'يظهر {count} استدعاء من الشركة المصنّعة قائماً. الوكيل المعتمد ينفذه مجاناً؛ اسأل إن كان قد نُفّذ دون تسجيل.',
  '{count} manufacturer recalls shows as outstanding. A franchised dealer does these free; ask whether it has been done and is simply unrecorded.':
    'تظهر {count} استدعاءات من الشركة المصنّعة قائمة. الوكيل المعتمد ينفذها مجاناً؛ اسأل إن كانت قد نُفّذت دون تسجيل.',
  '{count} odometer reading did not follow the one before it. That has innocent explanations, and it also has one that is not. Ask.':
    '{count} قراءة للعداد لم تتسق مع القراءة التي قبلها. لذلك تفسيرات بريئة، وله أيضاً تفسير غير بريء. اسأل.',
  '{count} odometer readings did not follow the one before it. That has innocent explanations, and it also has one that is not. Ask.':
    '{count} قراءات للعداد لم تتسق مع القراءة التي قبلها. لذلك تفسيرات بريئة، وله أيضاً تفسير غير بريء. اسأل.',
  'The last recorded service was {date}. Ask what has been done since and where.':
    'آخر صيانة مسجلة كانت في {date}. اسأل عما أُجري منذ ذلك الحين وأين.',
  '{count} owners is a lot for one vehicle. Not a fault in itself, and worth a question.':
    '{count} ملاك عدد كبير لسيارة واحدة. ليس عيباً في حد ذاته، لكنه يستحق السؤال.',

  // The mileage record.
  'The mileage record': 'سجل المسافة المقطوعة',
  'Checked across every workshop that has recorded a reading. {count} on file.':
    'تم التحقق عبر كل ورشة سجلت قراءة. {count} في الملف.',
  arithmetic: 'حساب',
  likely: 'مرجّح',
  'worth asking': 'يستحق السؤال',
  'About the record itself': 'عن السجل نفسه',
  'This checks the readings against each other. It cannot see mileage covered while nobody was writing anything down, and it is not a warranty.':
    'يقارن هذا القراءات ببعضها. لا يمكنه رؤية المسافة المقطوعة حين لم يكن أحد يسجل شيئاً، وهو ليس ضماناً.',
  'The mileage record contradicts itself. One reading is impossible given the others.':
    'سجل المسافة المقطوعة يناقض نفسه. قراءة واحدة مستحيلة مقارنة بالبقية.',
  'The mileage record contradicts itself. {count} readings are impossible given the others.':
    'سجل المسافة المقطوعة يناقض نفسه. {count} قراءات مستحيلة مقارنة بالبقية.',
  'Nothing in the record is impossible, but there is one thing worth asking about.':
    'لا شيء مستحيل في السجل، لكن هناك أمراً واحداً يستحق السؤال.',
  'Nothing in the record is impossible, but there are {count} things worth asking about.':
    'لا شيء مستحيل في السجل، لكن هناك {count} أمور تستحق السؤال.',
  'Too few readings to say much. One reading on record.':
    'القراءات أقل من أن تقول الكثير. قراءة واحدة مسجلة.',
  'Too few readings to say much. {count} readings on record.':
    'القراءات أقل من أن تقول الكثير. {count} قراءات مسجلة.',
  'Nothing inconsistent across {count} readings. That is as much as the record can show; it cannot speak for time nobody wrote anything down.':
    'لا تناقض عبر {count} قراءات. هذا أقصى ما يمكن للسجل إظهاره؛ فهو لا يستطيع الحديث عن وقت لم يسجل فيه أحد شيئاً.',
  'The odometer read {lost} fewer miles on {later} than it had on {earlier}.':
    'سجّل العداد في {later} أميالاً أقل بـ{lost} مما سجّله في {earlier}.',
  'The reading fell from {high} to {low}, then later rose above the earlier figure again. Because the most recent readings are consistent with each other, a check that only compares the last two would show nothing wrong.':
    'انخفضت القراءة من {high} إلى {low}، ثم ارتفعت لاحقاً فوق الرقم السابق مجدداً. ولأن أحدث القراءات متسقة فيما بينها، فإن أي فحص يقارن آخر قراءتين فقط لن يُظهر أي خطأ.',
  'The reading fell from {high} to {low}. An odometer does not go backwards on its own. Either the instrument cluster was replaced, which a workshop should have recorded, or the reading was altered.':
    'انخفضت القراءة من {high} إلى {low}. العداد لا يرجع إلى الخلف من تلقاء نفسه. إما أن لوحة العدادات استُبدلت، وكان على الورشة تسجيل ذلك، أو أن القراءة عُدّلت.',
  '{rate} miles a day between {from} and {to}.': '{rate} ميل يومياً بين {from} و{to}.',
  'The reading rose by {distance} miles in {days} days. Sustained over that period it is not a distance a road vehicle covers, so one of the two readings is wrong.':
    'ارتفعت القراءة بمقدار {distance} ميل خلال {days} يوماً. على امتداد تلك الفترة، ليست هذه مسافة تقطعها سيارة على الطريق، لذا إحدى القراءتين خاطئة.',
  'Recent use is about {recent} miles a year, against {overall} over its life.':
    'الاستخدام الأخير نحو {recent} ميل سنوياً، مقابل {overall} على مدى عمرها.',
  'This is worth asking the seller about, and it is not evidence of anything on its own. A change of job, retirement, illness or a second car all produce exactly this pattern. So does an altered odometer.':
    'هذا يستحق سؤال البائع عنه، وهو ليس دليلاً على شيء بمفرده. تغيير العمل أو التقاعد أو المرض أو امتلاك سيارة ثانية، كلها تنتج هذا النمط تماماً. وكذلك العداد المُعدَّل.',
  'Two workshops recorded readings {gap} miles apart within a fortnight.':
    'سجلت ورشتان قراءتين بفارق {gap} ميل خلال أسبوعين.',
  '{first} recorded {firstReading} on {firstDate} and {second} recorded {secondReading} on {secondDate}. One of them is wrong, and a typed digit is the most common reason.':
    'سجلت {first} القراءة {firstReading} في {firstDate} وسجلت {second} القراءة {secondReading} في {secondDate}. إحداهما خاطئة، والخطأ في كتابة رقم هو السبب الأكثر شيوعاً.',
  'One workshop': 'ورشة',
  another: 'ورشة أخرى',
  'Nothing recorded between {from} and {to}.': 'لا شيء مسجل بين {from} و{to}.',
  'A gap of about {months} months. This says only that nobody wrote anything down, which is ordinary for a vehicle serviced outside the network. It is not a finding against the vehicle.':
    'فجوة تقارب {months} أشهر. هذا يعني فقط أن أحداً لم يسجل شيئاً، وهو أمر عادي لسيارة تُصان خارج الشبكة. وليس ملاحظة ضد السيارة.',
  'Nothing recorded since {date}.': 'لا شيء مسجل منذ {date}.',
  'The most recent entry is about {months} months old, so the current mileage is unknown rather than unchanged.':
    'أحدث قيد عمره نحو {months} أشهر، لذا فالمسافة الحالية مجهولة لا ثابتة.',
};
