/**
 * The first day: the setup list, the demonstration workshop and the help
 * pages. Phase 45.
 */

export const fr: Readonly<Record<string, string>> = {
  'That demonstration workshop is not one of yours.':
    'Cet atelier de démonstration n’est pas l’un des vôtres.',
  'You are not a member of that workshop.': 'Vous n’êtes pas membre de cet atelier.',

  // Help articles and the setup list, from core.
  'What this product is for': 'À quoi sert ce produit',
  'The history belongs to the car, and that is the whole idea.':
    'L’historique appartient au véhicule, et c’est toute l’idée.',
  'Everything a workshop records about a vehicle is kept against the vehicle rather than against the customer, in a record that cannot be edited afterwards. When the car is sold, the history goes with it and the previous owner’s details do not.':
    'Tout ce qu’un atelier enregistre sur un véhicule est conservé au nom du véhicule plutôt qu’au nom du client, dans un dossier qui ne peut plus être modifié ensuite. Quand la voiture est vendue, l’historique la suit, mais pas les coordonnées de l’ancien propriétaire.',
  'That is why jobs, inspections, parts and mileage readings all end up in one place, and why nothing here lets somebody quietly change what was recorded last year. The rest of the product is the work a workshop does on the way to those entries.':
    'C’est pourquoi les interventions, les inspections, les pièces et les relevés de kilométrage se retrouvent tous au même endroit, et pourquoi rien ici ne permet de modifier discrètement ce qui a été enregistré l’an dernier. Le reste du produit, c’est le travail que fait un atelier pour arriver à ces enregistrements.',

  'A job from booking to invoice': 'Une intervention, de la prise de rendez-vous à la facture',
  'The path every car takes, and what each step is for.':
    'Le parcours que suit chaque voiture, et à quoi sert chaque étape.',
  'A job is booked, the car is received with its mileage and condition, it is inspected, what needs doing is quoted, the customer approves, the work is done and checked, and the job is invoiced. Each step is a status on the job, and the product only offers the moves that make sense from where it is.':
    'Une intervention est réservée, la voiture est réceptionnée avec son kilométrage et son état, elle est inspectée, ce qu’il faut faire est chiffré dans un devis, le client donne son accord, le travail est effectué puis vérifié, et l’intervention est facturée. Chaque étape correspond à un statut de l’intervention, et le produit ne propose que les actions qui ont du sens à ce stade.',
  'The shop floor screen is the same job seen by whoever is holding a spanner: clock on, tick the checklist, ask for a part, hand it back. Nothing has to be typed twice, because the hours and parts recorded there are the ones the invoice is built from.':
    'L’écran de l’atelier montre la même intervention vue par celui qui tient la clé à molette : pointer, cocher la liste de contrôle, demander une pièce, la rendre. Rien n’a besoin d’être saisi deux fois, car les heures et les pièces enregistrées là sont celles sur lesquelles se construit la facture.',

  'Quotes, approval and extra work': 'Devis, accord et travaux supplémentaires',
  'What to send, what the customer taps, and what happens when the car turns out to need more.':
    'Ce qu’il faut envoyer, ce sur quoi le client appuie, et ce qui se passe quand la voiture s’avère nécessiter davantage.',
  'A quote is sent as a link the customer opens on a phone. They approve or decline each line, and what they tapped is recorded with the time, so "I never agreed to that" has an answer.':
    'Un devis est envoyé sous forme de lien que le client ouvre sur son téléphone. Il approuve ou refuse chaque ligne, et ce sur quoi il a appuyé est enregistré avec l’heure, de sorte que « je n’ai jamais accepté ça » trouve une réponse.',
  'Work found after approval goes on a supplementary quote rather than quietly onto the bill. Once approved work exceeds the estimate by more than the workshop’s threshold, the product asks for approval again before the job can be invoiced.':
    'Un travail découvert après l’accord est ajouté à un devis complémentaire plutôt que discrètement à la note. Dès que le travail approuvé dépasse l’estimation de plus que le seuil fixé par l’atelier, le produit redemande un accord avant que l’intervention puisse être facturée.',

  'Inspections and what the customer sees': 'Les inspections et ce que voit le client',
  'Red, amber and green, with photographs, in the customer’s own language.':
    'Rouge, orange et vert, avec des photographies, dans la langue du client.',
  'An inspection is a list of items checked on the ramp, each marked green, amber or red, with a measurement where one applies and a photograph where it helps. Red and amber items become quote lines with one press.':
    'Une inspection est une liste de points contrôlés sur le pont, chacun marqué vert, orange ou rouge, avec une mesure quand elle s’applique et une photographie quand elle aide. Les points rouges et oranges deviennent des lignes de devis d’une seule pression.',
  'The customer sees the report as a page they can read without an account, and it prints and downloads as a PDF. What it says is what the technician recorded, not a sales script written afterwards.':
    'Le client voit le rapport sous forme de page qu’il peut consulter sans compte, et elle s’imprime et se télécharge en PDF. Ce qui y est écrit est ce que le technicien a constaté, pas un argumentaire commercial rédigé après coup.',

  'Parts, stock and what they cost': 'Pièces, stock et leur coût',
  'Why a part goes on a job from the shelf rather than being typed.':
    'Pourquoi une pièce est ajoutée à une intervention depuis le rayon plutôt que saisie.',
  'A part fitted from stock leaves the shelf, carries the cost it was bought at, and shows up in the job’s profit. A part typed as a line has no cost, so the job looks more profitable than it was.':
    'Une pièce montée depuis le stock quitte le rayon, porte le coût auquel elle a été achetée, et apparaît dans la marge de l’intervention. Une pièce saisie comme simple ligne n’a pas de coût, si bien que l’intervention paraît plus rentable qu’elle ne l’est.',
  'Stock is counted per site, purchase orders book goods in at what was actually charged, and parts that fit particular vehicles warn when they are put on the wrong car. A stocktake corrects the shelf and records who counted it.':
    'Le stock est compté par site, les bons de commande enregistrent les marchandises reçues au prix réellement facturé, et les pièces spécifiques à certains véhicules avertissent quand elles sont montées sur la mauvaise voiture. Un inventaire corrige le rayon et enregistre qui l’a compté.',

  'Invoices, payments and the till': 'Factures, paiements et la caisse',
  'Numbered without gaps, never edited, and always agreeing with the ledger.':
    'Numérotées sans trou, jamais modifiées, et toujours en accord avec le grand livre.',
  'An invoice is numbered in sequence when it is issued and cannot be changed afterwards. A mistake is corrected with a credit note, which is what an accountant expects and what a tax authority requires.':
    'Une facture est numérotée dans l’ordre au moment de son émission et ne peut plus être modifiée ensuite. Une erreur est corrigée par un avoir, ce qu’attend un comptable et ce qu’exige une administration fiscale.',
  'Payments are recorded against the invoice as they arrive, by card, cash, bank or account. The counter has its own till session that is counted and closed at the end of the day, and every one of these movements posts to the ledger without anybody typing a journal.':
    'Les paiements sont enregistrés sur la facture au fur et à mesure qu’ils arrivent, par carte, en espèces, par virement ou sur compte. Le comptoir a sa propre session de caisse, qui est comptée et clôturée en fin de journée, et chacun de ces mouvements est reporté au grand livre sans que personne ait à saisir une écriture.',

  'What the customer sees': 'Ce que voit le client',
  'Their cars, their invoices, their approvals, and nothing of anybody else’s.':
    'Ses voitures, ses factures, ses accords, et rien de ce qui appartient à quelqu’un d’autre.',
  'A customer with a login sees the vehicles they own, what is happening to them now, their invoices and their history, in whichever of the three languages they choose. They can share a vehicle’s history with a buyer through a link that expires.':
    'Un client disposant d’un accès voit les véhicules qu’il possède, ce qui leur arrive en ce moment, ses factures et son historique, dans celle des trois langues qu’il choisit. Il peut partager l’historique d’un véhicule avec un acheteur grâce à un lien qui expire.',
  'They never see the workshop’s costs, margins or other customers. What a workshop records privately about a job stays with the workshop; what belongs to the car belongs to the car.':
    'Il ne voit jamais les coûts, les marges ni les autres clients de l’atelier. Ce qu’un atelier enregistre en privé sur une intervention reste à l’atelier ; ce qui appartient à la voiture appartient à la voiture.',

  'Getting people back': 'Faire revenir les clients',
  'Service reminders, MOT dates and the work a customer turned down.':
    'Les rappels d’entretien, les dates de contrôle technique et les travaux qu’un client a refusés.',
  'A service due date is set from the work done and the mileage since, and the reminder goes out by itself when it falls due, by email or text, in the customer’s language.':
    'Une date d’entretien à venir est fixée à partir du travail effectué et du kilométrage parcouru depuis, et le rappel part de lui-même à l’échéance, par courriel ou par texto, dans la langue du client.',
  'Work a customer declined is kept as well, and comes back as a reason to ring them rather than as a lost cause. Both are the cheapest work a workshop can win, because it is already on the books.':
    'Un travail refusé par un client est également conservé, et revient comme une raison de l’appeler plutôt que comme une cause perdue. Dans les deux cas, c’est le travail le moins coûteux qu’un atelier puisse gagner, car il est déjà dans les registres.',

  'Tax, prices and more than one site': 'Taxes, prix et plusieurs sites',
  'What is charged, where, and how a group keeps two branches apart.':
    'Ce qui est facturé, où, et comment un groupe distingue deux succursales.',
  'A tax rate can carry more than one tax, prices can be entered with tax in or before it, and a customer with a certificate can be exempt. Every document records what each tax came to when it was issued, so a return filed last quarter still reads the same next year.':
    'Un taux de taxe peut regrouper plusieurs taxes, les prix peuvent être saisis taxe comprise ou hors taxe, et un client muni d’une attestation peut en être exonéré. Chaque document enregistre le montant de chaque taxe au moment de son émission, de sorte qu’une déclaration déposée le trimestre dernier se lise encore de la même façon l’année suivante.',
  'An hourly rate and a part price can belong to a site as well as to the workshop. A line takes the site’s figure where it has one and the workshop’s where it does not, and the screen says which it used.':
    'Un taux horaire et un prix de pièce peuvent appartenir à un site aussi bien qu’à l’atelier. Une ligne reprend le chiffre du site quand il en a un et celui de l’atelier sinon, et l’écran indique lequel a été utilisé.',

  'When a car is sold': 'Quand une voiture est vendue',
  'Handing the history to the buyer without handing over the seller.':
    'Transmettre l’historique à l’acheteur sans transmettre le vendeur.',
  'The seller starts a handover and the buyer accepts it from a link. Nothing moves until they do; when they accept, the car and its history land on their account and leave the seller’s.':
    'Le vendeur lance une cession et l’acheteur l’accepte depuis un lien. Rien ne bouge tant qu’il ne l’a pas fait ; une fois qu’il accepte, la voiture et son historique arrivent sur son compte et quittent celui du vendeur.',
  'The buyer is shown the vehicle, how many owners it has had and how much history it carries, and is never shown who the seller was. That separation is what makes the record both permanent and private.':
    'L’acheteur voit le véhicule, le nombre de propriétaires qu’il a eus et l’ampleur de l’historique qu’il porte, mais ne voit jamais qui était le vendeur. Cette séparation est ce qui rend le dossier à la fois permanent et privé.',

  'Who can see what': 'Qui peut voir quoi',
  'Roles, and why a technician does not see the money.':
    'Les rôles, et pourquoi un technicien ne voit pas l’argent.',
  'Everybody has a role, and a role holds permissions. A technician sees the jobs they are on and what the work is, not the margins, the customer list or the payroll. An owner sees everything.':
    'Chacun a un rôle, et un rôle porte des permissions. Un technicien voit les interventions sur lesquelles il travaille et en quoi consiste le travail, mais pas les marges, la liste des clients ni la paie. Un propriétaire voit tout.',
  'Every change of substance is written to the audit trail with who did it and what it was before, and that trail cannot be edited by anybody, including an owner.':
    'Chaque modification importante est inscrite dans le journal d’audit, avec qui l’a faite et ce qu’il y avait avant, et ce journal ne peut être modifié par personne, pas même par un propriétaire.',

  'Your data, and getting it out': 'Vos données, et comment les récupérer',
  'Exports, erasure requests and what the product will not do.':
    'Les exports, les demandes d’effacement et ce que le produit ne fera pas.',
  'Every report exports as a CSV, and the whole workshop exports as a file you keep. Nothing here is designed to make leaving difficult, because a product that has to trap people is a product that knows it is not worth staying for.':
    'Chaque rapport s’exporte en CSV, et l’atelier entier s’exporte sous forme d’un fichier que vous conservez. Rien ici n’est conçu pour rendre le départ difficile, car un produit qui doit piéger les gens est un produit qui sait qu’il ne mérite pas qu’on y reste.',
  'A customer can ask to be erased, and the product erases what is theirs while keeping what belongs to the vehicle and what the law says an invoice must keep. The audit trail records that the erasure happened, without recording what was erased.':
    'Un client peut demander à être effacé, et le produit efface ce qui lui appartient tout en conservant ce qui appartient au véhicule et ce que la loi exige de conserver sur une facture. Le journal d’audit enregistre que l’effacement a eu lieu, sans enregistrer ce qui a été effacé.',

  'Put your details on the paperwork': 'Renseignez vos coordonnées sur les documents',
  'Your legal name, address and tax number appear on every invoice. An invoice without them is one a customer’s accountant sends back.':
    'Votre raison sociale, votre adresse et votre numéro fiscal figurent sur chaque facture. Une facture qui en est dépourvue est une facture que le comptable du client renvoie.',

  'Say what an hour costs': 'Indiquez le coût d’une heure',
  'Quotes and jobs take this rate by themselves. Without it, every line starts at nothing and somebody has to remember the figure.':
    'Les devis et les interventions reprennent ce taux d’eux-mêmes. Sans lui, chaque ligne part de zéro et quelqu’un doit se souvenir du chiffre.',

  'Check the tax rate': 'Vérifiez le taux de taxe',
  'One was created when you signed up, at the usual rate for your country. It is on every invoice, so it is worth ten seconds now.':
    'Un taux a été créé lors de votre inscription, au taux habituel pour votre pays. Il figure sur chaque facture, cela vaut donc dix secondes maintenant.',

  'Invite whoever else works here': 'Invitez les autres personnes qui travaillent ici',
  'Technicians clock on to jobs and see only what they need. Working from one login makes the hours, the commission and the audit trail meaningless.':
    'Les techniciens pointent sur les interventions et ne voient que ce dont ils ont besoin. Travailler avec un seul identifiant rend les heures, la commission et le journal d’audit dénués de sens.',

  'Put a few parts on the shelf': 'Mettez quelques pièces en rayon',
  'Parts on jobs come from here, with their cost, so the profit on a job is real. Start with the dozen you fit every week.':
    'Les pièces des interventions viennent d’ici, avec leur coût, si bien que la marge d’une intervention est réelle. Commencez par la douzaine que vous montez chaque semaine.',

  'Add a customer and their vehicle': 'Ajoutez un client et son véhicule',
  'A vehicle is the whole point: its history stays with it, whoever owns it next.':
    'Un véhicule, c’est tout l’enjeu : son historique reste avec lui, quel que soit son prochain propriétaire.',

  'Put a job through': 'Traitez une intervention de bout en bout',
  'One job, start to finish, is the only way to know the product fits how you work. Book it, inspect it, quote it, do it.':
    'Une intervention, du début à la fin, est le seul moyen de savoir si le produit correspond à votre façon de travailler. Réservez-la, inspectez-la, chiffrez-la, réalisez-la.',

  'Issue your first invoice': 'Émettez votre première facture',
  'Invoices are numbered without gaps and cannot be edited once issued, which is what makes them worth having.':
    'Les factures sont numérotées sans trou et ne peuvent plus être modifiées une fois émises, ce qui est précisément ce qui leur donne de la valeur.',

  'Let the reminders run': 'Laissez les rappels fonctionner',
  'A service due in six months is work you have already won. The product writes to them so nobody has to remember.':
    'Un entretien prévu dans six mois est un travail déjà gagné. Le produit leur écrit pour que personne n’ait à s’en souvenir.',

  'Everything on the setup list is done.':
    'Tout ce qui figurait sur la liste de configuration est terminé.',
  '{left} things left on the setup list, none of them urgent.':
    '{left} choses restent à faire sur la liste de configuration, sans urgence.',
  '{left} things left to set up, and one of them is needed before you invoice anybody.':
    '{left} choses restent à configurer, et l’une d’elles est nécessaire avant de pouvoir facturer qui que ce soit.',

  // The setup list
  'Getting started': 'Pour commencer',
  'What to do next': 'Que faire ensuite',
  'Read from your own workshop, so nothing here is ticked off until it is true':
    'Lu depuis votre propre atelier : rien n’est coché ici tant que ce n’est pas fait',
  'The setup list': 'La liste de mise en route',
  '{done} of {total} done': '{done} sur {total} faits',
  '{percent}%': '{percent} %',
  'needed first': 'indispensable',
  'Do it': 'Le faire',
  'Show this on the dashboard': 'Afficher sur le tableau de bord',
  'Put the list away': 'Masquer la liste',

  // The demonstration workshop
  'A workshop to look around': 'Un atelier à visiter',
  'A second workshop, full of made-up work: a year of jobs, invoices, parts and vehicle histories. Nothing in it is yours, and it can be removed whole.':
    'Un second atelier, rempli de travail fictif : une année de travaux, de factures, de pièces et d’historiques de véhicules. Rien n’y est à vous, et il peut être supprimé en entier.',
  'You are in the demonstration now.': 'Vous êtes actuellement dans la démonstration.',
  'Back to {name}': 'Retour à {name}',
  'It is built and waiting.': 'Il est créé et vous attend.',
  'Look around it': 'Le visiter',
  'Remove it': 'Le supprimer',
  'It takes about half a minute to build, because the work is put through the product the way real work is.':
    'Sa création prend environ une demi-minute, car le travail passe par le produit comme du vrai travail.',
  'Build it and take me there': 'Le créer et m’y emmener',
  'Its customers are invented and nothing it writes is ever sent to anybody.':
    'Ses clients sont inventés et rien de ce qu’il rédige n’est jamais envoyé à qui que ce soit.',
  demonstration: 'démonstration',
  'you are here': 'vous êtes ici',
  'Move here': 'Venir ici',
  'Your workshops': 'Vos ateliers',
  'The demonstration workshop and everything in it has been removed.':
    'L’atelier de démonstration et tout ce qu’il contenait ont été supprimés.',
  'Demonstration workshop: none of this is real work.':
    'Atelier de démonstration : rien de tout ceci n’est du vrai travail.',
  'Go back to your own': 'Revenir au vôtre',

  // Help
  Help: 'Aide',
  'How this works': 'Comment cela fonctionne',
  'Twelve short pages. Each one links to the screen it is about.':
    'Douze pages courtes. Chacune renvoie à l’écran dont elle parle.',
  'What are you looking for': 'Que cherchez-vous',
  'invoice, stock, who can see what': 'facture, stock, qui voit quoi',
  'Nothing here matches': 'Rien ne correspond ici',
  'Try a word from the screen you are on. The search box at the top finds records as well as help.':
    'Essayez un mot de l’écran où vous êtes. Le champ de recherche en haut trouve aussi bien les fiches que l’aide.',
  'Read it': 'La lire',
  'Go to the screen': 'Aller à l’écran',
  'Also worth reading': 'À lire également',
  'Where the help is': 'Où trouver l’aide',
  'Twelve short pages, one for each part of the product, searchable from the box at the top of every screen along with everything else.':
    'Douze pages courtes, une par partie du produit, cherchables depuis le champ en haut de chaque écran comme tout le reste.',
  'Read the help': 'Lire l’aide',
};

