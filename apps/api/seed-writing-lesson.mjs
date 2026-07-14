/**
 * Seeds the عائشة writing lesson into admin content (social-economic).
 * Run: node seed-writing-lesson.mjs  (from apps/api, API need not be running)
 */
import Database from 'better-sqlite3'

const SECTION = 'social-economic'
const QUESTIONS_PREFIX = '__DOMAIN_QUESTIONS__:'

const questions = [
  { id: 'w-f1', type: 'multiple-choice', level: 'مباشر', objective: 'أن يلتقط المتعلّم معلومة صريحة من النص.', question: 'مَن جاء لعيادةِ الأمِّ المريضة؟', options: ['الطبيبُ إبراهيم', 'أحدُ أبنائِها', 'جارٌ من الحيّ'], feedbacks: ['صحيح. مطلعُ النصّ: «جاءَ الطبيبُ إبراهيمُ لعيادةِ أمِّها المريضة».', 'عُدْ إلى الجملةِ الأولى من النصّ.', 'هل ذُكِرَ جارٌ في زيارةِ العيادة؟'], correctAnswer: 0 },
  { id: 'w-f2', type: 'multiple-choice', level: 'مباشر', objective: 'أن يحدّد المتعلّم معطًى صريحًا (المرض).', question: 'بأيِّ داءٍ أُصيبت عائشة؟', options: ['داءِ السلِّ', 'داءِ القلبِ', 'لم تُصَبْ بأيِّ مرض'], feedbacks: ['صحيح. «أُصيبت المسكينةُ عائشةُ بداءِ السلِّ».', 'راجِعْ موضعَ ذكرِ المرضِ في الفقرةِ الأولى.', 'النصُّ يَذكُرُ مرضًا بعينِه.'], correctAnswer: 0 },
  { id: 'w-f3', type: 'multiple-choice', level: 'استنتاجي', objective: 'أن يستنتج المتعلّم سبب المرض من قرائن النص.', question: 'ما السببُ الذي أدّى إلى مرضِ عائشة؟', options: ['الجُهدُ المتواصلُ في الخياطةِ وسهرُ الليالي', 'العدوى من زبوناتِها', 'تقدُّمُها في السنِّ فحسب'], feedbacks: ['صحيح. «نتيجةَ الجهدِ المتّصلِ الذي كانت تبذلُه... وكم سهِرت الليالي».', 'هل يَربطُ النصُّ مرضَها بعدوى؟', 'ركّزْ على «الجهدِ المتّصل» و«سهرِ الليالي».'], correctAnswer: 0 },
  { id: 'w-f4', type: 'multiple-choice', level: 'ضمني', objective: 'أن يؤوّل المتعلّم دلالة خاتمة النص.', question: 'ماذا نَستنتجُ من قولِه: «كانت أفضلَ نساءِ حيِّها وأكثرَهنَّ تحمُّلًا لنوائبِ الدهر»؟', options: ['عُمقَ تضحيتِها وصبرِها ومكانتَها في قلوبِ أهلِ حيِّها', 'أنّها كانت أغنى نساءِ الحيّ', 'أنّها كانت تكرهُ عملَها'], feedbacks: ['صحيح. العبارةُ ثناءٌ على صبرِها وتضحيتِها.', 'هل تتحدّثُ العبارةُ عن المالِ؟', 'الثناءُ على تحمُّلِها يُناقِضُ الكراهية.'], correctAnswer: 0 },
  { id: 'w-a1', type: 'match', level: 'مباشر', objective: 'أن يربط المتعلّم كل عنصر سردي بمثاله من النص.', question: 'صِلْ كلَّ عنصرٍ سرديٍّ بما يُمثّلُه في نصِّ الانطلاق:', options: ['', '', '', ''], correctAnswer: 0, matchPairs: [{ left: 'الشخصيّة المحوريّة', right: 'عائشةُ (الأمّ)' }, { left: 'الزمان', right: 'ذاتَ صباحٍ' }, { left: 'المكان', right: 'غرفتُها الصغيرة' }, { left: 'حدثٌ من الأحداث', right: 'أُصيبت بداءِ السلّ' }] },
  { id: 'w-a2', type: 'multiple-choice', level: 'استنتاجي', objective: 'أن يحدّد المتعلّم ضمير السرد في النص.', question: 'بأيِّ ضميرٍ سُرِدت أحداثُ النصّ؟', options: ['ضميرُ الغائبِ (سَهِرت، وجدوها، كانت...)', 'ضميرُ المتكلّمِ (أنا)', 'ضميرُ المخاطَبِ (أنتَ)'], feedbacks: ['صحيح. السارِدُ يَحكي بضميرِ الغائبِ.', 'هل يَحكي السارِدُ عن نفسِه؟', 'هل يُخاطِبُ النصُّ قارئًا بـ«أنتَ»؟'], correctAnswer: 0 },
  { id: 'w-a3', type: 'multiple-choice', level: 'ضمني', objective: 'أن يُدرك المتعلّم وظيفة الوصف داخل السرد.', question: 'ما وظيفةُ الوصفِ في عباراتٍ مثل: «غرفتِها الصغيرة»، «رأسِها الذي كساه شعرٌ أبيض»؟', options: ['يَرسمُ صورةَ الشخصيّةِ والمكانِ ويُعمّقُ التأثيرَ', 'حَشوٌ لا فائدةَ منه يُمكنُ حذفُه', 'يَسردُ الأحداثَ المتتابعةَ'], feedbacks: ['صحيح. الوصفُ يُخدِمُ السردَ ويُثيرُ التعاطف.', 'جرّبْ حذفَ هذه الصورِ من النصّ.', 'تحريكُ الأحداثِ وظيفةُ الأفعالِ السرديّة.'], correctAnswer: 0 },
  { id: 'w-a4', type: 'multiple-choice', level: 'استنتاجي', objective: 'أن يُحدّد المتعلّم موقع مقطع في بنية النص.', question: '«وعندما فتحوا بابَ غرفتِها ذاتَ صباحٍ وجدوها... وقد انكفأت...» يمثّلُ في بنيةِ النصّ:', options: ['النهايةَ (الوضعيّةَ النهائيّة)', 'البدايةَ (الوضعيّةَ الأولى)', 'العقدةَ (تأزُّمَ الأحداث)'], feedbacks: ['صحيح. هذا المقطعُ يُغلِقُ النصَّ بمصيرِ الشخصيّة.', 'البدايةُ تُقدّمُ الشخصيّةَ قبلَ المشكلة.', 'العقدةُ هي لحظةُ التأزُّمِ لا الختام.'], correctAnswer: 0 },
]

