from services import ayurveda_knowledge as kb
from services.safety import is_emergency


def test_dataset_loads():
    assert len(kb.load_conditions()) > 400


def test_get_profile_exact_partial_and_fuzzy():
    assert kb.get_profile("hypertension")["disease"] == "Hypertension"
    assert kb.get_profile("Hypertensio")["disease"] == "Hypertension"   # typo
    assert kb.get_profile("UNKNOWN") is None
    assert kb.get_profile("") is None


def test_keyword_search_finds_cough():
    results = kb.keyword_search("I have a cough and sore throat")
    assert results and any("Cough" in r["disease"] for r in results)


def test_list_conditions_filter_and_limit():
    assert len(kb.list_conditions(limit=5)) == 5
    assert all("tulsi" in (r["herbs"] + r["symptoms"] + r["disease"]).lower()
               for r in kb.list_conditions("tulsi"))


def test_emergency_detection():
    assert is_emergency("My father has CHEST PAIN")
    assert is_emergency("I want to kill myself")
    assert not is_emergency("I have a mild headache")
