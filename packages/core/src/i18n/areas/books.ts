/**
 * Whether the books still agree with themselves.
 *
 * The words of the integrity audit: the rules it holds a workshop to, the
 * things it holds, and the two sentences it uses to say what went wrong. They
 * are short on purpose. A person reading this page is being told that money
 * they thought was accounted for is not, and that is not the moment for a
 * paragraph.
 */

export const fr: Readonly<Record<string, string>> = {
  // The page
  'Do the books agree?': 'Les comptes concordent-ils ?',
  'Every figure recomputed from the rows underneath it':
    'Chaque montant recalculé à partir des lignes qui le composent',
  Checked: 'Vérifiés',
  'Figures held against what they are made of': 'Montants confrontés à ce qui les compose',
  Disagreements: 'Écarts',
  'Everything agrees': 'Tout concorde',
  'Each one is named below': 'Chacun est nommé ci-dessous',
  'Unaccounted for': 'Inexpliqué',
  'The money nobody can explain': 'L’argent que personne ne sait expliquer',
  'Every invoice adds up to its lines, every entry balances on its own, every shelf matches its movements, and the ledger agrees with the bills and the money held. Nothing here is taken on trust: all of it was recomputed just now.':
    'Chaque facture correspond à ses lignes, chaque écriture est équilibrée à elle seule, chaque rayonnage correspond à ses mouvements, et le grand livre concorde avec les factures et les sommes détenues. Rien n’est pris pour acquis : tout vient d’être recalculé.',
  'Figures that do not add up': 'Montants qui ne tombent pas juste',
  'Largest difference first, because that is where to start':
    'Le plus grand écart en premier, car c’est par là qu’il faut commencer',
  What: 'Quoi',
  Rule: 'Règle',
  'It says': 'Il indique',
  'It comes to': 'Il totalise',
  Difference: 'Écart',
  'Rules that were broken': 'Règles enfreintes',
  'Not a difference in money, but something that should not have happened':
    'Non pas un écart d’argent, mais quelque chose qui n’aurait pas dû arriver',

  // The rules
  'Every entry balances': 'Toute écriture est équilibrée',
  'An invoice is its lines': 'Une facture, ce sont ses lignes',
  'A bill is paid by its payments': 'Une facture est payée par ses règlements',
  'What is owed is what is left': 'Le dû, c’est ce qui reste',
  'A shelf is its movements': 'Un rayonnage, ce sont ses mouvements',
  'A card is its entries': 'Une carte, ce sont ses opérations',
  'Money held is what is left of it': 'Les sommes détenues, c’est ce qu’il en reste',
  'A closed period stays closed': 'Une période close reste close',
  'The ledger agrees with the bills': 'Le grand livre concorde avec les factures',
  'The ledger agrees with what is owed out':
    'Le grand livre concorde avec ce qui est dû à d’autres',

  // The things it holds
  Entry: 'Écriture',
  Card: 'Carte',
  Part: 'Pièce',
  'Money owed by customers': 'Sommes dues par les clients',
  'Gift cards outstanding': 'Cartes cadeaux en circulation',
  'Money held for customers': 'Sommes détenues pour les clients',

  // What went wrong, in words
  'Says {onHand} on the shelf, and its movements come to {movements}: a difference of {difference}.':
    'Indique {onHand} en rayon, alors que ses mouvements totalisent {movements} : un écart de {difference}.',
  'Posted into {period} on {postedAt}, after that period was closed on {closedAt}.':
    'Comptabilisée dans {period} le {postedAt}, après la clôture de cette période le {closedAt}.',
};

export const ar: Readonly<Record<string, string>> = {
  // The page
  'Do the books agree?': 'هل تتطابق الدفاتر؟',
  'Every figure recomputed from the rows underneath it':
    'كل رقم أُعيد احتسابه من السطور التي يقوم عليها',
  Checked: 'المفحوصة',
  'Figures held against what they are made of': 'أرقام قُوبلت بما تتكوّن منه',
  Disagreements: 'الفروق',
  'Everything agrees': 'كل شيء متطابق',
  'Each one is named below': 'كلٌّ منها مذكور أدناه',
  'Unaccounted for': 'غير مُفسَّر',
  'The money nobody can explain': 'المال الذي لا يستطيع أحد تفسيره',
  'Every invoice adds up to its lines, every entry balances on its own, every shelf matches its movements, and the ledger agrees with the bills and the money held. Nothing here is taken on trust: all of it was recomputed just now.':
    'كل فاتورة تساوي مجموع سطورها، وكل قيد متوازن بذاته، وكل رفّ يطابق حركاته، ودفتر الأستاذ يتطابق مع الفواتير ومع المبالغ المحتفظ بها. لا شيء هنا مأخوذ على الثقة: أُعيد احتساب ذلك كلّه للتوّ.',
  'Figures that do not add up': 'أرقام لا يستقيم جمعها',
  'Largest difference first, because that is where to start':
    'الفرق الأكبر أولًا، فمن هناك يبدأ النظر',
  What: 'ماذا',
  Rule: 'القاعدة',
  'It says': 'يقول',
  'It comes to': 'يبلغ',
  Difference: 'الفرق',
  'Rules that were broken': 'قواعد جرى خرقها',
  'Not a difference in money, but something that should not have happened':
    'ليس فرقًا في المال، بل أمرٌ ما كان ينبغي أن يقع',

  // The rules
  'Every entry balances': 'كل قيد متوازن',
  'An invoice is its lines': 'الفاتورة هي سطورها',
  'A bill is paid by its payments': 'الفاتورة تُسدَّد بدفعاتها',
  'What is owed is what is left': 'المستحقّ هو ما تبقّى',
  'A shelf is its movements': 'الرفّ هو حركاته',
  'A card is its entries': 'البطاقة هي عملياتها',
  'Money held is what is left of it': 'المبلغ المحتفظ به هو ما تبقّى منه',
  'A closed period stays closed': 'الفترة المقفلة تبقى مقفلة',
  'The ledger agrees with the bills': 'دفتر الأستاذ يتطابق مع الفواتير',
  'The ledger agrees with what is owed out': 'دفتر الأستاذ يتطابق مع ما هو مستحقّ للغير',

  // The things it holds
  Entry: 'قيد',
  Card: 'بطاقة',
  Part: 'قطعة',
  'Money owed by customers': 'مبالغ مستحقّة على العملاء',
  'Gift cards outstanding': 'بطاقات هدايا قائمة',
  'Money held for customers': 'مبالغ محتفظ بها للعملاء',

  // What went wrong, in words
  'Says {onHand} on the shelf, and its movements come to {movements}: a difference of {difference}.':
    'يقول {onHand} على الرفّ، بينما تبلغ حركاته {movements}: بفارق {difference}.',
  'Posted into {period} on {postedAt}, after that period was closed on {closedAt}.':
    'قُيِّد في {period} بتاريخ {postedAt}، بعد إقفال تلك الفترة في {closedAt}.',
};
