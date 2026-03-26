
export interface AISuggestion {
  category: string;
  name: string;
  price: number;
  variations?: Record<string, number>; // e.g. { 'Hot': 0, 'Iced': 10, 'Small': 0, 'Large': 20 }
}

export const scanMenuWithAI = async (input: string | File): Promise<AISuggestion[]> => {
  let content: any[] = [];
  const prompt = `You are a professional menu digitizer. Your task is to extract ALL categories, products, and prices from the provided menu (image or text).

CRITICAL INSTRUCTIONS:
1. Extract EVERY single item. Do not skip anything.
2. Identify variations (e.g., 'Hot' vs 'Iced', 'Small' vs 'Medium' vs 'Large', 'Solo' vs 'Sharing').
3. For variations, determine the BASE price (usually the lowest price or the first one listed) and the price OFFSETS for other variations.
4. Return ONLY a valid JSON array of objects. No markdown formatting, no preamble.

JSON Structure:
[
  {
    "category": "Category Name",
    "name": "Product Name",
    "price": 120, // Base price
    "variations": {
      "Hot": 0,
      "Iced": 15, // Price is 135 (120 + 15)
      "Large": 20 // Price is 140 (120 + 20)
    }
  }
]

If a product has no variations, the "variations" field should be an empty object {}.
If multiple sizes are listed like "S: 100, M: 120, L: 140", use 100 as base price and variations as {"S": 0, "M": 20, "L": 40}.`;

  if (typeof input === 'string') {
    content.push({ type: 'text', text: `${prompt} Menu text: ${input}` });
  } else {
    const base64 = await fileToBase64(input);
    content.push({ type: 'text', text: prompt });
    content.push({
      type: 'image_url',
      image_url: { url: `data:${input.type};base64,${base64}` }
    });
  }

  const response = await fetch("/api/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ content })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to scan menu');
  }

  const data = await response.json();
  const text = data.choices[0].message.content;
  
  // Extract JSON from response (sometimes models wrap it in markdown)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  throw new Error('Could not parse AI response');
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};
