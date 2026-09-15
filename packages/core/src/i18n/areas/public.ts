/**
 * The public site, sign-up, sign-in, the pay pages and the links sent to customers.
 *
 * Keys are the English exactly as written in the product. Slots in braces
 * are kept as they are. Phase 40.5.
 */

export const fr: Readonly<Record<string, string>> = {
  // The root layout, the 404 and the offline page.
  'Workshop management with a portable vehicle history that follows the car, not the owner or the garage.':
    'La gestion d’atelier avec un historique de véhicule portable qui suit la voiture, et non le propriétaire ou le garage.',
  'Page not found': 'Page introuvable',
  'Error 404': 'Erreur 404',
  'The road stops here': 'La route s’arrête ici',
  'There is nothing at this address. The page may have moved, or the link that brought you here may be out of date.':
    'Il n’y a rien à cette adresse. La page a peut-être été déplacée, ou le lien qui vous a mené ici n’est plus à jour.',
  'Back to the workshop': 'Retour à l’atelier',
  'If you followed a link to a vehicle’s history, ask whoever sent it to share the vehicle again. Share links are time-limited by design, so the owner stays in control of who can read the record.':
    'Si vous avez suivi un lien vers l’historique d’un véhicule, demandez à la personne qui l’a envoyé de le partager à nouveau. Les liens de partage sont limités dans le temps à dessein, pour que le propriétaire garde la maîtrise de qui peut lire le registre.',
  'No signal': 'Pas de réseau',
  'This page has not been opened on this device before, so there is nothing saved to show you.':
    'Cette page n’a jamais été ouverte sur cet appareil, il n’y a donc rien d’enregistré à vous montrer.',
  'Your jobs, your clock and any inspection you have already opened still work. Anything you record is kept on the device and sent the moment there is a signal.':
    'Vos travaux, votre pointage et tout contrôle déjà ouvert fonctionnent toujours. Tout ce que vous saisissez est conservé sur l’appareil et envoyé dès que le réseau revient.',
  'Back to my jobs': 'Retour à mes travaux',

  // The front page.
  'Carnet — workshop management with a service history that follows the car':
    'Carnet — la gestion d’atelier avec un historique d’entretien qui suit la voiture',
  'Run the diary, jobs, inspections, parts and the books in one system. Every job writes to a service history the vehicle keeps for life, and takes with it when it is sold.':
    'Gérez l’agenda, les travaux, les contrôles, les pièces et la comptabilité dans un seul système. Chaque travail s’inscrit dans un historique d’entretien que le véhicule garde à vie, et emporte avec lui lorsqu’il est vendu.',
  'Three garages, two owners and eleven years later, the folder in the glovebox is a stack of receipts and a guess. The work was real. The evidence is gone.':
    'Trois garages, deux propriétaires et onze ans plus tard, la pochette de la boîte à gants n’est plus qu’une pile de factures et une supposition. Le travail était réel. La preuve a disparu.',
  'The garage owns the record': 'Le garage possède le registre',
  'Your history lives in your system. When the customer moves away, or you close, it goes with you. The car keeps nothing.':
    'Votre historique vit dans votre système. Quand le client déménage, ou que vous fermez, il part avec vous. La voiture ne garde rien.',
  'Nobody can verify a claim': 'Personne ne peut vérifier une affirmation',
  '“Full service history” means a folder of paper anybody could print. A buyer discounts what they cannot check, and the seller pays for it.':
    '« Historique d’entretien complet » signifie une pochette de papiers que n’importe qui pourrait imprimer. Un acheteur déduit ce qu’il ne peut pas vérifier, et c’est le vendeur qui paie.',
  'The next garage starts blind': 'Le garage suivant part à l’aveugle',
  'A car arrives with no record of the cambelt, the fluid, or what the last workshop already advised on. The same checks get done twice and paid for once.':
    'Une voiture arrive sans trace de la courroie de distribution, des liquides, ni de ce que le dernier atelier avait déjà recommandé. Les mêmes contrôles sont faits deux fois et payés une seule.',
  'Every completed job writes entries against the car itself: the work, the parts, the mileage, the photographs. Not against your customer record. Against the VIN.':
    'Chaque travail terminé inscrit des entrées sur la voiture elle-même : le travail, les pièces, le kilométrage, les photos. Pas sur votre fiche client. Sur le VIN.',
  'It transfers on sale': 'Il se transmet à la vente',
  'Ownership changes hands and the history goes with the car. The new owner sees everything, including what a workshop they have never heard of did in 2019.':
    'La voiture change de propriétaire et l’historique la suit. Le nouveau propriétaire voit tout, y compris ce qu’un atelier dont il n’a jamais entendu parler a fait en 2019.',
  'It cannot be quietly edited': 'Il ne peut pas être modifié en douce',
  'Entries are appended and hash-linked. Correcting one leaves both versions visible. A history that can be rewritten is worth exactly as much as the folder it replaced.':
    'Les entrées sont ajoutées et chaînées par empreinte. En corriger une laisse les deux versions visibles. Un historique qu’on peut réécrire ne vaut pas plus que la pochette qu’il remplace.',
  'It is worth money at resale': 'Il a une valeur à la revente',
  'A verifiable record is the difference between a buyer taking your word for it and a buyer checking. That difference has a price, and the seller has been paying it.':
    'Un registre vérifiable fait la différence entre un acheteur qui vous croit sur parole et un acheteur qui vérifie. Cette différence a un prix, et c’est le vendeur qui le payait.',
  'It works even where Carnet does not': 'Il fonctionne même là où Carnet n’est pas',
  'A passport opens as a public link. The next garage needs no account, no login and no relationship with us to read what you wrote.':
    'Un passeport s’ouvre par un lien public. Le garage suivant n’a besoin ni de compte, ni de connexion, ni d’aucune relation avec nous pour lire ce que vous avez écrit.',
  'One data model, so the estimate the customer approved is the job the technician worked, is the invoice they paid, is the entry in the accounts. Nothing is re-keyed.':
    'Un seul modèle de données : le devis que le client a approuvé est le travail effectué par le technicien, la facture qu’il a payée et l’écriture en comptabilité. Rien n’est ressaisi.',
  'Diary and jobs': 'Agenda et travaux',
  'Bay-level scheduling with real capacity. Fourteen job statuses that refuse the transitions that make no sense, and say why.':
    'Une planification par poste avec la capacité réelle. Quatorze statuts de travail qui refusent les transitions absurdes, et disent pourquoi.',
  'Inspections with photographs': 'Contrôles avec photos',
  'Structured checks with measurements and pictures. A customer approving brake work can see the pads.':
    'Des contrôles structurés avec mesures et photos. Un client qui approuve des travaux de freinage peut voir les plaquettes.',
  'Estimates the customer decides on': 'Des devis sur lesquels le client décide',
  'Sent as a link, approved line by line. Work exceeding what was approved needs approving again.':
    'Envoyés par lien, approuvés ligne par ligne. Un travail qui dépasse ce qui a été approuvé doit être approuvé à nouveau.',
  'Parts and purchasing': 'Pièces et achats',
  'Weighted average cost, reservations against jobs, reorder suggestions from actual usage, three-way bill matching.':
    'Coût moyen pondéré, réservations sur les travaux, suggestions de réapprovisionnement d’après la consommation réelle, rapprochement à trois voies des factures fournisseurs.',
  'Invoicing and the ledger': 'Facturation et grand livre',
  'Double-entry posted from the work itself. Trial balance, profit and loss, balance sheet, VAT, aged debtors.':
    'Une comptabilité en partie double passée à partir du travail lui-même. Balance, compte de résultat, bilan, TVA, balance âgée clients.',
  'People and productivity': 'Personnel et productivité',
  'Attended, clocked and sold hours side by side, so utilisation and efficiency stop hiding each other.':
    'Heures de présence, pointées et vendues côte à côte, pour que le taux d’occupation et l’efficacité cessent de se masquer l’un l’autre.',
  'Every step below writes to the same job. The passport entries at the end are produced by the work, not typed in afterwards.':
    'Chaque étape ci-dessous s’inscrit dans le même travail. Les entrées du passeport à la fin sont produites par le travail, pas saisies après coup.',
  'Books in': 'Prise de rendez-vous',
  'Customer calls. Booking takes a bay and a technician, and checks the day has room for it.':
    'Le client appelle. Le rendez-vous réserve un poste et un technicien, et vérifie que la journée a de la place.',
  Inspected: 'Contrôlé',
  'Technician works the checklist on a tablet. Two reds and three ambers, with photographs.':
    'Le technicien suit la liste de contrôle sur une tablette. Deux rouges et trois oranges, avec photos.',
  Approved: 'Approuvé',
  'Estimate goes out as a link. The customer approves the brakes and declines the tyres.':
    'Le devis part sous forme de lien. Le client approuve les freins et refuse les pneus.',
  'Invoiced and recorded': 'Facturé et enregistré',
  'Parts leave stock, time is costed, the invoice posts to the ledger, and the car keeps the history.':
    'Les pièces sortent du stock, le temps est valorisé, la facture passe au grand livre, et la voiture garde l’historique.',
  'Three plans, and unlimited staff accounts on every one. The vehicle passport is in all of them, because a network nobody can join is not a network.':
    'Trois formules, avec des comptes employés illimités dans chacune. Le passeport du véhicule est inclus partout, car un réseau que personne ne peut rejoindre n’est pas un réseau.',
  Core: 'Essentiel',
  Complete: 'Complet',
  'A single workshop running the everyday work': 'Un atelier unique qui gère le travail quotidien',
  'A workshop that wants the books to be right, not reconciled later':
    'Un atelier qui veut une comptabilité juste, pas rapprochée plus tard',
  'More than one site, read as one business': 'Plusieurs sites, lus comme une seule entreprise',
  'Not a workshop?': 'Vous n’êtes pas un atelier ?',
  'Keep your own car’s history instead.': 'Gardez plutôt l’historique de votre propre voiture.',
  'Free, and the record follows the car when you sell it.':
    'C’est gratuit, et le registre suit la voiture quand vous la vendez.',
  'Front brake pads and discs replaced': 'Plaquettes et disques de frein avant remplacés',
  'Pads at 2mm on inspection. Discs lipped. Photographs attached.':
    'Plaquettes à 2 mm au contrôle. Disques avec lèvre d’usure. Photos jointes.',
  'Advisory: rear tyres approaching limit': 'Recommandation : pneus arrière proches de la limite',
  'Declined by owner at the time. Recorded either way.':
    'Refusé par le propriétaire à ce moment-là. Enregistré dans tous les cas.',
  '12 March 2024': '12 mars 2024',

  // The pricing page, the plans, the countries and taxes it names, and the terms.
  'Three plans, priced per bay. Unlimited staff accounts on every one. The vehicle passport is included in all of them.':
    'Trois formules, tarifées par poste. Des comptes employés illimités dans chacune. Le passeport du véhicule est inclus dans toutes.',
  Bays: 'Postes',
  'Staff accounts': 'Comptes employés',
  'Vehicles on the books': 'Véhicules enregistrés',
  'Priced per bay, because bays are what a workshop earns from. Staff accounts are unlimited on every plan: charging per user would bill you for giving your own people access.':
    'Tarifé par poste, car ce sont les postes qui font gagner de l’argent à un atelier. Les comptes employés sont illimités dans toutes les formules : facturer par utilisateur vous ferait payer le fait de donner accès à vos propres équipes.',
  'Billed annually. Saves {percent}% against {monthly} monthly.':
    'Facturé annuellement. Économise {percent} % par rapport à {monthly} en mensuel.',
  'Start {days}-day trial': 'Commencer l’essai de {days} jours',
  'Prices are in {currency}, per bay per month, and exclude {tax}. You are billed in the currency of your country and no other. The trial creates a real workshop with your data in it. A card is added at sign-up and charged only when the trial ends, unless you cancel first.':
    'Les prix sont en {currency}, par poste et par mois, hors {tax}. Vous êtes facturé dans la monnaie de votre pays et dans aucune autre. L’essai crée un vrai atelier avec vos données. Une carte est ajoutée à l’inscription et n’est prélevée qu’à la fin de l’essai, sauf si vous résiliez avant.',
  'Limits are counted and enforced. When a workshop reaches one, the system says so before it stops rather than after.':
    'Les limites sont comptées et appliquées. Quand un atelier en atteint une, le système le signale avant de bloquer, pas après.',
  'Diary, jobs, inspections and estimates': 'Agenda, travaux, contrôles et devis',
  'Vehicle passport on every car you touch':
    'Passeport du véhicule sur chaque voiture que vous touchez',
  'Invoicing, payments and parts': 'Facturation, paiements et pièces',
  'Customer portal': 'Portail client',
  'Everything in Core': 'Tout ce qu’inclut Essentiel',
  'Double-entry ledger, posted from the work itself':
    'Grand livre en partie double, alimenté par le travail lui-même',
  'Profit and loss, balance sheet, VAT position': 'Compte de résultat, bilan, position de TVA',
  'Purchase orders and three-way bill matching':
    'Bons de commande et rapprochement à trois voies des factures',
  'Timesheets, pay history and commission': 'Feuilles de temps, historique de paie et commissions',
  'Everything in Complete, at every site': 'Tout ce qu’inclut Complet, sur chaque site',
  'Consolidated reporting that carries its spread':
    'Des rapports consolidés qui montrent les écarts entre sites',
  'Stock transfers, with what is on the road counted':
    'Transferts de stock, en comptant ce qui est en route',
  'Per-site permissions and single sign-on': 'Droits par site et authentification unique',
  'The vehicle passport': 'Le passeport du véhicule',
  'Digital inspections': 'Contrôles numériques',
  'Estimates and approvals': 'Devis et accords',
  'The parts catalogue': 'Le catalogue de pièces',
  'Purchase orders': 'Bons de commande',
  'The general ledger': 'Le grand livre',
  'Financial statements': 'États financiers',
  'Timesheets and payroll': 'Feuilles de temps et paie',
  'Commission schemes': 'Plans de commissions',
  'More than one site': 'Plus d’un site',
  'Stock transfers between sites': 'Transferts de stock entre sites',
  'The API': 'L’API',
  'Single sign-on': 'Authentification unique',
  'Why is the passport in the cheapest plan?':
    'Pourquoi le passeport est-il dans la formule la moins chère ?',
  'Because a network nobody can join is not a network. The record is worth more to every workshop the more vehicles carry one, so putting it behind the top tier would strangle the part of the product that compounds.':
    'Parce qu’un réseau que personne ne peut rejoindre n’est pas un réseau. Le registre vaut d’autant plus pour chaque atelier que les véhicules sont nombreux à en avoir un : le réserver à la formule la plus chère étoufferait la partie du produit dont la valeur se cumule.',
  'What happens at the end of the trial?': 'Que se passe-t-il à la fin de l’essai ?',
  'You add a card when you open the workshop; nothing is charged for {days} days. On the day the trial ends the card is charged for the first month of the plan you chose, and monthly after that, unless you cancelled before then, which takes two presses from Settings. We remind you by email three days before. Nothing is ever deleted: a cancelled workshop still reads and exports everything.':
    'Vous ajoutez une carte en ouvrant l’atelier ; rien n’est prélevé pendant {days} jours. Le jour où l’essai se termine, la carte est prélevée pour le premier mois de la formule choisie, puis chaque mois, sauf si vous avez résilié avant, ce qui se fait en deux pressions depuis Réglages. Nous vous le rappelons par e-mail trois jours avant. Rien n’est jamais supprimé : un atelier résilié peut toujours tout lire et tout exporter.',
  'Why per bay rather than per user?': 'Pourquoi par poste plutôt que par utilisateur ?',
  'Because bays are what a workshop earns from, and users are not. Charging per seat bills you for giving your own staff access, which pushes workshops into sharing a login and makes every record say the wrong person did the work.':
    'Parce que ce sont les postes qui rapportent à un atelier, pas les utilisateurs. Facturer par siège vous fait payer l’accès de vos propres employés, ce qui pousse les ateliers à partager un identifiant et fait dire à chaque registre que la mauvaise personne a fait le travail.',
  'What counts as a site?': 'Qu’est-ce qui compte comme un site ?',
  'A physical premises with its own bays and its own stock. Two units on the same industrial estate sharing a store is one site. Two towns is two.':
    'Des locaux physiques avec leurs propres postes et leur propre stock. Deux unités dans la même zone industrielle qui partagent un magasin forment un seul site. Deux villes, c’est deux sites.',
  'Do customers using the portal count?': 'Les clients qui utilisent le portail comptent-ils ?',
  'No. Your customers are unlimited on every plan, and so is the number of people who read a passport link.':
    'Non. Vos clients sont illimités dans toutes les formules, tout comme le nombre de personnes qui lisent un lien de passeport.',
  'Can we move our existing history in?': 'Pouvons-nous importer notre historique existant ?',
  'Yes, and it is worth doing. Imported history is marked as migrated rather than as verified work you recorded, because a record that cannot distinguish the two is not worth trusting.':
    'Oui, et cela en vaut la peine. L’historique importé est marqué comme migré et non comme un travail vérifié que vous avez enregistré, car un registre qui ne distingue pas les deux ne mérite pas la confiance.',
  'What happens if we leave?': 'Que se passe-t-il si nous partons ?',
  'Your data exports in full. The passports stay with the vehicles, which is the point of them: they were never yours to take away.':
    'Vos données s’exportent intégralement. Les passeports restent avec les véhicules, c’est tout leur intérêt : ils n’ont jamais été à vous pour que vous les emportiez.',
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
  'VAT 20%': 'TVA 20 %',
  'VAT 23%': 'TVA 23 %',
  'VAT 5%': 'TVA 5 %',
  'VAT 15%': 'TVA 15 %',
  'VAT 14%': 'TVA 14 %',
  'GST 5%': 'TPS 5 %',
  'GST 10%': 'GST 10 %',
  'GST 15%': 'GST 15 %',
  'GST 18%': 'GST 18 %',
  'Sales tax 7%': 'Taxe de vente 7 %',
  Terms: 'Conditions',
  'The terms a workshop agrees to when it opens on Carnet: the trial, the charge, cancelling, and what happens to the data.':
    'Les conditions qu’un atelier accepte en ouvrant sur Carnet : l’essai, le prélèvement, la résiliation et ce que deviennent les données.',
  'Version {version}.': 'Version {version}.',
  'Opening a workshop starts a free trial of {days} days. To start it you add a payment card. Nothing is charged during the trial.':
    'Ouvrir un atelier démarre un essai gratuit de {days} jours. Pour le démarrer, vous ajoutez une carte de paiement. Rien n’est prélevé pendant l’essai.',
  'We tell you this here, on the sign-up form, in the welcome email, and again by email {days} days before the trial ends, with the date and the amount.':
    'Nous vous le disons ici, sur le formulaire d’inscription, dans l’e-mail de bienvenue, et de nouveau par e-mail {days} jours avant la fin de l’essai, avec la date et le montant.',
  'The plans and their prices are on the {link}, per bay, per month, and exclude tax. You are billed in the currency of your country, the one your books are kept in, and in no other. Paid monthly, per bay per month, the plans cost:':
    'Les formules et leurs prix figurent sur la {link}, par poste, par mois, hors taxes. Vous êtes facturé dans la monnaie de votre pays, celle de votre comptabilité, et dans aucune autre. Payées mensuellement, par poste et par mois, les formules coûtent :',
  'If a charge fails, we tell you by email and the provider tries again over the following days. The workshop keeps working while that happens. If no payment succeeds within {days} days, the workshop becomes read-only until a payment goes through. Nothing is deleted.':
    'Si un prélèvement échoue, nous vous prévenons par e-mail et le prestataire réessaie les jours suivants. L’atelier continue de fonctionner pendant ce temps. Si aucun paiement n’aboutit dans les {days} jours, l’atelier passe en lecture seule jusqu’à ce qu’un paiement aboutisse. Rien n’est supprimé.',
  'Everything you enter is yours. A read-only or cancelled workshop can still read all of it and export all of it. We do not delete a workshop’s data when it stops paying; we delete it when you ask us to, subject to the retention the law requires for invoices and tax records.':
    'Tout ce que vous saisissez vous appartient. Un atelier en lecture seule ou résilié peut toujours tout lire et tout exporter. Nous ne supprimons pas les données d’un atelier lorsqu’il cesse de payer ; nous les supprimons lorsque vous nous le demandez, sous réserve de la conservation que la loi impose pour les factures et les documents fiscaux.',
  'The vehicle passport is different by design: an entry a workshop writes to a vehicle’s history belongs to the vehicle’s record and stays readable to the vehicle’s owner after the workshop leaves Carnet. Nothing in it identifies a workshop’s customers to anybody else.':
    'Le passeport du véhicule est différent par conception : une entrée qu’un atelier inscrit dans l’historique d’un véhicule appartient au registre du véhicule et reste lisible par son propriétaire après le départ de l’atelier de Carnet. Rien dans ce registre n’identifie les clients d’un atelier auprès de qui que ce soit.',
  'When your customers pay an invoice by card through Carnet, the payment is processed by our payment provider. Card details never reach Carnet or you. The provider’s fees for those payments are shown on your billing page and on the provider’s statement.':
    'Lorsque vos clients paient une facture par carte via Carnet, le paiement est traité par notre prestataire de paiement. Les données de carte ne parviennent jamais à Carnet ni à vous. Les frais du prestataire pour ces paiements figurent sur votre page de facturation et sur le relevé du prestataire.',

  // Sign-up, sign-in, passwords, the buyer check and confirming an address.
  'Start a workshop': 'Ouvrir un atelier',
  'Open a Carnet workshop. {days} days free; the card is charged only when the trial ends, and only if you have not cancelled.':
    'Ouvrez un atelier Carnet. {days} jours gratuits ; la carte n’est prélevée qu’à la fin de l’essai, et seulement si vous n’avez pas résilié.',
  '{days} days free. Your card is charged only when the trial ends, and only if you have not cancelled':
    '{days} jours gratuits. Votre carte n’est prélevée qu’à la fin de l’essai, et seulement si vous n’avez pas résilié',
  'Set up with bays, job types and VAT already configured':
    'Prêt avec les postes, les types de travaux et la TVA déjà configurés',
  'Every job you put through writes a permanent vehicle history':
    'Chaque travail que vous traitez écrit un historique permanent du véhicule',
  'Already have an account?': 'Vous avez déjà un compte ?',
  '{days} days free on {plan}. You add a card on the next page; it is charged on the day the trial ends unless you cancel before, and nothing is ever deleted.':
    '{days} jours gratuits sur {plan}. Vous ajoutez une carte à la page suivante ; elle est prélevée le jour où l’essai se termine sauf si vous résiliez avant, et rien n’est jamais supprimé.',
  'One thing to check before we continue.': 'Une chose à vérifier avant de continuer.',
  '1 thing to fix.': '1 chose à corriger.',
  '{count} things to fix.': '{count} choses à corriger.',
  'Hillside Motors': 'Garage des Collines',
  'you@yourworkshop.co.uk': 'vous@votreatelier.fr',
  'Choose the country the workshop trades in.': 'Choisissez le pays où l’atelier exerce.',
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
    'Cela ressemble à une adresse personnelle. Utilisez l’adresse de votre atelier si vous en avez une, pour que le compte ne soit pas lié à une seule personne.',
  'Use at least {count} characters.': 'Utilisez au moins {count} caractères.',
  'That password is one of the first ones tried.':
    'Ce mot de passe fait partie des premiers essayés.',
  'Do not put the workshop name in the password.':
    'Ne mettez pas le nom de l’atelier dans le mot de passe.',
  'Enter how many sites you run, at least one.':
    'Indiquez combien de sites vous gérez, au moins un.',
  'There is already an account on that address. Sign in instead.':
    'Un compte existe déjà avec cette adresse. Connectez-vous plutôt.',
  'Tick the box to say you have read how the trial and the charge work.':
    'Cochez la case pour indiquer que vous avez lu comment fonctionnent l’essai et le prélèvement.',
  'That password has appeared in a data breach once. Choose one nobody has used before; a phrase of four unrelated words is easy to remember and hard to guess.':
    'Ce mot de passe est apparu une fois dans une fuite de données. Choisissez-en un que personne n’a utilisé ; une phrase de quatre mots sans rapport est facile à retenir et difficile à deviner.',
  'That password has appeared in  data breaches {count} times. Choose one nobody has used before; a phrase of four unrelated words is easy to remember and hard to guess.':
    'Ce mot de passe est apparu {count} fois dans des fuites de données. Choisissez-en un que personne n’a utilisé ; une phrase de quatre mots sans rapport est facile à retenir et difficile à deviner.',
  'Keep your car history': 'Gardez l’historique de votre voiture',
  'A free Carnet account for drivers. Every service, repair and MOT on your car, in one place, and it stays with the car when you sell it.':
    'Un compte Carnet gratuit pour les conducteurs. Chaque entretien, réparation et contrôle technique de votre voiture, au même endroit, et il reste avec la voiture quand vous la vendez.',
  'Every service, repair and part, with dates and mileages':
    'Chaque entretien, réparation et pièce, avec les dates et les kilométrages',
  'What was recommended and declined, so nothing is a surprise later':
    'Ce qui a été recommandé et refusé, pour que rien ne soit une surprise plus tard',
  'A buyer report you can hand over when you sell':
    'Un rapport pour l’acheteur que vous pouvez remettre quand vous vendez',
  'Free, and it stays free': 'Gratuit, et ça le reste',
  'Run a workshop instead?': 'Vous gérez plutôt un atelier ?',
  'Keep your car’s history': 'Gardez l’historique de votre voiture',
  'At least {count} characters': 'Au moins {count} caractères',
  'Every job you complete writes a verified, tamper-evident entry to the vehicle’s permanent record. When the car is sold, the history goes with it.':
    'Chaque travail terminé écrit une entrée vérifiée et infalsifiable dans le registre permanent du véhicule. Quand la voiture est vendue, l’historique part avec elle.',
  'No account yet? {driver} as a driver, or {workshop}.':
    'Pas encore de compte ? {driver} en tant que conducteur, ou {workshop}.',
  'Enter your email and password': 'Saisissez votre e-mail et votre mot de passe',
  'Too many attempts. Wait fifteen minutes and try again.':
    'Trop de tentatives. Attendez quinze minutes et réessayez.',
  'That email and password do not match.': 'Cet e-mail et ce mot de passe ne correspondent pas.',
  'If that address has an account, a link is on its way. It lasts an hour, and asking again replaces it.':
    'Si cette adresse a un compte, un lien est en route. Il est valable une heure, et une nouvelle demande le remplace.',
  'Choose a new password': 'Choisir un nouveau mot de passe',
  'At least {count} characters. A short phrase you will remember beats a short word with a number after it.':
    'Au moins {count} caractères. Une courte phrase dont vous vous souviendrez vaut mieux qu’un mot court suivi d’un chiffre.',
  'And again': 'Encore une fois',
  'Set it and sign in': 'Le définir et se connecter',
  'Setting a new password signs you out everywhere else. If you are doing this because you think somebody else has your password, that is the part that matters.':
    'Définir un nouveau mot de passe vous déconnecte partout ailleurs. Si vous le faites parce que vous pensez que quelqu’un d’autre a votre mot de passe, c’est ce qui compte.',
  'Ask for a new link': 'Demander un nouveau lien',
  'Those two do not match.': 'Les deux ne correspondent pas.',
  'Check a vehicle': 'Vérifier un véhicule',
  'Enter the code on a Carnet vehicle report to read the history it refers to, and see whether it has been altered.':
    'Saisissez le code d’un rapport de véhicule Carnet pour lire l’historique auquel il renvoie, et voir s’il a été modifié.',
  'Check a vehicle’s history': 'Vérifier l’historique d’un véhicule',
  'If a seller has given you a Carnet code, enter it here. You will see what workshops recorded about the vehicle, and whether any of it has been altered since it was written.':
    'Si un vendeur vous a donné un code Carnet, saisissez-le ici. Vous verrez ce que les ateliers ont enregistré sur le véhicule, et si quoi que ce soit a été modifié depuis.',
  'Code from the report': 'Code du rapport',
  'Spaces do not matter.': 'Les espaces ne comptent pas.',
  'Enter the code the seller gave you.': 'Saisissez le code que le vendeur vous a donné.',
  'Check this vehicle': 'Vérifier ce véhicule',
  'What you will see.': 'Ce que vous verrez.',
  'Services, repairs and inspections recorded by workshops using Carnet, the mileage at each, how many owners the vehicle has had and for how long, and anything outstanding on it.':
    'Les entretiens, réparations et contrôles enregistrés par les ateliers qui utilisent Carnet, le kilométrage à chaque fois, le nombre de propriétaires du véhicule et pour combien de temps, et tout ce qui reste en suspens.',
  'What you will not see.': 'Ce que vous ne verrez pas.',
  'Nothing about any owner, past or present. Not their name, not where they live, not what they chose to spend.':
    'Rien sur aucun propriétaire, passé ou présent. Ni son nom, ni son adresse, ni ce qu’il a choisi de dépenser.',
  'What it cannot tell you.': 'Ce qu’il ne peut pas vous dire.',
  'Work done outside Carnet does not appear. An empty record is not proof a car was neglected, and a full one is not a substitute for an inspection before you buy.':
    'Les travaux faits hors de Carnet n’apparaissent pas. Un registre vide ne prouve pas qu’une voiture a été négligée, et un registre complet ne remplace pas une inspection avant l’achat.',
  'Confirming your address': 'Confirmation de votre adresse',
  'That is confirmed.': 'C’est confirmé.',
  '{address} is now a proven address on your account.':
    '{address} est désormais une adresse vérifiée sur votre compte.',
  'Two things change. What you send to customers is less likely to be treated as spam, and when a message to one of them bounces we can tell you rather than leaving you to find out from the customer.':
    'Deux choses changent. Ce que vous envoyez aux clients risque moins d’être traité comme du spam, et quand un message à l’un d’eux est rejeté, nous pouvons vous le dire au lieu de vous laisser l’apprendre par le client.',
  'That link did not work': 'Ce lien n’a pas fonctionné',
  'That link could not be read.': 'Ce lien n’a pas pu être lu.',
  'Nothing is wrong with your account and you can still sign in. Ask for another link from the banner on the dashboard.':
    'Votre compte n’a aucun problème et vous pouvez toujours vous connecter. Demandez un autre lien depuis le bandeau du tableau de bord.',
  'Confirm your email': 'Confirmez votre e-mail',
  'One more step: confirm your email': 'Encore une étape : confirmez votre e-mail',
  'We have sent a link to {email}. Open it and the workshop is yours. Until then, everything the workshop would send goes out in your name from an address nobody has checked, so we wait.':
    'Nous avons envoyé un lien à {email}. Ouvrez-le et l’atelier est à vous. D’ici là, tout ce que l’atelier enverrait partirait en votre nom depuis une adresse que personne n’a vérifiée, alors nous attendons.',
  'Sent again. The newest link is the one that works; earlier ones have been retired.':
    'Renvoyé. Seul le lien le plus récent fonctionne ; les précédents ont été désactivés.',
  'Nothing in your inbox? Check the spam folder first. Some providers hold a first message from a new sender for a few minutes.':
    'Rien dans votre boîte ? Vérifiez d’abord les courriers indésirables. Certains fournisseurs retiennent quelques minutes le premier message d’un nouvel expéditeur.',
  'Send the link again': 'Renvoyer le lien',
  'This deployment has no mail transport configured, so the link is written to the server log rather than sent. Whoever runs it can read it there.':
    'Cette installation n’a pas de transport de courrier configuré : le lien est écrit dans le journal du serveur au lieu d’être envoyé. La personne qui l’administre peut le lire là.',
  'Typed the wrong address? {signOut} and sign up again with the right one. This account will simply never be confirmed, and nothing has been sent from it.':
    'Vous vous êtes trompé d’adresse ? {signOut} et inscrivez-vous de nouveau avec la bonne. Ce compte ne sera tout simplement jamais confirmé, et rien n’a été envoyé depuis.',

  // Invitations, the review request, the shared passport and quote, and the test checkout.
  'Join a workshop': 'Rejoindre un atelier',
  'About Carnet': 'À propos de Carnet',
  'You have been invited': 'Vous avez été invité',
  '{name} has invited you to join as {role}.':
    '{name} vous a invité à rejoindre l’atelier en tant que {role}.',
  'You have been invited to join as {role}.':
    'Vous avez été invité à rejoindre l’atelier en tant que {role}.',
  'Your account belongs to you. The workshop decides what you can see, not who you are.':
    'Votre compte vous appartient. L’atelier décide de ce que vous pouvez voir, pas de qui vous êtes.',
  'Join {workshop}': 'Rejoindre {workshop}',
  'Set up your account': 'Configurer votre compte',
  'You are joining as {role}, using {email}.':
    'Vous rejoignez l’atelier en tant que {role}, avec {email}.',
  'Choose a password': 'Choisissez un mot de passe',
  'Already have a Carnet account on this address? Use the same password and this invitation attaches the workshop to it.':
    'Vous avez déjà un compte Carnet avec cette adresse ? Utilisez le même mot de passe et cette invitation y rattache l’atelier.',
  'This invitation has been used': 'Cette invitation a déjà été utilisée',
  'This invitation was withdrawn': 'Cette invitation a été retirée',
  'This invitation has run out': 'Cette invitation a expiré',
  'We did not issue this link': 'Nous n’avons pas émis ce lien',
  'The account already exists. Sign in with the address it was sent to.':
    'Le compte existe déjà. Connectez-vous avec l’adresse à laquelle elle a été envoyée.',
  'Whoever sent it has withdrawn it. Ask them for a new one.':
    'La personne qui l’a envoyée l’a retirée. Demandez-lui-en une nouvelle.',
  'Invitations last seven days. Ask whoever sent it to send another.':
    'Les invitations durent sept jours. Demandez à la personne qui l’a envoyée d’en envoyer une autre.',
  'Check the link is complete. If it was copied out of an email, part of it may have been left behind.':
    'Vérifiez que le lien est complet. S’il a été copié depuis un e-mail, une partie a peut-être été oubliée.',
  'That did not work.': 'Cela n’a pas fonctionné.',
  'That invitation link is not one we issued.': 'Ce lien d’invitation n’a pas été émis par nous.',
  'Choose a password of at least 10 characters.':
    'Choisissez un mot de passe d’au moins 10 caractères.',
  owner: 'propriétaire',
  manager: 'responsable',
  'service advisor': 'conseiller de service',
  technician: 'technicien',
  bookkeeper: 'comptable',
  customer: 'client',
  'How did we do?': 'Comment nous en sommes-nous sortis ?',
  'Thank you.': 'Merci.',
  'If you have a moment, saying so publicly helps other people find a workshop they can trust.':
    'Si vous avez un instant, le dire publiquement aide d’autres personnes à trouver un atelier de confiance.',
  'Your workshop will send you the link to do that. There is nothing else to do here.':
    'Votre atelier vous enverra le lien pour le faire. Il n’y a rien d’autre à faire ici.',
  'If there was something that would have made it a five, ring us and say so. It is the most useful thing anybody tells us.':
    'S’il y avait quelque chose qui aurait mérité un cinq, appelez-nous pour nous le dire. C’est ce qu’on nous dit de plus utile.',
  'Somebody here will read this today and get in touch. We would rather put it right than leave it.':
    'Quelqu’un ici lira ceci aujourd’hui et vous contactera. Nous préférons arranger les choses plutôt que d’en rester là.',
  'How did we do with your {vehicle}?': 'Comment nous en sommes-nous sortis avec votre {vehicle} ?',
  'How did we do with your vehicle?': 'Comment nous en sommes-nous sortis avec votre véhicule ?',
  'Tap a rating': 'Touchez une note',
  '{rating} out of 5': '{rating} sur 5',
  Badly: 'Mal',
  'Very well': 'Très bien',
  'Anything you want to say': 'Quelque chose à ajouter',
  Send: 'Envoyer',
  'This goes to the workshop that did the work. It is not published anywhere, and nothing about you is passed to anybody else.':
    'Ceci est transmis à l’atelier qui a fait le travail. Ce n’est publié nulle part, et rien sur vous n’est communiqué à qui que ce soit.',
  'Link expired': 'Lien expiré',
  'This link has run out of road': 'Ce lien est arrivé au bout de la route',
  'The vehicle history it pointed to is still there. The link itself has expired, or the owner has withdrawn it.':
    'L’historique du véhicule vers lequel il pointait est toujours là. C’est le lien lui-même qui a expiré, ou le propriétaire l’a retiré.',
  'Why links expire': 'Pourquoi les liens expirent',
  'A vehicle’s history belongs to the vehicle, and its owner decides who may read it. Every share link is time-limited and can be revoked at any moment, so a record shared once for a sale does not stay open to the internet forever.':
    'L’historique d’un véhicule appartient au véhicule, et son propriétaire décide qui peut le lire. Chaque lien de partage est limité dans le temps et révocable à tout moment, pour qu’un registre partagé une fois pour une vente ne reste pas ouvert à tout internet pour toujours.',
  'What to do': 'Que faire',
  'Ask whoever sent it to share the vehicle again. It takes them a few seconds and produces a fresh link.':
    'Demandez à la personne qui l’a envoyé de partager à nouveau le véhicule. Cela lui prend quelques secondes et produit un nouveau lien.',
  'Carnet keeps a permanent, append-only record of what has happened to a vehicle: services, repairs, parts, mileage and inspections, each attributed to the workshop that recorded it. The history follows the car, not the owner.':
    'Carnet tient un registre permanent, en ajout seul, de ce qui est arrivé à un véhicule : entretiens, réparations, pièces, kilométrage et contrôles, chacun attribué à l’atelier qui l’a enregistré. L’historique suit la voiture, pas le propriétaire.',
  'Vehicle passport': 'Passeport du véhicule',
  Back: 'Retour',
  'Shared by the vehicle’s owner. This link expires on {date}, and the owner can revoke it at any time. Your visit has been recorded and is visible to them.':
    'Partagé par le propriétaire du véhicule. Ce lien expire le {date}, et le propriétaire peut le révoquer à tout moment. Votre visite a été enregistrée et lui est visible.',
  'No personal details of any owner are shown. Carnet does not verify claims made outside this record.':
    'Aucune donnée personnelle d’un propriétaire n’est affichée. Carnet ne vérifie pas les affirmations faites en dehors de ce registre.',
  'Your quote': 'Votre devis',
  'This link is no longer live': 'Ce lien n’est plus actif',
  'Quote links expire, and a workshop can withdraw one at any time. Ask them to send it again and it will work straight away.':
    'Les liens de devis expirent, et un atelier peut en retirer un à tout moment. Demandez-lui de le renvoyer et il fonctionnera immédiatement.',
  'Thank you. Your workshop has your answer and will get on with it.':
    'Merci. Votre atelier a votre réponse et va s’y mettre.',
  'Test billing': 'Facturation de test',
  'Test billing portal': 'Portail de facturation de test',
  'Test checkout': 'Paiement de test',
  'Carnet, for {workshop}': 'Carnet, pour {workshop}',
  'This page stands in for the provider’s billing portal while none is connected.':
    'Cette page remplace le portail de facturation du prestataire tant qu’aucun n’est connecté.',
  '{brand} ending {last4}': '{brand} se terminant par {last4}',
  none: 'aucune',
  Plan: 'Formule',
  '{plan}, 1 bay, {amount} a month': '{plan}, 1 poste, {amount} par mois',
  '{plan}, {count} bays, {amount} a month': '{plan}, {count} postes, {amount} par mois',
  trialing: 'en essai',
  active: 'actif',
  'past due': 'en retard de paiement',
  cancelled: 'annulé',
  incomplete: 'incomplet',
  paid: 'payée',
  open: 'ouverte',
  failed: 'échoué',
  void: 'annulée',
  draft: 'brouillon',
  pending: 'en attente',
  succeeded: 'réussi',
  'None yet.': 'Aucune pour l’instant.',
  'Simulate the next charge succeeding ({amount})':
    'Simuler la réussite du prochain prélèvement ({amount})',
  'Simulate the next charge failing': 'Simuler l’échec du prochain prélèvement',
  'Back to Carnet': 'Retour à Carnet',
  'No card is charged here: this page stands in for a payment provider while none is connected.':
    'Aucune carte n’est prélevée ici : cette page remplace un prestataire de paiement tant qu’aucun n’est connecté.',
  'due today. {days} days free, then {amount} a month for 1 bay on {plan}, charged to the card unless cancelled before the trial ends.':
    'à payer aujourd’hui. {days} jours gratuits, puis {amount} par mois pour 1 poste sur {plan}, prélevés sur la carte sauf résiliation avant la fin de l’essai.',
  'due today. {days} days free, then {amount} a month for {count} bays on {plan}, charged to the card unless cancelled before the trial ends.':
    'à payer aujourd’hui. {days} jours gratuits, puis {amount} par mois pour {count} postes sur {plan}, prélevés sur la carte sauf résiliation avant la fin de l’essai.',
  'Add a test card and start the trial': 'Ajouter une carte de test et démarrer l’essai',
  'Go back without adding a card': 'Revenir sans ajouter de carte',
  '{terms} say the same thing as this page.': '{terms} disent la même chose que cette page.',
  'The terms': 'Les conditions',
  'Invoice {number}. No card is charged here: this page stands in for a payment provider while none is connected.':
    'Facture {number}. Aucune carte n’est prélevée ici : cette page remplace un prestataire de paiement tant qu’aucun n’est connecté.',
  'This checkout is finished: {status}.': 'Ce paiement est terminé : {status}.',
  'Back to your invoices': 'Retour à vos factures',
  'Pay {amount}': 'Payer {amount}',
  'Have the card declined': 'Faire refuser la carte',
  'Cancel and go back': 'Annuler et revenir',
  'Your card was declined by the issuer.': 'Votre carte a été refusée par l’émetteur.',
};

