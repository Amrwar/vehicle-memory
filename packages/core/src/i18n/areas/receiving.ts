/**
 * Receiving with a scanner in one hand. Phase 93.
 *
 * The sentence that carries the phase is the refusal: “that is not on this
 * order”. It has to read as *stop and look*, not as *the computer did not
 * find it* — because the three things that cause it (the supplier sent
 * something nobody ordered, this is the wrong order for this pallet, the box
 * belongs to another delivery) are all worth stopping for, and a receiver who
 * reads it as a lookup failure shrugs and books it in anyway.
 */

export const fr = {
  // The refusals the library throws.
  'That purchase order was not found.': 'Ce bon de commande est introuvable.',
  'That line is not on this order.': 'Cette ligne ne figure pas sur cette commande.',
  'How many arrived? It must be more than nothing.':
    'Combien en est-il arrivé ? Il en faut plus que rien.',
  'Only {v1} of those are still owed on this order.':
    'Il n’en reste que {v1} à recevoir sur cette commande.',
  'That order is closed. Nothing more can be booked to it.':
    'Cette commande est close. Plus rien ne peut y être imputé.',
  Receiving: 'Réception',
  'Orders with something still to come. Open one and scan the boxes into it.':
    'Commandes dont il reste des articles à recevoir. Ouvrez-en une et scannez les colis.',
  'Waiting on a delivery': 'En attente de livraison',
  '{count} orders': '{count} commandes',
  'Nothing is outstanding. Every order has arrived.':
    'Rien en attente. Toutes les commandes sont arrivées.',
  'Still to come': 'Reste à recevoir',
  'Part received': 'Partiellement reçue',
  'Order #{number}': 'Commande n° {number}',

  // The scan.
  'Scan a box': 'Scanner un colis',
  'Point the scanner at the box. The line appears; you say how many arrived.':
    'Visez le colis. La ligne apparaît ; vous indiquez la quantité reçue.',
  'Scan or type a part number': 'Scannez ou saisissez une référence',
  'Find the line': 'Trouver la ligne',

  // The refusals, which are the point.
  '“{code}” is not on this order.': '« {code} » ne figure pas sur cette commande.',
  'Either the supplier sent something nobody ordered, or this is the wrong order for this pallet. Worth stopping for.':
    'Soit le fournisseur a envoyé un article non commandé, soit ce n’est pas la bonne commande pour cette palette. Cela mérite qu’on s’arrête.',
  'All of “{what}” have already been received on this order.':
    'La totalité de « {what} » a déjà été reçue sur cette commande.',
  'This order has two lines for that part': 'Cette commande comporte deux lignes pour cette pièce',
  'A split delivery, two prices or two dates. Choosing for you would book it against whichever was created first.':
    'Livraison fractionnée, deux prix ou deux dates. Choisir à votre place imputerait la réception à la ligne créée en premier.',

  // Counting it in.
  'How many arrived': 'Quantité reçue',
  'Delivery note': 'Bon de livraison',
  // The jobs area owns bare `Book it in` for making a booking. Booking a
  // pallet in is a different act, and French has no word that is both.
  'Book it in#goods': 'Enregistrer la réception',
  '{count} still owed on this order': 'Il reste {count} à recevoir sur cette commande',
  '{count} still owed': 'Reste {count}',
  '{count} booked in.': '{count} enregistrés.',
  'That is the whole order. Nothing is still to come.':
    'La commande est complète. Il ne reste rien à recevoir.',
  'Nothing. The whole order has arrived.': 'Rien. Toute la commande est arrivée.',
  '{lines} lines, {items} items': '{lines} lignes, {items} articles',
  'Still owed': 'Reste dû',
  'All in': 'Tout reçu',
};

export const ar = {
  'That purchase order was not found.': 'لم يُعثر على أمر الشراء هذا.',
  'That line is not on this order.': 'هذا السطر ليس على هذا الطلب.',
  'How many arrived? It must be more than nothing.': 'كم وصل منها؟ يجب أن يكون أكثر من لا شيء.',
  'Only {v1} of those are still owed on this order.': 'لم يتبقَّ سوى {v1} منها على هذا الطلب.',
  'That order is closed. Nothing more can be booked to it.':
    'هذا الطلب مغلق. لا يمكن تسجيل أي شيء آخر عليه.',
  Receiving: 'الاستلام',
  'Orders with something still to come. Open one and scan the boxes into it.':
    'طلبات ما زال بعضها لم يصل. افتح واحداً وامسح الصناديق عليه.',
  'Waiting on a delivery': 'في انتظار التسليم',
  '{count} orders': '{count} طلبات',
  'Nothing is outstanding. Every order has arrived.': 'لا شيء معلَّق. وصلت جميع الطلبات.',
  'Still to come': 'ما زال متوقعاً',
  'Part received': 'مستلَمة جزئياً',
  'Order #{number}': 'الطلب رقم {number}',

  'Scan a box': 'امسح صندوقاً',
  'Point the scanner at the box. The line appears; you say how many arrived.':
    'وجّه الماسح إلى الصندوق. يظهر السطر، وأنت تحدد الكمية التي وصلت.',
  'Scan or type a part number': 'امسح أو اكتب رقم قطعة',
  'Find the line': 'ابحث عن السطر',

  '“{code}” is not on this order.': '«{code}» ليس على هذا الطلب.',
  'Either the supplier sent something nobody ordered, or this is the wrong order for this pallet. Worth stopping for.':
    'إمّا أن المورّد أرسل صنفاً لم يُطلب، أو أن هذا ليس الطلب الصحيح لهذه المنصّة. الأمر يستحق التوقف.',
  'All of “{what}” have already been received on this order.':
    'استُلمت «{what}» بالكامل على هذا الطلب من قبل.',
  'This order has two lines for that part': 'هذا الطلب يحتوي على سطرين لهذه القطعة',
  'A split delivery, two prices or two dates. Choosing for you would book it against whichever was created first.':
    'تسليم مجزّأ، أو سعران، أو تاريخان. الاختيار نيابةً عنك سيقيّدها على السطر الأقدم.',

  'How many arrived': 'الكمية التي وصلت',
  'Delivery note': 'إشعار التسليم',
  'Book it in#goods': 'سجّل الاستلام',
  '{count} still owed on this order': 'ما زال {count} مستحقاً على هذا الطلب',
  '{count} still owed': 'يتبقى {count}',
  '{count} booked in.': 'تم تسجيل {count}.',
  'That is the whole order. Nothing is still to come.': 'هذا هو الطلب كاملاً. لم يبقَ شيء.',
  'Nothing. The whole order has arrived.': 'لا شيء. وصل الطلب بأكمله.',
  '{lines} lines, {items} items': '{lines} سطراً، {items} صنفاً',
  'Still owed': 'المتبقي',
  'All in': 'اكتمل',
};
