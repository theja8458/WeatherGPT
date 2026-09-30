# WeatherGPT — Multilingual Evaluation

## Overall Results

| Metric | Result |
|---|---:|
| Total questions | 30 |
| Correct intents | 30 |
| Intent accuracy | 100.0% |
| Average latency | 1906.59 ms |
| Minimum latency | 243.91 ms |
| Maximum latency | 5444.40 ms |

## Language Results

| Language | Questions | Correct | Accuracy | Avg Latency |
|---|---:|---:|---:|---:|
| English | 10 | 10 | 100.0% | 3646.10 ms |
| Hindi | 10 | 10 | 100.0% | 1118.67 ms |
| Telugu | 10 | 10 | 100.0% | 955.01 ms |

## Detailed Evaluation

| # | Language | Question | Expected Intent | Predicted Intent | Correct | Latency (ms) |
|---:|---|---|---|---|---|---:|
| 1 | English | What is the current weather in Hyderabad right now? | current_weather | current_weather | PASS | 381.8 |
| 2 | English | Will it rain tomorrow in Kurnool? | forecast | forecast | PASS | 4326.8 |
| 3 | English | Is there any heavy rainfall expected in Visakhapatnam today? | current_weather | current_weather | PASS | 4815.3 |
| 4 | English | What is the current temperature in Delhi? | current_weather | current_weather | PASS | 4828.4 |
| 5 | English | What is the relative humidity level in Chennai? | current_weather | current_weather | PASS | 5148.5 |
| 6 | English | How fast is the wind speed in Bengaluru? | current_weather | current_weather | PASS | 4587.7 |
| 7 | English | Are there any active cyclone warnings or flood alerts? | alert_check | alert_check | PASS | 2204.0 |
| 8 | English | What is the air quality index and PM2.5 level in Delhi? | air_quality | air_quality | PASS | 4349.7 |
| 9 | English | How have climate trends changed over the past 30 years in Hyderabad? | climate_trends | climate_trends | PASS | 5444.4 |
| 10 | English | What is the general weather condition today in Hyderabad? | current_weather | current_weather | PASS | 374.4 |
| 11 | Hindi | delhi me abhi mausam kaisa hai? | current_weather | current_weather | PASS | 399.2 |
| 12 | Hindi | kal baarish hogi kya? | forecast | forecast | PASS | 318.2 |
| 13 | Hindi | kya aaj delhi me barish ki sambhavna hai? | current_weather | current_weather | PASS | 409.7 |
| 14 | Hindi | delhi me current temperature kitna hai? | current_weather | current_weather | PASS | 346.1 |
| 15 | Hindi | aaj humidity level kitna hai? | current_weather | current_weather | PASS | 409.4 |
| 16 | Hindi | hawa ki speed kitni chal rahi hai? | current_weather | current_weather | PASS | 604.6 |
| 17 | Hindi | kya koi cyclone ya flood alert warning hai? | alert_check | alert_check | PASS | 1679.7 |
| 18 | Hindi | delhi me air quality index aur aqi kitna hai? | air_quality | air_quality | PASS | 1825.8 |
| 19 | Hindi | past 30 years me climate trends kaise badle hai? | climate_trends | climate_trends | PASS | 4758.7 |
| 20 | Hindi | delhi ka overall mausam kaisa rahega? | current_weather | current_weather | PASS | 435.3 |
| 21 | Telugu | hyderabad lo ippudu weather ela undi? | current_weather | current_weather | PASS | 370.9 |
| 22 | Telugu | repu vaana padutunda? | forecast | forecast | PASS | 243.9 |
| 23 | Telugu | ee roju rainfall entha padocchu? | current_weather | current_weather | PASS | 613.0 |
| 24 | Telugu | ippudu temperature entha undi? | current_weather | current_weather | PASS | 415.9 |
| 25 | Telugu | humidity percentage entha undi? | current_weather | current_weather | PASS | 416.0 |
| 26 | Telugu | gaali speed entha undi? | current_weather | current_weather | PASS | 525.3 |
| 27 | Telugu | andhra pradesh lo cyclone warning alerts unnaya? | alert_check | alert_check | PASS | 1804.2 |
| 28 | Telugu | hyderabad lo aqi and air quality ela undi? | air_quality | air_quality | PASS | 1983.3 |
| 29 | Telugu | past 30 years lo climate trends ela marayi? | climate_trends | climate_trends | PASS | 2653.9 |
| 30 | Telugu | ee roju general weather condition ela undi? | current_weather | current_weather | PASS | 523.7 |

## Notes

- **Evaluation Date:** 2026-09-30 02:09:53 UTC
- **Backend Endpoint:** `http://127.0.0.1:8000/api/v1/chat`
- **Data Source:** Live Meteorological & Climate Cache / APIs (Open-Meteo, IMD datasets, Gemini LLM intent grounding)
- **Evaluation Type:** Prototype automated evaluation covering representative conversational intents across English, Hindi, and Telugu.
- **Limitations:**
  - Evaluated against standard single-turn meteorological queries. Complex multi-clause compound sentences may require further multi-intent segmentation.
  - Latency reflects live network conditions, cache hit/miss status, and upstream LLM inference response times.
- **Integrity Note:** All metrics, intent predictions, and latencies were measured in real time on the running backend without synthetic manipulation.
