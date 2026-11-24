"""
phrases.py
----------
Everything the voice assistant SAYS that is not an AI answer:
greetings, "thinking..." fillers, follow-up prompts and goodbyes,
in English + 10 Indian languages.

  * Phrases are pre-written in every language, so we don't need to call a
    translation API for them (faster replies).
  * Several options per phrase are picked at random so it sounds natural.
  * is_exit_intent() detects "thank you / bye / shukriya ..." to end a chat.
"""

import random

# ─────────────────────────────────────────────────────────────
# Exit trigger keywords  (matched against the English transcript)
# Saaras translates everything to English so we only need English
# equivalents here, but we include the Romanised originals too
# because Saaras sometimes keeps them as-is.
# ─────────────────────────────────────────────────────────────
EXIT_TRIGGERS: set[str] = {
    # English
    "thank you", "thanks", "thank you so much", "thanks a lot",
    "that's all", "that is all", "that will be all",
    "goodbye", "good bye", "bye", "bye bye",
    "exit", "quit", "stop", "end",
    "no more questions", "nothing else",
    # Hindi (Romanised — Saaras may leave these untranslated)
    "shukriya", "dhanyavaad", "dhanyawad", "bahut shukriya",
    "bas", "theek hai bas", "alvida",
    # Tamil
    "nandri", "romba nandri", "poitten", "sari",
    # Telugu
    "dhanyavaadalu", "chalu", "veltanu",
    # Bengali
    "dhonyobad", "onek dhonyobad", "cholun",
    # Kannada
    "dhanyavadagalu", "saku", "hoguttene",
    # Malayalam
    "nanni", "nandhi", "mathi", "pokunnu",
    # Marathi
    "dhanyawaad", "bas zala", "theek ahe",
    # Gujarati
    "aabhar", "bas", "alvida",
    # Punjabi
    "shukriya", "bahut bahut shukriya", "theek aa",
}


def is_exit_intent(english_transcript: str) -> bool:
    """
    Return True if the transcript matches an exit/thank-you trigger.
    Case-insensitive, strips punctuation for robustness.
    """
    text = english_transcript.lower().strip(" .,!?।")
    # Exact match
    if text in EXIT_TRIGGERS:
        return True
    # Substring match for short phrases embedded in longer sentences
    for trigger in EXIT_TRIGGERS:
        if len(trigger) > 4 and trigger in text:
            return True
    return False


# ─────────────────────────────────────────────────────────────
# Phrase bank
# Structure:  PHRASES[key][lang_code] = list of strings
# Caller picks one with get_phrase(key, lang_code)
# ─────────────────────────────────────────────────────────────

