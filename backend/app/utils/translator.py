import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from app.core.database import get_database

logger = logging.getLogger(__name__)

# Standardized IMD Weather Glossary across 11 Indian languages
WEATHER_GLOSSARY: Dict[str, Dict[str, str]] = {
    "heavy_rain": {
        "en": "Heavy Rain",
        "te": "భారీ వర్షం",
        "hi": "भारी बारिश",
        "ta": "கனமழை",
        "kn": "ಭಾರೀ ಮಳೆ",
        "ml": "കനത്ത മഴ",
        "mr": "मुसळधार पाऊस",
        "bn": "ভারী বৃষ্টিপাত",
        "gu": "ભારે વરસાદ",
        "pa": "ਭਾਰੀ ਮੀਂਹ",
        "or": "ପ୍ରବଳ ବର୍ଷା",
    },
    "very_heavy_rain": {
        "en": "Very Heavy Rain",
        "te": "అతి భారీ వర్షం",
        "hi": "अति भारी बारिश",
        "ta": "மிகக் கனமழை",
        "kn": "ಅತಿ ಭಾರೀ ಮಳೆ",
        "ml": "അതിശക്തമായ മഴ",
        "mr": "अति मुसळधार पाऊस",
        "bn": "অতি ভারী বৃষ্টি",
        "gu": "અતિ ભારે વરસાદ",
        "pa": "ਬਹੁਤ ਭਾਰੀ ਮੀਂਹ",
        "or": "ଅତି ପ୍ରବଳ ବର୍ଷା",
    },
    "cyclone": {
        "en": "Cyclone / Cyclonic Storm",
        "te": "తుఫాను (సైక్లోన్)",
        "hi": "चक्रवात (तूफान)",
        "ta": "புயல்",
        "kn": "ಚಂಡಮಾರುತ",
        "ml": "ചുഴലിക്കാറ്റ്",
        "mr": "चक्रीवादळ",
        "bn": "ঘূর্ণিঝড়",
        "gu": "વાવાઝોડું",
        "pa": "ਚੱਕਰਵਾਤ",
        "or": "ବାତ୍ୟା / ଘୂର୍ଣ୍ଣିବଳୟ",
    },
    "heatwave": {
        "en": "Heatwave",
        "te": "వడగాల్పులు (హీట్‌వేవ్)",
        "hi": "लू / भीषण गर्मी",
        "ta": "வெப்ப அலை",
        "kn": "ಬಿಸಿಗಾಳಿ",
        "ml": "ഉഷ്ണതരംഗം",
        "mr": "उष्णतेची लाट",
        "bn": "দাবদাহ / তাপপ্রবাহ",
        "gu": "ગરમીનું મોજું / લૂ",
        "pa": "ਲੂ / ਗਰਮੀ ਦੀ ਲਹਿਰ",
        "or": "ଗ୍ରୀଷ୍ମ ପ୍ରବାହ",
    },
    "thunderstorm": {
        "en": "Thunderstorm & Lightning",
        "te": "ఉరుములు, మెరుపులతో కూడిన తుఫాను",
        "hi": "गरज-चमक के साथ आंधी",
        "ta": "இடி மின்னலுடன் கூடிய புயல்",
        "kn": "ಗುಡುಗು ಸಹಿತ ಮಿಂಚು",
        "ml": "ഇടിമിന്നലോടുകൂടിയ മഴ",
        "mr": "विजांच्या कडकडाटासह वादळ",
        "bn": "বজ্রবিদ্যুৎ সহ ঝড়",
        "gu": "ગાજવીજ સાથે વાવાઝોડું",
        "pa": "ਗਰਜ ਚਮਕ ਨਾਲ ਤੂਫ਼ਾਨ",
        "or": "ଘଡ଼ଘଡ଼ି ସହ ବର୍ଷା",
    },
    "cold_wave": {
        "en": "Cold Wave",
        "te": "శీతల గాలులు (కోల్డ్ వేవ్)",
        "hi": "शीतलहर",
        "ta": "குளிர் அலை",
        "kn": "ಶೀತ ಮಾರುತ",
        "ml": "ശീതതരംഗം",
        "mr": "थंडीची लाट",
        "bn": "শৈত্যপ্রবাহ",
        "gu": "ઠંડીનું મોજું",
        "pa": "ਸੀਤ ਲਹਿਰ",
        "or": "ଶୀତ ପ୍ରବାହ",
    },
    "fog": {
        "en": "Dense Fog",
        "te": "దట్టమైన పొగమంచు",
        "hi": "घना कोहरा",
        "ta": "அடர்ந்த பனிமூட்டம்",
        "kn": "ದಟ್ಟ ಮಂಜು",
        "ml": "കനത്ത മൂടൽമഞ്ഞ്",
        "mr": "दाट धुके",
        "bn": "ঘন কুয়াশা",
        "gu": "ગાઢ ધુમ્મસ",
        "pa": "ਸੰਘਣੀ ਧੁੰਦ",
        "or": "ଘନ କୁହୁଡ଼ି",
    },
    "flash_flood": {
        "en": "Flash Flood",
        "te": "ఆకస్మిక వరదలు",
        "hi": "अचानक आई बाढ़",
        "ta": "திடீர் வெள்ளம்",
        "kn": "ಧಿಡೀರ್ ಪ್ರವಾಹ",
        "ml": "പെട്ടെന്നുള്ള വെള്ളപ്പൊക്കം",
        "mr": "अचानक आलेला पूर",
        "bn": "হড়পা বান / আকস্মিক বন্যা",
        "gu": "અચાનક આવતો પૂર",
        "pa": "ਅਚਾਨਕ ਹੜ੍ਹ",
        "or": "ଆକସ୍ମିକ ବନ୍ୟା",
    },
    "drought": {
        "en": "Drought",
        "te": "కరువు / అనావృష్టి",
        "hi": "सूखा",
        "ta": "வறட்சி",
        "kn": "ಬರಗಾಲ",
        "ml": "വരൾച്ച",
        "mr": "दुष्काळ",
        "bn": "খরা",
        "gu": "દુષ્કાળ",
        "pa": "ਸੋਕਾ",
        "or": "ମରୁଡ଼ି",
    },
    "wind_speed": {
        "en": "Wind Speed",
        "te": "గాలి వేగం",
        "hi": "हवा की गति",
        "ta": "காற்றின் வேகம்",
        "kn": "ಗಾಳಿಯ ವೇಗ",
        "ml": "കാറ്റിന്റെ വേഗത",
        "mr": "वाऱ्याचा वेग",
        "bn": "বাতাসের গতি",
        "gu": "પવનની ગતિ",
        "pa": "ਹਵਾ ਦੀ ਰਫ਼ਤਾਰ",
        "or": "ପବନର ବେଗ",
    },
    "humidity": {
        "en": "Humidity",
        "te": "తేమ (హ్యుమిడిటీ)",
        "hi": "आर्द्रता / नमी",
        "ta": "ஈரப்பதம்",
        "kn": "ತೇವಾಂಶ",
        "ml": "ഈർപ്പം",
        "mr": "आर्द्रता",
        "bn": "আর্দ্রতা",
        "gu": "ભેજ",
        "pa": "ਨਮੀ",
        "or": "ଆର୍ଦ୍ରତା",
    },
}

