/**
 * Customers, vehicles, passports, relationships, fleets, reminders and recalls.
 *
 * Keys are the English exactly as written in the product. Slots in braces
 * are kept as they are. Phase 40.5.
 */

export const fr: Readonly<Record<string, string>> = {
  // customers/new
  'New customer': 'Nouveau client',
  'All customers': 'Tous les clients',
  'A name and one way to reach them is enough. The rest can wait.':
    'Un nom et un moyen de le joindre suffisent. Le reste peut attendre.',
  'Open them instead': 'Ouvrir sa fiche à la place',
  'Who they are': 'Qui il est',
  'What goes on the invoice': 'Ce qui figure sur la facture',
  Kind: 'Type',
  'Changes which name is asked for': 'Détermine le nom demandé',
  'A person': 'Un particulier',
  'A company': 'Une entreprise',
  'First name': 'Prénom',
  'For a person': 'Pour un particulier',
  'Last name': 'Nom',
  'Company name': 'Raison sociale',
  'For a company or a fleet': 'Pour une entreprise ou une flotte',
  'VAT number': 'Numéro de TVA',
  'Optional. Goes on their invoices.': 'Facultatif. Figure sur ses factures.',
  'Where they are': 'Où il se trouve',
  'Optional, and worth having before the first invoice':
    'Facultatif, mais utile avant la première facture',
  Address: 'Adresse',
  'Address, continued': 'Complément d’adresse',
  Town: 'Ville',
  County: 'Département',
  Postcode: 'Code postal',
  'How to reach them': 'Comment le joindre',
  'At least one. Everything the workshop sends goes here.':
    'Au moins un. Tout ce que l’atelier envoie arrive ici.',
  Email: 'E-mail',
  'Quotes, invoices and the portal link': 'Devis, factures et lien vers le portail',
  Mobile: 'Mobile',
  'Texts about the car': 'SMS au sujet de la voiture',
  'Other telephone': 'Autre téléphone',
  'Landline or work number': 'Fixe ou numéro professionnel',
  Marketing: 'Marketing',
  'Separate from anything about their own car':
    'Distinct de tout ce qui concerne sa propre voiture',
  'They agreed to marketing emails': 'A accepté les e-mails marketing',
  'They agreed to marketing texts': 'A accepté les SMS marketing',
  'Service reminders and messages about a job in progress are not marketing and go out either way.':
    'Les rappels d’entretien et les messages sur un travail en cours ne sont pas du marketing et partent dans tous les cas.',
  'Anything else': 'Autre chose',
  'How they found you': 'Comment il vous a connu',
  Optional: 'Facultatif',
  'Recommended by a neighbour': 'Recommandé par un voisin',
  'Arrived with a code': 'Venu avec un code',
  'Optional. Another customer’s referral code; both sides are paid once this one has had work done':
    'Facultatif. Le code de parrainage d’un autre client ; les deux sont récompensés une fois que celui-ci a fait réaliser un travail',
  Notes: 'Notes',
  'Anything whoever serves them next should know':
    'Ce que la prochaine personne qui le reçoit doit savoir',
  'Add them anyway. I have checked, and this really is a different person.':
    'L’ajouter quand même. J’ai vérifié, il s’agit bien d’une autre personne.',
  'Add the customer': 'Ajouter le client',
  // customers
  '1 customer': '1 client',
  '{count} customers': '{count} clients',
  'Name, phone or email': 'Nom, téléphone ou e-mail',
  'Search customers': 'Rechercher des clients',
  'No customers found': 'Aucun client trouvé',
  'Try a different search.': 'Essayez une autre recherche.',
  'Add your first customer to begin.': 'Ajoutez votre premier client pour commencer.',
  Type: 'Type',
  'Source of business': 'Origine',
  Company: 'Entreprise',
  Individual: 'Particulier',
  // customers/[id]
  'Source: {source}': 'Origine : {source}',
  'How this came to be': 'Comment on en est arrivé là',
  'Points added. They can see them in the portal.':
    'Points ajoutés. Le client peut les voir sur le portail.',
  'Deposit taken and booked as money held, not as revenue. It goes against the invoice when there is one.':
    'Acompte encaissé et comptabilisé comme somme détenue, pas comme chiffre d’affaires. Il sera imputé sur la facture quand il y en aura une.',
  'Money returned, with the reason kept.': 'Somme restituée, avec le motif conservé.',
  'Code used. They had already had enough work done here, so both sides have been paid.':
    'Code utilisé. Le client avait déjà fait réaliser assez de travaux ici, les deux parties ont donc été récompensées.',
  'Code used. Both sides are paid once this customer has had enough work done.':
    'Code utilisé. Les deux parties seront récompensées dès que ce client aura fait réaliser assez de travaux.',
  'Saved.': 'Enregistré.',
  Landline: 'Fixe',
  'Tax number': 'Numéro fiscal',
  'Marketing consent': 'Consentement marketing',
  'Email yes': 'E-mail oui',
  'Email no': 'E-mail non',
  'SMS yes': 'SMS oui',
  'SMS no': 'SMS non',
  '1 vehicle': '1 véhicule',
  '{count} vehicles': '{count} véhicules',
  'No vehicles': 'Aucun véhicule',
  'Vehicles appear once a job is created.':
    'Les véhicules apparaissent dès qu’un travail est créé.',
  Recall: 'Rappel',
  '1 history entry': '1 entrée d’historique',
  '{count} history entries': '{count} entrées d’historique',
  Passport: 'Passeport',
  'Recent jobs': 'Travaux récents',
  'No jobs yet': 'Aucun travail pour l’instant',
  Draft: 'Brouillon',
  'Vehicle received': 'Véhicule réceptionné',
  Inspection: 'Contrôle',
  Diagnosis: 'Diagnostic',
  'Estimate created': 'Devis établi',
  'Customer approval': 'Accord du client',
  Approved: 'Accepté',
  Repair: 'Réparation',
  'Quality control': 'Contrôle qualité',
  Completed: 'Terminé',
  Payment: 'Paiement',
  Preferences: 'Préférences',
  'Preselected on a new job; the diary has the last word':
    'Présélectionné sur un nouveau travail ; l’agenda a le dernier mot',
  'Asks for': 'Demande',
  'Nobody in particular': 'Personne en particulier',
  'Save preference': 'Enregistrer la préférence',
  'Deposits and credit, waiting for a bill': 'Acomptes et avoirs, en attente d’une facture',
  'A deposit before the work, or credit kept from a refund':
    'Un acompte avant les travaux, ou un avoir conservé après un remboursement',
  Held: 'Détenu',
  Deposit: 'Acompte',
  'for job #{number}': 'pour le travail n° {number}',
  'Amount to return': 'Montant à restituer',
  'Why it is going back': 'Pourquoi il est restitué',
  Return: 'Restituer',
  Card: 'Carte',
  Cash: 'Espèces',
  'Bank transfer': 'Virement bancaire',
  Cheque: 'Chèque',
  'For which job': 'Pour quel travail',
  'Not a particular job': 'Aucun travail en particulier',
  Reference: 'Référence',
  'Take the deposit': 'Encaisser l’acompte',
  Points: 'Points',
  'Worth {amount} off a bill': 'Valent {amount} de réduction sur une facture',
  '{count} point a pound on every bill paid in full':
    '{count} point par unité monétaire sur chaque facture payée intégralement',
  Balance: 'Solde',
  '{points} lapse on {date}. Worth mentioning at the next visit.':
    '{points} expirent le {date}. À mentionner lors de la prochaine visite.',
  'Work done': 'Travaux réalisés',
  'Redeemed against {amount}': 'Utilisés contre {amount}',
  'Referral, for introducing somebody': 'Parrainage, pour avoir présenté quelqu’un',
  'Referral, for being introduced': 'Parrainage, pour avoir été présenté',
  'Nothing earned yet. The first bill they pay in full starts it.':
    'Rien de gagné pour l’instant. La première facture payée intégralement lance le compteur.',
  Why: 'Motif',
  'Sorry about the wait on Tuesday': 'Désolé pour l’attente de mardi',
  'Add points': 'Ajouter des points',
  'Both sides get {points} points once the person brought in has had {amount} of work done':
    'Les deux parties reçoivent {points} points dès que la personne parrainée a fait réaliser {amount} de travaux',
  'Their code to hand out': 'Son code à transmettre',
  'Introduced by': 'Présenté par',
  'both sides paid on {date}': 'les deux parties récompensées le {date}',
  'waiting on their first bill': 'en attente de sa première facture',
  'A customer since removed': 'Un client supprimé depuis',
  Paid: 'Payé',
  'Waiting on a bill': 'En attente d’une facture',
  'Nobody brought in yet.': 'Personne de parrainé pour l’instant.',
  'Somebody else’s code, said at the counter': 'Le code de quelqu’un d’autre, donné au comptoir',
  'Use the code': 'Utiliser le code',
  'Recent payments': 'Paiements récents',
  'Nothing recorded.': 'Rien d’enregistré.',
  cash: 'espèces',
  card: 'carte',
  'bank transfer': 'virement bancaire',
  online: 'en ligne',
  cheque: 'chèque',
  account: 'compte',
  other: 'autre',
  'gift card': 'carte cadeau',
  deposit: 'acompte',
  'The whole story': 'Toute l’histoire',
  'Every visit, quote, decision and payment, newest first.':
    'Chaque visite, devis, décision et paiement, le plus récent d’abord.',
  'Nothing has happened yet. The thread fills itself as this customer is dealt with.':
    'Rien ne s’est encore passé. Le fil se remplit à mesure que ce client est pris en charge.',
  '{car} came in for {work}': '{car} est venue pour {work}',
  'Job {number}': 'Travail {number}',
  'Quote sent for {car}': 'Devis envoyé pour {car}',
  'Version {version}': 'Version {version}',
  'They turned the work down': 'Il a refusé les travaux',
  'They approved part of the quote': 'Il a accepté une partie du devis',
  'They approved the work': 'Il a accepté les travaux',
  'Invoiced {number}': 'Facturé {number}',
  'Paid with points': 'Payé avec des points',
  'Paid by {method}': 'Payé par {method}',
  'Did not turn up for {work}': 'Ne s’est pas présenté pour {work}',
  'Booked in for {work}': 'Rendez-vous pour {work}',
  'the vehicle': 'le véhicule',
  'What they were sent': 'Ce qui lui a été envoyé',
  'Matched on the address on file, so it is a close record rather than a certain one.':
    'Rapproché d’après l’adresse enregistrée : c’est donc un relevé probable plutôt que certain.',
  'The conversation': 'La conversation',
  email: 'e-mail',
  sms: 'SMS',
  portal: 'portail',
  whatsapp: 'WhatsApp',
  'did not arrive': 'non distribué',
  // vehicles
  'Vehicles this workshop has serviced or been granted access to.':
    'Les véhicules que cet atelier a entretenus ou auxquels il a reçu l’accès.',
  'Find or add a vehicle': 'Trouver ou ajouter un véhicule',
  'Registration, VIN, make or model': 'Immatriculation, VIN, marque ou modèle',
  'Search vehicles': 'Rechercher des véhicules',
  'No vehicles yet': 'Aucun véhicule pour l’instant',
  'A vehicle appears here once it is found on the network or added, or the first time you open a job for it.':
    'Un véhicule apparaît ici dès qu’il est trouvé sur le réseau ou ajouté, ou la première fois que vous ouvrez un travail pour lui.',
  Registration: 'Immatriculation',
  VIN: 'VIN',
  Owner: 'Propriétaire',
  Odometer: 'Compteur',
  History: 'Historique',
  Flags: 'Alertes',
  Unknown: 'Inconnu',
  '1 entry': '1 entrée',
  '{count} entries': '{count} entrées',
  '1 recall': '1 rappel',
  '{count} recalls': '{count} rappels',
  // vehicles/find
  'Find a vehicle': 'Trouver un véhicule',
  'All vehicles': 'Tous les véhicules',
  'By registration or VIN. If another Carnet workshop has seen it, its history is already here.':
    'Par immatriculation ou VIN. Si un autre atelier Carnet l’a déjà vu, son historique est déjà ici.',
  'Registration or VIN': 'Immatriculation ou VIN',
  'AB12 CDE or WVWZZZ1JZ3W386752': 'AB-123-CD ou WVWZZZ1JZ3W386752',
  'Look it up': 'Rechercher',
  'No plate on record': 'Aucune plaque enregistrée',
  'VIN {vin}': 'VIN {vin}',
  'What you will see: every service, part, inspection and mileage reading, with the verification each carries. What you will not see: what they charged, their job numbers, or who did the work. The car’s history is the car’s; their margins are theirs.':
    'Ce que vous verrez : chaque entretien, pièce, contrôle et relevé kilométrique, avec la vérification de chacun. Ce que vous ne verrez pas : ce qu’ils ont facturé, leurs numéros de travaux, ni qui a fait le travail. L’historique de la voiture appartient à la voiture ; leurs marges leur appartiennent.',
  'Open the vehicle': 'Ouvrir le véhicule',
  'Take it on and see the history': 'Le prendre en charge et voir l’historique',
  'Somebody with vehicle access can take this car on.':
    'Une personne ayant accès aux véhicules peut prendre cette voiture en charge.',
  'Not on the network': 'Absent du réseau',
  'No Carnet workshop has recorded {identifier}. Its history starts with you.':
    'Aucun atelier Carnet n’a enregistré {identifier}. Son historique commence avec vous.',
  '17 characters, from the windscreen or the door frame':
    '17 caractères, sur le pare-brise ou le montant de porte',
  Make: 'Marque',
  Model: 'Modèle',
  Year: 'Année',
  'A VIN whose check digit does not add up is recorded as typed and flagged, not refused. You have the car in front of you; the algorithm does not.':
    'Un VIN dont le chiffre de contrôle ne correspond pas est enregistré tel que saisi et signalé, pas refusé. Vous avez la voiture devant vous ; l’algorithme, non.',
  'Add the vehicle': 'Ajouter le véhicule',
  'Why look first': 'Pourquoi chercher d’abord',
  'A vehicle is one record wherever it is serviced. Adding a car that another workshop already keeps would start a second history for the same VIN, so the network refuses that and offers the existing one instead.':
    'Un véhicule n’a qu’un seul dossier, où qu’il soit entretenu. Ajouter une voiture qu’un autre atelier suit déjà ouvrirait un second historique pour le même VIN : le réseau le refuse et propose le dossier existant.',
  'The VIN check digit does not add up. It has been recorded as typed; check it against the plate on the door frame.':
    'Le chiffre de contrôle du VIN ne correspond pas. Il a été enregistré tel que saisi ; vérifiez-le sur la plaque du montant de porte.',
  // vehicles: the network sentence
  'No history on this vehicle yet. What you record here starts it.':
    'Aucun historique sur ce véhicule pour l’instant. Ce que vous enregistrez ici le commence.',
  '1 entry on this vehicle, all recorded here, most recently {when}.':
    '1 entrée sur ce véhicule, enregistrée ici, la dernière en {when}.',
  '{count} entries on this vehicle, all recorded here, most recently {when}.':
    '{count} entrées sur ce véhicule, toutes enregistrées ici, la dernière en {when}.',
  '1 entry on this vehicle, recorded by {first}, most recently {when}. Their commercial detail is withheld; the car’s history is not. What you record continues it.':
    '1 entrée sur ce véhicule, enregistrée par {first}, la dernière en {when}. Leurs données commerciales sont masquées ; l’historique de la voiture ne l’est pas. Ce que vous enregistrez le prolonge.',
  '{count} entries on this vehicle, recorded by {first}, most recently {when}. Their commercial detail is withheld; the car’s history is not. What you record continues it.':
    '{count} entrées sur ce véhicule, enregistrées par {first}, la dernière en {when}. Leurs données commerciales sont masquées ; l’historique de la voiture ne l’est pas. Ce que vous enregistrez le prolonge.',
  '{count} entries on this vehicle, recorded by {first} and {second}, most recently {when}. Their commercial detail is withheld; the car’s history is not. What you record continues it.':
    '{count} entrées sur ce véhicule, enregistrées par {first} et {second}, la dernière en {when}. Leurs données commerciales sont masquées ; l’historique de la voiture ne l’est pas. Ce que vous enregistrez le prolonge.',
  '{count} entries on this vehicle, recorded by {workshops} other workshops, most recently {when}. Their commercial detail is withheld; the car’s history is not. What you record continues it.':
    '{count} entrées sur ce véhicule, enregistrées par {workshops} autres ateliers, la dernière en {when}. Leurs données commerciales sont masquées ; l’historique de la voiture ne l’est pas. Ce que vous enregistrez le prolonge.',
  '{total} entries on this vehicle: {own} recorded here and {others} by {first}, most recently {when}. Their commercial detail is withheld.':
    '{total} entrées sur ce véhicule : {own} enregistrées ici et {others} par {first}, la dernière en {when}. Leurs données commerciales sont masquées.',
  '{total} entries on this vehicle: {own} recorded here and {others} by {first} and {second}, most recently {when}. Their commercial detail is withheld.':
    '{total} entrées sur ce véhicule : {own} enregistrées ici et {others} par {first} et {second}, la dernière en {when}. Leurs données commerciales sont masquées.',
  '{total} entries on this vehicle: {own} recorded here and {others} by {workshops} other workshops, most recently {when}. Their commercial detail is withheld.':
    '{total} entrées sur ce véhicule : {own} enregistrées ici et {others} par {workshops} autres ateliers, la dernière en {when}. Leurs données commerciales sont masquées.',
  'another workshop': 'un autre atelier',
  // vehicles: paperwork
  'No paperwork on this vehicle yet.': 'Aucun document sur ce véhicule pour l’instant.',
  '1 document on file.': '1 document enregistré.',
  '{count} documents on file.': '{count} documents enregistrés.',
  'The MOT has expired.': 'Le contrôle technique a expiré.',
  'The MOT runs out on {date}.': 'Le contrôle technique expire le {date}.',
  'The insurance has expired.': 'L’assurance a expiré.',
  'The insurance runs out on {date}.': 'L’assurance expire le {date}.',
  'No expiry': 'Sans échéance',
  'Expired {date}': 'Expiré le {date}',
  'Runs out {date}': 'Expire le {date}',
  'Valid until {date}': 'Valable jusqu’au {date}',
  'MOT no expiry': 'Contrôle technique sans échéance',
  'MOT expired {date}': 'Contrôle technique expiré le {date}',
  'MOT runs out {date}': 'Contrôle technique expire le {date}',
  'MOT valid until {date}': 'Contrôle technique valable jusqu’au {date}',
  'Insurance no expiry': 'Assurance sans échéance',
  'Insurance expired {date}': 'Assurance expirée le {date}',
  'Insurance runs out {date}': 'Assurance expire le {date}',
  'Insurance valid until {date}': 'Assurance valable jusqu’au {date}',
  Photograph: 'Photo',
  'Registration certificate': 'Certificat d’immatriculation',
  'MOT certificate': 'Procès-verbal de contrôle technique',
  Insurance: 'Assurance',
  'Service record': 'Carnet d’entretien',
  'Purchase invoice': 'Facture d’achat',
  Other: 'Autre',
  Document: 'Document',
  'The owner': 'Le propriétaire',
  // vehicles/[id]
  'Vehicle passport': 'Passeport du véhicule',
  'Buyer report': 'Rapport acheteur',
  Transfer: 'Cession',
  'This vehicle is on your books now. Its history is below, and what you record continues it.':
    'Ce véhicule figure désormais dans vos dossiers. Son historique est ci-dessous, et ce que vous enregistrez le prolonge.',
  'Added. Nobody on the network had seen this vehicle; its history starts here.':
    'Ajouté. Personne sur le réseau n’avait vu ce véhicule ; son historique commence ici.',
  'See it as the next owner will': 'Le voir comme le prochain propriétaire',
  'Find another vehicle': 'Trouver un autre véhicule',
  Identity: 'Identité',
  Engine: 'Moteur',
  Fuel: 'Carburant',
  Body: 'Carrosserie',
  Colour: 'Couleur',
  Transmission: 'Boîte de vitesses',
  '{km} km/month': '{km} km/mois',
  'Current owner': 'Propriétaire actuel',
  'Owners on record': 'Propriétaires enregistrés',
  'Events on record': 'Événements enregistrés',
  petrol: 'essence',
  diesel: 'diesel',
  hybrid: 'hybride',
  plugin_hybrid: 'hybride rechargeable',
  electric: 'électrique',
  lpg: 'GPL',
  hydrogen: 'hydrogène',
  manual: 'manuelle',
  automatic: 'automatique',
  cvt: 'CVT',
  dct: 'double embrayage',
  'Integrity check failed': 'Échec du contrôle d’intégrité',
  'The chain diverges at entry {sequence} ({reason}). Entries before that point are unaffected.':
    'La chaîne diverge à l’entrée {sequence} ({reason}). Les entrées antérieures ne sont pas affectées.',
  'sequence start': 'début de séquence',
  'sequence gap': 'trou dans la séquence',
  'broken link': 'lien rompu',
  'hash mismatch': 'empreinte non concordante',
  '{count} entries, oldest first at the bottom': '{count} entrées, les plus anciennes en bas',
  'No history yet': 'Aucun historique pour l’instant',
  'Entries appear here automatically when a job on this vehicle is completed.':
    'Les entrées apparaissent ici automatiquement quand un travail sur ce véhicule est terminé.',
  Ownership: 'Propriété',
  Mileage: 'Kilométrage',
  Service: 'Entretien',
  Part: 'Pièce',
  Tires: 'Pneus',
  Accident: 'Accident',
  'Recall issued': 'Rappel émis',
  'Recall done': 'Rappel effectué',
  Modification: 'Modification',
  Maintenance: 'Maintenance',
  'Write-off': 'Épave',
  Note: 'Note',
  '{part} fitted': '{part} posé(e)',
  'Part number {number}': 'Référence {number}',
  'Vehicle inspection carried out': 'Contrôle du véhicule effectué',
  '{pass} passed, {advisory} advisory, {critical} critical':
    '{pass} conformes, {advisory} à surveiller, {critical} critiques',
  '{km} km recorded': '{km} km enregistrés',
  'Read at {workshop} during job {number}': 'Relevé chez {workshop} lors du travail {number}',
  'Parts fitted: {parts}. {hours} hours of labour.':
    'Pièces posées : {parts}. {hours} heures de main-d’œuvre.',
  'Parts fitted: {parts}.': 'Pièces posées : {parts}.',
  '{hours} hours of labour.': '{hours} heures de main-d’œuvre.',
  'Ownership transferred': 'Changement de propriétaire',
  'From {from} to {to}': 'De {from} à {to}',
  'Flagged: {reason}': 'Signalé : {reason}',
  'lower than a previous reading': 'inférieur à un relevé précédent',
  'implies an unusually high daily distance':
    'suppose une distance quotidienne anormalement élevée',
  'Open recalls': 'Rappels en cours',
  'Next service': 'Prochain entretien',
  'Due at': 'Prévu à',
  Remaining: 'Restant',
  Projected: 'Prévision',
  'Nothing on file yet. The registration certificate, the MOT and the insurance are the three worth having; a photograph of damage before repair is the fourth.':
    'Rien d’enregistré pour l’instant. Le certificat d’immatriculation, le contrôle technique et l’assurance sont les trois à avoir ; une photo des dégâts avant réparation est le quatrième.',
  'Jobs at this workshop': 'Travaux dans cet atelier',
  'This vehicle has not been worked on here.': 'Ce véhicule n’a pas été pris en charge ici.',
  Condition: 'État',
  'Derived from what is on record, not stored anywhere.':
    'Déduit de ce qui est enregistré, stocké nulle part.',
  'Next likely: {component} in about {km} km.':
    'Probablement ensuite : {component} dans environ {km} km.',
  'Next likely: {component}.': 'Probablement ensuite : {component}.',
  'The whole working': 'Tout le détail du calcul',
  'Under warranty': 'Sous garantie',
  'What this workshop is still standing behind on this vehicle.':
    'Ce que cet atelier garantit encore sur ce véhicule.',
  'Nothing recorded. Cover is written as a job closes.':
    'Rien d’enregistré. La garantie est établie à la clôture d’un travail.',
  '{days}d left': '{days} j restants',
  expired: 'expirée',
  'Not covered: {reason}': 'Non couvert : {reason}',
  'Out of cover on mileage, by {km} miles.': 'Hors garantie au kilométrage, de {km} miles.',
  'Cover ran out on {date}.': 'La garantie a pris fin le {date}.',
  'Covered for another 1 day, or {km} miles, whichever comes first.':
    'Couvert encore 1 jour, ou {km} miles, selon ce qui arrive en premier.',
  'Covered for another {days} days, or {km} miles, whichever comes first.':
    'Couvert encore {days} jours, ou {km} miles, selon ce qui arrive en premier.',
  'Covered for another 1 day.': 'Couvert encore 1 jour.',
  'Covered for another {days} days.': 'Couvert encore {days} jours.',
  'Unnamed owner': 'Propriétaire sans nom',
  present: 'aujourd’hui',
  // vehicles: health
  'Nothing is on record for this vehicle yet, so there is nothing to score.':
    'Rien n’est encore enregistré pour ce véhicule : il n’y a donc rien à noter.',
  'Nothing on record needs attention.': 'Rien d’enregistré ne demande d’attention.',
  '{factor} is what holds this back. {why}': '{factor} : c’est ce qui fait baisser la note. {why}',
  'maintenance kept up': 'Entretien suivi',
  'faults left open': 'Défauts non traités',
  'condition of components': 'État des composants',
  'work turned down': 'Travaux refusés',
  'how recently it was looked at': 'Date du dernier contrôle',
  'how much is on record': 'Quantité d’historique',
  'Maintenance kept up': 'Entretien suivi',
  'Faults left open': 'Défauts non traités',
  'Condition of components': 'État des composants',
  'Work turned down': 'Travaux refusés',
  'How recently it was looked at': 'Date du dernier contrôle',
  'How much is on record': 'Quantité d’historique',
  'No service schedule on record for this vehicle.':
    'Aucun plan d’entretien enregistré pour ce véhicule.',
  'All {count} scheduled services are up to date.': 'Les {count} entretiens prévus sont à jour.',
  '{overdue} of {total} overdue, the worst by {days} days.':
    '{overdue} sur {total} en retard, le pire de {days} jours.',
  'Nothing has ever been inspected, so nothing is known to be wrong.':
    'Rien n’a jamais été contrôlé : aucun défaut n’est donc connu.',
  'Nothing found at the last inspection is still outstanding.':
    'Rien de ce qui a été relevé au dernier contrôle n’est encore en suspens.',
  '{critical} critical and {advisory} advisory items still open.':
    '{critical} points critiques et {advisory} points à surveiller encore ouverts.',
  'No parts on record, so no component can be aged.':
    'Aucune pièce enregistrée : aucun composant ne peut donc être daté.',
  '{component} is past its usual life.': '{component} a dépassé sa durée de vie habituelle.',
  '{component} is the furthest through its life, at {percent}%.':
    '{component} est le plus avancé dans sa durée de vie, à {percent} %.',
  'a component': 'un composant',
  'Nothing has been quoted on this vehicle yet.': 'Aucun devis sur ce véhicule pour l’instant.',
  'No recommended work has been turned down.': 'Aucun travail recommandé n’a été refusé.',
  '1 recommended item turned down, {critical} of them critical.':
    '1 point recommandé refusé, dont {critical} critique.',
  '{count} recommended items turned down, {critical} of them critical.':
    '{count} points recommandés refusés, dont {critical} critiques.',
  'No inspection has been carried out on this vehicle.':
    'Aucun contrôle n’a été effectué sur ce véhicule.',
  'Last inspected {days} days ago.': 'Dernier contrôle il y a {days} jours.',
  'No visits on record.': 'Aucune visite enregistrée.',
  '1 recorded visit.': '1 visite enregistrée.',
  '{count} recorded visits.': '{count} visites enregistrées.',
  Battery: 'Batterie',
  'Front brake pads': 'Plaquettes de frein avant',
  'Rear brake pads': 'Plaquettes de frein arrière',
  'Front brake discs': 'Disques de frein avant',
  'Rear brake discs': 'Disques de frein arrière',
  Tyres: 'Pneus',
  Clutch: 'Embrayage',
  'Timing belt': 'Courroie de distribution',
  'Engine oil and filter': 'Huile moteur et filtre',
  'Air filter': 'Filtre à air',
  'Cabin filter': 'Filtre d’habitacle',
  'Fuel filter': 'Filtre à carburant',
  'Spark plugs': 'Bougies',
  Coolant: 'Liquide de refroidissement',
  'Brake fluid': 'Liquide de frein',
  'Wiper blades': 'Balais d’essuie-glace',
  Suspension: 'Suspension',
  Exhaust: 'Échappement',
  // vehicles/[id]/condition
  'Back to the vehicle': 'Retour au véhicule',
  'What this vehicle is in, and every figure that says so':
    'L’état de ce véhicule, et chaque chiffre qui le montre',
  'Built from {count} of 6 measures, covering {percent}% of the weight. The score belongs to the vehicle, not to this workshop: nothing in it measures what was spent here or how recently the car visited.':
    'Calculé à partir de {count} mesures sur 6, couvrant {percent} % du poids. La note appartient au véhicule, pas à cet atelier : rien n’y mesure ce qui a été dépensé ici ni la date de la dernière visite.',
  'What makes up the score': 'Ce qui compose la note',
  'Worst first. Every one of these is checkable against the record.':
    'Le pire d’abord. Chacun peut être vérifié dans le dossier.',
  'Nothing to score': 'Rien à noter',
  'No visit, inspection, part or schedule is on record for this vehicle.':
    'Aucune visite, aucun contrôle, aucune pièce ni aucun plan n’est enregistré pour ce véhicule.',
  'Counts for {percent}% of the score.': 'Compte pour {percent} % de la note.',
  'What could not be scored': 'Ce qui n’a pas pu être noté',
  'Left out of the total rather than counted as a pass or a fail.':
    'Exclu du total plutôt que compté comme réussi ou échoué.',
  'Likely due': 'Probablement à prévoir',
  'From this vehicle’s own mileage, about {km} km a day.':
    'D’après le kilométrage de ce véhicule, environ {km} km par jour.',
  'Not enough odometer history to work from distance, so these are from age.':
    'Pas assez de relevés kilométriques pour raisonner en distance : ces prévisions se fondent sur l’âge.',
  'Nothing is due inside the next four months.':
    'Rien n’est à prévoir dans les quatre prochains mois.',
  '{km} km past': 'dépassé de {km} km',
  'in about {km} km': 'dans environ {km} km',
  '{days} days past': 'dépassé de {days} jours',
  'in about {months} months': 'dans environ {months} mois',
  'Confidence high.': 'Confiance élevée.',
  'Confidence medium.': 'Confiance moyenne.',
  'Confidence low.': 'Confiance faible.',
  'This vehicle has gone about {km} km between changes.':
    'Ce véhicule a parcouru environ {km} km entre deux remplacements.',
  'No pattern for this vehicle yet, so a general {km} km is used at {rate} km a day.':
    'Pas encore d’historique pour ce véhicule : une valeur générale de {km} km est utilisée, à {rate} km par jour.',
  'No pattern and no mileage rate, so this is from age alone.':
    'Ni historique ni rythme kilométrique : cette prévision se fonde sur l’âge seul.',
  Components: 'Composants',
  'What is on this vehicle, how old it is, and how far through its life.':
    'Ce qui est monté sur ce véhicule, son âge et son avancement dans sa durée de vie.',
  'No parts on record': 'Aucune pièce enregistrée',
  'Components appear here as parts are fitted on a job.':
    'Les composants apparaissent ici à mesure que des pièces sont posées lors d’un travail.',
  new: 'neuf',
  good: 'bon',
  ageing: 'vieillissant',
  due: 'à prévoir',
  overdue: 'dépassé',
  unknown: 'inconnu',
  'Fitted this month.': 'Posé ce mois-ci.',
  'Fitted this month, {km} km ago.': 'Posé ce mois-ci, il y a {km} km.',
  '1 month old.': 'Âgé de 1 mois.',
  '{count} months old.': 'Âgé de {count} mois.',
  '1 month old, {km} km ago.': 'Âgé de 1 mois, il y a {km} km.',
  '{count} months old, {km} km ago.': 'Âgé de {count} mois, il y a {km} km.',
  'Fitted {date}, {brand}.': 'Posé le {date}, {brand}.',
  'Fitted {date}.': 'Posé le {date}.',
  '{percent}% through its usual life, on distance.':
    '{percent} % de sa durée de vie habituelle, en distance.',
  '{percent}% through its usual life, on age.':
    '{percent} % de sa durée de vie habituelle, en âge.',
  '{count} components have no record here.': '{count} composants n’ont aucun enregistrement ici.',
  'That is not the same as them being new.': 'Cela ne veut pas dire qu’ils sont neufs.',
  'This vehicle has {mileage} on it and {visits} recorded visits, and anything fitted before those visits, or elsewhere, is not in this list.':
    'Ce véhicule affiche {mileage} et {visits} visites enregistrées ; tout ce qui a été posé avant ces visites, ou ailleurs, ne figure pas dans cette liste.',
  'Working out the condition of this vehicle': 'Calcul de l’état de ce véhicule',
  // vehicles/[id]/passport
  'The vehicle': 'Le véhicule',
  'As the next owner will see it': 'Tel que le prochain propriétaire le verra',
  'The document a buyer receives through a share link, word for word. No owner is named on it.':
    'Le document qu’un acheteur reçoit par un lien de partage, mot pour mot. Aucun propriétaire n’y est nommé.',
  // vehicles/[id]/report
  'Vehicle report': 'Rapport du véhicule',
  'Buyer check code': 'Code de vérification acheteur',
  'Private owner': 'Particulier',
  Dealer: 'Négociant',
  'Finance company': 'Société de financement',
  'less than a month': 'moins d’un mois',
  'less than a month, still': 'moins d’un mois, toujours propriétaire',
  '1 month': '1 mois',
  '1 month, still': '1 mois, toujours propriétaire',
  '{count} months': '{count} mois',
  '{count} months, still': '{count} mois, toujours propriétaire',
  '{count} years': '{count} ans',
  '{count} years, still': '{count} ans, toujours propriétaire',
  'Carnet vehicle report': 'Rapport de véhicule Carnet',
  Verified: 'Vérifié',
  'Does not check out': 'Ne se vérifie pas',
  Unverified: 'Non vérifié',
  'What the record says': 'Ce que dit le dossier',
  Owners: 'Propriétaires',
  'How many, and how long each kept it. No names: those belong to them.':
    'Combien, et combien de temps chacun l’a gardé. Aucun nom : ils leur appartiennent.',
  'Owner {position} · {kind}': 'Propriétaire {position} · {kind}',
  'No ownership on record.': 'Aucun propriétaire enregistré.',
  'What this does not cover': 'Ce que ce rapport ne couvre pas',
  'Said here rather than left for somebody to discover.': 'Dit ici plutôt que laissé à découvrir.',
  'Worth asking about': 'Questions à poser',
  'Each of these has an innocent explanation and at least one that is not.':
    'Chacun de ces points a une explication innocente et au moins une qui ne l’est pas.',
  'Give a buyer a code': 'Donner un code à un acheteur',
  'They check the same figures at /verify, with no account and nothing about the owner.':
    'Il vérifie les mêmes chiffres sur /verify, sans compte et sans rien sur le propriétaire.',
  'Written down now, or it is gone:': 'Notez-le maintenant, sinon il est perdu :',
  'Good for ninety days. Only its fingerprint is stored, so this screen is the one chance to copy it. Issue another whenever you need one.':
    'Valable quatre-vingt-dix jours. Seule son empreinte est conservée : cet écran est la seule occasion de le copier. Émettez-en un autre quand vous en avez besoin.',
  'Issue a check code': 'Émettre un code de vérification',
  'Recorded events': 'Événements enregistrés',
  Services: 'Entretiens',
  'Unresolved critical items': 'Points critiques non résolus',
  'Outstanding recalls': 'Rappels en suspens',
  'Mileage recorded': 'Kilométrage enregistré',
  'Last service': 'Dernier entretien',
  None: 'Aucun',
  'None on record': 'Aucun enregistré',
  'The record starts in {start}, and the vehicle was first registered in {registered}. About 1 year before that is not covered here at all.':
    'Le dossier commence en {start}, et le véhicule a été immatriculé pour la première fois en {registered}. Environ 1 année avant cela n’est pas du tout couverte ici.',
  'The record starts in {start}, and the vehicle was first registered in {registered}. About {years} years before that is not covered here at all.':
    'Le dossier commence en {start}, et le véhicule a été immatriculé pour la première fois en {registered}. Environ {years} années avant cela ne sont pas du tout couvertes ici.',
  'Nothing is recorded for this vehicle yet.': 'Rien n’est encore enregistré pour ce véhicule.',
  'No service has been recorded, which is not the same as none having been done.':
    'Aucun entretien n’a été enregistré, ce qui ne veut pas dire qu’aucun n’a été fait.',
  'Nothing here was inspected by a workshop, so the condition of the vehicle is not part of this record.':
    'Rien ici n’a été contrôlé par un atelier : l’état du véhicule ne fait donc pas partie de ce dossier.',
  'This covers what participating workshops recorded. Work done elsewhere, or by the owner, does not appear.':
    'Ceci couvre ce que les ateliers participants ont enregistré. Les travaux faits ailleurs, ou par le propriétaire, n’apparaissent pas.',
  '1 critical item was found and has not been recorded as put right. Ask for the invoice, not a description.':
    '1 point critique a été relevé et n’a pas été enregistré comme corrigé. Demandez la facture, pas une description.',
  '{count} critical items were found and have not been recorded as put right. Ask for the invoice, not a description.':
    '{count} points critiques ont été relevés et n’ont pas été enregistrés comme corrigés. Demandez la facture, pas une description.',
  '1 manufacturer recall shows as outstanding. A franchised dealer does these free; ask whether it has been done and is simply unrecorded.':
    '1 rappel constructeur apparaît en suspens. Un concessionnaire le fait gratuitement ; demandez s’il a été fait et simplement pas enregistré.',
  '{count} manufacturer recalls shows as outstanding. A franchised dealer does these free; ask whether it has been done and is simply unrecorded.':
    '{count} rappels constructeur apparaissent en suspens. Un concessionnaire les fait gratuitement ; demandez s’ils ont été faits et simplement pas enregistrés.',
  '1 odometer reading did not follow the one before it. That has innocent explanations, and it also has one that is not. Ask.':
    '1 relevé kilométrique ne suivait pas le précédent. Il y a des explications innocentes, et aussi une qui ne l’est pas. Demandez.',
  '{count} odometer readings did not follow the one before it. That has innocent explanations, and it also has one that is not. Ask.':
    '{count} relevés kilométriques ne suivaient pas le précédent. Il y a des explications innocentes, et aussi une qui ne l’est pas. Demandez.',
  'The last recorded service was {date}. Ask what has been done since and where.':
    'Le dernier entretien enregistré date de {date}. Demandez ce qui a été fait depuis, et où.',
  '{count} owners is a lot for one vehicle. Not a fault in itself, and worth a question.':
    '{count} propriétaires, c’est beaucoup pour un véhicule. Pas un défaut en soi, mais cela mérite une question.',
  'Every record in this history was checked against the one before it, and nothing has been altered or removed since it was written.':
    'Chaque enregistrement de cet historique a été vérifié par rapport au précédent, et rien n’a été modifié ni supprimé depuis son écriture.',
  'This history does not check out. A record has been altered or removed since it was written, and nothing here should be relied on.':
    'Cet historique ne se vérifie pas. Un enregistrement a été modifié ou supprimé depuis son écriture, et rien ici ne doit être considéré comme fiable.',
  'This history could not be checked. Treat it as unverified.':
    'Cet historique n’a pas pu être vérifié. Considérez-le comme non vérifié.',
  'Do not rely on this record.': 'Ne vous fiez pas à ce dossier.',
  'The record is intact, and it has things in it to ask about.':
    'Le dossier est intact, et il contient des points à éclaircir.',
  'There is nothing on record for this vehicle.': 'Rien n’est enregistré pour ce véhicule.',
  'A full record, intact, with nothing outstanding on it.':
    'Un dossier complet, intact, sans rien en suspens.',
  'Intact, but thin. Read what it does not cover as carefully as what it does.':
    'Intact, mais mince. Lisez ce qu’il ne couvre pas aussi attentivement que ce qu’il couvre.',
  // vehicles/[id]/transfer
  'Say what day the vehicle changed hands.': 'Indiquez le jour où le véhicule a changé de mains.',
  'Record that this vehicle has changed hands': 'Enregistrer que ce véhicule a changé de mains',
  'That cannot be recorded': 'Impossible de l’enregistrer',
  'Who it is going to': 'À qui il revient',
  'The history goes with the vehicle. The previous owner’s details do not.':
    'L’historique suit le véhicule. Les coordonnées du précédent propriétaire, non.',
  'New owner': 'Nouveau propriétaire',
  'The name that will appear as the current owner.':
    'Le nom qui apparaîtra comme propriétaire actuel.',
  'Full name or company': 'Nom complet ou entreprise',
  'Day it changed hands': 'Date du changement de mains',
  'Reading at the sale': 'Relevé à la vente',
  'Optional. Left blank, the last reading on record is used.':
    'Facultatif. Laissé vide, le dernier relevé enregistré est utilisé.',
  'Record it even if work is still open on this vehicle.':
    'L’enregistrer même si des travaux sont encore ouverts sur ce véhicule.',
  'Any open job stays on the previous owner’s account.':
    'Tout travail ouvert reste sur le compte du précédent propriétaire.',
  'Record the transfer': 'Enregistrer la cession',
  'Who has it now': 'Qui l’a actuellement',
  Unnamed: 'Sans nom',
  Since: 'Depuis',
  'No current owner on record. Record one before transferring, or the history will have a gap nobody can explain later.':
    'Aucun propriétaire actuel enregistré. Enregistrez-en un avant la cession, sinon l’historique aura un trou que personne ne pourra expliquer plus tard.',
  'What happens': 'Ce qui se passe',
  'The current ownership closes on the day you give, a new one opens, and the vehicle record gains an entry saying it changed hands at that mileage.':
    'La propriété actuelle se termine à la date indiquée, une nouvelle commence, et le dossier du véhicule reçoit une entrée indiquant qu’il a changé de mains à ce kilométrage.',
  'No name goes into that entry. Who owned the car lives in the ownership record, where an erasure request can reach it. A permanent chain with somebody’s name hashed into it is a chain that cannot honour one.':
    'Aucun nom n’entre dans cette entrée. Qui possédait la voiture figure dans le registre de propriété, où une demande d’effacement peut l’atteindre. Une chaîne permanente contenant le nom de quelqu’un ne pourrait jamais honorer une telle demande.',
  'Every service, inspection and reading stays with the vehicle, which is the entire point: the new owner inherits a history they can rely on.':
    'Chaque entretien, contrôle et relevé reste avec le véhicule, et c’est tout l’intérêt : le nouveau propriétaire hérite d’un historique fiable.',
  // passports
  'The record that belongs to each car. One line per vehicle; open any to read it as the next owner will.':
    'Le dossier qui appartient à chaque voiture. Une ligne par véhicule ; ouvrez-en un pour le lire comme le prochain propriétaire.',
  'Vehicles this workshop has written to': 'Véhicules sur lesquels cet atelier a écrit',
  Entries: 'Entrées',
  'Across all of them': 'Sur l’ensemble',
  'Chains sound': 'Chaînes intègres',
  '{count} do not verify': '{count} ne se vérifient pas',
  'Every entry hashes to the one before': 'Chaque entrée est liée par empreinte à la précédente',
  'Shared with other workshops': 'Partagés avec d’autres ateliers',
  'Written to by more than one garage': 'Alimentés par plus d’un garage',
  'Search passports': 'Rechercher des passeports',
  'A passport appears here the first time a job is completed on a vehicle, or when one is found on the network.':
    'Un passeport apparaît ici la première fois qu’un travail est terminé sur un véhicule, ou quand il est trouvé sur le réseau.',
  Recorded: 'Enregistré',
  Chain: 'Chaîne',
  '{count} from elsewhere': '{count} d’ailleurs',
  Empty: 'Vide',
  Verifies: 'Se vérifie',
  // recalls
  'Manufacturer campaigns against the vehicles this workshop has seen':
    'Campagnes constructeur visant les véhicules que cet atelier a vus',
  'Not recorded as done': 'Non enregistrés comme effectués',
  Safety: 'Sécurité',
  'Of those, safety-related': 'Dont liés à la sécurité',
  'On record': 'Enregistrés',
  'Across every vehicle seen here': 'Sur tous les véhicules vus ici',
  'This is a record, not a source.': 'Ceci est un registre, pas une source.',
  'It shows campaigns already recorded against these vehicles. It does not query the manufacturer, so a vehicle showing nothing here has not been checked and cleared: it has not been checked. Anything safety-related goes to a franchised dealer, who does the work free and has the authoritative list.':
    'Il montre les campagnes déjà enregistrées pour ces véhicules. Il n’interroge pas le constructeur : un véhicule sans rien ici n’a pas été vérifié et déclaré en règle, il n’a simplement pas été vérifié. Tout ce qui touche à la sécurité va chez un concessionnaire, qui fait le travail gratuitement et détient la liste officielle.',
  'Outstanding first, then everything already put right.':
    'Les rappels en suspens d’abord, puis tout ce qui a déjà été corrigé.',
  'No recalls recorded': 'Aucun rappel enregistré',
  'Campaigns appear here once they are recorded against a vehicle this workshop has seen.':
    'Les campagnes apparaissent ici dès qu’elles sont enregistrées pour un véhicule que cet atelier a vu.',
  Campaign: 'Campagne',
  Issued: 'Émis',
  State: 'État',
  'safety, outstanding': 'sécurité, en suspens',
  outstanding: 'en suspens',
  done: 'effectué',
  // fleet
  'Company accounts with more than one vehicle on the books':
    'Comptes d’entreprise avec plus d’un véhicule enregistré',
  Accounts: 'Comptes',
  'Companies with a fleet': 'Entreprises avec une flotte',
  'Off the road': 'Immobilisés',
  'In the workshop now': 'À l’atelier en ce moment',
  'Last thirty days': 'Trente derniers jours',
  'Invoiced to fleets': 'Facturé aux flottes',
  '1 fleet vehicle is past a service.': '1 véhicule de flotte a dépassé un entretien.',
  '{count} fleet vehicles are past a service.':
    '{count} véhicules de flotte ont dépassé un entretien.',
  'A fleet manager is measured on downtime, so an overdue van is their problem before it is yours. Telling them first is worth more than the service itself.':
    'Un gestionnaire de flotte est jugé sur l’immobilisation : une camionnette en retard est son problème avant d’être le vôtre. Le prévenir en premier vaut plus que l’entretien lui-même.',
  'The accounts': 'Les comptes',
  'Most vehicles first. Open one to see what is wrong with which van.':
    'Les plus grandes flottes d’abord. Ouvrez-en une pour voir ce qui ne va pas sur quelle camionnette.',
  'No fleets yet': 'Aucune flotte pour l’instant',
  'A company customer with more than one vehicle appears here automatically. Nothing needs setting up.':
    'Un client entreprise avec plus d’un véhicule apparaît ici automatiquement. Rien à configurer.',
  'Due soon': 'Bientôt dus',
  'Waiting on them': 'En attente de leur réponse',
  '30 days': '30 jours',
  // fleet/[id]
  'All fleets': 'Toutes les flottes',
  '1 vehicle on the books': '1 véhicule enregistré',
  '{count} vehicles on the books': '{count} véhicules enregistrés',
  'The account': 'Le compte',
  'Seen at least once': 'Vus au moins une fois',
  'Quotes nobody has answered': 'Devis restés sans réponse',
  'Spent with you': 'Dépensé chez vous',
  'Across every vehicle': 'Sur tous les véhicules',
  '1 vehicle waiting on a decision.': '1 véhicule en attente d’une décision.',
  '{count} vehicles waiting on a decision.': '{count} véhicules en attente d’une décision.',
  'A fleet quote usually sits with one person who has forty other things on. Nothing happens until they answer, and the van is off the road the whole time.':
    'Un devis de flotte attend généralement une seule personne qui a quarante autres choses à faire. Rien ne se passe tant qu’elle n’a pas répondu, et la camionnette reste immobilisée tout ce temps.',
  'Vehicles appear here once this company has brought one in.':
    'Les véhicules apparaissent ici dès que cette entreprise en a amené un.',
  'last in {date}': 'dernière visite le {date}',
  'Waiting on a decision': 'En attente d’une décision',
  'In the workshop': 'À l’atelier',
  'service overdue': 'entretien en retard',
  'nothing due': 'rien à prévoir',
  Spent: 'Dépensé',
  'Terms saved. They apply to every invoice raised for this fleet from now on.':
    'Conditions enregistrées. Elles s’appliquent désormais à chaque facture émise pour cette flotte.',
  'Agreed terms': 'Conditions convenues',
  'Applied at invoice time, so the job keeps its list figures.':
    'Appliquées au moment de la facturation : le travail garde ses prix catalogue.',
  'None yet. Without terms this fleet pays list price like anybody else.':
    'Aucune pour l’instant. Sans conditions, cette flotte paie le prix catalogue comme tout le monde.',
  'Labour discount': 'Remise main-d’œuvre',
  'Parts discount': 'Remise pièces',
  'Payment terms': 'Délai de paiement',
  days: 'jours',
  'One invoice a month for everything completed, rather than one per job':
    'Une facture par mois pour tout ce qui est terminé, plutôt qu’une par travail',
  'Their purchase order number must be on every job before it is invoiced':
    'Leur numéro de bon de commande doit figurer sur chaque travail avant facturation',
  'Update the terms': 'Mettre à jour les conditions',
  'Save the terms': 'Enregistrer les conditions',
  'Invoice a month': 'Facturer un mois',
  'Every job completed in the month, on one invoice, at the agreed terms.':
    'Tous les travaux terminés dans le mois, sur une seule facture, aux conditions convenues.',
  Month: 'Mois',
  'Jobs already invoiced on their own are left alone. Each line on the invoice names the vehicle and the job it came from, so their accounts department can tie a line to a van.':
    'Les travaux déjà facturés séparément ne sont pas repris. Chaque ligne de la facture indique le véhicule et le travail d’origine, pour que leur service comptable puisse rattacher une ligne à une camionnette.',
  'Issue the month’s invoice': 'Émettre la facture du mois',
  'Save the terms first': 'Enregistrez d’abord les conditions',
  // reminders
  'Service reminders': 'Rappels d’entretien',
  'Due in the next {days} days': 'Dus dans les {days} prochains jours',
  '{days}d': '{days} j',
  'Within {days} days': 'Sous {days} jours',
  'Past the interval already': 'Intervalle déjà dépassé',
  'Nobody to tell': 'Personne à prévenir',
  'No address on the owner': 'Aucune adresse pour le propriétaire',
  'Already sent': 'Déjà envoyés',
  'Reminder has gone out': 'Le rappel est parti',
  '1 vehicle due with no way to tell the owner.':
    '1 véhicule arrive à échéance sans moyen de prévenir le propriétaire.',
  '{count} vehicles due with no way to tell the owner.':
    '{count} véhicules arrivent à échéance sans moyen de prévenir le propriétaire.',
  'The reminder will not go out, and nothing will report a failure, because there was nothing to fail. These are the ones that quietly become somebody else’s customer.':
    'Le rappel ne partira pas, et aucun échec ne sera signalé, puisqu’il n’y avait rien à faire échouer. Ce sont ceux-là qui deviennent discrètement les clients de quelqu’un d’autre.',
  Due: 'Échéance',
  'Soonest first. This is what the reminder worker will act on.':
    'Les plus proches d’abord. C’est ce que le service de rappels va traiter.',
  'No vehicle reaches its service interval in the next {days} days.':
    'Aucun véhicule n’atteint son intervalle d’entretien dans les {days} prochains jours.',
  'no address': 'aucune adresse',
  'By mileage': 'Au kilométrage',
  sent: 'envoyé',
  'cannot send': 'envoi impossible',
  'Paperwork running out': 'Documents arrivant à échéance',
  'The latest MOT or insurance on file for a vehicle this workshop looks after, within forty-five days or already gone':
    'Le dernier contrôle technique ou la dernière assurance enregistrés pour un véhicule suivi par cet atelier, à moins de quarante-cinq jours ou déjà expirés',
  'Nothing on file is running out. Paperwork is added on the vehicle’s page, or by the owner from their portal.':
    'Aucun document n’arrive à échéance. Les documents s’ajoutent sur la page du véhicule, ou par le propriétaire depuis son portail.',
  'How this works': 'Comment ça marche',
  'A service interval is set by time, by mileage, or by both. Where mileage is involved the due date is projected from how far the vehicle has actually been travelling, not from an average, so a van that does 30,000 a year is not reminded on the same schedule as a car that does 4,000.':
    'Un intervalle d’entretien se définit par la durée, le kilométrage ou les deux. Quand le kilométrage entre en jeu, l’échéance est projetée à partir de la distance réellement parcourue par le véhicule, pas d’une moyenne : une camionnette qui fait 30 000 par an n’est pas rappelée au même rythme qu’une voiture qui en fait 4 000.',
  'The worker sends each reminder once and records when. Nothing on this page sends anything: it is here so somebody can tell the difference between a quiet month and a worker that has stopped.':
    'Le service envoie chaque rappel une seule fois et en note la date. Rien sur cette page n’envoie quoi que ce soit : elle existe pour distinguer un mois calme d’un service qui s’est arrêté.',
  // crm
  'Who has stopped coming, who is staying, and who you are allowed to write to':
    'Qui ne vient plus, qui reste, et à qui vous avez le droit d’écrire',
  'Nothing was sent': 'Rien n’a été envoyé',
  'Saved as a draft': 'Enregistré comme brouillon',
  'Nothing has gone out. The campaign below will say how many people it reaches before you commit to it.':
    'Rien n’est parti. La campagne ci-dessous indiquera combien de personnes elle touche avant que vous ne vous engagiez.',
  Sent: 'Envoyé',
  '{sent} written to, {held} held back. There is no way to call it back.':
    '{sent} destinataires, {held} retenus. Il n’y a aucun moyen de l’annuler.',
  'Lapsed a year': 'Absents depuis un an',
  'Not been in for 12 months': 'Pas venus depuis 12 mois',
  Reachable: 'Joignables',
  'Of those, by email': 'Dont par e-mail',
  Cohorts: 'Cohortes',
  'Months with a first visit': 'Mois avec une première visite',
  'Campaigns sent': 'Campagnes envoyées',
  '{count} in total': '{count} au total',
  '{count} of the people below cannot be written to.':
    '{count} des personnes ci-dessous ne peuvent pas recevoir de message.',
  'Some never agreed to marketing and some have no address on file. They stay in the segment and out of the send, and the reason is kept against each one.':
    'Certaines n’ont jamais accepté le marketing et d’autres n’ont pas d’adresse enregistrée. Elles restent dans le segment mais hors de l’envoi, et le motif est conservé pour chacune.',
  Segments: 'Segments',
  'The count that matters is the second one: how many can actually be reached.':
    'Le chiffre qui compte est le second : combien peuvent réellement être joints.',
  Segment: 'Segment',
  'In it': 'Membres',
  'Held back': 'Retenus',
  Worth: 'Valeur',
  'If you sent it': 'Si vous l’envoyiez',
  '{count} emails, nothing to pay.': '{count} e-mails, rien à payer.',
  'Retention by cohort': 'Fidélisation par cohorte',
  'Share of each month’s new customers who came back, by months since. An overall rate would move with acquisition and tell you nothing.':
    'Part des nouveaux clients de chaque mois qui sont revenus, selon le nombre de mois écoulés. Un taux global varierait avec l’acquisition et ne vous apprendrait rien.',
  'No completed visits yet': 'Aucune visite terminée pour l’instant',
  'Cohorts appear once customers have a first visit to be counted from.':
    'Les cohortes apparaissent dès que des clients ont une première visite à partir de laquelle compter.',
  'First came in': 'Première visite',
  Size: 'Taille',
  'Worth each': 'Valeur par client',
  'Write a campaign': 'Rédiger une campagne',
  'Saving writes a draft and sends nothing. The audience is stored as its rules, so consent is rechecked against every person at the moment you send.':
    'Enregistrer crée un brouillon et n’envoie rien. L’audience est conservée sous forme de règles : le consentement est revérifié pour chaque personne au moment de l’envoi.',
  'Call it': 'Nom',
  'Winter check offer': 'Offre contrôle hiver',
  Who: 'Qui',
  '{segment} ({count} reachable)': '{segment} ({count} joignables)',
  How: 'Comment',
  'A text costs money to send. Email does not.':
    'Un SMS coûte de l’argent à envoyer. Un e-mail, non.',
  Text: 'SMS',
  Subject: 'Objet',
  'Email only.': 'E-mail uniquement.',
  'A free winter check while the weather turns': 'Un contrôle hiver gratuit avant le froid',
  'What it says': 'Message',
  'Save as a draft': 'Enregistrer comme brouillon',
  'Consent is rechecked for every recipient at the moment of sending, never taken from when the list was built.':
    'Le consentement est revérifié pour chaque destinataire au moment de l’envoi, jamais repris de la date de création de la liste.',
  'No campaigns': 'Aucune campagne',
  'A campaign is a segment and a message. It is the one thing here that cannot be undone.':
    'Une campagne, c’est un segment et un message. C’est la seule chose ici qui ne peut pas être annulée.',
  Channel: 'Canal',
  When: 'Quand',
  'Not sent': 'Non envoyée',
  'Send it': 'L’envoyer',
  draft: 'brouillon',
  sending: 'envoi en cours',
  cancelled: 'annulée',
  'Not been in for {days} days': 'Pas venus depuis {days} jours',
  'Spent more than £{amount} with you': 'Ont dépensé plus de {amount} £ chez vous',
  'Been in at least {count} times': 'Venus au moins {count} fois',
  'Has a vehicle over {years} years old': 'Ont un véhicule de plus de {years} ans',
  'Came once and never came back': 'Venus une fois et jamais revenus',
  'Declined work in the last {days} days': 'Ont refusé des travaux ces {days} derniers jours',
  'Nobody in this segment can be contacted on this channel.':
    'Personne dans ce segment ne peut être contacté sur ce canal.',
  'More of this segment cannot be reached ({unreachable}) than can ({reachable}).':
    'Dans ce segment, plus de personnes sont injoignables ({unreachable}) que joignables ({reachable}).',
  '1 person has not agreed to marketing and will not be sent to.':
    '1 personne n’a pas accepté le marketing et ne recevra rien.',
  '{count} people have not agreed to marketing and will not be sent to.':
    '{count} personnes n’ont pas accepté le marketing et ne recevront rien.',
  // Phase 41: tax, configurable.
  'Exempt. No tax is charged on their invoices.':
    'Exonéré. Aucune taxe n’est facturée sur ses factures.',
  'Charged tax as usual.': 'Taxé normalement.',
  'Exempt from tax': 'Exonéré de taxe',
  'Certificate or registration number': 'Numéro de certificat ou d’immatriculation',
  'Required when exempt. It is printed on every invoice to them.':
    'Obligatoire en cas d’exonération. Il figure sur chacune de ses factures.',
};