const fields = {
  'writing:lesson:title': 'عائشةُ… وفاءٌ حتّى الرَّمَق الأخير',
  'writing:lesson:author': 'المصطفى سليمي',
  'writing:lesson:source': 'مجلّة الوعي الإسلاميّ، العدد 495، ذو القعدة 1427هـ (بتصرّف)',
  'writing:objective': 'اقرأ نصّ الانطلاق مع أزرار الإبراز، ثمّ أجِب عن أسئلة الاكتساب بالتتابع. بعد إتمام جميع الإجابات الصحيحة تُفتَح الخطاطة الذهنيّة.',
  'writing:acquisition:text': `جاء الطبيب إبراهيم لعيادة أمها المريضة، إنها تذكر كلماته، كما لو كانت بالأمس القريب، وهو يحذرها من مغادرة فراشها وعدم إجهاد نفسها بالعمل المتواصل... لقد أصيبت المسكينة عائشة بداء السل نتيجة الجهد المتصل الذي كانت تبذله، وهي جالسة على ماكينة الخياطة تعد ملابس نزولا عند طلب زبوناتها.

عانت الأم المسكينة من العبء الكبير الذي كانت تحمله وحدها بعد رحيل زوجها، وكم سهرت الليالي في غرفتها الصغيرة بعد نوم أبنائها، لكي تتمكن من إنجاز عملها وتسلم الملابس لزبائنها في مواعيد محددة. وعندما فتحوا باب غرفتها ذات صباح وجدوها جالسة على مقعدها الذي ألفت الجلوس عليه، وقد انكفأت برأسها الذي كساه شعر أبيض. رحم الله المسكينة، فقد كانت أفضل نساء حيها وأكثرهن تحملا لنوائب الدهر.`,
  'writing:acquisition:people': `إبراهيم
أمها المريضة
المسكينة عائشة
زبوناتها
الأم المسكينة
أبنائها
زبائنها`,
  'writing:acquisition:time': `بالأمس القريب
الليالي
مواعيد محددة
عندما
ذات صباح`,
  'writing:acquisition:place': `فراشها
ماكينة الخياطة
غرفتها
غرفتها الصغيرة`,
  'writing:acquisition:events': `جاء الطبيب
تذكر كلماته
يحذرها
أصيبت
تعد ملابس
عانت
رحيل زوجها
سهرت
تتمكن من إنجاز عملها
فتحوا باب غرفتها
وجدوها
انكفأت`,
  'writing:acquisition:description': `جالسة
العبء الكبير
الصغيرة
جالسة على مقعدها الذي ألفت الجلوس عليه
برأسها الذي كساه شعر أبيض
أفضل نساء حيها وأكثرهن تحملا لنوائب الدهر`,
  'writing:questions:acquisition': `${QUESTIONS_PREFIX}${JSON.stringify(questions)}`,
  'writing:situation:context': 'تستعد جمعية حيّك — أو نادي مؤسستك — لإصدار كتيّب بعنوان «وفاءٌ وعِرفان» يُكرّم أشخاصًا ضحّوا في صمت من أجل أسرهم أو حيّهم، ودُعي التلاميذ إلى المشاركة بقصص واقعية مؤثرة.',
  'writing:situation:task': 'موظّفًا ما اكتسبته من طرق السرد، اكتب نصًّا سرديًّا (من 12 إلى 15 سطرًا) تحكي فيه قصة شخص من محيطك (أم، أب، جار، معلّم...) ضحّى بجهده أو صحّته من أجل غيره؛ محترمًا بنية السرد (بداية ← عقدة ← نهاية)، موظّفًا عناصره، ومُدرجًا الوصف في موضعه.',
  'writing:resources:time': `ذات يوم
في صباح باكر
بعد مرور سنوات
منذ ذلك الحين
طوال الليل
وفي نهاية المطاف`,
  'writing:resources:place': `في حي شعبي قديم
داخل غرفة متواضعة
على عتبة البيت
في زاوية من الورشة
وسط زحام المدينة`,
  'writing:resources:people': `كان هناك رجل كادح
امرأة صبورة لا تعرف الكلل
جار طيب القلب
معلم مخلص في عمله`,
  'writing:resources:events': `بدأ يكافح من أجل
ثم حدث أن
وفجأة
وما إن … حتى
وأخيرا`,
  'writing:resources:description': `كان وجهه يحمل آثار التعب
يداه خشنتان من كثرة العمل
عيناه تفيضان حنانا
بيت صغير تفوح منه رائحة القناعة`,
}