PHRASES: dict[str, dict[str, list[str]]] = {

    # ── Startup: spoken while RAG + Sarvam are loading ────────
    "loading": {
        "en-IN": [
            "Namaste! I am HealthVeda, your Ayurvedic guide. "
            "I am waking up — please give me a moment.",
        ],
        "hi-IN": [
            "नमस्ते! मैं हेल्थवेद हूँ, आपका आयुर्वेदिक मार्गदर्शक। "
            "मैं तैयार हो रहा हूँ — कृपया एक पल रुकें।",
        ],
        "ta-IN": [
            "வணக்கம்! நான் ஹெல்த்வேதா, உங்கள் ஆயுர்வேத வழிகாட்டி. "
            "நான் தயாராகிறேன் — ஒரு நிமிடம் காத்திருங்கள்.",
        ],
        "te-IN": [
            "నమస్కారం! నేను హెల్త్‌వేద, మీ ఆయుర్వేద మార్గదర్శి. "
            "నేను సిద్ధమవుతున్నాను — దయచేసి ఒక్క నిమిషం వేచి ఉండండి.",
        ],
        "bn-IN": [
            "নমস্কার! আমি হেলথবেদ, আপনার আয়ুর্বেদিক গাইড। "
            "আমি প্রস্তুত হচ্ছি — অনুগ্রহ করে একটু অপেক্ষা করুন।",
        ],
        "gu-IN": [
            "નમસ્તે! હું હેલ્થવેદ છું, તમારો આયુર્વેદિક માર્ગદર્શક. "
            "હું તૈયાર થઈ રહ્યો છું — કૃપા કરી એક ક્ષણ રાહ જુઓ.",
        ],
        "kn-IN": [
            "ನಮಸ್ಕಾರ! ನಾನು ಹೆಲ್ತ್‌ವೇದ, ನಿಮ್ಮ ಆಯುರ್ವೇದ ಮಾರ್ಗದರ್ಶಿ. "
            "ನಾನು ಸಿದ್ಧವಾಗುತ್ತಿದ್ದೇನೆ — ದಯವಿಟ್ಟು ಒಂದು ಕ್ಷಣ ನಿರೀಕ್ಷಿಸಿ.",
        ],
        "ml-IN": [
            "നമസ്കാരം! ഞാൻ ഹെൽത്ത്‌വേദ, നിങ്ങളുടെ ആയുർവേദ വഴികാട്ടി. "
            "ഞാൻ തയ്യാറാകുന്നു — ദയവായി ഒരു നിമിഷം കാത്തിരിക്കൂ.",
        ],
        "mr-IN": [
            "नमस्कार! मी हेल्थवेद आहे, तुमचा आयुर्वेदिक मार्गदर्शक. "
            "मी तयार होत आहे — कृपया एक क्षण थांबा.",
        ],
        "pa-IN": [
            "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਹੈਲਥਵੇਦ ਹਾਂ, ਤੁਹਾਡਾ ਆਯੁਰਵੈਦਿਕ ਮਾਰਗਦਰਸ਼ਕ. "
            "ਮੈਂ ਤਿਆਰ ਹੋ ਰਿਹਾ ਹਾਂ — ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਪਲ ਉਡੀਕ ਕਰੋ।",
        ],
        "od-IN": [
            "ନମସ୍କାର! ମୁଁ ହେଲଥବେଦ, ଆପଣଙ୍କ ଆୟୁର୍ବେଦ ମାର୍ଗଦର୍ଶକ। "
            "ମୁଁ ପ୍ରସ୍ତୁତ ହେଉଛି — ଦୟାକରି ଏକ ମୁହୂର୍ତ ଅପେକ୍ଷା କରନ୍ତୁ।",
        ],
    },

    # ── Ready: spoken once everything is loaded ────────────────
    "ready": {
        "en-IN": [
            "I am ready. Please tell me your health concern.",
            "HealthVeda is ready. How can I help you today?",
            "All set! Please speak your question.",
        ],
        "hi-IN": [
            "मैं तैयार हूँ। कृपया अपनी स्वास्थ्य समस्या बताएं।",
            "हेल्थवेद तैयार है। आज मैं आपकी कैसे मदद कर सकता हूँ?",
            "सब तैयार है! कृपया अपना प्रश्न बोलें।",
        ],
        "ta-IN": [
            "நான் தயார். உங்கள் உடல்நலப் பிரச்சினையை சொல்லுங்கள்.",
            "ஹெல்த்வேதா தயார். இன்று நான் உங்களுக்கு எப்படி உதவலாம்?",
        ],
        "te-IN": [
            "నేను సిద్ధంగా ఉన్నాను. దయచేసి మీ ఆరోగ్య సమస్యను చెప్పండి.",
            "హెల్త్‌వేద సిద్ధంగా ఉంది. ఈరోజు నేను మీకు ఎలా సహాయం చేయగలను?",
        ],
        "bn-IN": [
            "আমি প্রস্তুত। আপনার স্বাস্থ্য সমস্যা বলুন।",
            "হেলথবেদ প্রস্তুত। আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
        ],
        "gu-IN": [
            "હું તૈયાર છું. કૃપા કરી તમારી સ્વાસ્થ્ય સમસ્યા જણાવો.",
            "હેલ્થવેદ તૈયાર છે. આજે હું તમારી કેવી રીતે મદદ કરી શકું?",
        ],
        "kn-IN": [
            "ನಾನು ಸಿದ್ಧ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಆರೋಗ್ಯ ಸಮಸ್ಯೆ ಹೇಳಿ.",
            "ಹೆಲ್ತ್‌ವೇದ ಸಿದ್ಧವಾಗಿದೆ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
        ],
        "ml-IN": [
            "ഞാൻ തയ്യാർ. ദയവായി നിങ്ങളുടെ ആരോഗ്യ പ്രശ്നം പറയൂ.",
            "ഹെൽത്ത്‌വേദ തയ്യാർ. ഇന്ന് ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കാം?",
        ],
        "mr-IN": [
            "मी तयार आहे. कृपया तुमची आरोग्य समस्या सांगा.",
            "हेल्थवेद तयार आहे. आज मी तुम्हाला कशी मदत करू शकतो?",
        ],
        "pa-IN": [
            "ਮੈਂ ਤਿਆਰ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਸਿਹਤ ਸਮੱਸਿਆ ਦੱਸੋ।",
            "ਹੈਲਥਵੇਦ ਤਿਆਰ ਹੈ। ਅੱਜ ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?",
        ],
        "od-IN": [
            "ମୁଁ ପ୍ରସ୍ତୁତ। ଦୟାକରି ଆପଣଙ୍କ ସ୍ୱାସ୍ଥ୍ୟ ସମସ୍ୟା କୁହନ୍ତୁ।",
        ],
    },

    # ── Thinking fillers: spoken while RAG is processing ──────
    "thinking": {
        "en-IN": [
            "Let me consult the Ayurvedic texts for you.",
            "Searching through the ancient remedies, one moment.",
            "Let me look into this for you.",
            "Hmm, let me think about this carefully.",
            "Consulting the wisdom of Ayurveda, please hold on.",
            "Going through the Ayurvedic knowledge base for you.",
        ],
        "hi-IN": [
            "मैं आपके लिए आयुर्वेदिक ग्रंथों में देख रहा हूँ।",
            "प्राचीन उपचारों में खोज कर रहा हूँ, एक पल।",
            "आयुर्वेद के ज्ञान से परामर्श ले रहा हूँ, ज़रा रुकें।",
            "इस पर ध्यान से सोच रहा हूँ।",
            "बस एक पल, जानकारी ढूंढ रहा हूँ।",
        ],
        "ta-IN": [
            "ஆயுர்வேத நூல்களை ஆலோசிக்கிறேன், ஒரு நிமிடம்.",
            "பண்டைய மருத்துவத்தில் தேடுகிறேன்.",
            "ஆயுர்வேதத்தின் ஞானத்தை பார்க்கிறேன்.",
        ],
        "te-IN": [
            "ఆయుర్వేద గ్రంథాలు చూస్తున్నాను, ఒక్క నిమిషం.",
            "పురాతన వైద్యంలో వెతుకుతున్నాను.",
            "ఆయుర్వేద జ్ఞానాన్ని సంప్రదిస్తున్నాను.",
        ],
        "bn-IN": [
            "আয়ুর্বেদিক গ্রন্থ দেখছি, একটু অপেক্ষা করুন।",
            "প্রাচীন চিকিৎসায় খুঁজছি।",
            "আয়ুর্বেদের জ্ঞান থেকে পরামর্শ নিচ্ছি।",
        ],
        "gu-IN": [
            "આયુર્વેદિક ગ્રંથો જોઈ રહ્યો છું, એક ક્ષણ.",
            "પ્રાચીન ઉપચારોમાં શોધ કરી રહ્યો છું.",
            "આયુર્વેદના જ્ઞાનની સલાહ લઈ રહ્યો છું.",
        ],
        "kn-IN": [
            "ಆಯುರ್ವೇದ ಗ್ರಂಥಗಳನ್ನು ನೋಡುತ್ತಿದ್ದೇನೆ, ಒಂದು ಕ್ಷಣ.",
            "ಪ್ರಾಚೀನ ಚಿಕಿತ್ಸೆಯಲ್ಲಿ ಹುಡುಕುತ್ತಿದ್ದೇನೆ.",
            "ಆಯುರ್ವೇದದ ಜ್ಞಾನ ಸಂಪರ್ಕಿಸುತ್ತಿದ್ದೇನೆ.",
        ],
        "ml-IN": [
            "ആയുർവേദ ഗ്രന്ഥങ്ങൾ പരിശോധിക്കുന്നു, ഒരു നിമിഷം.",
            "പ്രാചീന ചികിത്സയിൽ തിരയുന്നു.",
            "ആയുർവേദ ജ്ഞാനം ആലോചിക്കുന്നു.",
        ],
        "mr-IN": [
            "आयुर्वेदिक ग्रंथ पाहत आहे, एक क्षण.",
            "प्राचीन उपचारांमध्ये शोध घेत आहे.",
            "आयुर्वेदाच्या ज्ञानाचा सल्ला घेत आहे.",
        ],
        "pa-IN": [
            "ਆਯੁਰਵੈਦਿਕ ਗ੍ਰੰਥਾਂ ਵਿੱਚ ਵੇਖ ਰਿਹਾ ਹਾਂ, ਇੱਕ ਪਲ।",
            "ਪ੍ਰਾਚੀਨ ਇਲਾਜਾਂ ਵਿੱਚ ਲੱਭ ਰਿਹਾ ਹਾਂ।",
            "ਆਯੁਰਵੇਦ ਦੇ ਗਿਆਨ ਤੋਂ ਸਲਾਹ ਲੈ ਰਿਹਾ ਹਾਂ।",
        ],
        "od-IN": [
            "ଆୟୁର୍ବେଦ ଗ୍ରନ୍ଥ ଦେଖୁଛି, ଏକ ମୁହୂର୍ତ।",
            "ପ୍ରାଚୀନ ଚିକିତ୍ସାରେ ଖୋଜୁଛି।",
        ],
    },

    # ── Translating filler: while Sarvam Translate is running ──
    "translating": {
        "en-IN": ["Preparing the response for you..."],
        "hi-IN": ["आपके लिए उत्तर तैयार कर रहा हूँ..."],
        "ta-IN": ["உங்களுக்கான பதிலை தயாரிக்கிறேன்..."],
        "te-IN": ["మీకు సమాధానం సిద్ధం చేస్తున్నాను..."],
        "bn-IN": ["আপনার জন্য উত্তর প্রস্তুত করছি..."],
        "gu-IN": ["તમારા માટે જવાબ તૈયાર કરી રહ્યો છું..."],
        "kn-IN": ["ನಿಮಗಾಗಿ ಉತ್ತರ ತಯಾರಿಸುತ್ತಿದ್ದೇನೆ..."],
        "ml-IN": ["നിങ്ങൾക്കുള്ള മറുപടി തയ്യാറാക്കുന്നു..."],
        "mr-IN": ["तुमच्यासाठी उत्तर तयार करत आहे..."],
        "pa-IN": ["ਤੁਹਾਡੇ ਲਈ ਜਵਾਬ ਤਿਆਰ ਕਰ ਰਿਹਾ ਹਾਂ..."],
        "od-IN": ["ଆପଣଙ୍କ ପାଇଁ ଉତ୍ତର ପ୍ରସ୍ତୁତ କରୁଛି..."],
    },

    # ── Farewell: spoken on exit intent ───────────────────────
    "farewell": {
        "en-IN": [
            "Take care and stay healthy. May Ayurveda guide your wellness. Goodbye!",
            "It was my pleasure helping you. Stay well, goodbye!",
            "Thank you for consulting HealthVeda. Wishing you good health!",
        ],
        "hi-IN": [
            "अपना ख्याल रखें और स्वस्थ रहें। आयुर्वेद आपका मार्गदर्शन करे। अलविदा!",
            "आपकी सेवा करके खुशी हुई। स्वस्थ रहें, अलविदा!",
            "हेल्थवेद से परामर्श लेने के लिए धन्यवाद। आपको अच्छे स्वास्थ्य की शुभकामनाएं!",
        ],
        "ta-IN": [
            "கவலைப்படாதீர்கள், ஆரோக்கியமாக இருங்கள். ஆயுர்வேதம் உங்களை வழிநடத்தட்டும். வணக்கம்!",
            "உங்களுக்கு உதவியதில் மகிழ்ச்சி. நலமாக இருங்கள், போய் வாருங்கள்!",
        ],
        "te-IN": [
            "జాగ్రత్తగా ఉండండి మరియు ఆరోగ్యంగా ఉండండి. ఆయుర్వేదం మీకు మార్గం చూపిస్తుంది. వీడ్కోలు!",
            "మీకు సేవ చేయడం సంతోషంగా ఉంది. మంచి ఆరోగ్యంతో ఉండండి!",
        ],
        "bn-IN": [
            "যত্ন নিন এবং সুস্থ থাকুন। আয়ুর্বেদ আপনাকে পথ দেখাক। বিদায়!",
            "আপনাকে সাহায্য করতে পেরে আনন্দিত। ভালো থাকুন!",
        ],
        "gu-IN": [
            "ધ્યાન રાખો અને સ્વસ્થ રહો. આયુર્વેદ તમને માર્ગ બતાવે. આવજો!",
            "તમારી સેવા કરીને ખુશી થઈ. સ્વસ્થ રહો!",
        ],
        "kn-IN": [
            "ಚೆನ್ನಾಗಿ ನೋಡಿಕೊಳ್ಳಿ ಮತ್ತು ಆರೋಗ್ಯದಿಂದ ಇರಿ. ಆಯುರ್ವೇದ ನಿಮ್ಮನ್ನು ಮಾರ್ಗದರ್ಶಿಸಲಿ. ವಿದಾಯ!",
            "ನಿಮಗೆ ಸೇವೆ ಮಾಡಿದ್ದಕ್ಕೆ ಸಂತೋಷ. ಆರೋಗ್ಯದಿಂದ ಇರಿ!",
        ],
        "ml-IN": [
            "ശ്രദ്ധിക്കൂ, ആരോഗ്യത്തോടെ ഇരിക്കൂ. ആയുർവേദം നിങ്ങളെ നയിക്കട്ടെ. വിട!",
            "നിങ്ങളെ സഹായിക്കാൻ കഴിഞ്ഞതിൽ സന്തോഷം. നന്നായിരിക്കൂ!",
        ],
        "mr-IN": [
            "काळजी घ्या आणि निरोगी राहा. आयुर्वेद तुम्हाला मार्गदर्शन करो. निरोप!",
            "तुमची सेवा करताना आनंद झाला. स्वस्थ राहा!",
        ],
        "pa-IN": [
            "ਆਪਣਾ ਖਿਆਲ ਰੱਖੋ ਅਤੇ ਤੰਦਰੁਸਤ ਰਹੋ। ਆਯੁਰਵੇਦ ਤੁਹਾਡੀ ਅਗਵਾਈ ਕਰੇ। ਅਲਵਿਦਾ!",
            "ਤੁਹਾਡੀ ਸੇਵਾ ਕਰਕੇ ਖੁਸ਼ੀ ਹੋਈ। ਤੰਦਰੁਸਤ ਰਹੋ!",
        ],
        "od-IN": [
            "ଯତ୍ନ ନିଅନ୍ତୁ ଏବଂ ସୁସ୍ଥ ରୁହନ୍ତୁ। ଆୟୁର୍ବେଦ ଆପଣଙ୍କୁ ମାର୍ଗଦର୍ଶନ କରୁ। ବିଦାୟ!",
        ],
    },

    # ── Follow-up prompt: after answer is spoken ─────────────
    "followup_prompt": {
        "en-IN": [
            "Do you have any follow-up questions?",
            "Feel free to ask anything else.",
            "Is there anything else you would like to know?",
        ],
        "hi-IN": [
            "क्या आपके कोई और प्रश्न हैं?",
            "आप कुछ और पूछना चाहते हैं?",
            "क्या आप कुछ और जानना चाहेंगे?",
        ],
        "ta-IN": [
            "உங்களுக்கு வேறு ஏதாவது கேள்விகள் உள்ளதா?",
            "வேறு எதாவது கேட்க விரும்புகிறீர்களா?",
        ],
        "te-IN": [
            "మీకు మరిన్ని ప్రశ్నలు ఉన్నాయా?",
            "మరేమైనా అడగాలనుకుంటున్నారా?",
        ],
        "bn-IN": [
            "আপনার কি আরও কোনো প্রশ্ন আছে?",
            "আর কিছু জানতে চান?",
        ],
        "gu-IN": [
            "શું તમારે બીજા કોઈ પ્રશ્નો છે?",
            "બીજું કંઈ પૂછવું છે?",
        ],
        "kn-IN": [
            "ನಿಮಗೆ ಇನ್ನಷ್ಟು ಪ್ರಶ್ನೆಗಳಿವೆಯೇ?",
            "ಬೇರೇನಾದರೂ ಕೇಳಲು ಬಯಸುತ್ತೀರಾ?",
        ],
        "ml-IN": [
            "നിങ്ങൾക്ക് വേറെ എന്തെങ്കിലും ചോദ്യങ്ങൾ ഉണ്ടോ?",
            "മറ്റെന്തെങ്കിലും അറിയണോ?",
        ],
        "mr-IN": [
            "तुम्हाला आणखी काही प्रश्न आहेत का?",
            "आणखी काही विचारायचे आहे का?",
        ],
        "pa-IN": [
            "ਕੀ ਤੁਹਾਡੇ ਕੋਈ ਹੋਰ ਸਵਾਲ ਹਨ?",
            "ਕੁਝ ਹੋਰ ਪੁੱਛਣਾ ਚਾਹੁੰਦੇ ਹੋ?",
        ],
        "od-IN": [
            "ଆପଣଙ୍କର ଆଉ କୌଣସି ପ୍ରଶ୍ନ ଅଛି କି?",
        ],
    },

    # ── Acknowledgement: after speech_start detected ───────────
    "acknowledged": {
        "en-IN": [
            "I heard you, let me find the answer.",
            "Got it, consulting Ayurveda for you.",
            "Understood, one moment please.",
        ],
        "hi-IN": [
            "मैंने सुना, जवाब ढूंढ रहा हूँ।",
            "समझ गया, आयुर्वेद से पूछ रहा हूँ।",
            "ठीक है, एक पल।",
        ],
        "ta-IN": [
            "கேட்டேன், பதில் தேடுகிறேன்.",
            "புரிந்தது, ஒரு நிமிடம்.",
        ],
        "te-IN": [
            "విన్నాను, సమాధానం వెతుకుతున్నాను.",
            "అర్థమైంది, ఒక్క నిమిషం.",
        ],
        "bn-IN": [
            "শুনেছি, উত্তর খুঁজছি।",
            "বুঝেছি, একটু অপেক্ষা করুন।",
        ],
        "gu-IN": [
            "સાંભળ્યું, જવાબ શોધી રહ્યો છું.",
            "સમજ્યો, એક ક્ષણ.",
        ],
        "kn-IN": [
            "ಕೇಳಿದೆ, ಉತ್ತರ ಹುಡುಕುತ್ತಿದ್ದೇನೆ.",
            "ಅರ್ಥವಾಯಿತು, ಒಂದು ಕ್ಷಣ.",
        ],
        "ml-IN": [
            "കേട്ടു, ഉത്തരം തിരയുന്നു.",
            "മനസ്സിലായി, ഒരു നിമിഷം.",
        ],
        "mr-IN": [
            "ऐकलं, उत्तर शोधत आहे.",
            "समजलं, एक क्षण.",
        ],
        "pa-IN": [
            "ਸੁਣਿਆ, ਜਵਾਬ ਲੱਭ ਰਿਹਾ ਹਾਂ।",
            "ਸਮਝਿਆ, ਇੱਕ ਪਲ।",
        ],
        "od-IN": [
            "ଶୁଣିଲି, ଉତ୍ତର ଖୋଜୁଛି।",
        ],
    },
}

# ─────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────

def get_phrase(key: str, lang_code: str = "en-IN") -> str:
    """
    Return a random phrase for the given key in the given language.
    Falls back to English if the language is not available.
    Falls back to key name if neither exists (should never happen).
    """
    lang_phrases = PHRASES.get(key, {})
    options = (
        lang_phrases.get(lang_code)
        or lang_phrases.get("en-IN")
        or [f"[{key}]"]
    )
    return random.choice(options)
