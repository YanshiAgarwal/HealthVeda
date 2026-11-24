// Prakriti (body-type) quiz. Each answer adds 1 point to one dosha.
export const QUESTIONS = [
  {
    question: "How would you describe your body frame?",
    options: {
      vata: "Thin, light, I find it hard to gain weight",
      pitta: "Medium, athletic, muscular",
      kapha: "Broad, solid, I gain weight easily",
    },
  },
  {
    question: "What is your skin usually like?",
    options: {
      vata: "Dry, rough, gets chapped easily",
      pitta: "Warm, sensitive, prone to rashes or acne",
      kapha: "Smooth, soft, slightly oily",
    },
  },
  {
    question: "How is your appetite?",
    options: {
      vata: "Irregular - sometimes hungry, sometimes not",
      pitta: "Strong - I get irritable if I skip a meal",
      kapha: "Steady - I can skip meals without trouble",
    },
  },
  {
    question: "How do you usually sleep?",
    options: {
      vata: "Light sleeper, I wake up easily",
      pitta: "Moderate, sound sleep of 6-7 hours",
      kapha: "Deep and long, hard to wake up",
    },
  },
  {
    question: "Which weather bothers you most?",
    options: {
      vata: "Cold and windy",
      pitta: "Hot and sunny",
      kapha: "Cold and damp",
    },
  },
  {
    question: "How do you react under stress?",
    options: {
      vata: "I get anxious and worried",
      pitta: "I get angry or irritated",
      kapha: "I stay calm but may withdraw",
    },
  },
  {
    question: "How do you speak?",
    options: {
      vata: "Fast, I talk a lot",
      pitta: "Sharp, clear and convincing",
      kapha: "Slow, calm and soft",
    },
  },
  {
    question: "How is your digestion?",
    options: {
      vata: "Gas, bloating or constipation",
      pitta: "Acidity or loose stools",
      kapha: "Slow and heavy after meals",
    },
  },
  {
    question: "How do you learn and remember?",
    options: {
      vata: "Learn quickly, forget quickly",
      pitta: "Sharp and focused memory",
      kapha: "Learn slowly but never forget",
    },
  },
  {
    question: "What describes your energy best?",
    options: {
      vata: "Bursts of energy, then I tire out",
      pitta: "Intense and goal-driven",
      kapha: "Steady with great stamina",
    },
  },
];

export const DOSHAS = {
  vata: {
    name: "Vata",
    elements: "Air + Space",
    color: "#7c9eb2",
    emoji: "🌬️",
    summary:
      "Creative, quick and full of ideas. When out of balance, Vata brings dryness, anxiety, poor sleep and digestion that comes and goes.",
    diet: ["Warm, cooked, slightly oily food", "Sweet, sour and salty tastes", "Ginger tea, ghee, soups", "Avoid cold drinks and raw salads"],
    lifestyle: ["Keep a fixed daily routine", "Warm sesame-oil massage (Abhyanga)", "Sleep by 10 pm", "Stay warm in cold weather"],
    yoga: ["Balasana (child's pose)", "Vrikshasana (tree pose)", "Nadi Shodhana breathing"],
  },
  pitta: {
    name: "Pitta",
    elements: "Fire + Water",
    color: "#fd7c10",
    emoji: "🔥",
    summary:
      "Focused, sharp and a natural leader. When out of balance, Pitta brings acidity, anger, skin rashes and overheating.",
    diet: ["Cooling food: cucumber, coconut, melons", "Sweet, bitter and astringent tastes", "Mint and coriander water", "Avoid spicy, fried and sour food"],
    lifestyle: ["Avoid the midday sun", "Take breaks - don't overwork", "Moonlight walks, swimming", "Practise patience and play"],
    yoga: ["Shitali pranayama (cooling breath)", "Bhujangasana (cobra)", "Chandra Namaskar (moon salutation)"],
  },
  kapha: {
    name: "Kapha",
    elements: "Earth + Water",
    color: "#37965b",
    emoji: "🌿",
    summary:
      "Calm, loving and steady with great stamina. When out of balance, Kapha brings weight gain, sluggishness, congestion and low motivation.",
    diet: ["Light, warm and spiced food", "Pungent, bitter and astringent tastes", "Honey, ginger, black pepper", "Avoid heavy, sweet and dairy-rich food"],
    lifestyle: ["Wake up before 6 am", "Daily brisk exercise", "Try new activities", "Avoid daytime naps"],
    yoga: ["Surya Namaskar (sun salutation)", "Kapalabhati breathing", "Ustrasana (camel pose)"],
  },
};