export const ar: Readonly<Record<string, string>> = {
  'That demonstration workshop is not one of yours.': 'ورشة العرض هذه ليست من ورشك.',
  'You are not a member of that workshop.': 'أنت لست عضوًا في تلك الورشة.',

  // Help articles and the setup list, from core.
  'What this product is for': 'الغرض من هذا المنتج',
  'The history belongs to the car, and that is the whole idea.':
    'السجل ملك للسيارة، وهذه هي الفكرة كلها.',
  'Everything a workshop records about a vehicle is kept against the vehicle rather than against the customer, in a record that cannot be edited afterwards. When the car is sold, the history goes with it and the previous owner’s details do not.':
    'كل ما تسجله الورشة عن سيارة يُحفظ باسم السيارة لا باسم العميل، في سجل لا يمكن تعديله لاحقًا. عند بيع السيارة، ينتقل السجل معها، ولا تنتقل بيانات المالك السابق.',
  'That is why jobs, inspections, parts and mileage readings all end up in one place, and why nothing here lets somebody quietly change what was recorded last year. The rest of the product is the work a workshop does on the way to those entries.':
    'لهذا تجتمع أوامر الشغل والفحوصات وقطع الغيار وقراءات العداد كلها في مكان واحد، ولا يسمح شيء هنا لأحد بتغيير ما سُجل العام الماضي بهدوء. باقي المنتج هو العمل الذي تقوم به الورشة في طريقها إلى هذه القيود.',

  'A job from booking to invoice': 'رحلة أمر الشغل من الحجز إلى الفاتورة',
  'The path every car takes, and what each step is for.':
    'المسار الذي تمر به كل سيارة، والغرض من كل خطوة.',
  'A job is booked, the car is received with its mileage and condition, it is inspected, what needs doing is quoted, the customer approves, the work is done and checked, and the job is invoiced. Each step is a status on the job, and the product only offers the moves that make sense from where it is.':
    'يُحجز أمر الشغل، وتُستلم السيارة مع تسجيل عدادها وحالتها، ثم تُفحص، ويُعرض سعر لما يلزم عمله، ويوافق العميل، ثم يُنجز العمل ويُراجع، وأخيرًا تصدر الفاتورة. كل خطوة هي حالة لأمر الشغل، والمنتج لا يعرض إلا الخطوات المنطقية التالية من موضعه الحالي.',
  'The shop floor screen is the same job seen by whoever is holding a spanner: clock on, tick the checklist, ask for a part, hand it back. Nothing has to be typed twice, because the hours and parts recorded there are the ones the invoice is built from.':
    'شاشة أرضية الورشة هي نفس أمر الشغل كما يراه من يمسك المفتاح: يبدأ الوقت، يعلّم بنود القائمة، يطلب قطعة غيار، ويعيد التسليم. لا داعي لكتابة أي شيء مرتين، لأن الساعات وقطع الغيار المسجلة هناك هي نفسها التي تُبنى عليها الفاتورة.',

  'Quotes, approval and extra work': 'عروض الأسعار والموافقة والعمل الإضافي',
  'What to send, what the customer taps, and what happens when the car turns out to need more.':
    'ما يُرسل، وما يضغط عليه العميل، وما يحدث حين يتضح أن السيارة تحتاج عملاً إضافيًا.',
  'A quote is sent as a link the customer opens on a phone. They approve or decline each line, and what they tapped is recorded with the time, so "I never agreed to that" has an answer.':
    'يُرسل عرض السعر كرابط يفتحه العميل على هاتفه. فيوافق أو يرفض كل بند على حدة، ويُسجَّل ما ضغط عليه مع الوقت، فتكون هناك إجابة جاهزة على عبارة "أنا لم أوافق على هذا".',
  'Work found after approval goes on a supplementary quote rather than quietly onto the bill. Once approved work exceeds the estimate by more than the workshop’s threshold, the product asks for approval again before the job can be invoiced.':
    'أي عمل يُكتشف بعد الموافقة يُضاف إلى عرض سعر تكميلي بدلاً من إضافته إلى الفاتورة بهدوء. وإذا تجاوز العمل المعتمد التقدير بأكثر من الحد الذي تضعه الورشة، يطلب المنتج موافقة جديدة قبل إصدار الفاتورة.',

  'Inspections and what the customer sees': 'الفحوصات وما يراه العميل',
  'Red, amber and green, with photographs, in the customer’s own language.':
    'أحمر وأصفر وأخضر، مع صور، بلغة العميل نفسه.',
  'An inspection is a list of items checked on the ramp, each marked green, amber or red, with a measurement where one applies and a photograph where it helps. Red and amber items become quote lines with one press.':
    'الفحص قائمة ببنود تُراجَع على الرافعة، ويُعلَّم كل بند بالأخضر أو الأصفر أو الأحمر، مع قياس حيث ينطبق ذلك وصورة حيث تفيد. تتحول البنود الحمراء والصفراء إلى بنود في عرض السعر بضغطة واحدة.',
  'The customer sees the report as a page they can read without an account, and it prints and downloads as a PDF. What it says is what the technician recorded, not a sales script written afterwards.':
    'يرى العميل التقرير كصفحة يمكنه قراءتها دون حساب، ويمكن طباعته وتنزيله بصيغة PDF. وما يقوله التقرير هو ما سجله الفني فعلاً، لا نص بيع كُتب لاحقًا.',

  'Parts, stock and what they cost': 'قطع الغيار والمخزون وتكلفتها',
  'Why a part goes on a job from the shelf rather than being typed.':
    'لماذا تُضاف قطعة الغيار إلى أمر الشغل من الرف بدلاً من كتابتها يدويًا.',
  'A part fitted from stock leaves the shelf, carries the cost it was bought at, and shows up in the job’s profit. A part typed as a line has no cost, so the job looks more profitable than it was.':
    'قطعة الغيار التي تُركَّب من المخزون تخرج من الرف، وتحمل معها التكلفة التي اشتُريت بها، وتظهر في ربح أمر الشغل. أما القطعة التي تُكتب كبند يدوي فلا تكلفة لها، فيبدو أمر الشغل أكثر ربحًا مما هو عليه فعلاً.',
  'Stock is counted per site, purchase orders book goods in at what was actually charged, and parts that fit particular vehicles warn when they are put on the wrong car. A stocktake corrects the shelf and records who counted it.':
    'يُحصى المخزون لكل موقع على حدة، وتُسجَّل أوامر الشراء البضائع الواردة بالسعر الفعلي المدفوع، وتنبّه قطع الغيار المخصصة لسيارات معينة عند تركيبها على سيارة خطأ. وتُصحح الجرود الرف وتُسجل من قام بالعد.',

  'Invoices, payments and the till': 'الفواتير والمدفوعات والخزينة',
  'Numbered without gaps, never edited, and always agreeing with the ledger.':
    'مرقمة دون فجوات، ولا تُعدَّل أبدًا، ومطابقة دائمًا لدفتر الأستاذ.',
  'An invoice is numbered in sequence when it is issued and cannot be changed afterwards. A mistake is corrected with a credit note, which is what an accountant expects and what a tax authority requires.':
    'تُرقَّم الفاتورة تسلسليًا عند إصدارها ولا يمكن تغييرها بعد ذلك. يُصحَّح أي خطأ بإشعار دائن، وهو ما يتوقعه المحاسب وما تشترطه مصلحة الضرائب.',
  'Payments are recorded against the invoice as they arrive, by card, cash, bank or account. The counter has its own till session that is counted and closed at the end of the day, and every one of these movements posts to the ledger without anybody typing a journal.':
    'تُسجَّل المدفوعات مقابل الفاتورة فور ورودها، سواء بالبطاقة أو النقد أو التحويل البنكي أو الحساب الآجل. وللكاونتر جلسة خزينة خاصة تُحصى وتُقفل في نهاية اليوم، وكل حركة من هذه الحركات تُقيَّد في دفتر الأستاذ دون أن يكتب أحد قيدًا يدويًا.',

  'What the customer sees': 'ما يراه العميل',
  'Their cars, their invoices, their approvals, and nothing of anybody else’s.':
    'سياراتهم وفواتيرهم وموافقاتهم، ولا شيء من سيارات أو بيانات غيرهم.',
  'A customer with a login sees the vehicles they own, what is happening to them now, their invoices and their history, in whichever of the three languages they choose. They can share a vehicle’s history with a buyer through a link that expires.':
    'العميل الذي لديه حساب دخول يرى السيارات التي يملكها، وما يجري لها الآن، وفواتيره وسجله، بأي لغة من اللغات الثلاث يختارها. ويمكنه مشاركة سجل السيارة مع مشترٍ عبر رابط ينتهي صلاحيته.',
  'They never see the workshop’s costs, margins or other customers. What a workshop records privately about a job stays with the workshop; what belongs to the car belongs to the car.':
    'لا يرى العميل أبدًا تكاليف الورشة أو هوامش ربحها أو عملاءها الآخرين. وما تسجله الورشة بشكل خاص عن أمر الشغل يبقى لدى الورشة؛ وما يخص السيارة يبقى للسيارة.',

  'Getting people back': 'استعادة العملاء',
  'Service reminders, MOT dates and the work a customer turned down.':
    'تذكيرات الصيانة، ومواعيد الفحص الدوري، والعمل الذي رفضه العميل.',
  'A service due date is set from the work done and the mileage since, and the reminder goes out by itself when it falls due, by email or text, in the customer’s language.':
    'يُحدَّد موعد استحقاق الصيانة القادمة بناءً على العمل المنجَز والمسافة المقطوعة منذ ذلك الحين، ويُرسَل التذكير تلقائيًا عند حلول موعده، عبر البريد الإلكتروني أو الرسائل النصية، بلغة العميل.',
  'Work a customer declined is kept as well, and comes back as a reason to ring them rather than as a lost cause. Both are the cheapest work a workshop can win, because it is already on the books.':
    'يُحفظ أيضًا العمل الذي رفضه العميل، ويعود لاحقًا كسبب للاتصال به بدلاً من أن يكون فرصة ضائعة. وكلاهما أرخص عمل يمكن للورشة كسبه، لأنه مسجل بالفعل في دفاترها.',

  'Tax, prices and more than one site': 'الضريبة والأسعار وأكثر من موقع',
  'What is charged, where, and how a group keeps two branches apart.':
    'ما يُحصَّل، وأين، وكيف تفصل المجموعة بين فرعين.',
  'A tax rate can carry more than one tax, prices can be entered with tax in or before it, and a customer with a certificate can be exempt. Every document records what each tax came to when it was issued, so a return filed last quarter still reads the same next year.':
    'يمكن أن تضم فئة الضريبة أكثر من ضريبة واحدة، ويمكن إدخال الأسعار شاملة الضريبة أو غير شاملة لها، ويمكن إعفاء عميل يملك شهادة إعفاء. ويسجل كل مستند قيمة كل ضريبة عند إصداره، فتظل الإقرارات المقدمة الربع الماضي كما هي في السنة التالية.',
  'An hourly rate and a part price can belong to a site as well as to the workshop. A line takes the site’s figure where it has one and the workshop’s where it does not, and the screen says which it used.':
    'يمكن أن يخص سعر الساعة وسعر قطعة الغيار موقعًا بعينه بدلاً من الورشة ككل. ويأخذ البند رقم الموقع إن وُجد، ورقم الورشة إن لم يوجد، وتوضح الشاشة أيهما استُخدم.',

  'When a car is sold': 'عند بيع السيارة',
  'Handing the history to the buyer without handing over the seller.':
    'تسليم السجل للمشتري دون كشف هوية البائع.',
  'The seller starts a handover and the buyer accepts it from a link. Nothing moves until they do; when they accept, the car and its history land on their account and leave the seller’s.':
    'يبدأ البائع عملية تسليم، ويقبلها المشتري عبر رابط. ولا يتحرك شيء قبل قبوله؛ فور القبول، تنتقل السيارة وسجلها إلى حساب المشتري وتختفي من حساب البائع.',
  'The buyer is shown the vehicle, how many owners it has had and how much history it carries, and is never shown who the seller was. That separation is what makes the record both permanent and private.':
    'يُعرَض على المشتري السيارة، وعدد مالكيها السابقين، وحجم السجل الذي تحمله، ولا يُعرَض عليه أبدًا من كان البائع. هذا الفصل هو ما يجعل السجل دائمًا وخاصًا في آن واحد.',

  'Who can see what': 'من يرى ماذا',
  'Roles, and why a technician does not see the money.':
    'الأدوار، ولماذا لا يرى الفني الأرقام المالية.',
  'Everybody has a role, and a role holds permissions. A technician sees the jobs they are on and what the work is, not the margins, the customer list or the payroll. An owner sees everything.':
    'لكل شخص دور، ولكل دور صلاحيات. يرى الفني أوامر الشغل التي يعمل عليها وطبيعة العمل، لا هوامش الربح ولا قائمة العملاء ولا كشوف المرتبات. أما المالك فيرى كل شيء.',
  'Every change of substance is written to the audit trail with who did it and what it was before, and that trail cannot be edited by anybody, including an owner.':
    'يُسجَّل كل تغيير جوهري في سجل التدقيق مع بيان من قام به وما كانت عليه القيمة قبله، ولا يمكن لأحد تعديل هذا السجل، ولا حتى المالك.',

  'Your data, and getting it out': 'بياناتك، وكيفية استخراجها',
  'Exports, erasure requests and what the product will not do.':
    'التصدير، وطلبات المحو، وما لن يفعله المنتج.',
  'Every report exports as a CSV, and the whole workshop exports as a file you keep. Nothing here is designed to make leaving difficult, because a product that has to trap people is a product that knows it is not worth staying for.':
    'يُصدَّر كل تقرير بصيغة CSV، وتُصدَّر بيانات الورشة كاملة كملف تحتفظ به. لا شيء هنا مصمَّم لتصعيب المغادرة، لأن المنتج الذي يحتاج إلى حبس مستخدميه هو منتج يعرف أنه لا يستحق البقاء من أجله.',
  'A customer can ask to be erased, and the product erases what is theirs while keeping what belongs to the vehicle and what the law says an invoice must keep. The audit trail records that the erasure happened, without recording what was erased.':
    'يمكن للعميل أن يطلب محو بياناته، فيمحو المنتج ما يخصه مع الاحتفاظ بما يخص السيارة وبما يشترط القانون الاحتفاظ به في الفاتورة. ويسجل سجل التدقيق أن عملية المحو تمت، دون تسجيل ما الذي مُحي.',

  'Put your details on the paperwork': 'ضع بياناتك على المستندات',
  'Your legal name, address and tax number appear on every invoice. An invoice without them is one a customer’s accountant sends back.':
    'اسمك القانوني وعنوانك ورقمك الضريبي تظهر في كل فاتورة. الفاتورة التي تخلو منها فاتورة يعيدها محاسب العميل.',
  'Say what an hour costs': 'حدد تكلفة الساعة',
  'Quotes and jobs take this rate by themselves. Without it, every line starts at nothing and somebody has to remember the figure.':
    'تأخذ عروض الأسعار وأوامر الشغل هذا السعر تلقائيًا. وبدونه، يبدأ كل بند من الصفر ويضطر أحدهم لتذكر الرقم في كل مرة.',
  'Check the tax rate': 'راجع فئة الضريبة',
  'One was created when you signed up, at the usual rate for your country. It is on every invoice, so it is worth ten seconds now.':
    'تم إنشاء فئة ضريبية عند تسجيلك، بالمعدل المعتاد في بلدك. وهي تظهر في كل فاتورة، فتستحق عشر ثوانٍ من وقتك الآن.',
  'Invite whoever else works here': 'ادعُ من يعمل معك',
  'Technicians clock on to jobs and see only what they need. Working from one login makes the hours, the commission and the audit trail meaningless.':
    'يسجل الفنيون دخولهم على أوامر الشغل ولا يرون إلا ما يحتاجونه. والعمل من حساب دخول واحد يفرغ الساعات والعمولات وسجل التدقيق من معناها.',
  'Put a few parts on the shelf': 'ضع بعض قطع الغيار على الرف',
  'Parts on jobs come from here, with their cost, so the profit on a job is real. Start with the dozen you fit every week.':
    'قطع الغيار في أوامر الشغل تأتي من هنا، بتكلفتها الفعلية، فيكون ربح أمر الشغل حقيقيًا. ابدأ بالقطع الاثنتي عشرة التي تركّبها كل أسبوع.',
  'Add a customer and their vehicle': 'أضف عميلاً وسيارته',
  'A vehicle is the whole point: its history stays with it, whoever owns it next.':
    'السيارة هي جوهر الفكرة: سجلها يبقى معها، أيًا كان مالكها التالي.',
  'Put a job through': 'نفّذ أمر شغل',
  'One job, start to finish, is the only way to know the product fits how you work. Book it, inspect it, quote it, do it.':
    'أمر شغل واحد، من البداية إلى النهاية، هو الطريقة الوحيدة لمعرفة أن المنتج يناسب طريقة عملك. احجزه، افحصه، سعّره، ونفّذه.',
  'Issue your first invoice': 'أصدر فاتورتك الأولى',
  'Invoices are numbered without gaps and cannot be edited once issued, which is what makes them worth having.':
    'الفواتير مرقمة دون فجوات ولا يمكن تعديلها بعد إصدارها، وهذا ما يجعلها ذات قيمة.',
  'Let the reminders run': 'فعّل التذكيرات',
  'A service due in six months is work you have already won. The product writes to them so nobody has to remember.':
    'الصيانة المستحقة بعد ستة أشهر عمل كسبته بالفعل. يراسلهم المنتج تلقائيًا فلا يحتاج أحد إلى التذكر.',

  'Everything on the setup list is done.': 'تم إنجاز كل ما في قائمة الإعداد.',
  '{left} things left on the setup list, none of them urgent.':
    '{left} أمورًا متبقية في قائمة الإعداد، وليس من بينها ما هو عاجل.',
  '{left} things left to set up, and one of them is needed before you invoice anybody.':
    '{left} أمورًا متبقية للإعداد، أحدها لازم قبل أن تصدر أي فاتورة.',

  // The setup list
  'Getting started': 'البداية',
  'What to do next': 'ما الخطوة التالية',
  'Read from your own workshop, so nothing here is ticked off until it is true':
    'مقروء من ورشتك نفسها، فلا يُعلَّم هنا شيء إلا إذا تحقق فعلًا',
  'The setup list': 'قائمة الإعداد',
  '{done} of {total} done': 'أُنجز {done} من {total}',
  '{percent}%': '{percent}٪',
  'needed first': 'مطلوب أولًا',
  'Do it': 'نفّذه',
  'Show this on the dashboard': 'إظهارها في لوحة المتابعة',
  'Put the list away': 'إخفاء القائمة',

  // The demonstration workshop
  'A workshop to look around': 'ورشة لتتجول فيها',
  'A second workshop, full of made-up work: a year of jobs, invoices, parts and vehicle histories. Nothing in it is yours, and it can be removed whole.':
    'ورشة ثانية مليئة بعمل مُفترض: سنة من الأعمال والفواتير وقطع الغيار وسجلات المركبات. لا شيء فيها يخصك، ويمكن حذفها بالكامل.',
  'You are in the demonstration now.': 'أنت الآن داخل ورشة العرض.',
  'Back to {name}': 'العودة إلى {name}',
  'It is built and waiting.': 'أُنشئت وهي في انتظارك.',
  'Look around it': 'تجول فيها',
  'Remove it': 'احذفها',
  'It takes about half a minute to build, because the work is put through the product the way real work is.':
    'يستغرق إنشاؤها نحو نصف دقيقة، لأن العمل يمر عبر المنتج كما يمر العمل الحقيقي.',
  'Build it and take me there': 'أنشئها وانقلني إليها',
  'Its customers are invented and nothing it writes is ever sent to anybody.':
    'عملاؤها مُتخيَّلون ولا يُرسَل شيء مما تكتبه إلى أحد.',
  demonstration: 'عرض توضيحي',
  'you are here': 'أنت هنا',
  'Move here': 'انتقل إلى هنا',
  'Your workshops': 'ورشك',
  'The demonstration workshop and everything in it has been removed.':
    'حُذفت ورشة العرض وكل ما فيها.',
  'Demonstration workshop: none of this is real work.': 'ورشة عرض توضيحي: لا شيء هنا عمل حقيقي.',
  'Go back to your own': 'ارجع إلى ورشتك',

  // Help
  Help: 'المساعدة',
  'How this works': 'كيف يعمل هذا',
  'Twelve short pages. Each one links to the screen it is about.':
    'اثنتا عشرة صفحة قصيرة. كل واحدة تحيل إلى الشاشة التي تتحدث عنها.',
  'What are you looking for': 'عمَّ تبحث',
  'invoice, stock, who can see what': 'فاتورة، مخزون، من يرى ماذا',
  'Nothing here matches': 'لا شيء هنا يطابق',
  'Try a word from the screen you are on. The search box at the top finds records as well as help.':
    'جرّب كلمة من الشاشة التي أنت فيها. حقل البحث في الأعلى يجد السجلات والمساعدة معًا.',
  'Read it': 'اقرأها',
  'Go to the screen': 'اذهب إلى الشاشة',
  'Also worth reading': 'يستحق القراءة أيضًا',
  'Where the help is': 'أين تجد المساعدة',
  'Twelve short pages, one for each part of the product, searchable from the box at the top of every screen along with everything else.':
    'اثنتا عشرة صفحة قصيرة، واحدة لكل جزء من المنتج، يمكن البحث فيها من الحقل أعلى كل شاشة مع كل شيء آخر.',
  'Read the help': 'اقرأ المساعدة',
};
