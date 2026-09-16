/**
 * Codes a customer hands over. Phase 45.5.
 *
 * The refusals matter more than the labels here. A code turned down at a
 * counter has to say why in the language the person reading it works in,
 * because "code invalide" teaches a customer that the workshop is broken.
 */

export const fr: Readonly<Record<string, string>> = {
  // The page
  Coupons: 'Bons de réduction',
  'Codes a customer hands over, and what each one has cost and brought in':
    'Les codes qu’un client présente, ce que chacun a coûté et ce qu’il a rapporté',
  'Saved. The code works from now on, within whatever it says.':
    'Enregistré. Le code fonctionne dès maintenant, dans les limites qu’il annonce.',
  'Saved. Codes already used keep what they gave away.':
    'Enregistré. Les codes déjà utilisés conservent ce qu’ils ont accordé.',
  'Codes running': 'Codes en cours',
  'Usable today': 'Utilisables aujourd’hui',
  'Given away': 'Accordé',
  'Billed on those visits': 'Facturé lors de ces passages',
  'What the offers brought in': 'Ce que les offres ont rapporté',
  'Times used': 'Utilisations',

  // The list
  'The codes': 'Les codes',
  'A retired code is refused at the counter and keeps its history.':
    'Un code retiré est refusé au comptoir et conserve son historique.',
  'No codes yet': 'Aucun code pour l’instant',
  'A code is worth a percentage or an amount, and can be limited by date, by bill, by how many times it is used and by how many times one customer uses it.':
    'Un code vaut un pourcentage ou un montant, et peut être limité par date, par facture, par nombre total d’utilisations et par nombre d’utilisations par client.',
  running: 'en cours',
  'not started': 'pas encore commencé',
  finished: 'terminé',
  'all used': 'épuisé',
  'used once': 'utilisé une fois',
  'used {count} times': 'utilisé {count} fois',
  'Who used it': 'Qui l’a utilisé',
  of: 'sur',

  // The form
  'A new code': 'Un nouveau code',
  'Everything it promises is set here, and checked at the counter':
    'Tout ce qu’il promet se règle ici, et se vérifie au comptoir',
  'Letters and digits. Spaces and dashes are ignored.':
    'Lettres et chiffres. Les espaces et les tirets sont ignorés.',
  'A percentage off': 'Un pourcentage de remise',
  'An amount off': 'Un montant de remise',
  'Per cent': 'Pourcentage',
  'For a percentage code.': 'Pour un code en pourcentage.',
  'Amount off': 'Montant de remise',
  'For an amount code.': 'Pour un code en montant.',
  'Least bill': 'Facture minimale',
  'Blank for any bill.': 'Vide pour toute facture.',
  Until: 'Jusqu’au',
  'The last day it works.': 'Le dernier jour où il fonctionne.',
  'Uses in total': 'Utilisations au total',
  'Blank for no limit.': 'Vide pour aucune limite.',
  'Uses per customer': 'Utilisations par client',
  'What it is for': 'À quoi il sert',
  'Only the workshop sees this.': 'Seul l’atelier le voit.',
  'Spring postcard': 'Carte postale de printemps',
  'Add the code': 'Ajouter le code',

  // How it works
  'How a code is taken': 'Comment un code est pris',
  'At the counter it comes off before the sale is taken. On an invoice it is settled like loyalty points: the invoice keeps the total it was issued at, and what the code took off is posted to what the offers cost rather than to the bank.':
    'Au comptoir, il est déduit avant que la vente ne soit prise. Sur une facture, il se règle comme des points de fidélité : la facture conserve le total auquel elle a été émise, et ce que le code a déduit est comptabilisé dans le coût des offres plutôt qu’en banque.',
  'A code is refused with the reason: out of date, not started, all used, already used by this customer, or the bill being too small. Whoever is standing at the counter can then decide what to do about it.':
    'Un code est refusé avec son motif : périmé, pas encore commencé, épuisé, déjà utilisé par ce client, ou facture trop faible. La personne au comptoir peut alors décider quoi en faire.',

  // On an invoice and at the counter
  'Use a coupon': 'Utiliser un bon',
  'The code off the postcard or the email. Spaces and dashes do not matter.':
    'Le code figurant sur la carte postale ou l’e-mail. Les espaces et les tirets n’ont pas d’importance.',
  'Take the code off': 'Déduire le code',
  'Code taken off the bill and booked as what the offer cost, not as money in.':
    'Code déduit de la facture et comptabilisé comme le coût de l’offre, et non comme une entrée d’argent.',
  Coupon: 'Bon de réduction',
  'If they have a code. Spaces and dashes do not matter.':
    'S’ils ont un code. Les espaces et les tirets n’ont pas d’importance.',
  'Their code': 'Leur code',

  // Refusals
  'Type the code the customer has.': 'Saisissez le code que le client possède.',
  'A code is at least three letters or digits. Anything shorter is typed by accident.':
    'Un code fait au moins trois lettres ou chiffres. Plus court, c’est une faute de frappe.',
  'A percentage is more than nothing and not more than a hundred. A hundred per cent is free work, which is a decision rather than a discount.':
    'Un pourcentage est supérieur à zéro et ne dépasse pas cent. Cent pour cent, c’est du travail gratuit : une décision, pas une remise.',
  'An amount off is more than nothing and less than a million.':
    'Un montant de remise est supérieur à zéro et inférieur à un million.',
  'A minimum spend cannot be less than nothing.':
    'Un montant minimal ne peut pas être inférieur à zéro.',
  'It ends before it starts. One of the two dates is the wrong way round.':
    'Il se termine avant de commencer. L’une des deux dates est inversée.',
  'A limit is a whole number of uses, or nothing at all for no limit.':
    'Une limite est un nombre entier d’utilisations, ou rien du tout pour aucune limite.',
  'One customer can use a code at least once.':
    'Un client peut utiliser un code au moins une fois.',
  'That code is no longer being honoured.': 'Ce code n’est plus honoré.',
  'This customer has used that code already. It is one to a customer.':
    'Ce client a déjà utilisé ce code. C’est un par client.',
  'Nothing is owed on this bill, so there is nothing to take off.':
    'Rien n’est dû sur cette facture, il n’y a donc rien à déduire.',
  'That code is not in this workshop.': 'Ce code n’existe pas dans cet atelier.',
  'That invoice is not in this workshop.': 'Cette facture n’existe pas dans cet atelier.',
  'Nobody has used this code yet.': 'Personne n’a encore utilisé ce code.',
  'Counter sale': 'Vente au comptoir',
  Retire: 'Retirer',
  Restore: 'Rétablir',
  retired: 'retiré',
  Code: 'Code',

  // The line that says what a code is, assembled from these
  '{percent}% off': '{percent} % de remise',
  '{amount} off': '{amount} de remise',
  'bills over {amount}': 'factures de plus de {amount}',
  '1 use left': 'il reste 1 utilisation',
  '{count} uses left': 'il reste {count} utilisations',
  'not used yet': 'pas encore utilisé',
  'This year so far': 'Cette année à ce jour',
  'Working…': 'En cours…',
  // Finding the way to spend a card
  'Nothing left to pay': 'Plus rien à payer',
  'This bill is settled, so there is nothing here to take a payment, a gift card, points, a coupon or money held against. Raising a credit note is below.':
    'Cette facture est soldée : il n’y a donc rien ici pour encaisser un paiement, une carte cadeau, des points, un bon ou de l’argent conservé. L’avoir se fait plus bas.',
  'Spent against a bill that still has something owing, or at the counter. A bill with nothing left to pay has nothing for a card to pay.':
    'Utilisable sur une facture qui reste due, ou au comptoir. Une facture entièrement réglée n’a plus rien qu’une carte puisse payer.',
  'Bills still owing': 'Factures encore dues',
  'The counter': 'Le comptoir',

  // Refusals that carry a figure or a date with them
  '{v1} is already a code in this workshop. Two codes with one name is two offers nobody can tell apart.':
    '{v1} est déjà un code dans cet atelier. Deux codes portant le même nom, ce sont deux offres que personne ne peut distinguer.',
  '{v1} is not a code this workshop has issued.': '{v1} n’est pas un code émis par cet atelier.',
  'That code starts on {v1}. It is worth nothing before then.':
    'Ce code commence le {v1}. Il ne vaut rien avant cette date.',
  'That code ran out on {v1}.': 'Ce code a expiré le {v1}.',
  'That code has been used its {v1} times and is finished.':
    'Ce code a été utilisé ses {v1} fois et il est épuisé.',
  'This customer has used that code its {v1} times.': 'Ce client a utilisé ce code ses {v1} fois.',
  'That code needs a bill of {v1} or more. This one is {v2}.':
    'Ce code exige une facture de {v1} ou plus. Celle-ci est de {v2}.',
};

