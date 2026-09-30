import asyncio
import difflib
import logging
import math
from typing import List, Optional, Dict, Any, Tuple
import httpx

from app.core.database import get_database
from app.models.location import LocationModel
from app.schemas.location import LocationCandidate, ReverseGeocodeResponse
from app.services.repository import LocationRepository

logger = logging.getLogger(__name__)

OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
BIG_DATA_CLOUD_REVERSE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client"

# Well-known Indian nicknames and historical alternative spellings
INDIAN_ALIAS_MAP: Dict[str, str] = {
    "vizag": "visakhapatnam",
    "waltair": "visakhapatnam",
    "bezawada": "vijayawada",
    "bangalore": "bengaluru",
    "madras": "chennai",
    "bombay": "mumbai",
    "calcutta": "kolkata",
    "poona": "pune",
    "baroda": "vadodara",
    "gurgaon": "gurugram",
    "cochin": "kochi",
    "ernakulam": "kochi",
    "trivandrum": "thiruvananthapuram",
    "calicut": "kozhikode",
    "orugallu": "warangal",
    "cuddapah": "kadapa",
    "trichy": "tiruchirappalli",
    "simla": "shimla",
    "secunderabad": "hyderabad",
    "cyberabad": "hyderabad",
    "banaras": "varanasi",
    "kashi": "varanasi",
    "allahabad": "prayagraj",
    "ncr": "delhi",
    "dilli": "delhi",
    "new delhi": "delhi",
    # Telugu script aliases
    "హైదరాబాద్": "hyderabad",
    "కర్నూలు": "kurnool",
    "విశాఖపట్నం": "visakhapatnam",
    "వైజాగ్": "visakhapatnam",
    "విజయవాడ": "vijayawada",
    "వరంగల్": "warangal",
    "తిరుపతి": "tirupati",
    "గుంటూరు": "guntur",
    "నెల్లూరు": "nellore",
    "రాజమండ్రి": "rajahmundry",
    # Hindi script aliases
    "हैदराबाद": "hyderabad",
    "दिल्ली": "delhi",
    "मुंबई": "mumbai",
    "कोलकाता": "kolkata",
    "चेन्नई": "chennai",
    "बेंगलुरु": "bengaluru",
    "पुणे": "pune",
    "जयपुर": "jaipur",
    "लखनऊ": "lucknow",
    "वाराणसी": "varanasi",
}


# In-memory TTL location caches (Prompt 17E)
import time

_LOCATION_CACHE: Dict[str, Tuple[List[LocationCandidate], float]] = {}
_REVERSE_CACHE: Dict[str, Tuple[ReverseGeocodeResponse, float]] = {}
LOCATION_CACHE_TTL = 3600.0  # 1 hour

