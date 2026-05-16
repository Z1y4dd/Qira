// Placement placeholder bank seed script.
//
// Inserts 5 placeholder Arabic passages (Levels 2, 6, 10, 14, 18), 15 questions
// (3 per passage: literal, vocabulary, inferential), and 60 answer choices
// (4 per question, exactly 1 correct).
//
// All rows tagged is_placeholder = true so a literacy specialist can replace the
// bank via a single DELETE WHERE is_placeholder = true + INSERT real transaction.
//
// Idempotent: if 5+ placeholder texts already exist, the script exits 0 with a
// skip message. This satisfies the "re-running is safe" requirement without
// needing a separate version-column write in this plan.
//
// Must run via DIRECT_DATABASE_URL (postgres superuser) because texts and
// questions have withCheck: sql`false` on INSERT (RLS blocks the pooler/anon role).
// Anti-pitfall 5 gate: throws early if DIRECT_DATABASE_URL is not set.

import { config } from 'dotenv';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { choices, levels, questions, texts } from '../schema';

config({ path: '.env.local' });

// ---------------------------------------------------------------------------
// Placeholder content — 5 passages at staggered levels per D-05.
// Arabic literals are NFC-normalized at the call site (see inserts below).
// Content is a smoke-test prop, NOT a pedagogically-calibrated instrument.
// Final content is the literacy specialist's deliverable (Phase 5 gate).
// ---------------------------------------------------------------------------

type Choice = { textAr: string; isCorrect: 0 | 1 };
type Question = {
  promptAr: string;
  questionType: 'literal' | 'vocabulary' | 'inferential';
  choices: Choice[];
};
type Passage = { levelNumber: number; titleAr: string; bodyAr: string; questions: Question[] };

