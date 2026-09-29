/**
 * What the car takes. Phase 88.
 *
 * The sentence that has to survive translation is the one about blanks: a
 * blank sends somebody to look it up and a wrong number does not. In all three
 * languages it must read as a deliberate choice rather than an apology for
 * missing data, because a technician who reads it as an apology will fill the
 * boxes in with something plausible, which is the exact failure the whole
 * design exists to prevent.
 *
 * The fourteen line labels are terms of the trade and are translated as such:
 * a French workshop says « 0W-30 » and « DOT 4 » exactly as an English one
 * does, so only the words around the figures change.
 */

export const fr = {
  // The sheet on a car.
  'What this car takes': 'Ce que prend ce véhicule',
  'Written once for the model, inherited by every car that decodes to it. A line nobody has answered is left blank on purpose.':
    'Rédigée une fois pour le modèle, puis reprise par chaque véhicule qui y correspond. Une ligne sans réponse reste vide, délibérément.',
  '{answered} of {of} filled in': '{answered} sur {of} renseignées',
  '{answered} of {of}': '{answered} sur {of}',
  'From your sheet for {what}': 'D’après votre fiche pour {what}',
  'Two sources do not agree': 'Deux sources ne concordent pas',
  'Nobody has filled this in yet.': 'Personne ne l’a encore renseigné.',
  'this car': 'ce véhicule',
  'Parts recorded as fitting this car': 'Pièces enregistrées comme compatibles',
  'What has gone in': 'Ce qui a été monté',
  'Anything you put here applies to this car only, and overrides the model sheet.':
    'Ce que vous saisissez ici ne vaut que pour ce véhicule et prime sur la fiche du modèle.',
  'Save for this car': 'Enregistrer pour ce véhicule',

  // Where the line came from.
  'Recorded for this car': 'Relevé sur ce véhicule',
  'From your sheet for this model': 'D’après votre fiche pour ce modèle',
  'From a data feed': 'D’après un flux de données',

  // The groups.
  Engine: 'Moteur',
  Brakes: 'Freinage',
  // `Tyres` and `Brake fluid` are not here: the customers area already
  // answers both, and one word gets one answer.
  Battery: 'Batterie',
  Intervals: 'Périodicité',

  // The fourteen lines.
  'Engine oil': 'Huile moteur',
  'Oil capacity': 'Capacité d’huile',
  Coolant: 'Liquide de refroidissement',
  'Coolant capacity': 'Capacité de liquide',
  'Front tyres': 'Pneus avant',
  'Rear tyres': 'Pneus arrière',
  'Front pressure': 'Pression avant',
  'Rear pressure': 'Pression arrière',
  'Cold cranking': 'Courant de démarrage',
  'Service every': 'Révision tous les',
  'or every': 'ou tous les',

  // Units.
  bar: 'bar',
  months: 'mois',

  // The settings screen.
  'What each model takes': 'Ce que prend chaque modèle',
  'Oil, coolant, brake fluid, tyres, battery and intervals, written once for a model. Every car that decodes to it inherits them.':
    'Huile, liquide de refroidissement, liquide de frein, pneus, batterie et périodicité : rédigés une fois pour un modèle. Chaque véhicule qui y correspond en hérite.',
  'Oil, coolant, tyres, battery and intervals, written once for a model and inherited by every car that decodes to it.':
    'Huile, liquide de refroidissement, pneus, batterie et périodicité, rédigés une fois pour un modèle et repris par chaque véhicule qui y correspond.',
  'Your sheets': 'Vos fiches',
  '{count} written so far': '{count} rédigées à ce jour',
  'No sheets yet. Write one below for a model you see often.':
    'Aucune fiche pour l’instant. Rédigez-en une ci-dessous pour un modèle que vous voyez souvent.',
  'Filled in': 'Renseignées',
  'Write a sheet': 'Rédiger une fiche',
  'Edit this sheet': 'Modifier cette fiche',
  'Leave anything you do not know empty. A blank sends somebody to look it up; a wrong number does not.':
    'Laissez vide ce que vous ignorez : une case vide incite à vérifier, un chiffre erroné non.',
  'Write the sheet': 'Enregistrer la fiche',
  'Save the sheet': 'Enregistrer la fiche',
  'From year': 'Année de début',
  'To year': 'Année de fin',
  'Engine code': 'Code moteur',

  // The refusals.
  'That vehicle was not found.': 'Ce véhicule est introuvable.',
  'That sheet was not found.': 'Cette fiche est introuvable.',
  'A model sheet needs at least a make.': 'Une fiche de modèle exige au moins une marque.',
  'Those figures need to be numbers, or left empty.':
    'Ces valeurs doivent être des nombres, ou rester vides.',
  'That sheet could not be saved.': 'Cette fiche n’a pas pu être enregistrée.',
  'That sheet could not be removed.': 'Cette fiche n’a pas pu être supprimée.',
};