STOP_WORDS = {
    "what", "is", "the", "weather", "in", "at", "for", "right", "now", "today",
    "tomorrow", "forecast", "current", "temperature", "rain", "will", "it", "how",
    "hows", "please", "tell", "me", "give", "and", "or", "of", "a", "an", "to",
    "from", "here", "there", "like", "feels", "wind", "humidity", "aqi", "air",
    "quality", "update", "details", "condition", "conditions", "repu", "nedu",
    "aaj", "kal", "kaisa", "hoga", "undhi", "ela", "padutunda", "kya", "hai",
    "varsham", "vaana", "baarish", "barish", "tapman", "chali", "yenda",
}


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates distance in kilometers between two geo coordinates."""
    r = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


class LocationService:
    def __init__(self):
        self.timeout = httpx.Timeout(8.0, connect=4.0)

    async def fast_local_search(self, query: str) -> Optional[LocationCandidate]:
        """
        Ultra-fast local-only lookup against alias map and in-memory repository (Prompt 17E).
        Guaranteed zero external network roundtrips.
        """
        clean_q = query.strip()
        if not clean_q or len(clean_q) < 2:
            return None
        lower_q = clean_q.lower()
        if lower_q in STOP_WORDS:
            return None

        # Check aliases first
        canonical = INDIAN_ALIAS_MAP.get(lower_q, lower_q)

        # Check in-memory locations repository directly
        loc = await LocationRepository.get_by_name(canonical)
        if loc:
            return LocationCandidate(
                name=loc.name,
                state=loc.state,
                district=loc.district,
                country="India",
                lat=loc.lat,
                lon=loc.lon,
                score=1.0,
                source="local_memory",
                aliases=loc.aliases,
            )
        return None

    async def _search_open_meteo_geocoding(self, query: str, limit: int = 5) -> List[LocationCandidate]:
        """Queries Open-Meteo Geocoding API as external fallback."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(
                    OPEN_METEO_GEOCODING_URL,
                    params={"name": query, "count": limit, "language": "en", "format": "json"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results", [])
                    candidates = []
                    for r in results:
                        candidates.append(
                            LocationCandidate(
                                name=r.get("name", query),
                                state=r.get("admin1", r.get("country", "")),
                                district=r.get("admin2", r.get("admin1", "")),
                                country=r.get("country", "India"),
                                lat=r.get("latitude", 0.0),
                                lon=r.get("longitude", 0.0),
                                score=0.8,
                                source="open_meteo",
                                aliases=[],
                            )
                        )
                    return candidates
        except Exception as e:
            logger.warning(f"Open-Meteo geocoding fallback failed for query '{query}': {e}")
        return []

    async def resolve_place(self, name: str) -> Optional[LocationCandidate]:
        """
        Resolves a single location string to the best matching candidate.
        First checks local fast search, then cache, then local DB, and lastly external geocoding.
        """
        clean_name = name.strip()
        if not clean_name:
            return None

        # 1. Fast zero-network local check
        fast_cand = await self.fast_local_search(clean_name)
        if fast_cand:
            return fast_cand

        # 2. Cached or full search
        results = await self.search_places(clean_name, limit=1)
        return results[0] if results else None

    async def search_places(self, query: str, limit: int = 10) -> List[LocationCandidate]:
        """
        Searches places with ranking, fuzzy matching, and alias resolution.
        Backed by memory TTL cache (Prompt 17E) to eliminate repetitive lookups.
        """
        clean_q = query.strip()
        if not clean_q:
            return []

        lower_q = clean_q.lower()
        if lower_q in STOP_WORDS:
            return []

        # Check in-memory TTL cache
        cache_key = f"{lower_q}_{limit}"
        now = time.time()
        if cache_key in _LOCATION_CACHE:
            cached_val, cached_time = _LOCATION_CACHE[cache_key]
            if now - cached_time < LOCATION_CACHE_TTL:
                return cached_val
        # Check alias dictionary (e.g. vizag -> visakhapatnam)
        canonical_target = INDIAN_ALIAS_MAP.get(lower_q, lower_q)

        candidates: List[LocationCandidate] = []
        seen_keys = set()

        # 1. Search local MongoDB Atlas collection
        db = get_database()
        local_docs = []

        if db is not None:
            # Query by exact or prefix on name, alias, district
            regex_canon = {"$regex": f"^{canonical_target}", "$options": "i"}
            regex_orig = {"$regex": f"^{clean_q}", "$options": "i"}
            
            cursor = db.locations.find({
                "$or": [
                    {"name": regex_canon},
                    {"name": regex_orig},
                    {"aliases": regex_canon},
                    {"aliases": regex_orig},
                    {"district": regex_canon},
                    {"state": regex_canon},
                ]
            }).limit(limit)
            local_docs = await cursor.to_list(length=limit)

            # If no prefix match, try text search
            if not local_docs:
                text_cursor = db.locations.find({"$text": {"$search": clean_q}}).limit(limit)
                local_docs = await text_cursor.to_list(length=limit)
        else:
            # In-memory search fallback
            repo_results = await LocationRepository.search_locations(clean_q, limit=limit)
            local_docs = [r.model_dump() for r in repo_results]

        for doc in local_docs:
            name = doc["name"]
            state = doc.get("state", "India")
            key = f"{name.lower()}_{state.lower()}"
            if key not in seen_keys:
                seen_keys.add(key)
                
                # Compute relevance score
                doc_name_lower = name.lower()
                doc_aliases = [a.lower() for a in doc.get("aliases", [])]
                
                score = 0.85
                if lower_q == doc_name_lower or lower_q in doc_aliases:
                    score = 1.0  # Exact match
                elif doc_name_lower.startswith(lower_q) or canonical_target == doc_name_lower:
                    score = 0.95
                elif any(a.startswith(lower_q) for a in doc_aliases):
                    score = 0.92
                else:
                    similarity = difflib.SequenceMatcher(None, lower_q, doc_name_lower).ratio()
                    score = max(0.7, round(similarity, 2))

                candidates.append(
                    LocationCandidate(
                        name=name,
                        state=state,
                        district=doc.get("district"),
                        country="India",
                        lat=doc["lat"],
                        lon=doc["lon"],
                        score=score,
                        source="local_db",
                        aliases=doc.get("aliases", []),
                    )
                )

        # Sort local candidates by score descending
        candidates.sort(key=lambda x: x.score, reverse=True)

        # 2. If candidates are sparse (< 2) and query is long enough, fall back to Open-Meteo geocoding
        if len(candidates) < 2 and len(clean_q) >= 3:
            external_candidates = await self._search_open_meteo_geocoding(clean_q, limit=5)
            for ext in external_candidates:
                key = f"{ext.name.lower()}_{ext.state.lower()}"
                if key not in seen_keys:
                    seen_keys.add(key)
                    candidates.append(ext)

        final_candidates = candidates[:limit]
        _LOCATION_CACHE[cache_key] = (final_candidates, time.time())
        return final_candidates

    async def reverse_geocode(self, lat: float, lon: float) -> ReverseGeocodeResponse:
        """
        Reverse geocodes (lat, lon) to the nearest district and state.
        First checks in-memory reverse cache (Prompt 17E), then scans curated local locations.
        """
        rev_key = f"{round(lat, 3)}_{round(lon, 3)}"
        now = time.time()
        if rev_key in _REVERSE_CACHE:
            cached_resp, cached_time = _REVERSE_CACHE[rev_key]
            if now - cached_time < LOCATION_CACHE_TTL:
                return cached_resp

        db = get_database()
        closest_doc = None
        min_dist = float("inf")

        if db is not None:
            # Scan curated locations in DB
            cursor = db.locations.find({})
            async for doc in cursor:
                d = haversine_distance(lat, lon, doc["lat"], doc["lon"])
                if d < min_dist:
                    min_dist = d
                    closest_doc = doc
        else:
            repo_count = await LocationRepository.count()
            # If in-memory
            from app.services.repository import _MEMORY_LOCATIONS
            for doc in _MEMORY_LOCATIONS:
                d = haversine_distance(lat, lon, doc["lat"], doc["lon"])
                if d < min_dist:
                    min_dist = d
                    closest_doc = doc

        # If a curated Indian district is within 150km, return it
        if closest_doc and min_dist <= 150.0:
            res = ReverseGeocodeResponse(
                lat=lat,
                lon=lon,
                name=closest_doc["name"],
                district=closest_doc.get("district", closest_doc["name"]),
                state=closest_doc.get("state"),
                country="India",
                source=f"local_db ({min_dist:.1f}km from {closest_doc['name']})",
            )
            _REVERSE_CACHE[rev_key] = (res, now)
            return res

        # Fallback to external reverse geocoding
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(
                    BIG_DATA_CLOUD_REVERSE_URL,
                    params={"latitude": lat, "longitude": lon, "localityLanguage": "en"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    city = data.get("city") or data.get("locality") or "Unknown Location"
                    principal_subdiv = data.get("principalSubdivision") or ""
                    country = data.get("countryName") or "India"
                    return ReverseGeocodeResponse(
                        lat=lat,
                        lon=lon,
                        name=city,
                        district=data.get("locality", city),
                        state=principal_subdiv,
                        country=country,
                        source="bigdatacloud_api",
                    )
        except Exception as e:
            logger.warning(f"External reverse geocode failed for ({lat}, {lon}): {e}")

        # Ultimate fallback
        if closest_doc:
            return ReverseGeocodeResponse(
                lat=lat,
                lon=lon,
                name=closest_doc["name"],
                district=closest_doc.get("district"),
                state=closest_doc.get("state"),
                country="India",
                source="local_db_nearest",
            )

        return ReverseGeocodeResponse(
            lat=lat,
            lon=lon,
            name="Unknown Location",
            district="Unknown",
            state="India",
            country="India",
            source="fallback",
        )


location_service = LocationService()