# Pre-compiled multi-lingual advisory templates for fast rendering and caching
COMMON_TEMPLATES: Dict[str, Dict[str, str]] = {
    "red_alert_advisory": {
        "en": "IMD RED ALERT: Severe weather expected in {location}. Stay indoors, keep away from electric poles, and follow local district disaster warnings.",
        "te": "IMD రెడ్ అలర్ట్: {location} లో తీవ్రమైన వాతావరణం ఉండే అవకాశం ఉంది. ఇళ్లలోనే సురక్షితంగా ఉండండి, విద్యుత్ స్తంభాలకు దూరంగా ఉండండి.",
        "hi": "IMD रेड अलर्ट: {location} में गंभीर मौसम की चेतावनी। सुरक्षित स्थानों पर रहें और स्थानीय आपदा प्रबंधन के निर्देशों का पालन करें।",
        "ta": "IMD ரெட் அலர்ட்: {location} பகுதியில் தீவிர வானிலை எச்சரிக்கை. வீட்டிலேயே பாதுகாப்பாக இருங்கள்.",
        "kn": "IMD ರೆಡ್ ಅಲರ್ಟ್: {location} ನಲ್ಲಿ ತೀವ್ರ ಹವಾಮಾನ ಎಚ್ಚರಿಕೆ. ಮನೆಗಳಲ್ಲೇ ಸುರಕ್ಷಿತವಾಗಿರಿ.",
        "ml": "IMD റെഡ് അലർട്ട്: {location} ൽ കനത്ത കാലാവസ്ഥാ മുന്നറിയിപ്പ്. സുരക്ഷിതമായി ഇരിക്കുക.",
        "mr": "IMD रेड अलर्ट: {location} मध्ये तीव्र हवामानाचा इशारा. घरातच सुरक्षित राहा.",
        "bn": "IMD রেড অ্যালার্ট: {location} এ তীব্র আবহাওয়ার সতর্কতা। নিরাপদ স্থানে থাকুন।",
        "gu": "IMD રેડ એલર્ટ: {location} માં ગંભીર હવામાનની ચેતવણી. ઘરમાં સુરક્ષિત રહો.",
        "pa": "IMD ਰੈੱਡ ਅਲਰਟ: {location} ਵਿੱਚ ਭਾਰੀ ਮੌਸਮ ਦੀ ਚੇਤਾਵਨੀ। ਘਰਾਂ ਵਿੱਚ ਰਹੋ।",
        "or": "IMD ରେଡ୍ ଆଲର୍ଟ: {location} ରେ ପ୍ରବଳ ପାଗ ଚେତାବନୀ। ନିରାପଦରେ ରୁହନ୍ତୁ।",
    },
    "farmer_spraying_advisory": {
        "en": "Agricultural Advisory: Rainfall or high wind expected in {location}. Avoid spraying pesticides and fertilizers for the next 24 hours.",
        "te": "రైతు వ్యవసాయ సలహా: {location} లో వర్షం లేదా తీవ్ర గాలులు వచ్చే అవకాశం ఉంది. రాబోయే 24 గంటలు పురుగుమందులు, ఎరువుల పిచికారీ నిలిపివేయండి.",
        "hi": "कृषि सलाह: {location} में बारिश या तेज हवा की संभावना। अगले 24 घंटे कीटनाशक और उर्वरक का छिड़काव न करें।",
        "ta": "விவசாய ஆலோசனை: {location} பகுதியில் மழை அல்லது பலத்த காற்று வீசக்கூடும். மருந்து தெளிப்பதை தவிர்க்கவும்.",
        "kn": "ರೈತ ಸಲಹೆ: {location} ನಲ್ಲಿ ಮಳೆ ಅಥವಾ ಬಿರುಗಾಳಿ ಸಾಧ್ಯತೆ. ಕೀಟನಾಶಕ ಸಿಂಪಡಿಸುವುದನ್ನು ಮುಂದೂಡಿ.",
        "ml": "കർഷക ഉപദേശം: {location} ൽ മഴയോ കാറ്റോ പ്രതീക്ഷിക്കുന്നു. കീടനാശിനി പ്രയോഗം ഒഴിവാക്കുക.",
        "mr": "शेतकरी सल्ला: {location} मध्ये पाऊस किंवा सोसाट्याचा वारा येण्याची शक्यता. फवारणी थांबवा.",
        "bn": "কৃষি পরামর্শ: {location} এ বৃষ্টি বা ঝোড়ো বাতাসের সম্ভাবনা। কীটনাশক স্প্রে বন্ধ রাখুন।",
        "gu": "ખેડૂત સલાહ: {location} માં વરસાદ અથવા પવનની શક્યતા. દવા છંટકાવ મોકૂફ રાખો.",
        "pa": "ਕਿਸਾਨ ਸਲਾਹ: {location} ਵਿੱਚ ਮੀਂਹ ਜਾਂ ਤੇਜ਼ ਹਵਾਵਾਂ ਦੀ ਸੰਭਾਵਨਾ। ਸਪਰੇਅ ਕਰਨ ਤੋਂ ਬਚੋ।",
        "or": "କୃଷକ ପରାମର୍ଶ: {location} ରେ ବର୍ଷା ବା ପବନର ସମ୍ଭାବନା। କୀଟନାଶକ ପ୍ରୟୋଗ ବନ୍ଦ ରଖନ୍ତୁ।",
    },
}


