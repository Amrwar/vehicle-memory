/**
 * What was scanned. Phase 92.
 *
 * The sentence that matters is the refusal. "That matches more than one thing"
 * has to read as the product being careful, not as it being broken — because a
 * workshop that reads it as broken will stop using the scanner, and go back to
 * typing job numbers in by hand, which is the thing that puts the wrong part
 * on the wrong car in the first place.
 *
 * `Vehicle` is here because no area owned it as a bare word. `Job`, `Part`,
 * `Bin`, `Inspection` and `Machine` are not: other areas answer all five, and
 * one word gets one answer.
 */

export const fr = {
  Scan: 'Scanner',
  'Point the scanner at a key tag, a shelf edge, a job sheet or a windscreen. Or type what is printed on the label.':
    'Visez une étiquette de clés, un bord d’étagère, un ordre de travail ou un pare-brise. Ou saisissez ce qui est imprimé sur l’étiquette.',
  'Scan or type a code': 'Scannez ou saisissez un code',
  Vehicle: 'Véhicule',

  'That is': 'C’est',
  'That matches more than one thing': 'Cela correspond à plusieurs éléments',
  'Which did you mean? Opening the wrong one looks exactly like opening the right one, so this asks rather than choosing.':
    'Lequel vouliez-vous ? Ouvrir le mauvais ressemble exactement à ouvrir le bon : la question est donc posée plutôt que tranchée.',

  'Nothing here matches that.': 'Rien ici ne correspond.',
  'It was looked for as: {kinds}': 'Recherché en tant que : {kinds}',

  'What carries a code': 'Ce qui porte un code',
  'Everything Carnet prints carries one. A code of ours can never be mistaken for anything else.':
    'Tout ce que Carnet imprime en porte un. Un de nos codes ne peut être confondu avec rien d’autre.',
};

export const ar = {
  Scan: 'المسح الضوئي',
  'Point the scanner at a key tag, a shelf edge, a job sheet or a windscreen. Or type what is printed on the label.':
    'وجّه الماسح إلى بطاقة مفاتيح أو حافة رف أو ورقة عمل أو زجاج أمامي. أو اكتب ما هو مطبوع على الملصق.',
  'Scan or type a code': 'امسح أو اكتب رمزاً',
  Vehicle: 'المركبة',

  'That is': 'هذا هو',
  'That matches more than one thing': 'هذا يطابق أكثر من عنصر',
  'Which did you mean? Opening the wrong one looks exactly like opening the right one, so this asks rather than choosing.':
    'أيّهما تقصد؟ فتح الخطأ يبدو تماماً كفتح الصحيح، لذا يُطرح السؤال بدل الاختيار.',

  'Nothing here matches that.': 'لا شيء هنا يطابق ذلك.',
  'It was looked for as: {kinds}': 'جرى البحث عنه بوصفه: {kinds}',

  'What carries a code': 'ما الذي يحمل رمزاً',
  'Everything Carnet prints carries one. A code of ours can never be mistaken for anything else.':
    'كل ما تطبعه Carnet يحمل رمزاً. ولا يمكن الخلط بين رموزنا وأي شيء آخر.',
};
