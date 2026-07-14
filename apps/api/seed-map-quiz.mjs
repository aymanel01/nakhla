/**
 * Seeds أبواب القصر from: الموارد/ابواب القصر/اسئلة القصر.docx
 * Run: node seed-map-quiz.mjs  (from apps/api)
 */
import Database from 'better-sqlite3'

const STAGE_IMAGES = [
  '/quiz-map/door-1.jpeg',
  '/quiz-map/door-2.jpeg',
  '/quiz-map/door-3.jpeg',
  '/quiz-map/door-4.jpeg',
  '/quiz-map/door-5.jpeg',
]

const mainStages = [
  {
    stageNumber: 1,
    title: 'الباب 1 — الدهليز',
    subtitle: 'تحدي القواعد والمنطق',
    questions: [
      {
        id: 'd1-q1',
        question: 'أيُّ الكلمات التالية تُعتبر فعلاً وليس اسماً؟',
        options: ['كتابة', 'يكتب', 'مكتبة', 'كاتب'],
        correctAnswer: 1,
      },
      {
        id: 'd1-q2',
        question: 'في جملة «أشرقت الشمسُ ساطعةً»، كلمة «ساطعة» تُعرب:',
        options: ['خبراً', 'نعتاً', 'حالاً', 'مفعولاً به'],
        correctAnswer: 2,
      },
      {
        id: 'd1-q3',
        question: 'ما الحرف الذي إذا أضفناه لكلمة (سلم) تحولت إلى أداة قتال؟',
        options: ['السين', 'الشين', 'الصاد', 'التاء'],
        correctAnswer: 2,
      },
      {
        id: 'd1-q4',
        question: 'أيُّ كلمة لا تنتمي للمجموعة التالية: بحر، مسمكة، شباك؟',
        options: ['بحر', 'مسمكة', 'شباك', 'جبل'],
        correctAnswer: 3,
      },
    ],
  },
  {
    stageNumber: 2,
    title: 'الباب 2 — الرواق',
    subtitle: 'تحدي البلاغة والمعاني',
    questions: [
      {
        id: 'd2-q1',
        question: 'في جملة «جاء محمدٌ وعليٌ»، الواو هنا تُفيد:',
        options: ['الترتيب', 'الجمع والمشاركة', 'التخيير', 'التعقيب'],
        correctAnswer: 1,
      },
      {
        id: 'd2-q2',
        question: 'ما هو مرادف كلمة «العزيمة» في قولنا: «لديه عزيمة قوية»؟',
        options: ['الإصرار', 'التردد', 'القوة الجسدية', 'الكسل'],
        correctAnswer: 0,
      },
      {
        id: 'd2-q3',
        question: '«طويل اليد» تعبير مجازي يُقصد به في لغتنا:',
        options: ['الشخص الكريم', 'الشخص السارق', 'الطويل القامة', 'صاحب المال'],
        correctAnswer: 1,
      },
      {
        id: 'd2-q4',
        question: 'حدد الضمير المستتر في جملة: «أحبُّ القراءةَ».',
        options: ['تقديره هو', 'تقديره أنا', 'لا يوجد', 'تقديره نحن'],
        correctAnswer: 1,
      },
    ],
  },
  {
    stageNumber: 3,
    title: 'الباب 3 — الساحة',
    subtitle: 'تحدي التراكيب والنحو',
    questions: [
      {
        id: 'd3-q1',
        question: '«المؤمنُ القويُ». ما نوع النعت في هذه الجملة؟',
        options: ['نعت حقيقي', 'نعت سببي', 'حال', 'تمييز'],
        correctAnswer: 0,
      },
      {
        id: 'd3-q2',
        question: 'صحّح الخطأ: «رأيتُ طفلان يلعبان في الحديقة».',
        options: ['رأيتُ طفلين', 'رأيتُ أطفالاً', 'رأيتُ طفلٌ', 'رأيتُ طفلان'],
        correctAnswer: 0,
      },
      {
        id: 'd3-q3',
        question: '«الشجرةُ أغصانُها مثمرةٌ». الخبر هنا نوعه:',
        options: ['مفرد', 'جملة اسمية', 'جملة فعلية', 'شبه جملة'],
        correctAnswer: 1,
      },
      {
        id: 'd3-q4',
        question: 'ما علامة جزم الفعل المضارع في «لم يكتبْ الدرس»؟',
        options: ['الضمة', 'الفتحة', 'السكون', 'الكسرة'],
        correctAnswer: 2,
      },
    ],
  },
  {
    stageNumber: 4,
    title: 'الباب 4 — القاعة',
    subtitle: 'تحدي الذكاء اللغوي',
    questions: [
      {
        id: 'd4-q1',
        question: 'ما معنى «المجاز» في اللغة؟',
        options: [
          'استخدام الكلمة في معناها الحقيقي',
          'استخدام الكلمة في غير معناها الحقيقي',
          'حذف جزء من الجملة',
          'تكرار الكلمة للتأكيد',
        ],
        correctAnswer: 1,
      },
      {
        id: 'd4-q2',
        question: 'أيُّ الجمل التالية تتضمن «استفهاماً إنكارياً»؟',
        options: ['هل من مفر؟', 'متى السفر؟', 'أين الكتاب؟', 'من جاء؟'],
        correctAnswer: 0,
      },
      {
        id: 'd4-q3',
        question: 'كلمة «سأل» إذا غيّرنا الهمزة على الواو (سؤول)، هل يتغير المعنى؟',
        options: ['نعم (صيغة مبالغة)', 'لا', 'يتغير جزئياً فقط', 'تصبح اسماً فقط'],
        correctAnswer: 0,
      },
      {
        id: 'd4-q4',
        question: 'ما هو الشيء الذي يكتب ولا يقرأ؟',
        options: ['الكتاب', 'القلم', 'السبورة', 'الورق'],
        correctAnswer: 1,
      },
    ],
  },
  {
    stageNumber: 5,
    title: 'الباب 5 — العرش',
    subtitle: 'عرش البيان — تحدي العباقرة',
    questions: [
      {
        id: 'd5-q1',
        question: 'لماذا تُسمى اللغة العربية «لغة الاشتقاق»؟',
        options: [
          'لأنها صعبة',
          'لأن الكلمات تولد من جذر واحد',
          'لأنها قديمة جداً',
          'لأنها كثيرة الحروف',
        ],
        correctAnswer: 1,
      },
      {
        id: 'd5-q2',
        question: 'أيهما أصح: «أنا أكثر منه ذكاءً» أم «أنا أذكى منه»؟',
        options: ['كلاهما صحيح', 'الأولى فقط', 'الثانية فقط', 'كلاهما خطأ'],
        correctAnswer: 0,
      },
      {
        id: 'd5-q3',
        question: 'ما الفرق بين «رأى» البصرية و«رأى» القلبية؟',
        options: ['لا فرق', 'سياق ومعنى (إبصار مقابل اعتقاد)', 'فرق في النطق فقط', 'فرق في الإملاء فقط'],
        correctAnswer: 1,
      },
      {
        id: 'd5-q4',
        question: 'لغز: شيء موجود في كل لغات العالم لكنه صامت؟',
        options: ['الحرف', 'الفراغ', 'النقطة', 'الصوت'],
        correctAnswer: 0,
      },
    ],
  },
]