export const ar = {
  'What this car takes': 'ما تحتاجه هذه السيارة',
  'Written once for the model, inherited by every car that decodes to it. A line nobody has answered is left blank on purpose.':
    'تُكتب مرة واحدة للطراز، وترثها كل سيارة تطابقه. والسطر بلا إجابة يبقى فارغاً عن قصد.',
  '{answered} of {of} filled in': 'تم ملء {answered} من {of}',
  '{answered} of {of}': '{answered} من {of}',
  'From your sheet for {what}': 'من ورقتك الخاصة بـ {what}',
  'Two sources do not agree': 'مصدران لا يتفقان',
  'Nobody has filled this in yet.': 'لم يملأ أحد هذا بعد.',
  'this car': 'هذه السيارة',
  'Parts recorded as fitting this car': 'قطع مسجَّلة على أنها تناسب هذه السيارة',
  'What has gone in': 'ما رُكّب فيها',
  'Anything you put here applies to this car only, and overrides the model sheet.':
    'ما تدخله هنا يخص هذه السيارة وحدها، ويَعلو على ورقة الطراز.',
  'Save for this car': 'احفظ لهذه السيارة',

  'Recorded for this car': 'مسجَّل لهذه السيارة',
  'From your sheet for this model': 'من ورقتك الخاصة بهذا الطراز',
  'From a data feed': 'من تغذية بيانات',

  Engine: 'المحرك',
  Brakes: 'الفرامل',
  Battery: 'البطارية',
  Intervals: 'دورية الصيانة',

  'Engine oil': 'زيت المحرك',
  'Oil capacity': 'سعة الزيت',
  Coolant: 'سائل التبريد',
  'Coolant capacity': 'سعة سائل التبريد',
  'Front tyres': 'الإطارات الأمامية',
  'Rear tyres': 'الإطارات الخلفية',
  'Front pressure': 'الضغط الأمامي',
  'Rear pressure': 'الضغط الخلفي',
  'Cold cranking': 'تيار البدء البارد',
  'Service every': 'صيانة كل',
  'or every': 'أو كل',

  bar: 'بار',
  months: 'شهراً',

  'What each model takes': 'ما يحتاجه كل طراز',
  'Oil, coolant, brake fluid, tyres, battery and intervals, written once for a model. Every car that decodes to it inherits them.':
    'الزيت وسائل التبريد وسائل الفرامل والإطارات والبطارية ودورية الصيانة، تُكتب مرة واحدة للطراز. وترثها كل سيارة تطابقه.',
  'Oil, coolant, tyres, battery and intervals, written once for a model and inherited by every car that decodes to it.':
    'الزيت وسائل التبريد والإطارات والبطارية ودورية الصيانة، تُكتب مرة واحدة للطراز وترثها كل سيارة تطابقه.',
  'Your sheets': 'أوراقك',
  '{count} written so far': 'كُتبت {count} حتى الآن',
  'No sheets yet. Write one below for a model you see often.':
    'لا توجد أوراق بعد. اكتب واحدة أدناه لطراز تراه كثيراً.',
  'Filled in': 'المملوءة',
  'Write a sheet': 'اكتب ورقة',
  'Edit this sheet': 'عدّل هذه الورقة',
  'Leave anything you do not know empty. A blank sends somebody to look it up; a wrong number does not.':
    'اترك ما لا تعرفه فارغاً: الفراغ يدفع إلى التحقق، أما الرقم الخاطئ فلا.',
  'Write the sheet': 'احفظ الورقة',
  'Save the sheet': 'احفظ الورقة',
  'From year': 'من سنة',
  'To year': 'إلى سنة',
  'Engine code': 'رمز المحرك',

  'That vehicle was not found.': 'لم يُعثر على هذه المركبة.',
  'That sheet was not found.': 'لم يُعثر على هذه الورقة.',
  'A model sheet needs at least a make.': 'ورقة الطراز تتطلب على الأقل اسم الصانع.',
  'Those figures need to be numbers, or left empty.':
    'يجب أن تكون هذه القيم أرقاماً، أو تُترك فارغة.',
  'That sheet could not be saved.': 'تعذّر حفظ هذه الورقة.',
  'That sheet could not be removed.': 'تعذّرت إزالة هذه الورقة.',
};
