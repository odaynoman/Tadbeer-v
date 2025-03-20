import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI('AIzaSyDgNboDtt2ncO1nHCk4e5BLNeOSEBb_2Lw');

interface UserContext {
  ingredients: string[];
  mealType: string;
  servings: number;
  lastRecipe?: string;
  imageIngredients?: string[];
}

const userContexts = new Map<string, UserContext>();

const modelConfig = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 1024,
};

export async function generateRecipe(
  userId: string,
  ingredients: string,
  mealType: string,
  servings: number,
  message?: string
) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      ...modelConfig 
    });

    // Get or create user context
    const context = userContexts.get(userId) || {
      ingredients: [],
      mealType: 'عام',
      servings: 4,
      imageIngredients: []
    };

    // Merge previous ingredients while avoiding duplicates
    const newIngredientsSet = new Set([
      ...context.ingredients,
      ...ingredients.split(/[،,]/).map(i => i.trim()).filter(i => i)
    ]);
    const newIngredients = Array.from(newIngredientsSet);

    const enhancedPrompt = buildPrompt(
      newIngredients,
      context.imageIngredients || [],
      mealType || context.mealType,
      servings || context.servings,
      message,
      context.lastRecipe
    );

    const result = await model.generateContent(enhancedPrompt);
    const response = await result.response;
    const responseText = response.text();

    // Update user context
    userContexts.set(userId, {
      ingredients: newIngredients,
      mealType: mealType || context.mealType,
      servings: servings || context.servings,
      lastRecipe: responseText,
      imageIngredients: context.imageIngredients
    });

    return responseText;
  } catch (error) {
    console.error('Error generating recipe:', error);
    throw new Error('عذراً، حدث خطأ في إنشاء الوصفة. الرجاء المحاولة مرة أخرى.');
  }
}

export async function analyzeImage(userId: string, imageData: string) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-pro-vision',
      ...modelConfig 
    });

    // Remove the data URL prefix if it exists
    const base64Data = imageData.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const prompt = `
أنت خبير في تحليل الصور وتحديد المكونات الغذائية. مهمتك هي:
1. تحديد جميع المكونات الغذائية الظاهرة في الصورة
2. تقدير الكميات التقريبية لكل مكون إن أمكن
3. ذكر حالة المكونات (طازجة، ناضجة، إلخ)

قم بإدراج المكونات بالتنسيق التالي:
- اسم المكون: الكمية التقريبية (إن وجدت) + الحالة

مثال:
- طماطم: 3 حبات متوسطة، ناضجة
- خيار: 2 حبة، طازج
- بصل: 1 حبة كبيرة

ملاحظة: ركز فقط على المكونات الغذائية وتجاهل أي عناصر أخرى في الصورة.
`;

    const result = await model.generateContent([
      { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
      prompt
    ]);
    
    const response = await result.response;
    const analysisText = response.text();
    
    // Extract ingredients from the analysis
    const ingredients = analysisText
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace('-', '').trim());

    // Update user context with image ingredients
    const context = userContexts.get(userId) || { ingredients: [], mealType: 'عام', servings: 4 };
    context.imageIngredients = ingredients;
    userContexts.set(userId, context);

    return `تم تحليل الصورة:\n${ingredients.join('\n')}`;
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw new Error('عذراً، حدث خطأ في تحليل الصورة. الرجاء المحاولة مرة أخرى.');
  }
}