export const ar: Readonly<Record<string, string>> = {
  // The page
  Coupons: 'قسائم الخصم',
  'Codes a customer hands over, and what each one has cost and brought in':
    'الرموز التي يقدّمها العميل، وما كلّفه كل رمز وما جلبه',
  'Saved. The code works from now on, within whatever it says.':
    'تم الحفظ. الرمز يعمل من الآن، في حدود ما ينصّ عليه.',
  'Saved. Codes already used keep what they gave away.':
    'تم الحفظ. الرموز المستخدَمة من قبل تحتفظ بما منحته.',
  'Codes running': 'رموز سارية',
  'Usable today': 'قابلة للاستخدام اليوم',
  'Given away': 'ما مُنح',
  'Billed on those visits': 'ما فُوتر في تلك الزيارات',
  'What the offers brought in': 'ما جلبته العروض',
  'Times used': 'مرات الاستخدام',

  // The list
  'The codes': 'الرموز',
  'A retired code is refused at the counter and keeps its history.':
    'الرمز المسحوب يُرفض عند المنضدة ويحتفظ بسجلّه.',
  'No codes yet': 'لا توجد رموز بعد',
  'A code is worth a percentage or an amount, and can be limited by date, by bill, by how many times it is used and by how many times one customer uses it.':
    'الرمز يساوي نسبة مئوية أو مبلغًا، ويمكن تقييده بالتاريخ، وبقيمة الفاتورة، وبعدد مرات استخدامه إجمالًا، وبعدد مرات استخدام العميل الواحد له.',
  running: 'ساري',
  'not started': 'لم يبدأ بعد',
  finished: 'انتهى',
  'all used': 'استُهلك بالكامل',
  'used once': 'استُخدم مرة واحدة',
  'used {count} times': 'استُخدم {count} مرة',
  'Who used it': 'من استخدمه',
  of: 'من أصل',

  // The form
  'A new code': 'رمز جديد',
  'Everything it promises is set here, and checked at the counter':
    'كل ما يَعِد به يُضبط هنا، ويُتحقَّق منه عند المنضدة',
  'Letters and digits. Spaces and dashes are ignored.': 'حروف وأرقام. المسافات والشُّرَط تُتجاهَل.',
  'A percentage off': 'خصم بنسبة مئوية',
  'An amount off': 'خصم بمبلغ',
  'Per cent': 'النسبة المئوية',
  'For a percentage code.': 'لرمز بنسبة مئوية.',
  'Amount off': 'مبلغ الخصم',
  'For an amount code.': 'لرمز بمبلغ.',
  'Least bill': 'أقل قيمة للفاتورة',
  'Blank for any bill.': 'اتركه فارغًا لأي فاتورة.',
  Until: 'حتى',
  'The last day it works.': 'آخر يوم يعمل فيه.',
  'Uses in total': 'عدد الاستخدامات إجمالًا',
  'Blank for no limit.': 'اتركه فارغًا بلا حد.',
  'Uses per customer': 'الاستخدامات لكل عميل',
  'What it is for': 'الغرض منه',
  'Only the workshop sees this.': 'الورشة وحدها ترى هذا.',
  'Spring postcard': 'بطاقة بريدية للربيع',
  'Add the code': 'إضافة الرمز',

  // How it works
  'How a code is taken': 'كيف يُؤخذ الرمز',
  'At the counter it comes off before the sale is taken. On an invoice it is settled like loyalty points: the invoice keeps the total it was issued at, and what the code took off is posted to what the offers cost rather than to the bank.':
    'عند المنضدة يُخصم قبل إتمام البيع. وعلى الفاتورة يُسوّى كنقاط الولاء: تحتفظ الفاتورة بإجماليها الذي صدرت به، ويُقيَّد ما خصمه الرمز على تكلفة العروض لا على البنك.',
  'A code is refused with the reason: out of date, not started, all used, already used by this customer, or the bill being too small. Whoever is standing at the counter can then decide what to do about it.':
    'يُرفض الرمز مع ذكر السبب: منتهي الصلاحية، أو لم يبدأ، أو استُهلك بالكامل، أو استخدمه هذا العميل من قبل، أو أن الفاتورة أقل من اللازم. عندها يقرّر من يقف عند المنضدة ما يفعله.',

  // On an invoice and at the counter
  'Use a coupon': 'استخدام قسيمة',
  'The code off the postcard or the email. Spaces and dashes do not matter.':
    'الرمز المكتوب على البطاقة البريدية أو في البريد الإلكتروني. المسافات والشُّرَط لا تهم.',
  'Take the code off': 'خصم الرمز',
  'Code taken off the bill and booked as what the offer cost, not as money in.':
    'خُصم الرمز من الفاتورة وقُيِّد بوصفه تكلفة العرض، لا نقدًا واردًا.',
  Coupon: 'قسيمة خصم',
  'If they have a code. Spaces and dashes do not matter.':
    'إن كان لديهم رمز. المسافات والشُّرَط لا تهم.',
  'Their code': 'رمزهم',

  // Refusals
  'Type the code the customer has.': 'اكتب الرمز الذي بحوزة العميل.',
  'A code is at least three letters or digits. Anything shorter is typed by accident.':
    'الرمز ثلاثة حروف أو أرقام على الأقل. وما دون ذلك يُكتب سهوًا.',
  'A percentage is more than nothing and not more than a hundred. A hundred per cent is free work, which is a decision rather than a discount.':
    'النسبة أكبر من الصفر ولا تتجاوز المئة. ومئة بالمئة عمل مجاني، وذلك قرار لا خصم.',
  'An amount off is more than nothing and less than a million.':
    'مبلغ الخصم أكبر من الصفر وأقل من مليون.',
  'A minimum spend cannot be less than nothing.': 'الحد الأدنى للإنفاق لا يقلّ عن الصفر.',
  'It ends before it starts. One of the two dates is the wrong way round.':
    'ينتهي قبل أن يبدأ. أحد التاريخين مقلوب.',
  'A limit is a whole number of uses, or nothing at all for no limit.':
    'الحد عدد صحيح من الاستخدامات، أو لا شيء إطلاقًا بلا حد.',
  'One customer can use a code at least once.':
    'العميل الواحد يستطيع استخدام الرمز مرة واحدة على الأقل.',
  'That code is no longer being honoured.': 'هذا الرمز لم يعد معمولًا به.',
  'This customer has used that code already. It is one to a customer.':
    'استخدم هذا العميل ذلك الرمز من قبل. وهو مرة واحدة لكل عميل.',
  'Nothing is owed on this bill, so there is nothing to take off.':
    'لا شيء مستحق على هذه الفاتورة، فليس هناك ما يُخصم.',
  'That code is not in this workshop.': 'هذا الرمز ليس في هذه الورشة.',
  'That invoice is not in this workshop.': 'هذه الفاتورة ليست في هذه الورشة.',
  'Nobody has used this code yet.': 'لم يستخدم أحد هذا الرمز بعد.',
  'Counter sale': 'بيع عند المنضدة',
  Retire: 'سحب',
  Restore: 'إعادة',
  retired: 'مسحوب',
  Code: 'الرمز',

  // The line that says what a code is, assembled from these
  '{percent}% off': 'خصم {percent}%',
  '{amount} off': 'خصم {amount}',
  'bills over {amount}': 'الفواتير التي تتجاوز {amount}',
  '1 use left': 'بقي استخدام واحد',
  '{count} uses left': 'بقي {count} استخدامات',
  'not used yet': 'لم يُستخدم بعد',
  'This year so far': 'هذا العام حتى الآن',
  'Working…': 'جارٍ التنفيذ…',
  // Finding the way to spend a card
  'Nothing left to pay': 'لم يتبقَّ شيء للدفع',
  'This bill is settled, so there is nothing here to take a payment, a gift card, points, a coupon or money held against. Raising a credit note is below.':
    'هذه الفاتورة مسدّدة، فليس هنا ما يُحصَّل عليه دفعة أو بطاقة هدايا أو نقاط أو قسيمة أو مال محتفَظ به. وإصدار إشعار دائن موجود بالأسفل.',
  'Spent against a bill that still has something owing, or at the counter. A bill with nothing left to pay has nothing for a card to pay.':
    'تُستخدم على فاتورة ما زال عليها مستحق، أو عند المنضدة. والفاتورة التي لم يبقَ عليها شيء ليس فيها ما تدفعه البطاقة.',
  'Bills still owing': 'فواتير ما زالت مستحقة',
  'The counter': 'المنضدة',

  // Refusals that carry a figure or a date with them
  '{v1} is already a code in this workshop. Two codes with one name is two offers nobody can tell apart.':
    '{v1} رمز موجود بالفعل في هذه الورشة. ورمزان بالاسم نفسه عرضان لا يستطيع أحد التفريق بينهما.',
  '{v1} is not a code this workshop has issued.': '{v1} ليس رمزًا أصدرته هذه الورشة.',
  'That code starts on {v1}. It is worth nothing before then.':
    'هذا الرمز يبدأ في {v1}. ولا قيمة له قبل ذلك.',
  'That code ran out on {v1}.': 'انتهت صلاحية هذا الرمز في {v1}.',
  'That code has been used its {v1} times and is finished.':
    'استُخدم هذا الرمز مراته الـ{v1} وانتهى.',
  'This customer has used that code its {v1} times.': 'استخدم هذا العميل ذلك الرمز مراته الـ{v1}.',
  'That code needs a bill of {v1} or more. This one is {v2}.':
    'هذا الرمز يتطلّب فاتورة بقيمة {v1} أو أكثر. وهذه الفاتورة {v2}.',
};