const bonusStages = [
  {
    stageNumber: 1,
    title: 'سؤال المسار — الدهليز',
    question: 'رتّب الجملة: (اللغةُ / مفتاح / العربيةُ / المعرفةِ / طريق).',
    options: [
      'اللغة العربية مفتاح طريق المعرفة',
      'اللغة طريق مفتاح العربية المعرفة',
      'مفتاح اللغة العربية طريق المعرفة',
      'المعرفة طريق مفتاح اللغة العربية',
    ],
    correctAnswer: 0,
  },
  {
    stageNumber: 2,
    title: 'سؤال المسار — الرواق',
    question: 'لغز: شيء له أسنان ولا يعض، فما هو؟',
    options: ['المنشار', 'المشط', 'المفتاح', 'السكين'],
    correctAnswer: 1,
  },
  {
    stageNumber: 3,
    title: 'سؤال المسار — الساحة',
    question: 'إذا كان كل الكتاب يقرأون، فهل كل من يقرأ هو كاتب؟',
    options: ['نعم', 'لا', 'بعضهم كتاب', 'لا يمكن الجزم'],
    correctAnswer: 1,
  },
  {
    stageNumber: 4,
    title: 'سؤال المسار — القاعة',
    question: 'كيف نصل إلى «النور» إذا كان الطريق كله «ظلام»؟',
    options: ['بإشعال شمعة العلم', 'بالانتظار', 'بالنوم', 'بالعودة للخلف'],
    correctAnswer: 0,
  },
  {
    stageNumber: 5,
    title: 'سؤال المسار — العرش',
    question: 'الصندوق الأسطوري: «إذا قلت الحقيقة خسرت، وإذا كذبت خسرت». ماذا تفعل؟',
    options: ['أقول الحقيقة', 'أكذب', 'أمتنع عن الإجابة', 'أغيّر السؤال'],
    correctAnswer: 2,
  },
]

const db = new Database('teaching-app.db')

const upsert = db.prepare(`
  INSERT INTO quiz_stage_configs (stage_type, stage_number, title, image, questions, updated_at)
  VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(stage_type, stage_number) DO UPDATE SET
    title = excluded.title,
    image = excluded.image,
    questions = excluded.questions,
    updated_at = CURRENT_TIMESTAMP
`)

for (const stage of mainStages) {
  upsert.run(
    'main',
    stage.stageNumber,
    stage.title,
    STAGE_IMAGES[stage.stageNumber - 1],
    JSON.stringify(stage.questions),
  )
  console.log(`✓ main / ${stage.title}`)
}

for (const stage of bonusStages) {
  const questions = [{
    id: `bonus-${stage.stageNumber}`,
    question: stage.question,
    options: stage.options,
    correctAnswer: stage.correctAnswer,
  }]
  upsert.run(
    'bonus',
    stage.stageNumber,
    stage.title,
    STAGE_IMAGES[stage.stageNumber - 1],
    JSON.stringify(questions),
  )
  console.log(`✓ bonus / ${stage.title}`)
}

console.log('\nSeeded from: الموارد/ابواب القصر/اسئلة القصر.docx')
console.log('Test at: http://localhost:5173/quizzes')
db.close()
