import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';

export interface GeneratedFlashcard {
  back: string;
  front: string;
}

export interface GenerateFlashcardsInput {
  cardCount?: number;
  sourceText: string;
}

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

if (!geminiApiKey) {
  throw new Error('Missing required environment variable: GEMINI_API_KEY');
}

const genAI = new GoogleGenerativeAI(geminiApiKey);

const flashcardSchema: Schema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      front: {
        type: SchemaType.STRING,
      },
      back: {
        type: SchemaType.STRING,
      },
    },
    required: ['front', 'back'],
  },
};

function isGeneratedFlashcard(value: unknown): value is GeneratedFlashcard {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const card = value as Record<string, unknown>;

  return typeof card.front === 'string' && card.front.trim().length > 0
    && typeof card.back === 'string' && card.back.trim().length > 0;
}

export async function generateFlashcards({
  cardCount = 5,
  sourceText,
}: GenerateFlashcardsInput): Promise<GeneratedFlashcard[]> {
  const trimmedSource = sourceText.trim();

  if (!trimmedSource) {
    throw new Error('sourceText is required');
  }

  const model = genAI.getGenerativeModel({
    model: geminiModel,
    generationConfig: {
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: flashcardSchema,
      temperature: 0.4,
    },
    systemInstruction: `You create concise study flashcards from notes.
Return only JSON matching the requested schema.
Each card must test a single idea.
Use clear front prompts and factual back answers.
Do not mention the source text or add explanations outside the schema.`,
  });

  const prompt = `Create ${cardCount} flashcards from the study notes below.
Prefer high-value concepts, definitions, mechanisms, and comparisons.
Keep the front side short and make the back side self-contained.

Study notes:
${trimmedSource}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = JSON.parse(text) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('Gemini returned an invalid flashcard payload');
  }

  const cards = parsed.filter(isGeneratedFlashcard).map(card => ({
    front: card.front.trim(),
    back: card.back.trim(),
  }));

  if (cards.length === 0) {
    throw new Error('Gemini did not return any usable flashcards');
  }

  return cards;
}