function buildPrompt(
  ingredients: string[],
  imageIngredients: string[],
  mealType: string,
  servings: number,
  message?: string,
  lastRecipe?: string
): string {
  return `
 أنت مساعد ذكي وتفاعلي إسمك تدبير. متخصص في تقليل هدر الطعام. مهمتك هي مساعدة المستخدمين في استغلال المكونات المتوفرة لديهم بأفضل طريقة ممكنة. ترد على الأسئلة بتفاعلية وسلاسة.

قواعد التفاعل:
1. رد على الأسئلة بتفاعلية ومختصرة، ولا يجب ان ترد كأنها طريقة آلية
2. دائمًا يبدأ اي حديث بشكل عشوائي، ومهمتك هي توجيه الحديث إلى نطاق تخصصك بشكل تفاعلي.
3. إذا سأل عن موضوع خارج نطاق الطعام والوصفات، اعتذر بلطف واعد توجيه المحادثة نحو:
   - تقليل هدر الطعام
   - إيجاد وصفات من المكونات المتوفرة
   - تقديم نصائح عن حفظ الطعام
   - اقتراح طرق لاستخدام بقايا الطعام
4. كن مبادراً في تقديم النصائح والاقتراحات المفيدة
5. اجعل المحادثة طبيعية وتفاعلية
6. ابدأ دائماً بتحليل المكونات المذكورة وحدد:
   - المكونات التي قد تفسد سريعاً وتحتاج لاستخدام فوري
   - المكونات التي يمكن حفظها لوقت أطول
   - أفضل طريقة لتخزين كل مكون

ملاحظة: فقط في بداية المحداثة او عند إضافة مكونات جديدة.
ملاحظة مهمة: يجب ان تكون كامل المحادثة سلسة وتفاعلية ولا تعطي انطباع ان المتحدث روبوت.

7. عند اقتراح الوصفات:
   - اقترح وصفات تستخدم أكبر قدر ممكن من المكونات المتوفرة
   - قدم نصائح عن كيفية حفظ أي مكونات متبقية
   - اشرح كيف يمكن تجميد أو حفظ الوجبة الجاهزة لوقت لاحق

8. قدم نصائح عملية:
   - طرق تخزين ذكية للحفاظ على الطعام لفترة أطول
   - علامات تدل على صلاحية الطعام
   - كيفية استخدام بقايا الطعام بطرق مبتكرة

9. كن مبادراً في:
   - تقديم بدائل للمكونات التي قد تفسد
   - اقتراح طرق لمشاركة الطعام الزائد
   - تقديم نصائح للتسوق الذكي في المستقبل


معلومات الطلب الحالي:
- الرسالة: ${message || "لا توجد رسالة محددة"}
- المكونات المتوفرة: ${[...ingredients, ...imageIngredients].join(', ')}
- نوع الوجبة: ${mealType}
- عدد الأشخاص: ${servings}
${lastRecipe ? '- الوصفة السابقة: ' + lastRecipe : ''}

تنسيق الإجابة:
- إذا كانت الرسالة تحية أو سؤال عام: رد بشكل ودي وتفاعلي
- إذا كان الطلب خارج نطاق تخصصك: اعتذر بلطف واشرح كيف يمكنك المساعدة
- إذا كان طلب وصفة: قدم الوصفة بالتنسيق التالي:

 إذا كان هناك مكونات:
   {تحليل سريع للمكونات وأولوية استخدامها}

   {اسم الوصفة المقترحة}

المكونات:
{قائمة المكونات مع الكميات}

طريقة التحضير:
{خطوات مرقمة}

   نصائح لتقليل الهدر:
   - نصائح لتخزين المكونات المتبقية
   - اقتراحات لاستخدام البقايا
   - طرق حفظ الوجبة الجاهزة

{نصائح مفيدة عن الوصفة وتقليل الهدر}
ملاحظة: تجنب التكرار وحافظ على إجاباتك موجزة ومنظمة
`;
}

// Clear context when needed
export function clearUserContext(userId: string) {
  userContexts.delete(userId);
}

export async function generateChatTitle(message: string) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      ...modelConfig 
    });

    const prompt = `
قم بتحليل الرسالة التالية وإنشاء عنوان قصير ومناسب للمحادثة (لا يتجاوز 5 كلمات):
"${message}"

القواعد:
- العنوان يجب أن يكون قصيراً وواضحاً
- يجب أن يعكس الموضوع الرئيسي للمحادثة
- لا تستخدم علامات الترقيم في النهاية
- أعد فقط العنوان بدون أي نص إضافي

مثال:
إذا كانت الرسالة: "عندي بقايا خبز وجبن وطماطم، ماذا يمكنني أن أعمل بها؟"
العنوان: "وصفات لبقايا الخبز والجبن"
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Error generating chat title:', error);
    return 'محادثة جديدة';
  }
}