const PASSAGES: Passage[] = [
  // ------------------------------------------------------------------
  // Passage 1 — Level 2, ~35 words, theme: animals
  // ------------------------------------------------------------------
  {
    levelNumber: 2,
    titleAr: 'القِطُّ الصَّغِيرُ',
    bodyAr:
      'عِنْدِي قِطٌّ صَغِيرٌ اسْمُهُ مِشْمِشٌ. لَوْنُهُ بُرْتُقَالِيٌّ، وَلَهُ ذَيْلٌ طَوِيلٌ. يُحِبُّ مِشْمِشٌ شُرْبَ الحَلِيبِ كُلَّ صَبَاحٍ. يَنَامُ عَلَى وِسَادَتِي، وَيَلْعَبُ بِالكُرَةِ.',
    questions: [
      {
        promptAr: 'مَا اسْمُ القِطِّ؟',
        questionType: 'literal',
        choices: [
          { textAr: 'مِشْمِشٌ', isCorrect: 1 },
          { textAr: 'بِسْكُوِيت', isCorrect: 0 },
          { textAr: 'لُولُو', isCorrect: 0 },
          { textAr: 'صَامُو', isCorrect: 0 },
        ],
      },
      {
        promptAr: 'مَا مَعْنَى "بُرْتُقَالِيٌّ"؟',
        questionType: 'vocabulary',
        choices: [
          { textAr: 'لَوْنٌ بَيْنَ الأَحْمَرِ وَالأَصْفَرِ', isCorrect: 1 },
          { textAr: 'نَوْعٌ مِنَ الفَوَاكِهِ', isCorrect: 0 },
          { textAr: 'صَوْتُ القِطِّ', isCorrect: 0 },
          { textAr: 'شَكْلُ الذَّيْلِ', isCorrect: 0 },
        ],
      },
      {
        promptAr: 'مَتَى يَشْرَبُ مِشْمِشٌ الحَلِيبَ؟',
        questionType: 'inferential',
        choices: [
          { textAr: 'فِي الصَّبَاحِ', isCorrect: 1 },
          { textAr: 'فِي اللَّيْلِ', isCorrect: 0 },
          { textAr: 'عِنْدَ نَوْمِهِ', isCorrect: 0 },
          { textAr: 'بَعْدَ اللَّعِبِ', isCorrect: 0 },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------
  // Passage 2 — Level 6, ~55 words, theme: family activity
  // ------------------------------------------------------------------
  {
    levelNumber: 6,
    titleAr: 'رِحْلَةُ يَوْمِ الجُمُعَةِ',
    bodyAr:
      'ذَهَبْنَا فِي يَوْمِ الجُمُعَةِ إِلَى حَدِيقَةِ المَدِينَةِ. كَانَ الجَوُّ مُشْمِسًا وَلَطِيفًا. أَحْضَرَتْ أُمِّي سَلَّةً مَلِيئَةً بِالطَّعَامِ، وَأَخِي الصَّغِيرُ حَمَلَ كُرَتَهُ المُفَضَّلَةَ. لَعِبْنَا تَحْتَ الشَّجَرَةِ الكَبِيرَةِ سَاعَتَيْنِ، ثُمَّ جَلَسْنَا نَأْكُلُ مَعًا. عُدْنَا إِلَى البَيْتِ سَعِيدِينَ.',
    questions: [
      {
        promptAr: 'مَاذَا أَحْضَرَتِ الأُمُّ؟',
        questionType: 'literal',
        choices: [
          { textAr: 'سَلَّةً مَلِيئَةً بِالطَّعَامِ', isCorrect: 1 },
          { textAr: 'مَجَلَّةً', isCorrect: 0 },
          { textAr: 'كُرَةً', isCorrect: 0 },
          { textAr: 'شَجَرَةً صَغِيرَةً', isCorrect: 0 },
        ],
      },
      {
        promptAr: 'مَا مَعْنَى "مُشْمِسًا"؟',
        questionType: 'vocabulary',
        choices: [
          { textAr: 'فِيهِ شَمْسٌ', isCorrect: 1 },
          { textAr: 'فِيهِ مَطَرٌ', isCorrect: 0 },
          { textAr: 'بَارِدٌ جِدًّا', isCorrect: 0 },
          { textAr: 'مُغَيَّمٌ', isCorrect: 0 },
        ],
      },
      {
        promptAr: 'لِمَاذَا عَادَتِ العَائِلَةُ سَعِيدَةً؟',
        questionType: 'inferential',
        choices: [
          { textAr: 'لِأَنَّهَا قَضَتْ يَوْمًا جَمِيلًا مَعًا', isCorrect: 1 },
          { textAr: 'لِأَنَّ الجَوَّ كَانَ بَارِدًا', isCorrect: 0 },
          { textAr: 'لِأَنَّ الكُرَةَ ضَاعَتْ', isCorrect: 0 },
          { textAr: 'لِأَنَّ الشَّجَرَةَ سَقَطَتْ', isCorrect: 0 },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------
  // Passage 3 — Level 10, ~70 words, theme: short story
  // ------------------------------------------------------------------
  {
    levelNumber: 10,
    titleAr: 'النَّمْلَةُ المُجْتَهِدَةُ',
    bodyAr:
      'فِي يَوْمٍ صَيْفِيٍّ حَارٍّ، كَانَتْ نَمْلَةٌ صَغِيرَةٌ تَحْمِلُ حَبَّاتِ القَمْحِ إِلَى بَيْتِهَا. مَرَّتْ بِهَا جَرَادَةٌ تَغَنِّي تَحْتَ ظِلِّ شَجَرَةٍ، فَسَأَلَتْهَا: "لِمَاذَا تَتْعَبِينَ هَكَذَا؟" أَجَابَتِ النَّمْلَةُ: "أَخَزِّنُ الطَّعَامَ لِفَصْلِ الشِّتَاءِ." ضَحِكَتِ الجَرَادَةُ وَلَمْ تَفْعَلْ شَيْئًا. وَعِنْدَمَا جَاءَ البَرْدُ، كَانَتِ النَّمْلَةُ مَرْتَاحَةً، وَكَانَتِ الجَرَادَةُ جَائِعَةً.',
    questions: [
      {
        promptAr: 'مَاذَا كَانَتِ النَّمْلَةُ تَحْمِلُ؟',
        questionType: 'literal',
        choices: [
          { textAr: 'حَبَّاتِ القَمْحِ', isCorrect: 1 },
          { textAr: 'أَوْرَاقَ الشَّجَرَةِ', isCorrect: 0 },
          { textAr: 'قِطَعَ السُّكَّرِ', isCorrect: 0 },
          { textAr: 'مَاءً بَارِدًا', isCorrect: 0 },
        ],
      },
      {
        promptAr: 'مَا مَعْنَى "أَخَزِّنُ"؟',
        questionType: 'vocabulary',
        choices: [
          { textAr: 'أَحْتَفِظُ بِشَيْءٍ لِوَقْتٍ آخَرَ', isCorrect: 1 },
          { textAr: 'أَتْرُكُ شَيْئًا', isCorrect: 0 },
          { textAr: 'أَبِيعُ شَيْئًا', isCorrect: 0 },
          { textAr: 'أُعْطِي شَيْئًا لِغَيْرِي', isCorrect: 0 },
        ],
      },
      {
        promptAr: 'لِمَاذَا كَانَتِ الجَرَادَةُ جَائِعَةً فِي الشِّتَاءِ؟',
        questionType: 'inferential',
        choices: [
          { textAr: 'لِأَنَّهَا لَمْ تَجْمَعِ الطَّعَامَ فِي الصَّيْفِ', isCorrect: 1 },
          { textAr: 'لِأَنَّ النَّمْلَةَ سَرَقَتْ طَعَامَهَا', isCorrect: 0 },
          { textAr: 'لِأَنَّ الشِّتَاءَ كَانَ قَصِيرًا', isCorrect: 0 },
          { textAr: 'لِأَنَّهَا غَنَّتْ كَثِيرًا', isCorrect: 0 },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------
  // Passage 4 — Level 14, ~65 words, theme: simple science
  // (Tashkeel stored; renderer hides for L14 per Phase 4 default)
  // ------------------------------------------------------------------
  {
    levelNumber: 14,
    titleAr: 'دَوْرَةُ المَاءِ',
    bodyAr:
      'عِنْدَمَا تَسْطَعُ الشَّمْسُ عَلَى البِحَارِ وَالأَنْهَارِ، يَتَبَخَّرُ المَاءُ وَيَصْعَدُ إِلَى السَّمَاءِ. هُنَاكَ يَتَحَوَّلُ إِلَى قَطَرَاتٍ صَغِيرَةٍ تَجْتَمِعُ مَعًا فَتُكَوِّنُ الغُيُومَ. وَعِنْدَمَا تَبْرُدُ هَذِهِ القَطَرَاتُ، تَسْقُطُ عَلَى الأَرْضِ مَطَرًا أَوْ ثَلْجًا. ثُمَّ يَعُودُ المَاءُ إِلَى البِحَارِ، وَتَبْدَأُ الدَّوْرَةُ مَرَّةً أُخْرَى.',
    questions: [
      {
        promptAr: 'مَاذَا يَحْدُثُ لِلْمَاءِ عِنْدَمَا تَسْطَعُ الشَّمْسُ؟',
        questionType: 'literal',
        choices: [
          { textAr: 'يَتَبَخَّرُ وَيَصْعَدُ إِلَى السَّمَاءِ', isCorrect: 1 },
          { textAr: 'يَتَجَمَّدُ', isCorrect: 0 },
          { textAr: 'يَخْتَفِي تَمَامًا', isCorrect: 0 },
          { textAr: 'يَتَحَوَّلُ إِلَى صَخْرَةٍ', isCorrect: 0 },
        ],
      },
      {
        promptAr: 'مَا مَعْنَى "يَتَبَخَّرُ"؟',
        questionType: 'vocabulary',
        choices: [
          { textAr: 'يَتَحَوَّلُ مِنْ سَائِلٍ إِلَى بُخَارٍ', isCorrect: 1 },
          { textAr: 'يَتَجَمَّدُ بِسُرْعَةٍ', isCorrect: 0 },
          { textAr: 'يَنْزِلُ إِلَى الأَرْضِ', isCorrect: 0 },
          { textAr: 'يَخْتَفِي فَجْأَةً', isCorrect: 0 },
        ],
      },
      {
        promptAr: 'مَا الَّذِي يَجْعَلُ الدَّوْرَةَ تَتَكَرَّرُ؟',
        questionType: 'inferential',
        choices: [
          { textAr: 'عَوْدَةُ المَاءِ إِلَى البِحَارِ وَتَبَخُّرُهُ مِنْ جَدِيدٍ', isCorrect: 1 },
          { textAr: 'تَوَقُّفُ الشَّمْسِ عَنِ السُّطُوعِ', isCorrect: 0 },
          { textAr: 'نُزُولُ المَطَرِ مَرَّةً وَاحِدَةً فَقَطْ', isCorrect: 0 },
          { textAr: 'اخْتِفَاءُ الغُيُومِ', isCorrect: 0 },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------
  // Passage 5 — Level 18, ~75 words, theme: abstract concept
  // (Tashkeel stored; renderer hides for L18 per Phase 4 default)
  // ------------------------------------------------------------------
  {
    levelNumber: 18,
    titleAr: 'قِيمَةُ الصَّبْرِ',
    bodyAr:
      'قَدْ يَظُنُّ بَعْضُ النَّاسِ أَنَّ النَّجَاحَ يَأْتِي بِسُرْعَةٍ، لَكِنَّ الحَقِيقَةَ أَنَّ كُلَّ إِنْجَازٍ كَبِيرٍ يَحْتَاجُ إِلَى وَقْتٍ طَوِيلٍ وَجُهْدٍ مُتَوَاصِلٍ. الطَّالِبُ الَّذِي يَتَعَلَّمُ لُغَةً جَدِيدَةً، وَالعَالِمُ الَّذِي يَكْتَشِفُ دَوَاءً، كِلَاهُمَا يَمُرَّانِ بِسَنَوَاتٍ مِنَ المُحَاوَلَةِ وَالفَشَلِ قَبْلَ أَنْ يَصِلَا إِلَى هَدَفِهِمَا. الصَّبْرُ لَيْسَ ضَعْفًا، بَلْ هُوَ القُوَّةُ الَّتِي تُحَوِّلُ الحُلْمَ إِلَى وَاقِعٍ.',
    questions: [
      {
        promptAr: 'مَا الَّذِي يَحْتَاجُهُ الإِنْجَازُ الكَبِيرُ؟',
        questionType: 'literal',
        choices: [
          { textAr: 'وَقْتٌ طَوِيلٌ وَجُهْدٌ مُتَوَاصِلٌ', isCorrect: 1 },
          { textAr: 'المَالُ فَقَطْ', isCorrect: 0 },
          { textAr: 'الحَظُّ وَحْدَهُ', isCorrect: 0 },
          { textAr: 'مُسَاعَدَةُ الآخَرِينَ دَائِمًا', isCorrect: 0 },
        ],
      },
      {
        promptAr: 'مَا المَقْصُودُ بِـ "الجُهْدُ المُتَوَاصِلُ"؟',
        questionType: 'vocabulary',
        choices: [
          { textAr: 'العَمَلُ المُسْتَمِرُّ دُونَ تَوَقُّفٍ', isCorrect: 1 },
          { textAr: 'اللَّعِبُ الطَّوِيلُ', isCorrect: 0 },
          { textAr: 'النَّوْمُ المُتَأَخِّرُ', isCorrect: 0 },
          { textAr: 'الكَلَامُ الكَثِيرُ', isCorrect: 0 },
        ],
      },
      {
        promptAr: 'مَا الفِكْرَةُ الرَّئِيسَةُ لِلنَّصِّ؟',
        questionType: 'inferential',
        choices: [
          { textAr: 'الصَّبْرُ ضَرُورِيٌّ لِتَحْقِيقِ النَّجَاحِ', isCorrect: 1 },
          { textAr: 'النَّجَاحُ يَأْتِي بِسُرْعَةٍ دَائِمًا', isCorrect: 0 },
          { textAr: 'العُلَمَاءُ لَا يَفْشَلُونَ أَبَدًا', isCorrect: 0 },
          { textAr: 'اللُّغَاتُ الجَدِيدَةُ صَعْبَةٌ', isCorrect: 0 },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const url = process.env.DIRECT_DATABASE_URL;
  if (!url)
    throw new Error(
      'DIRECT_DATABASE_URL is not set — cannot seed via RLS-bypassed superuser connection',
    );

  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client);

  // Idempotency guard: if 5+ placeholder texts already exist, skip.
  const existingCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(texts)
    .where(eq(texts.isPlaceholder, true));

  const count = Number(existingCount[0]?.count ?? 0);
  if (count >= 5) {
    console.log(
      `Placement bank already seeded (version 1). Found ${count} placeholder text(s). Exiting.`,
    );
    await client.end();
    process.exit(0);
  }

  // Look up level IDs for the 5 target levels.
  const levelRows = await db
    .select({ id: levels.id, number: levels.number })
    .from(levels)
    .where(sql`${levels.number} IN (2, 6, 10, 14, 18)`);

  const levelMap = new Map<number, string>();
  for (const row of levelRows) {
    levelMap.set(row.number, row.id);
  }

  // Verify all target levels exist in DB.
  const requiredLevels = [2, 6, 10, 14, 18];
  for (const num of requiredLevels) {
    if (!levelMap.has(num)) {
      throw new Error(`Level ${num} not found in DB. Run pnpm db:seed to seed levels first.`);
    }
  }

  console.log('Seeding placement placeholder bank (version 1)...');

  let totalTexts = 0;
  let totalQuestions = 0;
  let totalChoices = 0;

  for (const passage of PASSAGES) {
    const levelId = levelMap.get(passage.levelNumber) as string;
    const normalizedTitle = passage.titleAr.normalize('NFC');
    const normalizedBody = passage.bodyAr.normalize('NFC');
    const wordCount = normalizedBody.split(/\s+/).filter(Boolean).length;

    // Insert text row.
    const insertedTextRows = await db
      .insert(texts)
      .values({
        levelId,
        titleAr: normalizedTitle,
        bodyAr: normalizedBody,
        wordCount,
        genre: 'placeholder',
        isPlaceholder: true,
      })
      .returning({ id: texts.id });

    const insertedText = insertedTextRows[0];
    if (!insertedText)
      throw new Error(`Failed to insert text for passage level ${passage.levelNumber}`);

    totalTexts += 1;
    const textId = insertedText.id;

    // Insert questions for this passage.
    for (let qi = 0; qi < passage.questions.length; qi++) {
      const q = passage.questions[qi];
      if (!q) throw new Error(`Missing question at index ${qi} for level ${passage.levelNumber}`);

      const normalizedPrompt = q.promptAr.normalize('NFC');

      const insertedQuestionRows = await db
        .insert(questions)
        .values({
          kind: 'placement',
          textId,
          levelId,
          promptAr: normalizedPrompt,
          questionType: q.questionType,
          position: qi + 1,
          isPlaceholder: true,
        })
        .returning({ id: questions.id });

      const insertedQuestion = insertedQuestionRows[0];
      if (!insertedQuestion)
        throw new Error(`Failed to insert question ${qi + 1} for level ${passage.levelNumber}`);

      totalQuestions += 1;
      const questionId = insertedQuestion.id;

      // Insert choices for this question.
      for (let ci = 0; ci < q.choices.length; ci++) {
        const c = q.choices[ci];
        if (!c) throw new Error(`Missing choice at index ${ci} for question ${qi + 1}`);

        await db.insert(choices).values({
          questionId,
          textAr: c.textAr.normalize('NFC'),
          position: ci + 1,
          isCorrect: c.isCorrect,
        });
        totalChoices += 1;
      }
    }

    console.log(
      `  Inserted passage L${passage.levelNumber}: "${normalizedTitle}" (${wordCount} words)`,
    );
  }

  // Post-seed verification counts.
  const textCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(texts)
    .where(eq(texts.isPlaceholder, true));

  const questionCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(questions)
    .where(eq(questions.isPlaceholder, true));

  const textCountVal = Number(textCountRows[0]?.count ?? 0);
  const questionCountVal = Number(questionCountRows[0]?.count ?? 0);

  console.log(`\nSeed complete.`);
  console.log(`  Texts inserted this run:     ${totalTexts}`);
  console.log(`  Questions inserted this run: ${totalQuestions}`);
  console.log(`  Choices inserted this run:   ${totalChoices}`);
  console.log(`  Total placeholder texts in DB:     ${textCountVal}`);
  console.log(`  Total placeholder questions in DB: ${questionCountVal}`);
  console.log(`\nExpected: 5 texts, 15 questions, 60 choices.`);

  if (textCountVal !== 5) {
    console.error(`ERROR: Expected 5 placeholder texts, got ${textCountVal}`);
    await client.end();
    process.exit(1);
  }

  if (questionCountVal !== 15) {
    console.error(`ERROR: Expected 15 placeholder questions, got ${questionCountVal}`);
    await client.end();
    process.exit(1);
  }

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