export const ar: Readonly<Record<string, string>> = {
  // customers/new
  'New customer': 'عميل جديد',
  'All customers': 'كل العملاء',
  'A name and one way to reach them is enough. The rest can wait.':
    'يكفي اسم ووسيلة واحدة للتواصل. الباقي يمكن أن ينتظر.',
  'Open them instead': 'افتح ملفه بدلاً من ذلك',
  'Who they are': 'من هو',
  'What goes on the invoice': 'ما يظهر على الفاتورة',
  Kind: 'النوع',
  'Changes which name is asked for': 'يحدد الاسم المطلوب',
  'A person': 'فرد',
  'A company': 'شركة',
  'First name': 'الاسم الأول',
  'For a person': 'للفرد',
  'Last name': 'اسم العائلة',
  'Company name': 'اسم الشركة',
  'For a company or a fleet': 'لشركة أو أسطول',
  'VAT number': 'الرقم الضريبي',
  'Optional. Goes on their invoices.': 'اختياري. يظهر على فواتيره.',
  'Where they are': 'عنوانه',
  'Optional, and worth having before the first invoice': 'اختياري، ومن المفيد وجوده قبل أول فاتورة',
  Address: 'العنوان',
  'Address, continued': 'تتمة العنوان',
  Town: 'المدينة',
  County: 'المنطقة',
  Postcode: 'الرمز البريدي',
  'How to reach them': 'كيف نتواصل معه',
  'At least one. Everything the workshop sends goes here.':
    'وسيلة واحدة على الأقل. كل ما ترسله الورشة يصل إليها.',
  Email: 'البريد الإلكتروني',
  'Quotes, invoices and the portal link': 'عروض الأسعار والفواتير ورابط البوابة',
  Mobile: 'الجوال',
  'Texts about the car': 'رسائل نصية عن السيارة',
  'Other telephone': 'هاتف آخر',
  'Landline or work number': 'هاتف أرضي أو رقم العمل',
  Marketing: 'التسويق',
  'Separate from anything about their own car': 'منفصل عن كل ما يخص سيارته',
  'They agreed to marketing emails': 'وافق على رسائل البريد التسويقية',
  'They agreed to marketing texts': 'وافق على الرسائل النصية التسويقية',
  'Service reminders and messages about a job in progress are not marketing and go out either way.':
    'تذكيرات الصيانة والرسائل عن عمل جارٍ ليست تسويقاً وتُرسل في كل الأحوال.',
  'Anything else': 'أي شيء آخر',
  'How they found you': 'كيف عرف بكم',
  Optional: 'اختياري',
  'Recommended by a neighbour': 'بتوصية من جار',
  'Arrived with a code': 'جاء برمز',
  'Optional. Another customer’s referral code; both sides are paid once this one has had work done':
    'اختياري. رمز إحالة من عميل آخر؛ يُكافأ الطرفان بعد إنجاز عمل لهذا العميل',
  Notes: 'ملاحظات',
  'Anything whoever serves them next should know': 'ما ينبغي أن يعرفه من يخدمه في المرة القادمة',
  'Add them anyway. I have checked, and this really is a different person.':
    'أضفه على أي حال. لقد تحققت، وهذا شخص مختلف فعلاً.',
  'Add the customer': 'أضف العميل',
  // customers
  '1 customer': 'عميل واحد',
  '{count} customers': '{count} عملاء',
  'Name, phone or email': 'الاسم أو الهاتف أو البريد الإلكتروني',
  'Search customers': 'ابحث عن العملاء',
  'No customers found': 'لم يُعثر على عملاء',
  'Try a different search.': 'جرّب بحثاً مختلفاً.',
  'Add your first customer to begin.': 'أضف أول عميل للبدء.',
  Type: 'النوع',
  'Source of business': 'المصدر',
  Company: 'شركة',
  Individual: 'فرد',
  // customers/[id]
  'Source: {source}': 'المصدر: {source}',
  'How this came to be': 'كيف وصل إلى هنا',
  'Points added. They can see them in the portal.': 'أُضيفت النقاط. يمكن للعميل رؤيتها في البوابة.',
  'Deposit taken and booked as money held, not as revenue. It goes against the invoice when there is one.':
    'تم استلام العربون وقيده كمبلغ محتفظ به لا كإيراد. يُخصم من الفاتورة عند إصدارها.',
  'Money returned, with the reason kept.': 'أُعيد المبلغ، مع حفظ السبب.',
  'Code used. They had already had enough work done here, so both sides have been paid.':
    'استُخدم الرمز. كان العميل قد أنجز أعمالاً كافية هنا، لذا كوفئ الطرفان.',
  'Code used. Both sides are paid once this customer has had enough work done.':
    'استُخدم الرمز. يُكافأ الطرفان حين يُنجز لهذا العميل ما يكفي من الأعمال.',
  'Saved.': 'تم الحفظ.',
  Landline: 'الهاتف الأرضي',
  'Tax number': 'الرقم الضريبي',
  'Marketing consent': 'الموافقة التسويقية',
  'Email yes': 'البريد: نعم',
  'Email no': 'البريد: لا',
  'SMS yes': 'الرسائل النصية: نعم',
  'SMS no': 'الرسائل النصية: لا',
  '1 vehicle': 'مركبة واحدة',
  '{count} vehicles': '{count} مركبات',
  'No vehicles': 'لا مركبات',
  'Vehicles appear once a job is created.': 'تظهر المركبات بمجرد إنشاء عمل.',
  Recall: 'استدعاء',
  '1 history entry': 'قيد واحد في السجل',
  '{count} history entries': '{count} قيود في السجل',
  Passport: 'الجواز',
  'Recent jobs': 'أعمال حديثة',
  'No jobs yet': 'لا أعمال بعد',
  Draft: 'مسودة',
  'Vehicle received': 'تم استلام المركبة',
  Inspection: 'الفحص',
  Diagnosis: 'التشخيص',
  'Estimate created': 'تم إعداد عرض السعر',
  'Customer approval': 'موافقة العميل',
  Approved: 'تمت الموافقة',
  Repair: 'الإصلاح',
  'Quality control': 'مراقبة الجودة',
  Completed: 'مكتمل',
  Payment: 'الدفع',
  Preferences: 'التفضيلات',
  'Preselected on a new job; the diary has the last word':
    'يُختار مسبقاً في العمل الجديد؛ والكلمة الأخيرة للمفكرة',
  'Asks for': 'يطلب',
  'Nobody in particular': 'لا أحد بعينه',
  'Save preference': 'احفظ التفضيل',
  'Deposits and credit, waiting for a bill': 'عربون ورصيد دائن بانتظار فاتورة',
  'A deposit before the work, or credit kept from a refund':
    'عربون قبل العمل، أو رصيد محتفظ به من استرداد',
  Held: 'محتفظ به',
  Deposit: 'عربون',
  'for job #{number}': 'للعمل رقم {number}',
  'Amount to return': 'المبلغ المُعاد',
  'Why it is going back': 'سبب الإعادة',
  Return: 'إعادة',
  Card: 'بطاقة',
  Cash: 'نقداً',
  'Bank transfer': 'تحويل بنكي',
  Cheque: 'شيك',
  'For which job': 'لأي عمل',
  'Not a particular job': 'ليس لعمل بعينه',
  Reference: 'المرجع',
  'Take the deposit': 'استلم العربون',
  Points: 'النقاط',
  'Worth {amount} off a bill': 'قيمتها {amount} خصماً من فاتورة',
  '{count} point a pound on every bill paid in full':
    '{count} نقطة لكل وحدة نقدية في كل فاتورة مدفوعة بالكامل',
  Balance: 'الرصيد',
  '{points} lapse on {date}. Worth mentioning at the next visit.':
    'تنتهي صلاحية {points} في {date}. يُستحسن ذكر ذلك في الزيارة القادمة.',
  'Work done': 'أعمال منجزة',
  'Redeemed against {amount}': 'استُبدلت مقابل {amount}',
  'Referral, for introducing somebody': 'إحالة، لتعريف شخص',
  'Referral, for being introduced': 'إحالة، للقدوم بتعريف',
  'Nothing earned yet. The first bill they pay in full starts it.':
    'لم يُكسب شيء بعد. تبدأ مع أول فاتورة يدفعها بالكامل.',
  Why: 'السبب',
  'Sorry about the wait on Tuesday': 'نعتذر عن الانتظار يوم الثلاثاء',
  'Add points': 'أضف نقاطاً',
  'Both sides get {points} points once the person brought in has had {amount} of work done':
    'يحصل الطرفان على {points} نقطة حين يُنجز للشخص المُحال أعمال بقيمة {amount}',
  'Their code to hand out': 'رمزه للمشاركة',
  'Introduced by': 'بتعريف من',
  'both sides paid on {date}': 'كوفئ الطرفان في {date}',
  'waiting on their first bill': 'بانتظار فاتورته الأولى',
  'A customer since removed': 'عميل حُذف لاحقاً',
  Paid: 'مدفوع',
  'Waiting on a bill': 'بانتظار فاتورة',
  'Nobody brought in yet.': 'لم يُحِل أحداً بعد.',
  'Somebody else’s code, said at the counter': 'رمز شخص آخر، يُذكر عند المنضدة',
  'Use the code': 'استخدم الرمز',
  'Recent payments': 'مدفوعات حديثة',
  'Nothing recorded.': 'لا شيء مسجل.',
  cash: 'نقداً',
  card: 'بطاقة',
  'bank transfer': 'تحويل بنكي',
  online: 'عبر الإنترنت',
  cheque: 'شيك',
  account: 'على الحساب',
  other: 'أخرى',
  'gift card': 'بطاقة هدية',
  deposit: 'عربون',
  'The whole story': 'القصة كاملة',
  'Every visit, quote, decision and payment, newest first.':
    'كل زيارة وعرض سعر وقرار ودفعة، الأحدث أولاً.',
  'Nothing has happened yet. The thread fills itself as this customer is dealt with.':
    'لم يحدث شيء بعد. يمتلئ السجل تلقائياً مع التعامل مع هذا العميل.',
  '{car} came in for {work}': 'حضرت {car} من أجل {work}',
  'Job {number}': 'العمل {number}',
  'Quote sent for {car}': 'أُرسل عرض سعر من أجل {car}',
  'Version {version}': 'النسخة {version}',
  'They turned the work down': 'رفض العمل',
  'They approved part of the quote': 'وافق على جزء من عرض السعر',
  'They approved the work': 'وافق على العمل',
  'Invoiced {number}': 'فوترة {number}',
  'Paid with points': 'دُفع بالنقاط',
  'Paid by {method}': 'دُفع عبر {method}',
  'Did not turn up for {work}': 'لم يحضر من أجل {work}',
  'Booked in for {work}': 'محجوز من أجل {work}',
  'the vehicle': 'المركبة',
  'What they were sent': 'ما أُرسل إليه',
  'Matched on the address on file, so it is a close record rather than a certain one.':
    'مطابقة على العنوان المسجل، فهو سجل مرجّح لا مؤكد.',
  'The conversation': 'المحادثة',
  email: 'البريد الإلكتروني',
  sms: 'رسالة نصية',
  portal: 'البوابة',
  whatsapp: 'واتساب',
  'did not arrive': 'لم تصل',
  // vehicles
  'Vehicles this workshop has serviced or been granted access to.':
    'المركبات التي صانتها هذه الورشة أو مُنحت حق الوصول إليها.',
  'Find or add a vehicle': 'ابحث عن مركبة أو أضفها',
  'Registration, VIN, make or model': 'رقم اللوحة أو رقم الهيكل أو الصانع أو الطراز',
  'Search vehicles': 'ابحث عن المركبات',
  'No vehicles yet': 'لا مركبات بعد',
  'A vehicle appears here once it is found on the network or added, or the first time you open a job for it.':
    'تظهر المركبة هنا بمجرد العثور عليها في الشبكة أو إضافتها، أو عند فتح أول عمل لها.',
  Registration: 'رقم اللوحة',
  VIN: 'رقم الهيكل',
  Owner: 'المالك',
  Odometer: 'العداد',
  History: 'السجل',
  Flags: 'التنبيهات',
  Unknown: 'غير معروف',
  '1 entry': 'قيد واحد',
  '{count} entries': '{count} قيود',
  '1 recall': 'استدعاء واحد',
  '{count} recalls': '{count} استدعاءات',
  // vehicles/find
  'Find a vehicle': 'ابحث عن مركبة',
  'All vehicles': 'كل المركبات',
  'By registration or VIN. If another Carnet workshop has seen it, its history is already here.':
    'برقم اللوحة أو رقم الهيكل. إن رأتها ورشة أخرى على Carnet، فسجلها موجود هنا بالفعل.',
  'Registration or VIN': 'رقم اللوحة أو رقم الهيكل',
  'AB12 CDE or WVWZZZ1JZ3W386752': 'أ ب ج 1234 أو WVWZZZ1JZ3W386752',
  'Look it up': 'ابحث',
  'No plate on record': 'لا لوحة مسجلة',
  'VIN {vin}': 'رقم الهيكل {vin}',
  'What you will see: every service, part, inspection and mileage reading, with the verification each carries. What you will not see: what they charged, their job numbers, or who did the work. The car’s history is the car’s; their margins are theirs.':
    'ما ستراه: كل صيانة وقطعة وفحص وقراءة عداد، مع درجة التحقق لكل منها. ما لن تراه: ما تقاضوه، وأرقام أعمالهم، ومن أنجز العمل. سجل السيارة ملك للسيارة؛ وأرباحهم ملك لهم.',
  'Open the vehicle': 'افتح المركبة',
  'Take it on and see the history': 'تسلّمها واطّلع على السجل',
  'Somebody with vehicle access can take this car on.':
    'يمكن لشخص لديه صلاحية المركبات تسلّم هذه السيارة.',
  'Not on the network': 'غير موجودة في الشبكة',
  'No Carnet workshop has recorded {identifier}. Its history starts with you.':
    'لم تسجّل أي ورشة على Carnet {identifier}. يبدأ سجلها معك.',
  '17 characters, from the windscreen or the door frame':
    '17 خانة، من الزجاج الأمامي أو إطار الباب',
  Make: 'الصانع',
  Model: 'الطراز',
  Year: 'السنة',
  'A VIN whose check digit does not add up is recorded as typed and flagged, not refused. You have the car in front of you; the algorithm does not.':
    'رقم الهيكل الذي لا يتطابق رقم التحقق فيه يُسجَّل كما كُتب ويُعلَّم، ولا يُرفض. السيارة أمامك أنت، لا أمام الخوارزمية.',
  'Add the vehicle': 'أضف المركبة',
  'Why look first': 'لماذا نبحث أولاً',
  'A vehicle is one record wherever it is serviced. Adding a car that another workshop already keeps would start a second history for the same VIN, so the network refuses that and offers the existing one instead.':
    'للمركبة سجل واحد أينما صينت. إضافة سيارة تحتفظ بها ورشة أخرى ستبدأ سجلاً ثانياً لرقم الهيكل نفسه، لذا ترفض الشبكة ذلك وتعرض السجل الموجود بدلاً منه.',
  'The VIN check digit does not add up. It has been recorded as typed; check it against the plate on the door frame.':
    'رقم التحقق في رقم الهيكل غير متطابق. سُجّل كما كُتب؛ تحقق منه مقابل اللوحة على إطار الباب.',
  // vehicles: the network sentence
  'No history on this vehicle yet. What you record here starts it.':
    'لا سجل لهذه المركبة بعد. ما تسجله هنا يبدؤه.',
  '1 entry on this vehicle, all recorded here, most recently {when}.':
    'قيد واحد لهذه المركبة، سُجّل هنا، آخره في {when}.',
  '{count} entries on this vehicle, all recorded here, most recently {when}.':
    '{count} قيود لهذه المركبة، كلها سُجّلت هنا، آخرها في {when}.',
  '1 entry on this vehicle, recorded by {first}, most recently {when}. Their commercial detail is withheld; the car’s history is not. What you record continues it.':
    'قيد واحد لهذه المركبة، سجّلته {first}، آخره في {when}. تفاصيلهم التجارية محجوبة؛ أما سجل السيارة فلا. ما تسجله يكمله.',
  '{count} entries on this vehicle, recorded by {first}, most recently {when}. Their commercial detail is withheld; the car’s history is not. What you record continues it.':
    '{count} قيود لهذه المركبة، سجّلتها {first}، آخرها في {when}. تفاصيلهم التجارية محجوبة؛ أما سجل السيارة فلا. ما تسجله يكمله.',
  '{count} entries on this vehicle, recorded by {first} and {second}, most recently {when}. Their commercial detail is withheld; the car’s history is not. What you record continues it.':
    '{count} قيود لهذه المركبة، سجّلتها {first} و{second}، آخرها في {when}. تفاصيلهم التجارية محجوبة؛ أما سجل السيارة فلا. ما تسجله يكمله.',
  '{count} entries on this vehicle, recorded by {workshops} other workshops, most recently {when}. Their commercial detail is withheld; the car’s history is not. What you record continues it.':
    '{count} قيود لهذه المركبة، سجّلتها {workshops} ورش أخرى، آخرها في {when}. تفاصيلهم التجارية محجوبة؛ أما سجل السيارة فلا. ما تسجله يكمله.',
  '{total} entries on this vehicle: {own} recorded here and {others} by {first}, most recently {when}. Their commercial detail is withheld.':
    '{total} قيود لهذه المركبة: {own} سُجّلت هنا و{others} لدى {first}، آخرها في {when}. تفاصيلهم التجارية محجوبة.',
  '{total} entries on this vehicle: {own} recorded here and {others} by {first} and {second}, most recently {when}. Their commercial detail is withheld.':
    '{total} قيود لهذه المركبة: {own} سُجّلت هنا و{others} لدى {first} و{second}، آخرها في {when}. تفاصيلهم التجارية محجوبة.',
  '{total} entries on this vehicle: {own} recorded here and {others} by {workshops} other workshops, most recently {when}. Their commercial detail is withheld.':
    '{total} قيود لهذه المركبة: {own} سُجّلت هنا و{others} لدى {workshops} ورش أخرى، آخرها في {when}. تفاصيلهم التجارية محجوبة.',
  'another workshop': 'ورشة أخرى',
  // vehicles: paperwork
  'No paperwork on this vehicle yet.': 'لا مستندات لهذه المركبة بعد.',
  '1 document on file.': 'مستند واحد محفوظ.',
  '{count} documents on file.': '{count} مستندات محفوظة.',
  'The MOT has expired.': 'انتهت صلاحية شهادة الفحص الدوري.',
  'The MOT runs out on {date}.': 'تنتهي شهادة الفحص الدوري في {date}.',
  'The insurance has expired.': 'انتهت صلاحية التأمين.',
  'The insurance runs out on {date}.': 'ينتهي التأمين في {date}.',
  'No expiry': 'بلا تاريخ انتهاء',
  'Expired {date}': 'انتهت في {date}',
  'Runs out {date}': 'تنتهي في {date}',
  'Valid until {date}': 'سارية حتى {date}',
  'MOT no expiry': 'الفحص الدوري بلا تاريخ انتهاء',
  'MOT expired {date}': 'الفحص الدوري انتهى في {date}',
  'MOT runs out {date}': 'الفحص الدوري ينتهي في {date}',
  'MOT valid until {date}': 'الفحص الدوري ساري حتى {date}',
  'Insurance no expiry': 'التأمين بلا تاريخ انتهاء',
  'Insurance expired {date}': 'التأمين انتهى في {date}',
  'Insurance runs out {date}': 'التأمين ينتهي في {date}',
  'Insurance valid until {date}': 'التأمين ساري حتى {date}',
  Photograph: 'صورة',
  'Registration certificate': 'رخصة السير',
  'MOT certificate': 'شهادة الفحص الدوري',
  Insurance: 'التأمين',
  'Service record': 'سجل الصيانة',
  'Purchase invoice': 'فاتورة الشراء',
  Other: 'أخرى',
  Document: 'مستند',
  'The owner': 'المالك',
  // vehicles/[id]
  'Vehicle passport': 'جواز المركبة',
  'Buyer report': 'تقرير المشتري',
  Transfer: 'نقل الملكية',
  'This vehicle is on your books now. Its history is below, and what you record continues it.':
    'هذه المركبة مسجلة لديك الآن. سجلها أدناه، وما تسجله يكمله.',
  'Added. Nobody on the network had seen this vehicle; its history starts here.':
    'أُضيفت. لم يرَ أحد في الشبكة هذه المركبة من قبل؛ يبدأ سجلها هنا.',
  'See it as the next owner will': 'اعرضه كما سيراه المالك التالي',
  'Find another vehicle': 'ابحث عن مركبة أخرى',
  Identity: 'الهوية',
  Engine: 'المحرك',
  Fuel: 'الوقود',
  Body: 'الهيكل',
  Colour: 'اللون',
  Transmission: 'ناقل الحركة',
  '{km} km/month': '{km} كم/شهر',
  'Current owner': 'المالك الحالي',
  'Owners on record': 'الملاك المسجلون',
  'Events on record': 'الأحداث المسجلة',
  petrol: 'بنزين',
  diesel: 'ديزل',
  hybrid: 'هجين',
  plugin_hybrid: 'هجين قابل للشحن',
  electric: 'كهربائي',
  lpg: 'غاز مسال',
  hydrogen: 'هيدروجين',
  manual: 'يدوي',
  automatic: 'أوتوماتيكي',
  cvt: 'ناقل متغير باستمرار',
  dct: 'ناقل مزدوج القابض',
  'Integrity check failed': 'فشل التحقق من السلامة',
  'The chain diverges at entry {sequence} ({reason}). Entries before that point are unaffected.':
    'تنحرف السلسلة عند القيد {sequence} ({reason}). القيود السابقة لتلك النقطة غير متأثرة.',
  'sequence start': 'بداية التسلسل',
  'sequence gap': 'فجوة في التسلسل',
  'broken link': 'رابط مكسور',
  'hash mismatch': 'بصمة غير متطابقة',
  '{count} entries, oldest first at the bottom': '{count} قيود، الأقدم في الأسفل',
  'No history yet': 'لا سجل بعد',
  'Entries appear here automatically when a job on this vehicle is completed.':
    'تظهر القيود هنا تلقائياً عند اكتمال عمل على هذه المركبة.',
  Ownership: 'الملكية',
  Mileage: 'المسافة المقطوعة',
  Service: 'صيانة',
  Part: 'قطعة',
  Tires: 'الإطارات',
  Accident: 'حادث',
  'Recall issued': 'صدر استدعاء',
  'Recall done': 'نُفّذ الاستدعاء',
  Modification: 'تعديل',
  Maintenance: 'صيانة دورية',
  'Write-off': 'شطب',
  Note: 'ملاحظة',
  '{part} fitted': 'تركيب {part}',
  'Part number {number}': 'رقم القطعة {number}',
  'Vehicle inspection carried out': 'أُجري فحص المركبة',
  '{pass} passed, {advisory} advisory, {critical} critical':
    '{pass} سليمة، {advisory} تحتاج متابعة، {critical} حرجة',
  '{km} km recorded': 'سُجّل {km} كم',
  'Read at {workshop} during job {number}': 'قُرئ لدى {workshop} خلال العمل {number}',
  'Parts fitted: {parts}. {hours} hours of labour.': 'القطع المركّبة: {parts}. {hours} ساعات عمل.',
  'Parts fitted: {parts}.': 'القطع المركّبة: {parts}.',
  '{hours} hours of labour.': '{hours} ساعات عمل.',
  'Ownership transferred': 'نُقلت الملكية',
  'From {from} to {to}': 'من {from} إلى {to}',
  'Flagged: {reason}': 'مُعلَّم: {reason}',
  'lower than a previous reading': 'أقل من قراءة سابقة',
  'implies an unusually high daily distance': 'تشير إلى مسافة يومية مرتفعة على نحو غير معتاد',
  'Open recalls': 'استدعاءات مفتوحة',
  'Next service': 'الصيانة التالية',
  'Due at': 'مستحقة عند',
  Remaining: 'المتبقي',
  Projected: 'المتوقع',
  'Nothing on file yet. The registration certificate, the MOT and the insurance are the three worth having; a photograph of damage before repair is the fourth.':
    'لا شيء محفوظ بعد. رخصة السير وشهادة الفحص الدوري والتأمين هي الثلاثة الجديرة بالحفظ؛ وصورة الضرر قبل الإصلاح هي الرابعة.',
  'Jobs at this workshop': 'الأعمال في هذه الورشة',
  'This vehicle has not been worked on here.': 'لم يُنجز أي عمل على هذه المركبة هنا.',
  Condition: 'الحالة',
  'Derived from what is on record, not stored anywhere.':
    'مستخلصة مما هو مسجل، وغير مخزنة في أي مكان.',
  'Next likely: {component} in about {km} km.': 'المرجّح تالياً: {component} بعد نحو {km} كم.',
  'Next likely: {component}.': 'المرجّح تالياً: {component}.',
  'The whole working': 'تفاصيل الحساب كاملة',
  'Under warranty': 'تحت الضمان',
  'What this workshop is still standing behind on this vehicle.':
    'ما لا تزال هذه الورشة تضمنه على هذه المركبة.',
  'Nothing recorded. Cover is written as a job closes.':
    'لا شيء مسجل. يُكتب الضمان عند إغلاق العمل.',
  '{days}d left': 'متبقٍ {days} يوم',
  expired: 'منتهٍ',
  'Not covered: {reason}': 'غير مشمول: {reason}',
  'Out of cover on mileage, by {km} miles.': 'خارج الضمان بسبب المسافة، بفارق {km} ميل.',
  'Cover ran out on {date}.': 'انتهى الضمان في {date}.',
  'Covered for another 1 day, or {km} miles, whichever comes first.':
    'مشمول ليوم واحد آخر، أو {km} ميل، أيهما أقرب.',
  'Covered for another {days} days, or {km} miles, whichever comes first.':
    'مشمول لمدة {days} يوماً أخرى، أو {km} ميل، أيهما أقرب.',
  'Covered for another 1 day.': 'مشمول ليوم واحد آخر.',
  'Covered for another {days} days.': 'مشمول لمدة {days} يوماً أخرى.',
  'Unnamed owner': 'مالك بلا اسم',
  present: 'حتى الآن',
  // vehicles: health
  'Nothing is on record for this vehicle yet, so there is nothing to score.':
    'لا شيء مسجل لهذه المركبة بعد، لذا لا شيء يمكن تقييمه.',
  'Nothing on record needs attention.': 'لا شيء مسجل يحتاج إلى اهتمام.',
  '{factor} is what holds this back. {why}': '{factor}: هذا ما يخفض التقييم. {why}',
  'maintenance kept up': 'انتظام الصيانة',
  'faults left open': 'أعطال لم تُعالج',
  'condition of components': 'حالة المكونات',
  'work turned down': 'أعمال مرفوضة',
  'how recently it was looked at': 'حداثة آخر فحص',
  'how much is on record': 'حجم السجل',
  'Maintenance kept up': 'انتظام الصيانة',
  'Faults left open': 'أعطال لم تُعالج',
  'Condition of components': 'حالة المكونات',
  'Work turned down': 'أعمال مرفوضة',
  'How recently it was looked at': 'حداثة آخر فحص',
  'How much is on record': 'حجم السجل',
  'No service schedule on record for this vehicle.': 'لا جدول صيانة مسجل لهذه المركبة.',
  'All {count} scheduled services are up to date.': 'كل الصيانات المجدولة وعددها {count} محدّثة.',
  '{overdue} of {total} overdue, the worst by {days} days.':
    '{overdue} من {total} متأخرة، أسوأها بـ {days} يوماً.',
  'Nothing has ever been inspected, so nothing is known to be wrong.':
    'لم يُفحص شيء قط، لذا لا يُعرف عن أي عطل.',
  'Nothing found at the last inspection is still outstanding.':
    'لا شيء مما وُجد في آخر فحص لا يزال معلقاً.',
  '{critical} critical and {advisory} advisory items still open.':
    '{critical} بنود حرجة و{advisory} بنود تحتاج متابعة لا تزال مفتوحة.',
  'No parts on record, so no component can be aged.':
    'لا قطع مسجلة، لذا لا يمكن تقدير عمر أي مكوّن.',
  '{component} is past its usual life.': '{component} تجاوز عمره المعتاد.',
  '{component} is the furthest through its life, at {percent}%.':
    '{component} هو الأقرب إلى نهاية عمره، عند {percent}%.',
  'a component': 'أحد المكونات',
  'Nothing has been quoted on this vehicle yet.': 'لم يُقدَّم عرض سعر لهذه المركبة بعد.',
  'No recommended work has been turned down.': 'لم يُرفض أي عمل موصى به.',
  '1 recommended item turned down, {critical} of them critical.':
    'رُفض بند موصى به واحد، منها {critical} حرجة.',
  '{count} recommended items turned down, {critical} of them critical.':
    'رُفضت {count} بنود موصى بها، منها {critical} حرجة.',
  'No inspection has been carried out on this vehicle.': 'لم يُجرَ أي فحص لهذه المركبة.',
  'Last inspected {days} days ago.': 'آخر فحص قبل {days} يوماً.',
  'No visits on record.': 'لا زيارات مسجلة.',
  '1 recorded visit.': 'زيارة واحدة مسجلة.',
  '{count} recorded visits.': '{count} زيارات مسجلة.',
  Battery: 'البطارية',
  'Front brake pads': 'تيل الفرامل الأمامي',
  'Rear brake pads': 'تيل الفرامل الخلفي',
  'Front brake discs': 'أقراص الفرامل الأمامية',
  'Rear brake discs': 'أقراص الفرامل الخلفية',
  Tyres: 'الإطارات',
  Clutch: 'القابض',
  'Timing belt': 'سير التوقيت',
  'Engine oil and filter': 'زيت المحرك والفلتر',
  'Air filter': 'فلتر الهواء',
  'Cabin filter': 'فلتر المكيف',
  'Fuel filter': 'فلتر الوقود',
  'Spark plugs': 'شمعات الإشعال',
  Coolant: 'سائل التبريد',
  'Brake fluid': 'زيت الفرامل',
  'Wiper blades': 'مساحات الزجاج',
  Suspension: 'نظام التعليق',
  Exhaust: 'العادم',
  // vehicles/[id]/condition
  'Back to the vehicle': 'العودة إلى المركبة',
  'What this vehicle is in, and every figure that says so': 'حالة هذه المركبة، وكل رقم يدل عليها',
  'Built from {count} of 6 measures, covering {percent}% of the weight. The score belongs to the vehicle, not to this workshop: nothing in it measures what was spent here or how recently the car visited.':
    'مبني على {count} من 6 مقاييس، تغطي {percent}% من الوزن. التقييم يخص المركبة لا هذه الورشة: لا شيء فيه يقيس ما أُنفق هنا أو موعد آخر زيارة للسيارة.',
  'What makes up the score': 'مكونات التقييم',
  'Worst first. Every one of these is checkable against the record.':
    'الأسوأ أولاً. كل واحد منها يمكن التحقق منه في السجل.',
  'Nothing to score': 'لا شيء للتقييم',
  'No visit, inspection, part or schedule is on record for this vehicle.':
    'لا زيارة ولا فحص ولا قطعة ولا جدول مسجل لهذه المركبة.',
  'Counts for {percent}% of the score.': 'يمثل {percent}% من التقييم.',
  'What could not be scored': 'ما تعذّر تقييمه',
  'Left out of the total rather than counted as a pass or a fail.':
    'مستبعد من المجموع بدلاً من احتسابه نجاحاً أو إخفاقاً.',
  'Likely due': 'المرجّح استحقاقه',
  'From this vehicle’s own mileage, about {km} km a day.':
    'من المسافة التي تقطعها هذه المركبة، نحو {km} كم يومياً.',
  'Not enough odometer history to work from distance, so these are from age.':
    'لا توجد قراءات عداد كافية للحساب بالمسافة، لذا هذه التقديرات مبنية على العمر.',
  'Nothing is due inside the next four months.': 'لا شيء مستحق خلال الأشهر الأربعة القادمة.',
  '{km} km past': 'متجاوز بـ {km} كم',
  'in about {km} km': 'بعد نحو {km} كم',
  '{days} days past': 'متجاوز بـ {days} يوماً',
  'in about {months} months': 'بعد نحو {months} أشهر',
  'Confidence high.': 'الثقة عالية.',
  'Confidence medium.': 'الثقة متوسطة.',
  'Confidence low.': 'الثقة منخفضة.',
  'This vehicle has gone about {km} km between changes.':
    'قطعت هذه المركبة نحو {km} كم بين كل استبدال وآخر.',
  'No pattern for this vehicle yet, so a general {km} km is used at {rate} km a day.':
    'لا نمط لهذه المركبة بعد، لذا تُستخدم قيمة عامة قدرها {km} كم بمعدل {rate} كم يومياً.',
  'No pattern and no mileage rate, so this is from age alone.':
    'لا نمط ولا معدل مسافة، لذا هذا التقدير مبني على العمر وحده.',
  Components: 'المكونات',
  'What is on this vehicle, how old it is, and how far through its life.':
    'ما هو مركّب على هذه المركبة، وعمره، ومدى استهلاكه من عمره.',
  'No parts on record': 'لا قطع مسجلة',
  'Components appear here as parts are fitted on a job.': 'تظهر المكونات هنا عند تركيب قطع في عمل.',
  new: 'جديد',
  good: 'جيد',
  ageing: 'متقادم',
  due: 'مستحق',
  overdue: 'متأخر',
  unknown: 'غير معروف',
  'Fitted this month.': 'رُكّب هذا الشهر.',
  'Fitted this month, {km} km ago.': 'رُكّب هذا الشهر، قبل {km} كم.',
  '1 month old.': 'عمره شهر واحد.',
  '{count} months old.': 'عمره {count} أشهر.',
  '1 month old, {km} km ago.': 'عمره شهر واحد، قبل {km} كم.',
  '{count} months old, {km} km ago.': 'عمره {count} أشهر، قبل {km} كم.',
  'Fitted {date}, {brand}.': 'رُكّب في {date}، {brand}.',
  'Fitted {date}.': 'رُكّب في {date}.',
  '{percent}% through its usual life, on distance.':
    'استُهلك {percent}% من عمره المعتاد، بحسب المسافة.',
  '{percent}% through its usual life, on age.': 'استُهلك {percent}% من عمره المعتاد، بحسب العمر.',
  '{count} components have no record here.': '{count} مكونات لا سجل لها هنا.',
  'That is not the same as them being new.': 'وهذا لا يعني أنها جديدة.',
  'This vehicle has {mileage} on it and {visits} recorded visits, and anything fitted before those visits, or elsewhere, is not in this list.':
    'على عداد هذه المركبة {mileage} ولها {visits} زيارات مسجلة، وكل ما رُكّب قبل تلك الزيارات أو في مكان آخر ليس في هذه القائمة.',
  'Working out the condition of this vehicle': 'جارٍ تقدير حالة هذه المركبة',
  // vehicles/[id]/passport
  'The vehicle': 'المركبة',
  'As the next owner will see it': 'كما سيراه المالك التالي',
  'The document a buyer receives through a share link, word for word. No owner is named on it.':
    'المستند الذي يتلقاه المشتري عبر رابط المشاركة، حرفياً. لا يُذكر فيه اسم أي مالك.',
  // vehicles/[id]/report
  'Vehicle report': 'تقرير المركبة',
  'Buyer check code': 'رمز تحقق المشتري',
  'Private owner': 'مالك فرد',
  Dealer: 'تاجر',
  'Finance company': 'شركة تمويل',
  'less than a month': 'أقل من شهر',
  'less than a month, still': 'أقل من شهر، ولا يزال مالكاً',
  '1 month': 'شهر واحد',
  '1 month, still': 'شهر واحد، ولا يزال مالكاً',
  '{count} months': '{count} أشهر',
  '{count} months, still': '{count} أشهر، ولا يزال مالكاً',
  '{count} years': '{count} سنوات',
  '{count} years, still': '{count} سنوات، ولا يزال مالكاً',
  'Carnet vehicle report': 'تقرير مركبة من Carnet',
  Verified: 'موثّق',
  'Does not check out': 'لا يمكن التحقق منه',
  Unverified: 'غير موثّق',
  'What the record says': 'ما يقوله السجل',
  Owners: 'الملاك',
  'How many, and how long each kept it. No names: those belong to them.':
    'كم عددهم، وكم احتفظ بها كل منهم. بلا أسماء: فهي ملك لأصحابها.',
  'Owner {position} · {kind}': 'المالك {position} · {kind}',
  'No ownership on record.': 'لا ملكية مسجلة.',
  'What this does not cover': 'ما لا يغطيه هذا التقرير',
  'Said here rather than left for somebody to discover.': 'نذكره هنا بدلاً من تركه ليكتشفه أحد.',
  'Worth asking about': 'أسئلة جديرة بالطرح',
  'Each of these has an innocent explanation and at least one that is not.':
    'لكل منها تفسير بريء، وتفسير واحد على الأقل غير ذلك.',
  'Give a buyer a code': 'أعطِ المشتري رمزاً',
  'They check the same figures at /verify, with no account and nothing about the owner.':
    'يتحقق من الأرقام نفسها عبر /verify، دون حساب ودون أي معلومة عن المالك.',
  'Written down now, or it is gone:': 'دوّنه الآن، وإلا ضاع:',
  'Good for ninety days. Only its fingerprint is stored, so this screen is the one chance to copy it. Issue another whenever you need one.':
    'صالح لتسعين يوماً. تُحفظ بصمته فقط، لذا هذه الشاشة هي الفرصة الوحيدة لنسخه. أصدر رمزاً آخر متى احتجت.',
  'Issue a check code': 'أصدر رمز تحقق',
  'Recorded events': 'الأحداث المسجلة',
  Services: 'الصيانات',
  'Unresolved critical items': 'بنود حرجة غير محلولة',
  'Outstanding recalls': 'استدعاءات معلقة',
  'Mileage recorded': 'المسافة المسجلة',
  'Last service': 'آخر صيانة',
  None: 'لا يوجد',
  'None on record': 'لا شيء مسجل',
  'The record starts in {start}, and the vehicle was first registered in {registered}. About 1 year before that is not covered here at all.':
    'يبدأ السجل في {start}، وسُجّلت المركبة لأول مرة في {registered}. نحو سنة واحدة قبل ذلك غير مغطاة هنا إطلاقاً.',
  'The record starts in {start}, and the vehicle was first registered in {registered}. About {years} years before that is not covered here at all.':
    'يبدأ السجل في {start}، وسُجّلت المركبة لأول مرة في {registered}. نحو {years} سنوات قبل ذلك غير مغطاة هنا إطلاقاً.',
  'Nothing is recorded for this vehicle yet.': 'لا شيء مسجل لهذه المركبة بعد.',
  'No service has been recorded, which is not the same as none having been done.':
    'لم تُسجَّل أي صيانة، وهذا لا يعني أنه لم تُجرَ أي صيانة.',
  'Nothing here was inspected by a workshop, so the condition of the vehicle is not part of this record.':
    'لم تفحص أي ورشة شيئاً هنا، لذا حالة المركبة ليست جزءاً من هذا السجل.',
  'This covers what participating workshops recorded. Work done elsewhere, or by the owner, does not appear.':
    'يغطي هذا ما سجلته الورش المشاركة. الأعمال المنجزة في مكان آخر أو من قِبل المالك لا تظهر.',
  '1 critical item was found and has not been recorded as put right. Ask for the invoice, not a description.':
    'وُجد بند حرج واحد ولم يُسجَّل إصلاحه. اطلب الفاتورة، لا الوصف.',
  '{count} critical items were found and have not been recorded as put right. Ask for the invoice, not a description.':
    'وُجدت {count} بنود حرجة ولم يُسجَّل إصلاحها. اطلب الفاتورة، لا الوصف.',
  '1 manufacturer recall shows as outstanding. A franchised dealer does these free; ask whether it has been done and is simply unrecorded.':
    'يظهر استدعاء واحد من الشركة المصنّعة معلقاً. الوكيل المعتمد ينفذه مجاناً؛ اسأل إن كان قد نُفّذ ولم يُسجَّل فحسب.',
  '{count} manufacturer recalls shows as outstanding. A franchised dealer does these free; ask whether it has been done and is simply unrecorded.':
    'تظهر {count} استدعاءات من الشركة المصنّعة معلقة. الوكيل المعتمد ينفذها مجاناً؛ اسأل إن كانت قد نُفّذت ولم تُسجَّل فحسب.',
  '1 odometer reading did not follow the one before it. That has innocent explanations, and it also has one that is not. Ask.':
    'قراءة عداد واحدة لم تتسق مع ما قبلها. لذلك تفسيرات بريئة، وله أيضاً تفسير غير بريء. اسأل.',
  '{count} odometer readings did not follow the one before it. That has innocent explanations, and it also has one that is not. Ask.':
    '{count} قراءات عداد لم تتسق مع ما قبلها. لذلك تفسيرات بريئة، وله أيضاً تفسير غير بريء. اسأل.',
  'The last recorded service was {date}. Ask what has been done since and where.':
    'آخر صيانة مسجلة كانت في {date}. اسأل عما أُنجز منذ ذلك الحين وأين.',
  '{count} owners is a lot for one vehicle. Not a fault in itself, and worth a question.':
    '{count} ملاك عدد كبير لمركبة واحدة. ليس عيباً في حد ذاته، لكنه يستحق السؤال.',
  'Every record in this history was checked against the one before it, and nothing has been altered or removed since it was written.':
    'تم التحقق من كل قيد في هذا السجل مقابل القيد الذي قبله، ولم يُعدَّل أو يُحذف شيء منذ كتابته.',
  'This history does not check out. A record has been altered or removed since it was written, and nothing here should be relied on.':
    'هذا السجل لا يجتاز التحقق. عُدّل قيد أو حُذف منذ كتابته، ولا ينبغي الاعتماد على أي شيء هنا.',
  'This history could not be checked. Treat it as unverified.':
    'تعذّر التحقق من هذا السجل. تعامل معه على أنه غير موثّق.',
  'Do not rely on this record.': 'لا تعتمد على هذا السجل.',
  'The record is intact, and it has things in it to ask about.':
    'السجل سليم، وفيه أمور تستحق السؤال.',
  'There is nothing on record for this vehicle.': 'لا شيء مسجل لهذه المركبة.',
  'A full record, intact, with nothing outstanding on it.': 'سجل كامل وسليم، لا شيء معلق فيه.',
  'Intact, but thin. Read what it does not cover as carefully as what it does.':
    'سليم لكنه شحيح. اقرأ ما لا يغطيه بعناية قراءتك لما يغطيه.',
  // vehicles/[id]/transfer
  'Say what day the vehicle changed hands.': 'اذكر اليوم الذي انتقلت فيه ملكية المركبة.',
  'Record that this vehicle has changed hands': 'سجّل انتقال ملكية هذه المركبة',
  'That cannot be recorded': 'لا يمكن تسجيل ذلك',
  'Who it is going to': 'إلى من تنتقل',
  'The history goes with the vehicle. The previous owner’s details do not.':
    'السجل ينتقل مع المركبة. أما بيانات المالك السابق فلا.',
  'New owner': 'المالك الجديد',
  'The name that will appear as the current owner.': 'الاسم الذي سيظهر بصفته المالك الحالي.',
  'Full name or company': 'الاسم الكامل أو اسم الشركة',
  'Day it changed hands': 'يوم انتقال الملكية',
  'Reading at the sale': 'قراءة العداد عند البيع',
  'Optional. Left blank, the last reading on record is used.':
    'اختياري. إن تُرك فارغاً تُستخدم آخر قراءة مسجلة.',
  'Record it even if work is still open on this vehicle.':
    'سجّله حتى لو كان هناك عمل مفتوح على هذه المركبة.',
  'Any open job stays on the previous owner’s account.':
    'أي عمل مفتوح يبقى على حساب المالك السابق.',
  'Record the transfer': 'سجّل نقل الملكية',
  'Who has it now': 'من يملكها الآن',
  Unnamed: 'بلا اسم',
  Since: 'منذ',
  'No current owner on record. Record one before transferring, or the history will have a gap nobody can explain later.':
    'لا مالك حالياً مسجل. سجّل مالكاً قبل النقل، وإلا ستكون في السجل فجوة لا يستطيع أحد تفسيرها لاحقاً.',
  'What happens': 'ما الذي يحدث',
  'The current ownership closes on the day you give, a new one opens, and the vehicle record gains an entry saying it changed hands at that mileage.':
    'تُغلق الملكية الحالية في اليوم الذي تحدده، وتُفتح ملكية جديدة، ويُضاف إلى سجل المركبة قيد يفيد بانتقال ملكيتها عند تلك المسافة.',
  'No name goes into that entry. Who owned the car lives in the ownership record, where an erasure request can reach it. A permanent chain with somebody’s name hashed into it is a chain that cannot honour one.':
    'لا يدخل أي اسم في ذلك القيد. اسم مالك السيارة يبقى في سجل الملكية، حيث يمكن لطلب المحو أن يصل إليه. السلسلة الدائمة التي يُدمج فيها اسم شخص لا يمكنها أن تلبي مثل هذا الطلب.',
  'Every service, inspection and reading stays with the vehicle, which is the entire point: the new owner inherits a history they can rely on.':
    'كل صيانة وفحص وقراءة تبقى مع المركبة، وهذا بيت القصد: يرث المالك الجديد سجلاً يمكنه الاعتماد عليه.',
  // passports
  'The record that belongs to each car. One line per vehicle; open any to read it as the next owner will.':
    'السجل الذي يخص كل سيارة. سطر لكل مركبة؛ افتح أياً منها لتقرأه كما سيقرؤه المالك التالي.',
  'Vehicles this workshop has written to': 'مركبات كتبت فيها هذه الورشة',
  Entries: 'القيود',
  'Across all of them': 'على جميعها',
  'Chains sound': 'سلاسل سليمة',
  '{count} do not verify': '{count} لا تجتاز التحقق',
  'Every entry hashes to the one before': 'كل قيد مرتبط ببصمة القيد الذي قبله',
  'Shared with other workshops': 'مشتركة مع ورش أخرى',
  'Written to by more than one garage': 'كتبت فيها أكثر من ورشة',
  'Search passports': 'ابحث في الجوازات',
  'A passport appears here the first time a job is completed on a vehicle, or when one is found on the network.':
    'يظهر الجواز هنا عند اكتمال أول عمل على مركبة، أو عند العثور عليها في الشبكة.',
  Recorded: 'مسجل',
  Chain: 'السلسلة',
  '{count} from elsewhere': '{count} من مكان آخر',
  Empty: 'فارغ',
  Verifies: 'يجتاز التحقق',
  // recalls
  'Manufacturer campaigns against the vehicles this workshop has seen':
    'حملات الشركات المصنّعة على المركبات التي رأتها هذه الورشة',
  'Not recorded as done': 'غير مسجلة كمنفذة',
  Safety: 'السلامة',
  'Of those, safety-related': 'منها متعلقة بالسلامة',
  'On record': 'مسجلة',
  'Across every vehicle seen here': 'على كل المركبات التي رُئيت هنا',
  'This is a record, not a source.': 'هذا سجل، وليس مصدراً.',
  'It shows campaigns already recorded against these vehicles. It does not query the manufacturer, so a vehicle showing nothing here has not been checked and cleared: it has not been checked. Anything safety-related goes to a franchised dealer, who does the work free and has the authoritative list.':
    'يعرض الحملات المسجلة مسبقاً على هذه المركبات. لا يستعلم من الشركة المصنّعة، لذا فالمركبة التي لا يظهر لها شيء هنا لم تُفحص وتُعتمد سليمة: بل لم تُفحص أصلاً. كل ما يتعلق بالسلامة يُحال إلى الوكيل المعتمد، الذي ينفذ العمل مجاناً ولديه القائمة الرسمية.',
  'Outstanding first, then everything already put right.': 'المعلّقة أولاً، ثم كل ما أُصلح.',
  'No recalls recorded': 'لا استدعاءات مسجلة',
  'Campaigns appear here once they are recorded against a vehicle this workshop has seen.':
    'تظهر الحملات هنا بمجرد تسجيلها على مركبة رأتها هذه الورشة.',
  Campaign: 'الحملة',
  Issued: 'تاريخ الإصدار',
  State: 'الوضع',
  'safety, outstanding': 'سلامة، معلّق',
  outstanding: 'معلّق',
  done: 'نُفّذ',
  // fleet
  'Company accounts with more than one vehicle on the books':
    'حسابات شركات لديها أكثر من مركبة مسجلة',
  Accounts: 'الحسابات',
  'Companies with a fleet': 'شركات لديها أسطول',
  'Off the road': 'متوقفة عن السير',
  'In the workshop now': 'في الورشة الآن',
  'Last thirty days': 'آخر ثلاثين يوماً',
  'Invoiced to fleets': 'مفوتر للأساطيل',
  '1 fleet vehicle is past a service.': 'مركبة واحدة من الأسطول تجاوزت موعد صيانتها.',
  '{count} fleet vehicles are past a service.': '{count} مركبات من الأسطول تجاوزت موعد صيانتها.',
  'A fleet manager is measured on downtime, so an overdue van is their problem before it is yours. Telling them first is worth more than the service itself.':
    'يُقاس أداء مدير الأسطول بمدة التوقف، لذا فالشاحنة المتأخرة مشكلته قبل أن تكون مشكلتك. إبلاغه أولاً أثمن من الصيانة نفسها.',
  'The accounts': 'الحسابات',
  'Most vehicles first. Open one to see what is wrong with which van.':
    'الأكثر مركبات أولاً. افتح أحدها لترى ما خطب كل شاحنة.',
  'No fleets yet': 'لا أساطيل بعد',
  'A company customer with more than one vehicle appears here automatically. Nothing needs setting up.':
    'يظهر هنا تلقائياً كل عميل شركة لديه أكثر من مركبة. لا حاجة لأي إعداد.',
  'Due soon': 'مستحقة قريباً',
  'Waiting on them': 'بانتظار ردّهم',
  '30 days': '30 يوماً',
  // fleet/[id]
  'All fleets': 'كل الأساطيل',
  '1 vehicle on the books': 'مركبة واحدة مسجلة',
  '{count} vehicles on the books': '{count} مركبات مسجلة',
  'The account': 'الحساب',
  'Seen at least once': 'رُئيت مرة واحدة على الأقل',
  'Quotes nobody has answered': 'عروض أسعار لم يرد عليها أحد',
  'Spent with you': 'أُنفق لديك',
  'Across every vehicle': 'على كل المركبات',
  '1 vehicle waiting on a decision.': 'مركبة واحدة بانتظار قرار.',
  '{count} vehicles waiting on a decision.': '{count} مركبات بانتظار قرار.',
  'A fleet quote usually sits with one person who has forty other things on. Nothing happens until they answer, and the van is off the road the whole time.':
    'عرض سعر الأسطول يبقى عادة لدى شخص واحد منشغل بأربعين أمراً آخر. لا يحدث شيء حتى يرد، والشاحنة متوقفة طوال الوقت.',
  'Vehicles appear here once this company has brought one in.':
    'تظهر المركبات هنا بمجرد أن تحضر هذه الشركة إحداها.',
  'last in {date}': 'آخر زيارة في {date}',
  'Waiting on a decision': 'بانتظار قرار',
  'In the workshop': 'في الورشة',
  'service overdue': 'الصيانة متأخرة',
  'nothing due': 'لا شيء مستحق',
  Spent: 'المُنفق',
  'Terms saved. They apply to every invoice raised for this fleet from now on.':
    'حُفظت الشروط. تُطبَّق على كل فاتورة تصدر لهذا الأسطول من الآن فصاعداً.',
  'Agreed terms': 'الشروط المتفق عليها',
  'Applied at invoice time, so the job keeps its list figures.':
    'تُطبَّق عند الفوترة، لذا يحتفظ العمل بأسعار القائمة.',
  'None yet. Without terms this fleet pays list price like anybody else.':
    'لا شروط بعد. بدون شروط يدفع هذا الأسطول سعر القائمة كأي عميل آخر.',
  'Labour discount': 'خصم الأجور',
  'Parts discount': 'خصم القطع',
  'Payment terms': 'مهلة السداد',
  days: 'أيام',
  'One invoice a month for everything completed, rather than one per job':
    'فاتورة واحدة شهرياً لكل ما اكتمل، بدلاً من فاتورة لكل عمل',
  'Their purchase order number must be on every job before it is invoiced':
    'يجب أن يظهر رقم أمر الشراء الخاص بهم على كل عمل قبل فوترته',
  'Update the terms': 'حدّث الشروط',
  'Save the terms': 'احفظ الشروط',
  'Invoice a month': 'فوترة شهر',
  'Every job completed in the month, on one invoice, at the agreed terms.':
    'كل عمل اكتمل خلال الشهر، في فاتورة واحدة، بالشروط المتفق عليها.',
  Month: 'الشهر',
  'Jobs already invoiced on their own are left alone. Each line on the invoice names the vehicle and the job it came from, so their accounts department can tie a line to a van.':
    'الأعمال المفوترة منفردة مسبقاً لا تُمس. كل سطر في الفاتورة يذكر المركبة والعمل الذي جاء منه، ليتمكن قسم الحسابات لديهم من ربط كل سطر بشاحنة.',
  'Issue the month’s invoice': 'أصدر فاتورة الشهر',
  'Save the terms first': 'احفظ الشروط أولاً',
  // reminders
  'Service reminders': 'تذكيرات الصيانة',
  'Due in the next {days} days': 'مستحقة خلال {days} يوماً القادمة',
  '{days}d': '{days} يوم',
  'Within {days} days': 'خلال {days} يوماً',
  'Past the interval already': 'تجاوزت الفترة بالفعل',
  'Nobody to tell': 'لا أحد لإبلاغه',
  'No address on the owner': 'لا عنوان للمالك',
  'Already sent': 'أُرسلت بالفعل',
  'Reminder has gone out': 'أُرسل التذكير',
  '1 vehicle due with no way to tell the owner.': 'مركبة واحدة مستحقة ولا وسيلة لإبلاغ مالكها.',
  '{count} vehicles due with no way to tell the owner.':
    '{count} مركبات مستحقة ولا وسيلة لإبلاغ ملاكها.',
  'The reminder will not go out, and nothing will report a failure, because there was nothing to fail. These are the ones that quietly become somebody else’s customer.':
    'لن يُرسل التذكير، ولن يُبلَّغ عن أي إخفاق، لأنه لم يكن هناك ما يُخفق. هؤلاء هم من يصبحون بهدوء عملاء لورشة أخرى.',
  Due: 'الاستحقاق',
  'Soonest first. This is what the reminder worker will act on.':
    'الأقرب أولاً. هذا ما ستعالجه خدمة التذكيرات.',
  'No vehicle reaches its service interval in the next {days} days.':
    'لا مركبة تبلغ موعد صيانتها خلال {days} يوماً القادمة.',
  'no address': 'لا عنوان',
  'By mileage': 'بحسب المسافة',
  sent: 'أُرسل',
  'cannot send': 'تعذّر الإرسال',
  'Paperwork running out': 'مستندات قاربت على الانتهاء',
  'The latest MOT or insurance on file for a vehicle this workshop looks after, within forty-five days or already gone':
    'أحدث شهادة فحص دوري أو تأمين محفوظة لمركبة ترعاها هذه الورشة، خلال خمسة وأربعين يوماً أو منتهية بالفعل',
  'Nothing on file is running out. Paperwork is added on the vehicle’s page, or by the owner from their portal.':
    'لا شيء محفوظ قارب على الانتهاء. تُضاف المستندات من صفحة المركبة، أو من المالك عبر بوابته.',
  'How this works': 'كيف يعمل هذا',
  'A service interval is set by time, by mileage, or by both. Where mileage is involved the due date is projected from how far the vehicle has actually been travelling, not from an average, so a van that does 30,000 a year is not reminded on the same schedule as a car that does 4,000.':
    'تُحدَّد فترة الصيانة بالوقت أو بالمسافة أو بكليهما. حين تدخل المسافة في الحساب يُقدَّر تاريخ الاستحقاق من المسافة التي تقطعها المركبة فعلاً لا من متوسط، فالشاحنة التي تقطع 30,000 سنوياً لا تُذكَّر بالجدول نفسه الذي تُذكَّر به سيارة تقطع 4,000.',
  'The worker sends each reminder once and records when. Nothing on this page sends anything: it is here so somebody can tell the difference between a quiet month and a worker that has stopped.':
    'ترسل الخدمة كل تذكير مرة واحدة وتسجل وقت إرساله. لا شيء في هذه الصفحة يرسل أي شيء: هي موجودة ليتمكن أحد من التمييز بين شهر هادئ وخدمة توقفت.',
  // crm
  'Who has stopped coming, who is staying, and who you are allowed to write to':
    'من توقف عن المجيء، ومن يبقى، ومن يُسمح لك بمراسلته',
  'Nothing was sent': 'لم يُرسل شيء',
  'Saved as a draft': 'حُفظت كمسودة',
  'Nothing has gone out. The campaign below will say how many people it reaches before you commit to it.':
    'لم يُرسل شيء. ستوضح الحملة أدناه عدد من ستصل إليهم قبل أن تلتزم بها.',
  Sent: 'أُرسلت',
  '{sent} written to, {held} held back. There is no way to call it back.':
    'أُرسلت إلى {sent}، وحُجبت عن {held}. لا سبيل لاستردادها.',
  'Lapsed a year': 'منقطعون منذ سنة',
  'Not been in for 12 months': 'لم يحضروا منذ 12 شهراً',
  Reachable: 'يمكن الوصول إليهم',
  'Of those, by email': 'منهم عبر البريد الإلكتروني',
  Cohorts: 'الشرائح الزمنية',
  'Months with a first visit': 'أشهر فيها زيارة أولى',
  'Campaigns sent': 'الحملات المرسلة',
  '{count} in total': '{count} إجمالاً',
  '{count} of the people below cannot be written to.': '{count} من الأشخاص أدناه لا يمكن مراسلتهم.',
  'Some never agreed to marketing and some have no address on file. They stay in the segment and out of the send, and the reason is kept against each one.':
    'بعضهم لم يوافق على التسويق قط وبعضهم لا عنوان محفوظ له. يبقون في الشريحة وخارج الإرسال، ويُحفظ السبب لكل منهم.',
  Segments: 'الشرائح',
  'The count that matters is the second one: how many can actually be reached.':
    'العدد المهم هو الثاني: كم منهم يمكن الوصول إليه فعلاً.',
  Segment: 'الشريحة',
  'In it': 'الأعضاء',
  'Held back': 'محجوبون',
  Worth: 'القيمة',
  'If you sent it': 'لو أرسلتها',
  '{count} emails, nothing to pay.': '{count} رسائل بريد، دون تكلفة.',
  'Retention by cohort': 'الاحتفاظ بالعملاء حسب الشريحة الزمنية',
  'Share of each month’s new customers who came back, by months since. An overall rate would move with acquisition and tell you nothing.':
    'نسبة العملاء الجدد في كل شهر الذين عادوا، بحسب الأشهر المنقضية. المعدل الإجمالي يتغير مع اكتساب العملاء ولا يخبرك بشيء.',
  'No completed visits yet': 'لا زيارات مكتملة بعد',
  'Cohorts appear once customers have a first visit to be counted from.':
    'تظهر الشرائح الزمنية حين تكون للعملاء زيارة أولى يُحتسب منها.',
  'First came in': 'أول زيارة',
  Size: 'الحجم',
  'Worth each': 'قيمة كل عميل',
  'Write a campaign': 'اكتب حملة',
  'Saving writes a draft and sends nothing. The audience is stored as its rules, so consent is rechecked against every person at the moment you send.':
    'الحفظ ينشئ مسودة ولا يرسل شيئاً. يُحفظ الجمهور على شكل قواعد، لذا يُعاد التحقق من موافقة كل شخص لحظة الإرسال.',
  'Call it': 'الاسم',
  'Winter check offer': 'عرض فحص الشتاء',
  Who: 'لمن',
  '{segment} ({count} reachable)': '{segment} ({count} يمكن الوصول إليهم)',
  How: 'كيف',
  'A text costs money to send. Email does not.': 'الرسالة النصية لها تكلفة. البريد الإلكتروني لا.',
  Text: 'رسالة نصية',
  Subject: 'الموضوع',
  'Email only.': 'للبريد الإلكتروني فقط.',
  'A free winter check while the weather turns': 'فحص شتوي مجاني مع تغيّر الطقس',
  'What it says': 'نص الرسالة',
  'Save as a draft': 'احفظ كمسودة',
  'Consent is rechecked for every recipient at the moment of sending, never taken from when the list was built.':
    'يُعاد التحقق من موافقة كل مستلم لحظة الإرسال، ولا تُؤخذ أبداً من وقت إنشاء القائمة.',
  'No campaigns': 'لا حملات',
  'A campaign is a segment and a message. It is the one thing here that cannot be undone.':
    'الحملة شريحة ورسالة. وهي الشيء الوحيد هنا الذي لا يمكن التراجع عنه.',
  Channel: 'القناة',
  When: 'متى',
  'Not sent': 'لم تُرسل',
  'Send it': 'أرسلها',
  draft: 'مسودة',
  sending: 'قيد الإرسال',
  cancelled: 'ملغاة',
  'Not been in for {days} days': 'لم يحضروا منذ {days} يوماً',
  'Spent more than £{amount} with you': 'أنفقوا أكثر من {amount} جنيه إسترليني لديك',
  'Been in at least {count} times': 'حضروا {count} مرات على الأقل',
  'Has a vehicle over {years} years old': 'لديهم مركبة عمرها أكثر من {years} سنوات',
  'Came once and never came back': 'حضروا مرة ولم يعودوا',
  'Declined work in the last {days} days': 'رفضوا أعمالاً خلال آخر {days} يوماً',
  'Nobody in this segment can be contacted on this channel.':
    'لا أحد في هذه الشريحة يمكن التواصل معه عبر هذه القناة.',
  'More of this segment cannot be reached ({unreachable}) than can ({reachable}).':
    'من لا يمكن الوصول إليهم في هذه الشريحة ({unreachable}) أكثر ممن يمكن ({reachable}).',
  '1 person has not agreed to marketing and will not be sent to.':
    'شخص واحد لم يوافق على التسويق ولن يُرسل إليه.',
  '{count} people have not agreed to marketing and will not be sent to.':
    '{count} أشخاص لم يوافقوا على التسويق ولن يُرسل إليهم.',
  // Phase 41: tax, configurable.
  'Exempt. No tax is charged on their invoices.': 'معفى. لا تُحتسب أي ضريبة على فواتيره.',
  'Charged tax as usual.': 'تُحتسب عليه الضريبة كالمعتاد.',
  'Exempt from tax': 'معفى من الضريبة',
  'Certificate or registration number': 'رقم الشهادة أو التسجيل',
  'Required when exempt. It is printed on every invoice to them.':
    'مطلوب عند الإعفاء. يُطبع على كل فاتورة تصدر له.',
};
