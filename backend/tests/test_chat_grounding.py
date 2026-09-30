from fastapi.testclient import TestClient
from app.main import app
import json

def test_chat_grounding():
    client = TestClient(app)

    # Test 1: "Will it rain in Kurnool tomorrow?"
    print("=== Test 1: 'Will it rain in Kurnool tomorrow?' ===")
    payload1 = {
        "session_id": "test-session-kurnool-1",
        "message": "Will it rain in Kurnool tomorrow?",
    }
    r1 = client.post("/api/v1/chat", json=payload1)
    assert r1.status_code == 200, f"Chat request 1 failed: {r1.status_code} - {r1.text}"
    res1 = r1.json()
    print("Intent:", res1["intent"])
    print("Language:", res1["language"])
    print("Entities:", json.dumps(res1["entities"]))
    print("Data Cards Count:", len(res1["data_cards"]))
    print("Sources:", res1["sources"])
    print("Follow-up Suggestions:", res1["follow_up_suggestions"][:2])
    print("ANSWER:\n", res1["answer"])
    assert "Kurnool" in res1["answer"] or "Kurnool" in str(res1["entities"])
    assert res1["language"] == "en"

    # Test 2: "Hyderabad lo repu vaana padutunda?"
    print("\n=== Test 2: 'Hyderabad lo repu vaana padutunda?' ===")
    payload2 = {
        "session_id": "test-session-hyderabad-te",
        "message": "Hyderabad lo repu vaana padutunda?",
    }
    r2 = client.post("/api/v1/chat", json=payload2)
    assert r2.status_code == 200, f"Chat request 2 failed: {r2.status_code} - {r2.text}"
    res2 = r2.json()
    print("Intent:", res2["intent"])
    print("Language:", res2["language"])
    print("Entities:", json.dumps(res2["entities"]))
    print("Data Cards Count:", len(res2["data_cards"]))
    print("Sources:", res2["sources"])
    print("Follow-up Suggestions (escaped):", [s.encode("unicode_escape").decode("utf-8") for s in res2["follow_up_suggestions"][:2]])
    # Encode answer safely for console
    print("ANSWER (Unicode Escaped):\n", res2["answer"].encode("unicode_escape").decode("utf-8"))
    assert res2["language"] == "te", f"Expected language 'te' but got {res2['language']}"

    # Test 3: Follow-up memory test: "what about day after tomorrow?"
    print("\n=== Test 3: Conversation Memory Follow-up ===")
    payload3 = {
        "session_id": "test-session-kurnool-1",
        "message": "what about day after tomorrow?",
    }
    r3 = client.post("/api/v1/chat", json=payload3)
    assert r3.status_code == 200
    res3 = r3.json()
    print("Entities (Inherited Location):", json.dumps(res3["entities"]))
    print("ANSWER:\n", res3["answer"])
    assert res3["entities"].get("location") == "Kurnool", "Expected inherited location Kurnool from memory"

    print("\n[SUCCESS] All Prompt 5 LLM query understanding tests passed!")

if __name__ == "__main__":
    test_chat_grounding()