const db = new Database('teaching-app.db')

const admin = db.prepare("SELECT id FROM users WHERE email = 'admin@app.com' AND role = 'admin'").get()
if (!admin) {
  console.error('Admin user not found. Run: pnpm --filter @teaching-app/api seed')
  process.exit(1)
}

const upsert = db.prepare(`
  SELECT id FROM admin_section_posts WHERE section = ? AND category = ? ORDER BY id DESC LIMIT 1
`)

const update = db.prepare(`
  UPDATE admin_section_posts SET content = ?, file_url = NULL, file_name = NULL, file_type = NULL, file_size = NULL WHERE id = ?
`)

const insert = db.prepare(`
  INSERT INTO admin_section_posts (section, user_id, content, category, file_url, file_name, file_type, file_size)
  VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL)
`)

let count = 0
for (const [category, content] of Object.entries(fields)) {
  const existing = upsert.get(SECTION, category)
  if (existing) {
    update.run(content, existing.id)
  } else {
    insert.run(SECTION, admin.id, content, category)
  }
  count += 1
  console.log(`✓ ${category}`)
}

console.log(`\nSeeded ${count} writing lesson fields for ${SECTION}.`)
console.log('View at: http://localhost:5173/important-content#social-economic → الإنتاج الكتابي')
db.close()