export const ar: Readonly<Record<string, string>> = {
  // The root layout, the 404 and the offline page.
  'Workshop management with a portable vehicle history that follows the car, not the owner or the garage.':
    'إدارة ورش مع سجل مركبة ينتقل معها، يتبع السيارة لا المالك ولا الورشة.',
  'Page not found': 'الصفحة غير موجودة',
  'Error 404': 'خطأ 404',
  'The road stops here': 'الطريق ينتهي هنا',
  'There is nothing at this address. The page may have moved, or the link that brought you here may be out of date.':
    'لا يوجد شيء على هذا العنوان. ربما نُقلت الصفحة، أو ربما صار الرابط الذي أوصلك إلى هنا قديماً.',
  'Back to the workshop': 'العودة إلى الورشة',
  'If you followed a link to a vehicle’s history, ask whoever sent it to share the vehicle again. Share links are time-limited by design, so the owner stays in control of who can read the record.':
    'إذا وصلت عبر رابط إلى سجل مركبة، فاطلب ممن أرسله أن يشارك المركبة من جديد. روابط المشاركة محدودة المدة عن قصد، ليبقى المالك متحكماً فيمن يستطيع قراءة السجل.',
  'No signal': 'لا توجد إشارة',
  'This page has not been opened on this device before, so there is nothing saved to show you.':
    'لم تُفتح هذه الصفحة على هذا الجهاز من قبل، لذا لا يوجد شيء محفوظ لعرضه عليك.',
  'Your jobs, your clock and any inspection you have already opened still work. Anything you record is kept on the device and sent the moment there is a signal.':
    'أعمالك وتسجيل وقتك وأي فحص فتحته من قبل ما زالت تعمل. كل ما تسجله يُحفظ على الجهاز ويُرسل فور عودة الإشارة.',
  'Back to my jobs': 'العودة إلى أعمالي',

  // The front page.
  'Carnet — workshop management with a service history that follows the car':
    'Carnet — إدارة ورش مع سجل صيانة يتبع السيارة',
  'Run the diary, jobs, inspections, parts and the books in one system. Every job writes to a service history the vehicle keeps for life, and takes with it when it is sold.':
    'أدِر الأجندة والأعمال والفحوصات وقطع الغيار والحسابات في نظام واحد. كل عمل يُكتب في سجل صيانة تحتفظ به المركبة مدى الحياة، وتأخذه معها عند بيعها.',
  'Three garages, two owners and eleven years later, the folder in the glovebox is a stack of receipts and a guess. The work was real. The evidence is gone.':
    'بعد ثلاث ورش ومالكَين وإحدى عشرة سنة، يصبح الملف في درج السيارة كومة إيصالات وتخميناً. العمل كان حقيقياً. أما الدليل فقد ضاع.',
  'The garage owns the record': 'الورشة تملك السجل',
  'Your history lives in your system. When the customer moves away, or you close, it goes with you. The car keeps nothing.':
    'سجلك يعيش في نظامك. عندما ينتقل العميل بعيداً أو تُغلق ورشتك، يذهب السجل معك. ولا تحتفظ السيارة بشيء.',
  'Nobody can verify a claim': 'لا أحد يستطيع التحقق من الادعاء',
  '“Full service history” means a folder of paper anybody could print. A buyer discounts what they cannot check, and the seller pays for it.':
    '«سجل صيانة كامل» يعني ملفاً من الأوراق يستطيع أي أحد طباعته. المشتري يخصم من السعر ما لا يستطيع التحقق منه، والبائع يدفع الثمن.',
  'The next garage starts blind': 'الورشة التالية تبدأ من الصفر',
  'A car arrives with no record of the cambelt, the fluid, or what the last workshop already advised on. The same checks get done twice and paid for once.':
    'تصل السيارة بلا أي سجل لسير التوقيت أو السوائل أو ما أوصت به الورشة السابقة. فتُجرى الفحوصات نفسها مرتين ويُدفع ثمنها مرة واحدة.',
  'Every completed job writes entries against the car itself: the work, the parts, the mileage, the photographs. Not against your customer record. Against the VIN.':
    'كل عمل مكتمل يكتب قيوداً على السيارة نفسها: العمل والقطع وعدد الكيلومترات والصور. لا على ملف العميل لديك، بل على رقم الهيكل.',
  'It transfers on sale': 'ينتقل عند البيع',
  'Ownership changes hands and the history goes with the car. The new owner sees everything, including what a workshop they have never heard of did in 2019.':
    'تنتقل الملكية ويذهب السجل مع السيارة. يرى المالك الجديد كل شيء، بما في ذلك ما فعلته في 2019 ورشة لم يسمع بها قط.',
  'It cannot be quietly edited': 'لا يمكن تعديله خفية',
  'Entries are appended and hash-linked. Correcting one leaves both versions visible. A history that can be rewritten is worth exactly as much as the folder it replaced.':
    'القيود تُضاف وتُربط ببصمة رقمية. تصحيح أحدها يُبقي النسختين ظاهرتين. والسجل الذي يمكن إعادة كتابته لا يساوي أكثر من الملف الذي حلّ محله.',
  'It is worth money at resale': 'له قيمة مالية عند إعادة البيع',
  'A verifiable record is the difference between a buyer taking your word for it and a buyer checking. That difference has a price, and the seller has been paying it.':
    'السجل القابل للتحقق هو الفرق بين مشترٍ يصدّق كلامك ومشترٍ يتحقق بنفسه. ولهذا الفرق ثمن، والبائع هو من كان يدفعه.',
  'It works even where Carnet does not': 'يعمل حتى حيث لا يوجد Carnet',
  'A passport opens as a public link. The next garage needs no account, no login and no relationship with us to read what you wrote.':
    'يُفتح الجواز عبر رابط عام. لا تحتاج الورشة التالية إلى حساب ولا تسجيل دخول ولا أي علاقة بنا لتقرأ ما كتبته.',
  'One data model, so the estimate the customer approved is the job the technician worked, is the invoice they paid, is the entry in the accounts. Nothing is re-keyed.':
    'نموذج بيانات واحد: عرض السعر الذي وافق عليه العميل هو العمل الذي نفّذه الفني، وهو الفاتورة التي دفعها، وهو القيد في الحسابات. لا شيء يُعاد إدخاله.',
  'Diary and jobs': 'الأجندة والأعمال',
  'Bay-level scheduling with real capacity. Fourteen job statuses that refuse the transitions that make no sense, and say why.':
    'جدولة على مستوى المنصة بالسعة الفعلية. أربع عشرة حالة للعمل ترفض الانتقالات غير المنطقية وتوضح السبب.',
  'Inspections with photographs': 'فحوصات مع صور',
  'Structured checks with measurements and pictures. A customer approving brake work can see the pads.':
    'فحوصات منظمة مع قياسات وصور. العميل الذي يوافق على أعمال الفرامل يستطيع رؤية الفحمات.',
  'Estimates the customer decides on': 'عروض أسعار يقرر فيها العميل',
  'Sent as a link, approved line by line. Work exceeding what was approved needs approving again.':
    'تُرسل كرابط ويُوافق عليها بنداً بنداً. والعمل الذي يتجاوز ما تمت الموافقة عليه يحتاج إلى موافقة جديدة.',
  'Parts and purchasing': 'القطع والمشتريات',
  'Weighted average cost, reservations against jobs, reorder suggestions from actual usage, three-way bill matching.':
    'متوسط التكلفة المرجح، وحجوزات على الأعمال، واقتراحات إعادة الطلب بحسب الاستهلاك الفعلي، ومطابقة ثلاثية لفواتير الموردين.',
  'Invoicing and the ledger': 'الفوترة ودفتر الأستاذ',
  'Double-entry posted from the work itself. Trial balance, profit and loss, balance sheet, VAT, aged debtors.':
    'قيد مزدوج يُرحّل من العمل نفسه. ميزان المراجعة، والأرباح والخسائر، والميزانية العمومية، وضريبة القيمة المضافة، وأعمار الذمم المدينة.',
  'People and productivity': 'الموظفون والإنتاجية',
  'Attended, clocked and sold hours side by side, so utilisation and efficiency stop hiding each other.':
    'ساعات الحضور والساعات المسجلة والساعات المباعة جنباً إلى جنب، حتى لا يُخفي معدل الاستغلال والكفاءة أحدهما الآخر.',
  'Every step below writes to the same job. The passport entries at the end are produced by the work, not typed in afterwards.':
    'كل خطوة أدناه تُكتب في العمل نفسه. قيود الجواز في النهاية ينتجها العمل، ولا تُكتب لاحقاً.',
  'Books in': 'الحجز',
  'Customer calls. Booking takes a bay and a technician, and checks the day has room for it.':
    'يتصل العميل. يحجز الموعد منصة وفنياً، ويتحقق من أن اليوم يتسع له.',
  Inspected: 'تم الفحص',
  'Technician works the checklist on a tablet. Two reds and three ambers, with photographs.':
    'يعمل الفني على قائمة الفحص من جهاز لوحي. بندان باللون الأحمر وثلاثة بالكهرماني، مع الصور.',
  Approved: 'تمت الموافقة',
  'Estimate goes out as a link. The customer approves the brakes and declines the tyres.':
    'يُرسل عرض السعر كرابط. يوافق العميل على الفرامل ويرفض الإطارات.',
  'Invoiced and recorded': 'تمت الفوترة والتسجيل',
  'Parts leave stock, time is costed, the invoice posts to the ledger, and the car keeps the history.':
    'تخرج القطع من المخزون، ويُحتسب الوقت، وتُرحّل الفاتورة إلى دفتر الأستاذ، وتحتفظ السيارة بالسجل.',
  'Three plans, and unlimited staff accounts on every one. The vehicle passport is in all of them, because a network nobody can join is not a network.':
    'ثلاث خطط، وحسابات موظفين غير محدودة في كل منها. جواز المركبة موجود فيها جميعاً، لأن الشبكة التي لا يستطيع أحد الانضمام إليها ليست شبكة.',
  Core: 'الأساسية',
  Complete: 'المتكاملة',
  'A single workshop running the everyday work': 'ورشة واحدة تدير عملها اليومي',
  'A workshop that wants the books to be right, not reconciled later':
    'ورشة تريد حسابات صحيحة، لا تسويتها لاحقاً',
  'More than one site, read as one business': 'أكثر من موقع، تُقرأ كنشاط واحد',
  'Not a workshop?': 'لست ورشة؟',
  'Keep your own car’s history instead.': 'احتفظ بسجل سيارتك أنت بدلاً من ذلك.',
  'Free, and the record follows the car when you sell it.':
    'مجاناً، والسجل يتبع السيارة عندما تبيعها.',
  'Front brake pads and discs replaced': 'استبدال فحمات وأقراص الفرامل الأمامية',
  'Pads at 2mm on inspection. Discs lipped. Photographs attached.':
    'الفحمات عند 2 مم أثناء الفحص. الأقراص متآكلة الحواف. الصور مرفقة.',
  'Advisory: rear tyres approaching limit': 'توصية: الإطارات الخلفية تقترب من الحد الأدنى',
  'Declined by owner at the time. Recorded either way.':
    'رفضها المالك في حينه. وسُجّلت في كل الأحوال.',
  '12 March 2024': '12 مارس 2024',

  // The pricing page, the plans, the countries and taxes it names, and the terms.
  'Three plans, priced per bay. Unlimited staff accounts on every one. The vehicle passport is included in all of them.':
    'ثلاث خطط، بسعر لكل مكان عمل. حسابات موظفين غير محدودة في كل منها. وجواز المركبة مشمول فيها جميعاً.',
  Bays: 'أماكن العمل',
  'Staff accounts': 'حسابات الموظفين',
  'Vehicles on the books': 'المركبات المسجلة',
  'Priced per bay, because bays are what a workshop earns from. Staff accounts are unlimited on every plan: charging per user would bill you for giving your own people access.':
    'السعر لكل مكان عمل، لأن أماكن العمل هي مصدر دخل الورشة. حسابات الموظفين غير محدودة في كل الخطط: فالتسعير لكل مستخدم يعني أن تدفع مقابل منح موظفيك حق الوصول.',
  'Billed annually. Saves {percent}% against {monthly} monthly.':
    'فوترة سنوية. توفّر {percent}% مقارنة بـ {monthly} شهرياً.',
  'Start {days}-day trial': 'ابدأ تجربة {days} يوماً',
  'Prices are in {currency}, per bay per month, and exclude {tax}. You are billed in the currency of your country and no other. The trial creates a real workshop with your data in it. A card is added at sign-up and charged only when the trial ends, unless you cancel first.':
    'الأسعار بعملة {currency}، لكل مكان عمل شهرياً، ولا تشمل {tax}. تتم فوترتك بعملة بلدك ولا غيرها. التجربة تنشئ ورشة حقيقية فيها بياناتك. تُضاف بطاقة عند التسجيل ولا يُخصم منها إلا عند انتهاء التجربة، ما لم تلغِ قبل ذلك.',
  'Limits are counted and enforced. When a workshop reaches one, the system says so before it stops rather than after.':
    'الحدود تُحتسب وتُطبّق. عندما تبلغ الورشة أحدها، ينبّه النظام إلى ذلك قبل التوقف لا بعده.',
  'Diary, jobs, inspections and estimates': 'الأجندة والأعمال والفحوصات وعروض الأسعار',
  'Vehicle passport on every car you touch': 'جواز مركبة لكل سيارة تعمل عليها',
  'Invoicing, payments and parts': 'الفوترة والمدفوعات والقطع',
  'Customer portal': 'بوابة العملاء',
  'Everything in Core': 'كل ما في الخطة الأساسية',
  'Double-entry ledger, posted from the work itself':
    'دفتر أستاذ بالقيد المزدوج، يُرحّل من العمل نفسه',
  'Profit and loss, balance sheet, VAT position':
    'الأرباح والخسائر، والميزانية العمومية، وموقف ضريبة القيمة المضافة',
  'Purchase orders and three-way bill matching': 'أوامر الشراء ومطابقة ثلاثية للفواتير',
  'Timesheets, pay history and commission': 'سجلات الدوام وسجل الرواتب والعمولات',
  'Everything in Complete, at every site': 'كل ما في الخطة المتكاملة، في كل موقع',
  'Consolidated reporting that carries its spread': 'تقارير موحدة تُظهر التفاوت بين المواقع',
  'Stock transfers, with what is on the road counted': 'تحويلات المخزون، مع احتساب ما هو في الطريق',
  'Per-site permissions and single sign-on': 'صلاحيات لكل موقع وتسجيل دخول موحد',
  'The vehicle passport': 'جواز المركبة',
  'Digital inspections': 'الفحوصات الرقمية',
  'Estimates and approvals': 'عروض الأسعار والموافقات',
  'The parts catalogue': 'كتالوج القطع',
  'Purchase orders': 'أوامر الشراء',
  'The general ledger': 'دفتر الأستاذ العام',
  'Financial statements': 'القوائم المالية',
  'Timesheets and payroll': 'سجلات الدوام والرواتب',
  'Commission schemes': 'أنظمة العمولات',
  'More than one site': 'أكثر من موقع',
  'Stock transfers between sites': 'تحويل المخزون بين المواقع',
  'The API': 'واجهة API',
  'Single sign-on': 'تسجيل الدخول الموحد',
  'Why is the passport in the cheapest plan?': 'لماذا الجواز موجود في أرخص خطة؟',
  'Because a network nobody can join is not a network. The record is worth more to every workshop the more vehicles carry one, so putting it behind the top tier would strangle the part of the product that compounds.':
    'لأن الشبكة التي لا يستطيع أحد الانضمام إليها ليست شبكة. تزداد قيمة السجل لكل ورشة كلما زاد عدد المركبات التي تحمله، لذا فإن حصره في الخطة الأعلى سيخنق الجزء من المنتج الذي تتراكم قيمته.',
  'What happens at the end of the trial?': 'ماذا يحدث عند انتهاء التجربة؟',
  'You add a card when you open the workshop; nothing is charged for {days} days. On the day the trial ends the card is charged for the first month of the plan you chose, and monthly after that, unless you cancelled before then, which takes two presses from Settings. We remind you by email three days before. Nothing is ever deleted: a cancelled workshop still reads and exports everything.':
    'تضيف بطاقة عند فتح الورشة، ولا يُخصم شيء لمدة {days} يوماً. في يوم انتهاء التجربة يُخصم من البطاقة الشهر الأول من الخطة التي اخترتها، ثم شهرياً بعد ذلك، ما لم تكن قد ألغيت قبلها، وهو ما يتم بضغطتين من الإعدادات. نذكّرك بالبريد الإلكتروني قبل ثلاثة أيام. ولا يُحذف شيء أبداً: الورشة الملغاة تظل قادرة على قراءة كل شيء وتصديره.',
  'Why per bay rather than per user?': 'لماذا لكل مكان عمل وليس لكل مستخدم؟',
  'Because bays are what a workshop earns from, and users are not. Charging per seat bills you for giving your own staff access, which pushes workshops into sharing a login and makes every record say the wrong person did the work.':
    'لأن أماكن العمل هي مصدر دخل الورشة، أما المستخدمون فلا. التسعير لكل مستخدم يجعلك تدفع مقابل منح موظفيك حق الوصول، مما يدفع الورش إلى مشاركة حساب واحد ويجعل كل سجل ينسب العمل إلى الشخص الخطأ.',
  'What counts as a site?': 'ما الذي يُعدّ موقعاً؟',
  'A physical premises with its own bays and its own stock. Two units on the same industrial estate sharing a store is one site. Two towns is two.':
    'مقر فعلي له أماكن عمل ومخزون خاص به. وحدتان في المنطقة الصناعية نفسها تتشاركان مخزناً واحداً تُعدّان موقعاً واحداً. أما مدينتان فهما موقعان.',
  'Do customers using the portal count?': 'هل يُحتسب العملاء الذين يستخدمون البوابة؟',
  'No. Your customers are unlimited on every plan, and so is the number of people who read a passport link.':
    'لا. عدد عملائك غير محدود في كل الخطط، وكذلك عدد من يقرؤون رابط الجواز.',
  'Can we move our existing history in?': 'هل يمكننا نقل سجلنا الحالي؟',
  'Yes, and it is worth doing. Imported history is marked as migrated rather than as verified work you recorded, because a record that cannot distinguish the two is not worth trusting.':
    'نعم، ويستحق ذلك. يُوسم السجل المستورد بأنه منقول لا بأنه عمل موثّق سجلتموه، لأن السجل الذي لا يميّز بين الاثنين لا يستحق الثقة.',
  'What happens if we leave?': 'ماذا يحدث إذا غادرنا؟',
  'Your data exports in full. The passports stay with the vehicles, which is the point of them: they were never yours to take away.':
    'تُصدَّر بياناتك كاملة. أما الجوازات فتبقى مع المركبات، وهذا هو الغرض منها: لم تكن ملكاً لك لتأخذها معك.',
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
  'VAT 20%': 'ضريبة القيمة المضافة 20%',
  'VAT 23%': 'ضريبة القيمة المضافة 23%',
  'VAT 5%': 'ضريبة القيمة المضافة 5%',
  'VAT 15%': 'ضريبة القيمة المضافة 15%',
  'VAT 14%': 'ضريبة القيمة المضافة 14%',
  'GST 5%': 'ضريبة السلع والخدمات 5%',
  'GST 10%': 'ضريبة السلع والخدمات 10%',
  'GST 15%': 'ضريبة السلع والخدمات 15%',
  'GST 18%': 'ضريبة السلع والخدمات 18%',
  'Sales tax 7%': 'ضريبة المبيعات 7%',
  Terms: 'الشروط',
  'The terms a workshop agrees to when it opens on Carnet: the trial, the charge, cancelling, and what happens to the data.':
    'الشروط التي توافق عليها الورشة عند فتحها على Carnet: التجربة، والخصم، والإلغاء، وما يحدث للبيانات.',
  'Version {version}.': 'الإصدار {version}.',
  'Opening a workshop starts a free trial of {days} days. To start it you add a payment card. Nothing is charged during the trial.':
    'فتح ورشة يبدأ تجربة مجانية مدتها {days} يوماً. لبدئها تضيف بطاقة دفع. لا يُخصم أي مبلغ خلال التجربة.',
  'We tell you this here, on the sign-up form, in the welcome email, and again by email {days} days before the trial ends, with the date and the amount.':
    'نخبرك بذلك هنا، وفي نموذج التسجيل، وفي رسالة الترحيب، ومرة أخرى بالبريد الإلكتروني قبل {days} أيام من انتهاء التجربة، مع التاريخ والمبلغ.',
  'The plans and their prices are on the {link}, per bay, per month, and exclude tax. You are billed in the currency of your country, the one your books are kept in, and in no other. Paid monthly, per bay per month, the plans cost:':
    'الخطط وأسعارها موجودة في {link}، لكل مكان عمل، شهرياً، ولا تشمل الضرائب. تتم فوترتك بعملة بلدك، وهي العملة التي تُمسك بها حساباتك، ولا غيرها. عند الدفع شهرياً، لكل مكان عمل في الشهر، تكلفة الخطط كالتالي:',
  'If a charge fails, we tell you by email and the provider tries again over the following days. The workshop keeps working while that happens. If no payment succeeds within {days} days, the workshop becomes read-only until a payment goes through. Nothing is deleted.':
    'إذا فشل الخصم، نخبرك بالبريد الإلكتروني ويعيد مزوّد الدفع المحاولة خلال الأيام التالية. تستمر الورشة في العمل أثناء ذلك. وإذا لم تنجح أي دفعة خلال {days} يوماً، تصبح الورشة للقراءة فقط حتى تتم دفعة. ولا يُحذف شيء.',
  'Everything you enter is yours. A read-only or cancelled workshop can still read all of it and export all of it. We do not delete a workshop’s data when it stops paying; we delete it when you ask us to, subject to the retention the law requires for invoices and tax records.':
    'كل ما تدخله ملك لك. الورشة التي أصبحت للقراءة فقط أو الملغاة تظل قادرة على قراءة كل بياناتها وتصديرها. لا نحذف بيانات الورشة عندما تتوقف عن الدفع؛ بل نحذفها عندما تطلب منا ذلك، مع مراعاة مدة الاحتفاظ التي يفرضها القانون للفواتير والسجلات الضريبية.',
  'The vehicle passport is different by design: an entry a workshop writes to a vehicle’s history belongs to the vehicle’s record and stays readable to the vehicle’s owner after the workshop leaves Carnet. Nothing in it identifies a workshop’s customers to anybody else.':
    'جواز المركبة مختلف عن قصد: القيد الذي تكتبه الورشة في سجل مركبة يصبح جزءاً من سجل المركبة، ويظل مقروءاً لمالكها بعد مغادرة الورشة لCarnet. ولا يوجد فيه ما يكشف هوية عملاء الورشة لأي أحد آخر.',
  'When your customers pay an invoice by card through Carnet, the payment is processed by our payment provider. Card details never reach Carnet or you. The provider’s fees for those payments are shown on your billing page and on the provider’s statement.':
    'عندما يدفع عملاؤك فاتورة بالبطاقة عبر Carnet، يعالج مزوّد الدفع لدينا عملية الدفع. بيانات البطاقة لا تصل أبداً إلى Carnet ولا إليك. رسوم المزوّد على هذه المدفوعات تظهر في صفحة الفوترة لديك وفي كشف حساب المزوّد.',

  // Sign-up, sign-in, passwords, the buyer check and confirming an address.
  'Start a workshop': 'افتح ورشة',
  'Open a Carnet workshop. {days} days free; the card is charged only when the trial ends, and only if you have not cancelled.':
    'افتح ورشة على Carnet. {days} يوماً مجاناً؛ لا يُخصم من البطاقة إلا عند انتهاء التجربة، وفقط إذا لم تكن قد ألغيت.',
  '{days} days free. Your card is charged only when the trial ends, and only if you have not cancelled':
    '{days} يوماً مجاناً. لا يُخصم من بطاقتك إلا عند انتهاء التجربة، وفقط إذا لم تكن قد ألغيت',
  'Set up with bays, job types and VAT already configured':
    'جاهزة بأماكن العمل وأنواع الأعمال وضريبة القيمة المضافة مُعدّة مسبقاً',
  'Every job you put through writes a permanent vehicle history':
    'كل عمل تُنجزه يكتب سجلاً دائماً للمركبة',
  'Already have an account?': 'لديك حساب بالفعل؟',
  '{days} days free on {plan}. You add a card on the next page; it is charged on the day the trial ends unless you cancel before, and nothing is ever deleted.':
    '{days} يوماً مجاناً على خطة {plan}. تضيف بطاقة في الصفحة التالية؛ ويُخصم منها يوم انتهاء التجربة ما لم تلغِ قبل ذلك، ولا يُحذف شيء أبداً.',
  'One thing to check before we continue.': 'أمر واحد يجب التحقق منه قبل المتابعة.',
  '1 thing to fix.': 'أمر واحد يحتاج إلى تصحيح.',
  '{count} things to fix.': '{count} أمور تحتاج إلى تصحيح.',
  'Hillside Motors': 'ورشة التلال',
  'you@yourworkshop.co.uk': 'you@yourworkshop.com',
  'Choose the country the workshop trades in.': 'اختر البلد الذي تعمل فيه الورشة.',
  'Enter the name of the workshop.': 'أدخل اسم الورشة.',
  'That name is too long for an invoice.': 'هذا الاسم أطول من أن يُكتب على فاتورة.',
  'That name is reserved. Try the trading name you put on invoices.':
    'هذا الاسم محجوز. جرّب الاسم التجاري الذي تضعه على فواتيرك.',
  'That name needs at least one letter or number.':
    'يجب أن يحتوي الاسم على حرف أو رقم واحد على الأقل.',
  'Enter your name.': 'أدخل اسمك.',
  'Enter a valid email address.': 'أدخل عنوان بريد إلكتروني صحيحاً.',
  'That is a disposable address. Use one you will still have next month.':
    'هذا عنوان مؤقت. استخدم عنواناً سيبقى لديك الشهر القادم.',
  'This looks like a personal address. Use your workshop address if you have one, so the account is not tied to one person.':
    'يبدو هذا عنواناً شخصياً. استخدم عنوان الورشة إن كان لديك واحد، حتى لا يرتبط الحساب بشخص واحد.',
  'Use at least {count} characters.': 'استخدم {count} أحرف على الأقل.',
  'That password is one of the first ones tried.': 'كلمة المرور هذه من أول ما يُجرَّب.',
  'Do not put the workshop name in the password.': 'لا تضع اسم الورشة في كلمة المرور.',
  'Enter how many sites you run, at least one.':
    'أدخل عدد المواقع التي تديرها، موقعاً واحداً على الأقل.',
  'There is already an account on that address. Sign in instead.':
    'يوجد حساب بالفعل على هذا العنوان. سجّل الدخول بدلاً من ذلك.',
  'Tick the box to say you have read how the trial and the charge work.':
    'ضع علامة في المربع لتؤكد أنك قرأت كيف تعمل التجربة والخصم.',
  'That password has appeared in a data breach once. Choose one nobody has used before; a phrase of four unrelated words is easy to remember and hard to guess.':
    'ظهرت كلمة المرور هذه في تسريب بيانات مرة واحدة. اختر كلمة لم يستخدمها أحد من قبل؛ فعبارة من أربع كلمات غير مترابطة سهلة التذكر وصعبة التخمين.',
  'That password has appeared in  data breaches {count} times. Choose one nobody has used before; a phrase of four unrelated words is easy to remember and hard to guess.':
    'ظهرت كلمة المرور هذه في تسريبات بيانات {count} مرة. اختر كلمة لم يستخدمها أحد من قبل؛ فعبارة من أربع كلمات غير مترابطة سهلة التذكر وصعبة التخمين.',
  'Keep your car history': 'احتفظ بسجل سيارتك',
  'A free Carnet account for drivers. Every service, repair and MOT on your car, in one place, and it stays with the car when you sell it.':
    'حساب Carnet مجاني للسائقين. كل صيانة وإصلاح وفحص فني لسيارتك في مكان واحد، ويبقى مع السيارة عندما تبيعها.',
  'Every service, repair and part, with dates and mileages':
    'كل صيانة وإصلاح وقطعة، مع التواريخ وقراءات العداد',
  'What was recommended and declined, so nothing is a surprise later':
    'ما أُوصي به وما رُفض، حتى لا يفاجئك شيء لاحقاً',
  'A buyer report you can hand over when you sell': 'تقرير للمشتري يمكنك تسليمه عند البيع',
  'Free, and it stays free': 'مجاني، وسيبقى مجانياً',
  'Run a workshop instead?': 'تدير ورشة بدلاً من ذلك؟',
  'Keep your car’s history': 'احتفظ بسجل سيارتك',
  'At least {count} characters': '{count} أحرف على الأقل',
  'Every job you complete writes a verified, tamper-evident entry to the vehicle’s permanent record. When the car is sold, the history goes with it.':
    'كل عمل تُكمله يكتب قيداً موثّقاً يكشف أي تلاعب في السجل الدائم للمركبة. وعندما تُباع السيارة، يذهب السجل معها.',
  'No account yet? {driver} as a driver, or {workshop}.':
    'ليس لديك حساب بعد؟ {driver} كسائق، أو {workshop}.',
  'Enter your email and password': 'أدخل بريدك الإلكتروني وكلمة المرور',
  'Too many attempts. Wait fifteen minutes and try again.':
    'محاولات كثيرة جداً. انتظر خمس عشرة دقيقة ثم حاول مجدداً.',
  'That email and password do not match.': 'البريد الإلكتروني وكلمة المرور غير متطابقين.',
  'If that address has an account, a link is on its way. It lasts an hour, and asking again replaces it.':
    'إذا كان لهذا العنوان حساب، فالرابط في طريقه إليك. يصلح لساعة واحدة، وطلبه مجدداً يستبدله.',
  'Choose a new password': 'اختر كلمة مرور جديدة',
  'At least {count} characters. A short phrase you will remember beats a short word with a number after it.':
    '{count} أحرف على الأقل. العبارة القصيرة التي ستتذكرها أفضل من كلمة قصيرة يليها رقم.',
  'And again': 'مرة أخرى',
  'Set it and sign in': 'عيّنها وسجّل الدخول',
  'Setting a new password signs you out everywhere else. If you are doing this because you think somebody else has your password, that is the part that matters.':
    'تعيين كلمة مرور جديدة يسجّل خروجك من كل مكان آخر. وإن كنت تفعل ذلك لأنك تظن أن شخصاً آخر يعرف كلمة مرورك، فهذا هو الجزء المهم.',
  'Ask for a new link': 'اطلب رابطاً جديداً',
  'Those two do not match.': 'الكلمتان غير متطابقتين.',
  'Check a vehicle': 'تحقق من مركبة',
  'Enter the code on a Carnet vehicle report to read the history it refers to, and see whether it has been altered.':
    'أدخل الرمز الموجود في تقرير مركبة من Carnet لقراءة السجل الذي يشير إليه، ومعرفة ما إذا كان قد عُدّل.',
  'Check a vehicle’s history': 'تحقق من سجل مركبة',
  'If a seller has given you a Carnet code, enter it here. You will see what workshops recorded about the vehicle, and whether any of it has been altered since it was written.':
    'إذا أعطاك البائع رمز Carnet، فأدخله هنا. سترى ما سجلته الورش عن المركبة، وما إذا كان أي منه قد عُدّل منذ كتابته.',
  'Code from the report': 'الرمز من التقرير',
  'Spaces do not matter.': 'المسافات لا تهم.',
  'Enter the code the seller gave you.': 'أدخل الرمز الذي أعطاك إياه البائع.',
  'Check this vehicle': 'تحقق من هذه المركبة',
  'What you will see.': 'ما ستراه.',
  'Services, repairs and inspections recorded by workshops using Carnet, the mileage at each, how many owners the vehicle has had and for how long, and anything outstanding on it.':
    'أعمال الصيانة والإصلاح والفحص التي سجلتها الورش المستخدمة لCarnet، وقراءة العداد في كل منها، وعدد مالكي المركبة ومدة ملكية كل منهم، وأي أمر معلّق عليها.',
  'What you will not see.': 'ما لن تراه.',
  'Nothing about any owner, past or present. Not their name, not where they live, not what they chose to spend.':
    'لا شيء عن أي مالك، سابق أو حالي. لا اسمه، ولا مكان سكنه، ولا ما اختار أن ينفقه.',
  'What it cannot tell you.': 'ما لا يستطيع إخبارك به.',
  'Work done outside Carnet does not appear. An empty record is not proof a car was neglected, and a full one is not a substitute for an inspection before you buy.':
    'الأعمال المنجزة خارج Carnet لا تظهر. السجل الفارغ ليس دليلاً على إهمال السيارة، والسجل الممتلئ لا يغني عن فحصها قبل الشراء.',
  'Confirming your address': 'تأكيد عنوانك',
  'That is confirmed.': 'تم التأكيد.',
  '{address} is now a proven address on your account.': 'أصبح {address} عنواناً مُثبتاً في حسابك.',
  'Two things change. What you send to customers is less likely to be treated as spam, and when a message to one of them bounces we can tell you rather than leaving you to find out from the customer.':
    'يتغير أمران. ما ترسله إلى العملاء أقل عرضة لأن يُعامل كرسائل مزعجة، وعندما يرتد بريد إلى أحدهم نستطيع إخبارك بدلاً من أن تعرف ذلك من العميل.',
  'That link did not work': 'لم يعمل هذا الرابط',
  'That link could not be read.': 'تعذرت قراءة هذا الرابط.',
  'Nothing is wrong with your account and you can still sign in. Ask for another link from the banner on the dashboard.':
    'لا مشكلة في حسابك ويمكنك تسجيل الدخول. اطلب رابطاً آخر من الشريط في لوحة التحكم.',
  'Confirm your email': 'أكّد بريدك الإلكتروني',
  'One more step: confirm your email': 'خطوة أخيرة: أكّد بريدك الإلكتروني',
  'We have sent a link to {email}. Open it and the workshop is yours. Until then, everything the workshop would send goes out in your name from an address nobody has checked, so we wait.':
    'أرسلنا رابطاً إلى {email}. افتحه وتصبح الورشة لك. وحتى ذلك الحين، كل ما سترسله الورشة سيخرج باسمك من عنوان لم يتحقق منه أحد، لذا ننتظر.',
  'Sent again. The newest link is the one that works; earlier ones have been retired.':
    'أُرسل مجدداً. الرابط الأحدث هو الذي يعمل؛ وقد أُلغيت الروابط السابقة.',
  'Nothing in your inbox? Check the spam folder first. Some providers hold a first message from a new sender for a few minutes.':
    'لا شيء في بريدك الوارد؟ تحقق من مجلد الرسائل المزعجة أولاً. بعض مزودي البريد يحتجزون أول رسالة من مرسل جديد بضع دقائق.',
  'Send the link again': 'أرسل الرابط مجدداً',
  'This deployment has no mail transport configured, so the link is written to the server log rather than sent. Whoever runs it can read it there.':
    'لم يُضبط إرسال البريد في هذا التثبيت، لذا يُكتب الرابط في سجل الخادم بدلاً من إرساله. يمكن لمن يديره قراءته هناك.',
  'Typed the wrong address? {signOut} and sign up again with the right one. This account will simply never be confirmed, and nothing has been sent from it.':
    'كتبت عنواناً خاطئاً؟ {signOut} ثم سجّل من جديد بالعنوان الصحيح. هذا الحساب لن يُؤكَّد أبداً، ولم يُرسَل منه شيء.',

  // Invitations, the review request, the shared passport and quote, and the test checkout.
  'Join a workshop': 'انضم إلى ورشة',
  'About Carnet': 'عن Carnet',
  'You have been invited': 'لقد تمت دعوتك',
  '{name} has invited you to join as {role}.': 'دعاك {name} للانضمام بصفة {role}.',
  'You have been invited to join as {role}.': 'لقد دُعيت للانضمام بصفة {role}.',
  'Your account belongs to you. The workshop decides what you can see, not who you are.':
    'حسابك ملك لك. الورشة تقرر ما يمكنك رؤيته، لا من تكون.',
  'Join {workshop}': 'انضم إلى {workshop}',
  'Set up your account': 'أعدّ حسابك',
  'You are joining as {role}, using {email}.': 'أنت تنضم بصفة {role}، باستخدام {email}.',
  'Choose a password': 'اختر كلمة مرور',
  'Already have a Carnet account on this address? Use the same password and this invitation attaches the workshop to it.':
    'لديك حساب Carnet على هذا العنوان بالفعل؟ استخدم كلمة المرور نفسها وستُضاف الورشة إليه عبر هذه الدعوة.',
  'This invitation has been used': 'استُخدمت هذه الدعوة',
  'This invitation was withdrawn': 'سُحبت هذه الدعوة',
  'This invitation has run out': 'انتهت صلاحية هذه الدعوة',
  'We did not issue this link': 'لم نُصدر هذا الرابط',
  'The account already exists. Sign in with the address it was sent to.':
    'الحساب موجود بالفعل. سجّل الدخول بالعنوان الذي أُرسلت إليه.',
  'Whoever sent it has withdrawn it. Ask them for a new one.':
    'من أرسلها قد سحبها. اطلب منه دعوة جديدة.',
  'Invitations last seven days. Ask whoever sent it to send another.':
    'الدعوات صالحة لسبعة أيام. اطلب ممن أرسلها أن يرسل أخرى.',
  'Check the link is complete. If it was copied out of an email, part of it may have been left behind.':
    'تأكد من أن الرابط كامل. إذا نُسخ من بريد إلكتروني، فربما سقط جزء منه.',
  'That did not work.': 'لم ينجح ذلك.',
  'That invitation link is not one we issued.': 'رابط الدعوة هذا ليس من إصدارنا.',
  'Choose a password of at least 10 characters.': 'اختر كلمة مرور من 10 أحرف على الأقل.',
  owner: 'مالك',
  manager: 'مدير',
  'service advisor': 'مستشار خدمة',
  technician: 'فني',
  bookkeeper: 'محاسب',
  customer: 'عميل',
  'How did we do?': 'كيف كان أداؤنا؟',
  'Thank you.': 'شكراً لك.',
  'If you have a moment, saying so publicly helps other people find a workshop they can trust.':
    'إن كان لديك دقيقة، فإن قول ذلك علناً يساعد الآخرين على إيجاد ورشة يثقون بها.',
  'Your workshop will send you the link to do that. There is nothing else to do here.':
    'سترسل لك ورشتك الرابط لفعل ذلك. لا شيء آخر عليك فعله هنا.',
  'If there was something that would have made it a five, ring us and say so. It is the most useful thing anybody tells us.':
    'إن كان هناك ما كان سيجعلها خمسة، فاتصل بنا وأخبرنا. إنه أنفع ما يخبرنا به أحد.',
  'Somebody here will read this today and get in touch. We would rather put it right than leave it.':
    'سيقرأ أحدنا هذا اليوم ويتواصل معك. نفضّل أن نصلح الأمر على أن نتركه.',
  'How did we do with your {vehicle}?': 'كيف كان أداؤنا مع سيارتك {vehicle}؟',
  'How did we do with your vehicle?': 'كيف كان أداؤنا مع مركبتك؟',
  'Tap a rating': 'اختر تقييماً',
  '{rating} out of 5': '{rating} من 5',
  Badly: 'سيئ',
  'Very well': 'ممتاز',
  'Anything you want to say': 'أي شيء تود قوله',
  Send: 'إرسال',
  'This goes to the workshop that did the work. It is not published anywhere, and nothing about you is passed to anybody else.':
    'يصل هذا إلى الورشة التي أنجزت العمل. لا يُنشر في أي مكان، ولا يُمرَّر أي شيء عنك إلى أي أحد آخر.',
  'Link expired': 'انتهت صلاحية الرابط',
  'This link has run out of road': 'هذا الرابط وصل إلى نهاية الطريق',
  'The vehicle history it pointed to is still there. The link itself has expired, or the owner has withdrawn it.':
    'سجل المركبة الذي كان يشير إليه ما زال موجوداً. الرابط نفسه انتهت صلاحيته، أو سحبه المالك.',
  'Why links expire': 'لماذا تنتهي صلاحية الروابط',
  'A vehicle’s history belongs to the vehicle, and its owner decides who may read it. Every share link is time-limited and can be revoked at any moment, so a record shared once for a sale does not stay open to the internet forever.':
    'سجل المركبة ملك للمركبة، ومالكها يقرر من يستطيع قراءته. كل رابط مشاركة محدود المدة ويمكن إلغاؤه في أي لحظة، حتى لا يبقى سجل شورك مرة من أجل بيع مفتوحاً على الإنترنت إلى الأبد.',
  'What to do': 'ما العمل',
  'Ask whoever sent it to share the vehicle again. It takes them a few seconds and produces a fresh link.':
    'اطلب ممن أرسله أن يشارك المركبة من جديد. يستغرق ذلك بضع ثوانٍ ويُنشئ رابطاً جديداً.',
  'Carnet keeps a permanent, append-only record of what has happened to a vehicle: services, repairs, parts, mileage and inspections, each attributed to the workshop that recorded it. The history follows the car, not the owner.':
    'يحتفظ Carnet بسجل دائم لا يقبل إلا الإضافة لما جرى للمركبة: الصيانة والإصلاحات والقطع وقراءات العداد والفحوصات، كلٌّ منسوب إلى الورشة التي سجّلته. السجل يتبع السيارة لا المالك.',
  'Vehicle passport': 'جواز المركبة',
  Back: 'رجوع',
  'Shared by the vehicle’s owner. This link expires on {date}, and the owner can revoke it at any time. Your visit has been recorded and is visible to them.':
    'شاركه مالك المركبة. تنتهي صلاحية هذا الرابط في {date}، ويمكن للمالك إلغاؤه في أي وقت. زيارتك مسجّلة ويستطيع رؤيتها.',
  'No personal details of any owner are shown. Carnet does not verify claims made outside this record.':
    'لا تُعرض أي بيانات شخصية لأي مالك. ولا يتحقق Carnet من الادعاءات الواردة خارج هذا السجل.',
  'Your quote': 'عرض السعر الخاص بك',
  'This link is no longer live': 'هذا الرابط لم يعد فعّالاً',
  'Quote links expire, and a workshop can withdraw one at any time. Ask them to send it again and it will work straight away.':
    'روابط عروض الأسعار تنتهي صلاحيتها، ويمكن للورشة سحبها في أي وقت. اطلب منهم إرساله مجدداً وسيعمل فوراً.',
  'Thank you. Your workshop has your answer and will get on with it.':
    'شكراً لك. وصل ردّك إلى ورشتك وستباشر العمل.',
  'Test billing': 'فوترة تجريبية',
  'Test billing portal': 'بوابة فوترة تجريبية',
  'Test checkout': 'دفع تجريبي',
  'Carnet, for {workshop}': 'Carnet، لـ {workshop}',
  'This page stands in for the provider’s billing portal while none is connected.':
    'تحل هذه الصفحة محل بوابة الفوترة لدى مزوّد الدفع ما دام لم يُربط أي مزوّد.',
  '{brand} ending {last4}': '{brand} تنتهي بـ {last4}',
  none: 'لا يوجد',
  Plan: 'الخطة',
  '{plan}, 1 bay, {amount} a month': '{plan}، مكان عمل واحد، {amount} شهرياً',
  '{plan}, {count} bays, {amount} a month': '{plan}، {count} أماكن عمل، {amount} شهرياً',
  trialing: 'في فترة التجربة',
  active: 'نشط',
  'past due': 'متأخر السداد',
  cancelled: 'ملغى',
  incomplete: 'غير مكتمل',
  paid: 'مدفوعة',
  open: 'مفتوحة',
  failed: 'فشل',
  void: 'ملغاة',
  draft: 'مسودة',
  pending: 'قيد الانتظار',
  succeeded: 'نجح',
  'None yet.': 'لا شيء بعد.',
  'Simulate the next charge succeeding ({amount})': 'محاكاة نجاح الخصم التالي ({amount})',
  'Simulate the next charge failing': 'محاكاة فشل الخصم التالي',
  'Back to Carnet': 'العودة إلى Carnet',
  'No card is charged here: this page stands in for a payment provider while none is connected.':
    'لا يُخصم من أي بطاقة هنا: هذه الصفحة تحل محل مزوّد الدفع ما دام لم يُربط أي مزوّد.',
  'due today. {days} days free, then {amount} a month for 1 bay on {plan}, charged to the card unless cancelled before the trial ends.':
    'مستحق اليوم. {days} يوماً مجاناً، ثم {amount} شهرياً لمكان عمل واحد على خطة {plan}، تُخصم من البطاقة ما لم تُلغَ قبل انتهاء التجربة.',
  'due today. {days} days free, then {amount} a month for {count} bays on {plan}, charged to the card unless cancelled before the trial ends.':
    'مستحق اليوم. {days} يوماً مجاناً، ثم {amount} شهرياً لـ {count} أماكن عمل على خطة {plan}، تُخصم من البطاقة ما لم تُلغَ قبل انتهاء التجربة.',
  'Add a test card and start the trial': 'أضف بطاقة تجريبية وابدأ التجربة',
  'Go back without adding a card': 'العودة دون إضافة بطاقة',
  '{terms} say the same thing as this page.': '{terms} تقول الشيء نفسه الذي تقوله هذه الصفحة.',
  'The terms': 'الشروط',
  'Invoice {number}. No card is charged here: this page stands in for a payment provider while none is connected.':
    'الفاتورة {number}. لا يُخصم من أي بطاقة هنا: هذه الصفحة تحل محل مزوّد الدفع ما دام لم يُربط أي مزوّد.',
  'This checkout is finished: {status}.': 'انتهت عملية الدفع هذه: {status}.',
  'Back to your invoices': 'العودة إلى فواتيرك',
  'Pay {amount}': 'ادفع {amount}',
  'Have the card declined': 'اجعل البطاقة تُرفض',
  'Cancel and go back': 'إلغاء والعودة',
  'Your card was declined by the issuer.': 'رفضت الجهة المُصدرة بطاقتك.',
};