class TranslationService:
    @staticmethod
    def get_glossary(language: str = "en") -> Dict[str, str]:
        """Returns the weather glossary terms translated into requested language."""
        result = {}
        for term_key, trans_map in WEATHER_GLOSSARY.items():
            result[term_key] = trans_map.get(language, trans_map.get("en", term_key))
        return result

    @staticmethod
    async def get_translated_template(
        template_id: str,
        target_lang: str = "en",
        params: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Retrieves template in target language, with MongoDB caching support.
        """
        db = get_database()
        cache_key = f"{template_id}_{target_lang}"

        # 1. Check MongoDB cache if connected
        if db is not None:
            try:
                cached = await db.translated_templates.find_one({"key": cache_key})
                if cached and "text" in cached:
                    text = cached["text"]
                    if params:
                        for k, v in params.items():
                            text = text.replace(f"{{{k}}}", str(v))
                    return text
            except Exception as e:
                logger.debug(f"Template cache lookup failed: {e}")

        # 2. Check built-in common templates
        template_group = COMMON_TEMPLATES.get(template_id)
        if template_group:
            template_text = template_group.get(target_lang, template_group.get("en", ""))
            
            # Cache to MongoDB asynchronously
            if db is not None:
                try:
                    await db.translated_templates.update_one(
                        {"key": cache_key},
                        {
                            "$set": {
                                "key": cache_key,
                                "template_id": template_id,
                                "language": target_lang,
                                "text": template_text,
                                "updated_at": datetime.now(timezone.utc),
                            }
                        },
                        upsert=True,
                    )
                except Exception as e:
                    logger.debug(f"Template caching failed: {e}")

            if params:
                for k, v in params.items():
                    template_text = template_text.replace(f"{{{k}}}", str(v))
            return template_text

        return f"Weather advisory for {params.get('location', '') if params else ''}"


translation_service = TranslationService()
