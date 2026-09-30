import asyncio
import os
import sys
from datetime import datetime

# Add backend directory to sys.path so app modules import cleanly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.core.database import db_manager, init_db_indexes
from app.services.repository import LocationRepository

INDIAN_LOCATIONS = [
    # Andhra Pradesh
    {"name": "Visakhapatnam", "state": "Andhra Pradesh", "district": "Visakhapatnam", "lat": 17.6868, "lon": 83.2185, "aliases": ["Vizag", "Waltair"]},
    {"name": "Vijayawada", "state": "Andhra Pradesh", "district": "NTR", "lat": 16.5062, "lon": 80.6480, "aliases": ["Bezawada"]},
    {"name": "Guntur", "state": "Andhra Pradesh", "district": "Guntur", "lat": 16.3067, "lon": 80.4365, "aliases": []},
    {"name": "Nellore", "state": "Andhra Pradesh", "district": "SPSR Nellore", "lat": 14.4426, "lon": 79.9865, "aliases": []},
    {"name": "Kurnool", "state": "Andhra Pradesh", "district": "Kurnool", "lat": 15.8281, "lon": 78.0373, "aliases": []},
    {"name": "Kadapa", "state": "Andhra Pradesh", "district": "YSR Kadapa", "lat": 14.4673, "lon": 78.8242, "aliases": ["Cuddapah"]},
    {"name": "Rajahmundry", "state": "Andhra Pradesh", "district": "East Godavari", "lat": 17.0005, "lon": 81.8040, "aliases": ["Rajamahendravaram"]},
    {"name": "Kakinada", "state": "Andhra Pradesh", "district": "Kakinada", "lat": 16.9891, "lon": 82.2475, "aliases": []},
    {"name": "Tirupati", "state": "Andhra Pradesh", "district": "Tirupati", "lat": 13.6288, "lon": 79.4192, "aliases": []},
    {"name": "Anantapur", "state": "Andhra Pradesh", "district": "Anantapur", "lat": 14.6819, "lon": 77.6006, "aliases": ["Anantapuram"]},
    {"name": "Amaravati", "state": "Andhra Pradesh", "district": "Guntur", "lat": 16.5131, "lon": 80.5165, "aliases": ["AP Capital"], "is_capital": True},
    {"name": "Eluru", "state": "Andhra Pradesh", "district": "Eluru", "lat": 16.7107, "lon": 81.0952, "aliases": []},
    {"name": "Ongole", "state": "Andhra Pradesh", "district": "Prakasam", "lat": 15.5057, "lon": 80.0499, "aliases": []},
    {"name": "Machilipatnam", "state": "Andhra Pradesh", "district": "Krishna", "lat": 16.1875, "lon": 81.1389, "aliases": ["Bandar"]},
    {"name": "Chittoor", "state": "Andhra Pradesh", "district": "Chittoor", "lat": 13.2172, "lon": 79.1003, "aliases": []},
    {"name": "Srikakulam", "state": "Andhra Pradesh", "district": "Srikakulam", "lat": 18.2949, "lon": 83.8938, "aliases": ["Chicacole"]},
    {"name": "Vizianagaram", "state": "Andhra Pradesh", "district": "Vizianagaram", "lat": 18.1067, "lon": 83.3956, "aliases": []},

    # Telangana
    {"name": "Hyderabad", "state": "Telangana", "district": "Hyderabad", "lat": 17.3850, "lon": 78.4867, "aliases": ["Bhagyanagar", "Secunderabad", "Cyberabad"], "is_capital": True},
    {"name": "Warangal", "state": "Telangana", "district": "Warangal", "lat": 17.9689, "lon": 79.5941, "aliases": ["Orugallu", "Hanamkonda", "Kazipet"]},
    {"name": "Nizamabad", "state": "Telangana", "district": "Nizamabad", "lat": 18.6725, "lon": 78.0941, "aliases": ["Indur"]},
    {"name": "Karimnagar", "state": "Telangana", "district": "Karimnagar", "lat": 18.4386, "lon": 79.1288, "aliases": ["Elagandula"]},
    {"name": "Ramagundam", "state": "Telangana", "district": "Peddapalli", "lat": 18.7557, "lon": 79.5126, "aliases": []},
    {"name": "Khammam", "state": "Telangana", "district": "Khammam", "lat": 17.2473, "lon": 80.1514, "aliases": ["Stambhadri"]},
    {"name": "Mahbubnagar", "state": "Telangana", "district": "Mahbubnagar", "lat": 16.7488, "lon": 77.9856, "aliases": ["Palamoor"]},
    {"name": "Nalgonda", "state": "Telangana", "district": "Nalgonda", "lat": 17.0577, "lon": 79.2684, "aliases": ["Neelagiri"]},
    {"name": "Adilabad", "state": "Telangana", "district": "Adilabad", "lat": 19.6641, "lon": 78.5320, "aliases": []},
    {"name": "Siddipet", "state": "Telangana", "district": "Siddipet", "lat": 18.1018, "lon": 78.8520, "aliases": []},
    {"name": "Suryapet", "state": "Telangana", "district": "Suryapet", "lat": 17.1439, "lon": 79.6239, "aliases": []},

    # Tamil Nadu
    {"name": "Chennai", "state": "Tamil Nadu", "district": "Chennai", "lat": 13.0827, "lon": 80.2707, "aliases": ["Madras"], "is_capital": True},
    {"name": "Coimbatore", "state": "Tamil Nadu", "district": "Coimbatore", "lat": 11.0168, "lon": 76.9558, "aliases": ["Kovai"]},
    {"name": "Madurai", "state": "Tamil Nadu", "district": "Madurai", "lat": 9.9252, "lon": 78.1198, "aliases": ["Temple City"]},
    {"name": "Tiruchirappalli", "state": "Tamil Nadu", "district": "Tiruchirappalli", "lat": 10.7905, "lon": 78.7047, "aliases": ["Trichy"]},
    {"name": "Salem", "state": "Tamil Nadu", "district": "Salem", "lat": 11.6643, "lon": 78.1460, "aliases": []},
    {"name": "Tirunelveli", "state": "Tamil Nadu", "district": "Tirunelveli", "lat": 8.7139, "lon": 77.7567, "aliases": ["Nellai"]},
    {"name": "Tiruppur", "state": "Tamil Nadu", "district": "Tiruppur", "lat": 11.1085, "lon": 77.3411, "aliases": []},
    {"name": "Vellore", "state": "Tamil Nadu", "district": "Vellore", "lat": 12.9165, "lon": 79.1325, "aliases": []},
    {"name": "Erode", "state": "Tamil Nadu", "district": "Erode", "lat": 11.3410, "lon": 77.7172, "aliases": []},
    {"name": "Thoothukudi", "state": "Tamil Nadu", "district": "Thoothukudi", "lat": 8.7642, "lon": 78.1348, "aliases": ["Tuticorin"]},
    {"name": "Dindigul", "state": "Tamil Nadu", "district": "Dindigul", "lat": 10.3673, "lon": 77.9803, "aliases": []},
    {"name": "Thanjavur", "state": "Tamil Nadu", "district": "Thanjavur", "lat": 10.7870, "lon": 79.1378, "aliases": ["Tanjore"]},
    {"name": "Ooty", "state": "Tamil Nadu", "district": "Nilgiris", "lat": 11.4102, "lon": 76.6950, "aliases": ["Udhagamandalam"]},
    {"name": "Kanchipuram", "state": "Tamil Nadu", "district": "Kanchipuram", "lat": 12.8342, "lon": 79.7036, "aliases": ["Kanchi"]},
    {"name": "Kanyakumari", "state": "Tamil Nadu", "district": "Kanyakumari", "lat": 8.0883, "lon": 77.5385, "aliases": ["Cape Comorin"]},

    # Karnataka
    {"name": "Bengaluru", "state": "Karnataka", "district": "Bengaluru Urban", "lat": 12.9716, "lon": 77.5946, "aliases": ["Bangalore", "Silicon Valley of India"], "is_capital": True},
    {"name": "Mysuru", "state": "Karnataka", "district": "Mysuru", "lat": 12.2958, "lon": 76.6394, "aliases": ["Mysore"]},
    {"name": "Hubballi", "state": "Karnataka", "district": "Dharwad", "lat": 15.3647, "lon": 75.1240, "aliases": ["Hubli"]},
    {"name": "Mangaluru", "state": "Karnataka", "district": "Dakshina Kannada", "lat": 12.9141, "lon": 74.8560, "aliases": ["Mangalore", "Kudla"]},
    {"name": "Belagavi", "state": "Karnataka", "district": "Belagavi", "lat": 15.8497, "lon": 74.4977, "aliases": ["Belgaum"]},
    {"name": "Kalaburagi", "state": "Karnataka", "district": "Kalaburagi", "lat": 17.3297, "lon": 76.8343, "aliases": ["Gulbarga"]},
    {"name": "Davanagere", "state": "Karnataka", "district": "Davanagere", "lat": 14.4644, "lon": 75.9218, "aliases": []},
    {"name": "Ballari", "state": "Karnataka", "district": "Ballari", "lat": 15.1394, "lon": 76.9214, "aliases": ["Bellary"]},
    {"name": "Vijayapura", "state": "Karnataka", "district": "Vijayapura", "lat": 16.8302, "lon": 75.7100, "aliases": ["Bijapur"]},
    {"name": "Shivamogga", "state": "Karnataka", "district": "Shivamogga", "lat": 13.9299, "lon": 75.5681, "aliases": ["Shimoga"]},
    {"name": "Tumakuru", "state": "Karnataka", "district": "Tumakuru", "lat": 13.3379, "lon": 77.1173, "aliases": ["Tumkur"]},
    {"name": "Udupi", "state": "Karnataka", "district": "Udupi", "lat": 13.3409, "lon": 74.7421, "aliases": []},
    {"name": "Hassan", "state": "Karnataka", "district": "Hassan", "lat": 13.0072, "lon": 76.0963, "aliases": []},
    {"name": "Bidar", "state": "Karnataka", "district": "Bidar", "lat": 17.9104, "lon": 77.5199, "aliases": []},
    {"name": "Raichur", "state": "Karnataka", "district": "Raichur", "lat": 16.2076, "lon": 77.3463, "aliases": []},

    # Kerala
    {"name": "Thiruvananthapuram", "state": "Kerala", "district": "Thiruvananthapuram", "lat": 8.5241, "lon": 76.9366, "aliases": ["Trivandrum"], "is_capital": True},
    {"name": "Kochi", "state": "Kerala", "district": "Ernakulam", "lat": 9.9312, "lon": 76.2673, "aliases": ["Cochin", "Ernakulam"]},
    {"name": "Kozhikode", "state": "Kerala", "district": "Kozhikode", "lat": 11.2588, "lon": 75.7804, "aliases": ["Calicut"]},
    {"name": "Kollam", "state": "Kerala", "district": "Kollam", "lat": 8.8932, "lon": 76.6141, "aliases": ["Quilon"]},
    {"name": "Thrissur", "state": "Kerala", "district": "Thrissur", "lat": 10.5276, "lon": 76.2144, "aliases": ["Trichur"]},
    {"name": "Kannur", "state": "Kerala", "district": "Kannur", "lat": 11.8745, "lon": 75.3704, "aliases": ["Cannanore"]},
    {"name": "Alappuzha", "state": "Kerala", "district": "Alappuzha", "lat": 9.4981, "lon": 76.3388, "aliases": ["Alleppey"]},
    {"name": "Palakkad", "state": "Kerala", "district": "Palakkad", "lat": 10.7867, "lon": 76.6548, "aliases": ["Palghat"]},
    {"name": "Kottayam", "state": "Kerala", "district": "Kottayam", "lat": 9.5916, "lon": 76.5222, "aliases": []},
    {"name": "Malappuram", "state": "Kerala", "district": "Malappuram", "lat": 11.0510, "lon": 76.0711, "aliases": []},
    {"name": "Munnar", "state": "Kerala", "district": "Idukki", "lat": 10.0889, "lon": 77.0595, "aliases": []},
    {"name": "Wayanad", "state": "Kerala", "district": "Wayanad", "lat": 11.6854, "lon": 76.1320, "aliases": ["Kalpetta"]},

    # Maharashtra
    {"name": "Mumbai", "state": "Maharashtra", "district": "Mumbai City", "lat": 19.0760, "lon": 72.8777, "aliases": ["Bombay"], "is_capital": True},
    {"name": "Pune", "state": "Maharashtra", "district": "Pune", "lat": 18.5204, "lon": 73.8567, "aliases": ["Poona"]},
    {"name": "Nagpur", "state": "Maharashtra", "district": "Nagpur", "lat": 21.1458, "lon": 79.0882, "aliases": ["Orange City"]},
    {"name": "Thane", "state": "Maharashtra", "district": "Thane", "lat": 19.2183, "lon": 72.9781, "aliases": []},
    {"name": "Nashik", "state": "Maharashtra", "district": "Nashik", "lat": 19.9975, "lon": 73.7898, "aliases": ["Nasik"]},
    {"name": "Kalyan", "state": "Maharashtra", "district": "Thane", "lat": 19.2437, "lon": 73.1355, "aliases": ["Kalyan-Dombivli"]},
    {"name": "Chhatrapati Sambhajinagar", "state": "Maharashtra", "district": "Chhatrapati Sambhajinagar", "lat": 19.8762, "lon": 75.3433, "aliases": ["Aurangabad"]},
    {"name": "Navi Mumbai", "state": "Maharashtra", "district": "Thane", "lat": 19.0330, "lon": 73.0297, "aliases": ["New Bombay"]},
    {"name": "Solapur", "state": "Maharashtra", "district": "Solapur", "lat": 17.6599, "lon": 75.9064, "aliases": []},
    {"name": "Kolhapur", "state": "Maharashtra", "district": "Kolhapur", "lat": 16.7050, "lon": 74.2433, "aliases": []},
    {"name": "Amravati", "state": "Maharashtra", "district": "Amravati", "lat": 20.9374, "lon": 77.7796, "aliases": []},
    {"name": "Nanded", "state": "Maharashtra", "district": "Nanded", "lat": 19.1383, "lon": 77.3210, "aliases": []},
    {"name": "Jalgaon", "state": "Maharashtra", "district": "Jalgaon", "lat": 21.0077, "lon": 75.5626, "aliases": []},
    {"name": "Akola", "state": "Maharashtra", "district": "Akola", "lat": 20.7002, "lon": 77.0082, "aliases": []},
    {"name": "Latur", "state": "Maharashtra", "district": "Latur", "lat": 18.4088, "lon": 76.5604, "aliases": []},
    {"name": "Dhule", "state": "Maharashtra", "district": "Dhule", "lat": 20.9042, "lon": 74.7749, "aliases": []},
    {"name": "Ahmednagar", "state": "Maharashtra", "district": "Ahilyanagar", "lat": 19.0948, "lon": 74.7480, "aliases": ["Ahilyanagar"]},
    {"name": "Chandrapur", "state": "Maharashtra", "district": "Chandrapur", "lat": 19.9615, "lon": 79.2961, "aliases": []},
    {"name": "Shirdi", "state": "Maharashtra", "district": "Ahilyanagar", "lat": 19.7667, "lon": 74.4766, "aliases": []},

    # Gujarat
    {"name": "Ahmedabad", "state": "Gujarat", "district": "Ahmedabad", "lat": 23.0225, "lon": 72.5714, "aliases": ["Amdavad"]},
    {"name": "Surat", "state": "Gujarat", "district": "Surat", "lat": 21.1702, "lon": 72.8311, "aliases": ["Diamond City"]},
    {"name": "Vadodara", "state": "Gujarat", "district": "Vadodara", "lat": 22.3072, "lon": 73.1812, "aliases": ["Baroda"]},
    {"name": "Rajkot", "state": "Gujarat", "district": "Rajkot", "lat": 22.3039, "lon": 70.8022, "aliases": []},
    {"name": "Bhavnagar", "state": "Gujarat", "district": "Bhavnagar", "lat": 21.7645, "lon": 72.1519, "aliases": []},
    {"name": "Jamnagar", "state": "Gujarat", "district": "Jamnagar", "lat": 22.4707, "lon": 70.0577, "aliases": []},
    {"name": "Gandhinagar", "state": "Gujarat", "district": "Gandhinagar", "lat": 23.2156, "lon": 72.6369, "aliases": [], "is_capital": True},
    {"name": "Junagadh", "state": "Gujarat", "district": "Junagadh", "lat": 21.5222, "lon": 70.4579, "aliases": []},
    {"name": "Anand", "state": "Gujarat", "district": "Anand", "lat": 22.5645, "lon": 72.9289, "aliases": ["Milk Capital"]},
    {"name": "Navsari", "state": "Gujarat", "district": "Navsari", "lat": 20.9500, "lon": 72.9333, "aliases": []},
    {"name": "Bharuch", "state": "Gujarat", "district": "Bharuch", "lat": 21.7051, "lon": 72.9959, "aliases": []},
    {"name": "Morbi", "state": "Gujarat", "district": "Morbi", "lat": 22.8120, "lon": 70.8377, "aliases": []},
    {"name": "Bhuj", "state": "Gujarat", "district": "Kutch", "lat": 23.2420, "lon": 69.6669, "aliases": ["Kutch"]},
    {"name": "Porbandar", "state": "Gujarat", "district": "Porbandar", "lat": 21.6417, "lon": 69.6293, "aliases": []},

    # Rajasthan
    {"name": "Jaipur", "state": "Rajasthan", "district": "Jaipur", "lat": 26.9124, "lon": 75.7873, "aliases": ["Pink City"], "is_capital": True},
    {"name": "Jodhpur", "state": "Rajasthan", "district": "Jodhpur", "lat": 26.2389, "lon": 73.0243, "aliases": ["Blue City", "Sun City"]},
    {"name": "Kota", "state": "Rajasthan", "district": "Kota", "lat": 25.2138, "lon": 75.8648, "aliases": []},
    {"name": "Bikaner", "state": "Rajasthan", "district": "Bikaner", "lat": 28.0229, "lon": 73.3119, "aliases": []},
    {"name": "Ajmer", "state": "Rajasthan", "district": "Ajmer", "lat": 26.4499, "lon": 74.6399, "aliases": []},
    {"name": "Udaipur", "state": "Rajasthan", "district": "Udaipur", "lat": 24.5854, "lon": 73.7125, "aliases": ["City of Lakes"]},
    {"name": "Bhilwara", "state": "Rajasthan", "district": "Bhilwara", "lat": 25.3407, "lon": 74.6313, "aliases": []},
    {"name": "Alwar", "state": "Rajasthan", "district": "Alwar", "lat": 27.5530, "lon": 76.6346, "aliases": []},
    {"name": "Bharatpur", "state": "Rajasthan", "district": "Bharatpur", "lat": 27.2152, "lon": 77.5030, "aliases": []},
    {"name": "Sikar", "state": "Rajasthan", "district": "Sikar", "lat": 27.6094, "lon": 75.1398, "aliases": []},
    {"name": "Pali", "state": "Rajasthan", "district": "Pali", "lat": 25.7781, "lon": 73.3311, "aliases": []},
    {"name": "Sri Ganganagar", "state": "Rajasthan", "district": "Ganganagar", "lat": 29.9038, "lon": 73.8772, "aliases": ["Ganganagar"]},
    {"name": "Jaisalmer", "state": "Rajasthan", "district": "Jaisalmer", "lat": 26.9157, "lon": 70.9083, "aliases": ["Golden City"]},
    {"name": "Barmer", "state": "Rajasthan", "district": "Barmer", "lat": 25.7521, "lon": 71.3967, "aliases": []},

    # Uttar Pradesh
    {"name": "Lucknow", "state": "Uttar Pradesh", "district": "Lucknow", "lat": 26.8467, "lon": 80.9462, "aliases": ["Nawabo Ka Shehar"], "is_capital": True},
    {"name": "Kanpur", "state": "Uttar Pradesh", "district": "Kanpur Nagar", "lat": 26.4499, "lon": 80.3319, "aliases": ["Cawnpore"]},
    {"name": "Ghaziabad", "state": "Uttar Pradesh", "district": "Ghaziabad", "lat": 28.6692, "lon": 77.4538, "aliases": []},
    {"name": "Agra", "state": "Uttar Pradesh", "district": "Agra", "lat": 27.1767, "lon": 78.0081, "aliases": ["Taj Nagari"]},
    {"name": "Meerut", "state": "Uttar Pradesh", "district": "Meerut", "lat": 28.9845, "lon": 77.7064, "aliases": []},
    {"name": "Varanasi", "state": "Uttar Pradesh", "district": "Varanasi", "lat": 25.3176, "lon": 82.9739, "aliases": ["Banaras", "Kashi"]},
    {"name": "Prayagraj", "state": "Uttar Pradesh", "district": "Prayagraj", "lat": 25.4358, "lon": 81.8463, "aliases": ["Allahabad"]},
    {"name": "Bareilly", "state": "Uttar Pradesh", "district": "Bareilly", "lat": 28.3670, "lon": 79.4304, "aliases": []},
    {"name": "Aligarh", "state": "Uttar Pradesh", "district": "Aligarh", "lat": 27.8974, "lon": 78.0880, "aliases": []},
    {"name": "Moradabad", "state": "Uttar Pradesh", "district": "Moradabad", "lat": 28.8386, "lon": 78.7733, "aliases": ["Brass City"]},
    {"name": "Saharanpur", "state": "Uttar Pradesh", "district": "Saharanpur", "lat": 29.9671, "lon": 77.5510, "aliases": []},
    {"name": "Gorakhpur", "state": "Uttar Pradesh", "district": "Gorakhpur", "lat": 26.7606, "lon": 83.3732, "aliases": []},
    {"name": "Noida", "state": "Uttar Pradesh", "district": "Gautam Buddha Nagar", "lat": 28.5355, "lon": 77.3910, "aliases": ["Greater Noida"]},
    {"name": "Firozabad", "state": "Uttar Pradesh", "district": "Firozabad", "lat": 27.1593, "lon": 78.3957, "aliases": []},
    {"name": "Jhansi", "state": "Uttar Pradesh", "district": "Jhansi", "lat": 25.4484, "lon": 78.5685, "aliases": []},
    {"name": "Muzaffarnagar", "state": "Uttar Pradesh", "district": "Muzaffarnagar", "lat": 29.4727, "lon": 77.7085, "aliases": []},
    {"name": "Mathura", "state": "Uttar Pradesh", "district": "Mathura", "lat": 27.4924, "lon": 77.6737, "aliases": ["Vrindavan"]},
    {"name": "Ayodhya", "state": "Uttar Pradesh", "district": "Ayodhya", "lat": 26.7922, "lon": 82.1998, "aliases": ["Faizabad"]},
    {"name": "Mirzapur", "state": "Uttar Pradesh", "district": "Mirzapur", "lat": 25.1337, "lon": 82.5644, "aliases": []},

    # Madhya Pradesh
    {"name": "Bhopal", "state": "Madhya Pradesh", "district": "Bhopal", "lat": 23.2599, "lon": 77.4126, "aliases": [], "is_capital": True},
    {"name": "Indore", "state": "Madhya Pradesh", "district": "Indore", "lat": 22.7196, "lon": 75.8577, "aliases": ["Mini Bombay", "Cleanest City"]},
    {"name": "Jabalpur", "state": "Madhya Pradesh", "district": "Jabalpur", "lat": 23.1815, "lon": 79.9864, "aliases": ["Sanskardhani"]},
    {"name": "Gwalior", "state": "Madhya Pradesh", "district": "Gwalior", "lat": 26.2183, "lon": 78.1828, "aliases": []},
    {"name": "Ujjain", "state": "Madhya Pradesh", "district": "Ujjain", "lat": 23.1765, "lon": 75.7885, "aliases": ["Mahakal City"]},
    {"name": "Sagar", "state": "Madhya Pradesh", "district": "Sagar", "lat": 23.8388, "lon": 78.7378, "aliases": []},
    {"name": "Dewas", "state": "Madhya Pradesh", "district": "Dewas", "lat": 22.9676, "lon": 76.0534, "aliases": []},
    {"name": "Satna", "state": "Madhya Pradesh", "district": "Satna", "lat": 24.5800, "lon": 80.8300, "aliases": []},
    {"name": "Ratlam", "state": "Madhya Pradesh", "district": "Ratlam", "lat": 23.3315, "lon": 75.0367, "aliases": []},
    {"name": "Rewa", "state": "Madhya Pradesh", "district": "Rewa", "lat": 24.5362, "lon": 81.3037, "aliases": []},
    {"name": "Singrauli", "state": "Madhya Pradesh", "district": "Singrauli", "lat": 24.1997, "lon": 82.6644, "aliases": []},

    # West Bengal
    {"name": "Kolkata", "state": "West Bengal", "district": "Kolkata", "lat": 22.5726, "lon": 88.3639, "aliases": ["Calcutta", "City of Joy"], "is_capital": True},
    {"name": "Howrah", "state": "West Bengal", "district": "Howrah", "lat": 22.5958, "lon": 88.2636, "aliases": []},
    {"name": "Asansol", "state": "West Bengal", "district": "Paschim Bardhaman", "lat": 23.6739, "lon": 86.9524, "aliases": []},
    {"name": "Siliguri", "state": "West Bengal", "district": "Darjeeling", "lat": 26.7271, "lon": 88.3953, "aliases": ["Gateway of Northeast"]},
    {"name": "Durgapur", "state": "West Bengal", "district": "Paschim Bardhaman", "lat": 23.5204, "lon": 87.3119, "aliases": ["Steel City"]},
    {"name": "Bardhaman", "state": "West Bengal", "district": "Purba Bardhaman", "lat": 23.2324, "lon": 87.8615, "aliases": ["Burdwan"]},
    {"name": "Malda", "state": "West Bengal", "district": "Malda", "lat": 25.0069, "lon": 88.1458, "aliases": ["English Bazar"]},
    {"name": "Kharagpur", "state": "West Bengal", "district": "Paschim Medinipur", "lat": 22.3460, "lon": 87.2320, "aliases": []},
    {"name": "Darjeeling", "state": "West Bengal", "district": "Darjeeling", "lat": 27.0410, "lon": 88.2663, "aliases": ["Queen of the Hills"]},
    {"name": "Haldia", "state": "West Bengal", "district": "Purba Medinipur", "lat": 22.0667, "lon": 88.0698, "aliases": []},

    # Bihar
    {"name": "Patna", "state": "Bihar", "district": "Patna", "lat": 25.5941, "lon": 85.1376, "aliases": ["Pataliputra"], "is_capital": True},
    {"name": "Gaya", "state": "Bihar", "district": "Gaya", "lat": 24.7914, "lon": 85.0002, "aliases": ["Bodh Gaya"]},
    {"name": "Bhagalpur", "state": "Bihar", "district": "Bhagalpur", "lat": 25.2425, "lon": 86.9842, "aliases": ["Silk City"]},
    {"name": "Muzaffarpur", "state": "Bihar", "district": "Muzaffarpur", "lat": 26.1209, "lon": 85.3647, "aliases": ["Litchi City"]},
    {"name": "Purnia", "state": "Bihar", "district": "Purnia", "lat": 25.7771, "lon": 87.4753, "aliases": ["Purnea"]},
    {"name": "Darbhanga", "state": "Bihar", "district": "Darbhanga", "lat": 26.1542, "lon": 85.8918, "aliases": []},
    {"name": "Bihar Sharif", "state": "Bihar", "district": "Nalanda", "lat": 25.1982, "lon": 85.5149, "aliases": ["Nalanda"]},
    {"name": "Arrah", "state": "Bihar", "district": "Bhojpur", "lat": 25.5560, "lon": 84.6603, "aliases": ["Ara"]},
    {"name": "Begusarai", "state": "Bihar", "district": "Begusarai", "lat": 25.4182, "lon": 86.1272, "aliases": []},
    {"name": "Katihar", "state": "Bihar", "district": "Katihar", "lat": 25.5394, "lon": 87.5714, "aliases": []},

    # Odisha
    {"name": "Bhubaneswar", "state": "Odisha", "district": "Khurda", "lat": 20.2961, "lon": 85.8245, "aliases": ["Temple City"], "is_capital": True},
    {"name": "Cuttack", "state": "Odisha", "district": "Cuttack", "lat": 20.4625, "lon": 85.8828, "aliases": ["Silver City"]},
    {"name": "Rourkela", "state": "Odisha", "district": "Sundargarh", "lat": 22.2604, "lon": 84.8536, "aliases": ["Steel City"]},
    {"name": "Berhampur", "state": "Odisha", "district": "Ganjam", "lat": 19.3150, "lon": 84.7941, "aliases": ["Brahmapur"]},
    {"name": "Sambalpur", "state": "Odisha", "district": "Sambalpur", "lat": 21.4669, "lon": 83.9812, "aliases": []},
    {"name": "Puri", "state": "Odisha", "district": "Puri", "lat": 19.8135, "lon": 85.8312, "aliases": ["Jagannath Puri"]},
    {"name": "Balasore", "state": "Odisha", "district": "Balasore", "lat": 21.4934, "lon": 86.9135, "aliases": ["Baleshwar"]},
    {"name": "Bhadrak", "state": "Odisha", "district": "Bhadrak", "lat": 21.0544, "lon": 86.4960, "aliases": []},
    {"name": "Jharsuguda", "state": "Odisha", "district": "Jharsuguda", "lat": 21.8554, "lon": 84.0062, "aliases": []},

    # Punjab
    {"name": "Ludhiana", "state": "Punjab", "district": "Ludhiana", "lat": 30.9010, "lon": 75.8573, "aliases": []},
    {"name": "Amritsar", "state": "Punjab", "district": "Amritsar", "lat": 31.6340, "lon": 74.8723, "aliases": ["Golden Temple City"]},
    {"name": "Jalandhar", "state": "Punjab", "district": "Jalandhar", "lat": 31.3260, "lon": 75.5762, "aliases": []},
    {"name": "Patiala", "state": "Punjab", "district": "Patiala", "lat": 30.3398, "lon": 76.3869, "aliases": ["Royal City"]},
    {"name": "Bathinda", "state": "Punjab", "district": "Bathinda", "lat": 30.2110, "lon": 74.9455, "aliases": ["Bhatinda"]},
    {"name": "Mohali", "state": "Punjab", "district": "SAS Nagar", "lat": 30.7046, "lon": 76.7179, "aliases": ["SAS Nagar"]},
    {"name": "Pathankot", "state": "Punjab", "district": "Pathankot", "lat": 32.2684, "lon": 75.6499, "aliases": []},

    # Haryana
    {"name": "Faridabad", "state": "Haryana", "district": "Faridabad", "lat": 28.4089, "lon": 77.3178, "aliases": []},
    {"name": "Gurugram", "state": "Haryana", "district": "Gurugram", "lat": 28.4595, "lon": 77.0266, "aliases": ["Gurgaon", "Cyber City"]},
    {"name": "Panipat", "state": "Haryana", "district": "Panipat", "lat": 29.3909, "lon": 76.9635, "aliases": ["City of Weavers"]},
    {"name": "Ambala", "state": "Haryana", "district": "Ambala", "lat": 30.3782, "lon": 76.7767, "aliases": ["Twin City"]},
    {"name": "Yamunanagar", "state": "Haryana", "district": "Yamunanagar", "lat": 30.1290, "lon": 77.2674, "aliases": []},
    {"name": "Rohtak", "state": "Haryana", "district": "Rohtak", "lat": 28.8955, "lon": 76.6066, "aliases": []},
    {"name": "Hisar", "state": "Haryana", "district": "Hisar", "lat": 29.1492, "lon": 75.7217, "aliases": ["Hissar"]},
    {"name": "Karnal", "state": "Haryana", "district": "Karnal", "lat": 29.6857, "lon": 76.9905, "aliases": ["Rice Bowl"]},
    {"name": "Panchkula", "state": "Haryana", "district": "Panchkula", "lat": 30.6942, "lon": 76.8606, "aliases": []},

    # Delhi (NCT)
    {"name": "Delhi", "state": "Delhi", "district": "New Delhi", "lat": 28.6139, "lon": 77.2090, "aliases": ["New Delhi", "Dilli", "NCR"], "is_capital": True},

    # Chandigarh (UT)
    {"name": "Chandigarh", "state": "Chandigarh", "district": "Chandigarh", "lat": 30.7333, "lon": 76.7794, "aliases": ["The City Beautiful"], "is_capital": True},

    # Assam & Northeast
    {"name": "Guwahati", "state": "Assam", "district": "Kamrup Metropolitan", "lat": 26.1445, "lon": 91.7362, "aliases": ["Gauhati", "Dispur"], "is_capital": True},
    {"name": "Silchar", "state": "Assam", "district": "Cachar", "lat": 24.8333, "lon": 92.7789, "aliases": []},
    {"name": "Dibrugarh", "state": "Assam", "district": "Dibrugarh", "lat": 27.4728, "lon": 94.9120, "aliases": ["Tea City"]},
    {"name": "Jorhat", "state": "Assam", "district": "Jorhat", "lat": 26.7509, "lon": 94.2037, "aliases": []},
    {"name": "Tezpur", "state": "Assam", "district": "Sonitpur", "lat": 26.6528, "lon": 92.7926, "aliases": []},
    {"name": "Shillong", "state": "Meghalaya", "district": "East Khasi Hills", "lat": 25.5788, "lon": 91.8933, "aliases": ["Scotland of the East"], "is_capital": True},
    {"name": "Agartala", "state": "Tripura", "district": "West Tripura", "lat": 23.8315, "lon": 91.2868, "aliases": [], "is_capital": True},
    {"name": "Imphal", "state": "Manipur", "district": "Imphal West", "lat": 24.8170, "lon": 93.9368, "aliases": [], "is_capital": True},
    {"name": "Aizawl", "state": "Mizoram", "district": "Aizawl", "lat": 23.7271, "lon": 92.7176, "aliases": [], "is_capital": True},
    {"name": "Kohima", "state": "Nagaland", "district": "Kohima", "lat": 25.6751, "lon": 94.1086, "aliases": [], "is_capital": True},
    {"name": "Dimapur", "state": "Nagaland", "district": "Dimapur", "lat": 25.9068, "lon": 93.7273, "aliases": []},
    {"name": "Gangtok", "state": "Sikkim", "district": "East Sikkim", "lat": 27.3389, "lon": 88.6065, "aliases": [], "is_capital": True},
    {"name": "Itanagar", "state": "Arunachal Pradesh", "district": "Papum Pare", "lat": 27.0844, "lon": 93.6053, "aliases": [], "is_capital": True},

    # Jharkhand
    {"name": "Ranchi", "state": "Jharkhand", "district": "Ranchi", "lat": 23.3441, "lon": 85.3096, "aliases": ["City of Waterfalls"], "is_capital": True},
    {"name": "Jamshedpur", "state": "Jharkhand", "district": "East Singhbhum", "lat": 22.8046, "lon": 86.2029, "aliases": ["Tatanagar", "Steel City"]},
    {"name": "Dhanbad", "state": "Jharkhand", "district": "Dhanbad", "lat": 23.7957, "lon": 86.4304, "aliases": ["Coal Capital"]},
    {"name": "Bokaro", "state": "Jharkhand", "district": "Bokaro", "lat": 23.6693, "lon": 86.1511, "aliases": ["Bokaro Steel City"]},
    {"name": "Deoghar", "state": "Jharkhand", "district": "Deoghar", "lat": 24.4826, "lon": 86.7000, "aliases": ["Baidyanath Dham"]},
    {"name": "Hazaribagh", "state": "Jharkhand", "district": "Hazaribagh", "lat": 23.9925, "lon": 85.3637, "aliases": []},

    # Chhattisgarh
    {"name": "Raipur", "state": "Chhattisgarh", "district": "Raipur", "lat": 21.2514, "lon": 81.6296, "aliases": [], "is_capital": True},
    {"name": "Bhilai", "state": "Chhattisgarh", "district": "Durg", "lat": 21.2121, "lon": 81.3733, "aliases": ["Bhilai Nagar", "Durg"]},
    {"name": "Bilaspur", "state": "Chhattisgarh", "district": "Bilaspur", "lat": 22.0797, "lon": 82.1409, "aliases": []},
    {"name": "Korba", "state": "Chhattisgarh", "district": "Korba", "lat": 22.3595, "lon": 82.7501, "aliases": ["Power Hub"]},
    {"name": "Jagdalpur", "state": "Chhattisgarh", "district": "Bastar", "lat": 19.0740, "lon": 82.0084, "aliases": ["Bastar"]},

    # Uttarakhand
    {"name": "Dehradun", "state": "Uttarakhand", "district": "Dehradun", "lat": 30.3165, "lon": 78.0322, "aliases": ["Doon"], "is_capital": True},
    {"name": "Haridwar", "state": "Uttarakhand", "district": "Haridwar", "lat": 29.9457, "lon": 78.1642, "aliases": ["Hardwar"]},
    {"name": "Rishikesh", "state": "Uttarakhand", "district": "Dehradun", "lat": 30.0869, "lon": 78.2676, "aliases": ["Yoga Capital"]},
    {"name": "Haldwani", "state": "Uttarakhand", "district": "Nainital", "lat": 29.2183, "lon": 79.5130, "aliases": ["Kathgodam"]},
    {"name": "Roorkee", "state": "Uttarakhand", "district": "Haridwar", "lat": 29.8543, "lon": 77.8880, "aliases": []},
    {"name": "Nainital", "state": "Uttarakhand", "district": "Nainital", "lat": 29.3919, "lon": 79.4542, "aliases": []},

    # Himachal Pradesh
    {"name": "Shimla", "state": "Himachal Pradesh", "district": "Shimla", "lat": 31.1048, "lon": 77.1734, "aliases": ["Simla"], "is_capital": True},
    {"name": "Dharamshala", "state": "Himachal Pradesh", "district": "Kangra", "lat": 32.2190, "lon": 76.3234, "aliases": ["McLeodGanj", "Kangra"]},
    {"name": "Solan", "state": "Himachal Pradesh", "district": "Solan", "lat": 30.9084, "lon": 77.0999, "aliases": ["Mushroom City"]},
    {"name": "Mandi", "state": "Himachal Pradesh", "district": "Mandi", "lat": 31.7087, "lon": 76.9320, "aliases": ["Varanasi of Hills"]},
    {"name": "Kullu", "state": "Himachal Pradesh", "district": "Kullu", "lat": 31.9579, "lon": 77.1095, "aliases": ["Manali", "Valley of Gods"]},

    # Jammu & Kashmir / Ladakh
    {"name": "Srinagar", "state": "Jammu & Kashmir", "district": "Srinagar", "lat": 34.0837, "lon": 74.7973, "aliases": ["Summer Capital"], "is_capital": True},
    {"name": "Jammu", "state": "Jammu & Kashmir", "district": "Jammu", "lat": 32.7266, "lon": 74.8570, "aliases": ["Winter Capital", "City of Temples"], "is_capital": True},
    {"name": "Anantnag", "state": "Jammu & Kashmir", "district": "Anantnag", "lat": 33.7311, "lon": 75.1522, "aliases": ["Islamabad"]},
    {"name": "Leh", "state": "Ladakh", "district": "Leh", "lat": 34.1526, "lon": 77.5771, "aliases": [], "is_capital": True},
    {"name": "Kargil", "state": "Ladakh", "district": "Kargil", "lat": 34.5539, "lon": 76.1349, "aliases": []},

    # Goa
    {"name": "Panaji", "state": "Goa", "district": "North Goa", "lat": 15.4909, "lon": 73.8278, "aliases": ["Panjim"], "is_capital": True},
    {"name": "Margao", "state": "Goa", "district": "South Goa", "lat": 15.2832, "lon": 73.9862, "aliases": ["Madgaon"]},
    {"name": "Vasco da Gama", "state": "Goa", "district": "South Goa", "lat": 15.3995, "lon": 73.8125, "aliases": ["Vasco"]},

    # Island & Coastal UTs
    {"name": "Port Blair", "state": "Andaman and Nicobar Islands", "district": "South Andaman", "lat": 11.6234, "lon": 92.7265, "aliases": ["Sri Vijaya Puram"], "is_capital": True},
    {"name": "Puducherry", "state": "Puducherry", "district": "Puducherry", "lat": 11.9416, "lon": 79.8083, "aliases": ["Pondicherry"], "is_capital": True},
    {"name": "Kavaratti", "state": "Lakshadweep", "district": "Lakshadweep", "lat": 10.5669, "lon": 72.6420, "aliases": [], "is_capital": True},
    {"name": "Daman", "state": "Dadra and Nagar Haveli and Daman and Diu", "district": "Daman", "lat": 20.3974, "lon": 72.8328, "aliases": ["Diu"], "is_capital": True}
]


async def seed_locations():
    print(f"--- Seeding Indian Locations Database ---")
    print(f"Total curated locations: {len(INDIAN_LOCATIONS)}")
    
    # Initialize connection
    await db_manager.connect_to_database()
    db = db_manager.db

    if db_manager.is_connected and db is not None:
        print(f"Connected to MongoDB Atlas database: {settings.MONGODB_DB_NAME}")
        # Ensure indexes are created
        await init_db_indexes(db)

        # Batch insert/upsert
        print("Upserting location documents...")
        upserted_count = 0
        for loc in INDIAN_LOCATIONS:
            loc["updated_at"] = datetime.utcnow()
            result = await db.locations.update_one(
                {"name": loc["name"], "state": loc["state"]},
                {"$set": loc},
                upsert=True
            )
            if result.upserted_id or result.modified_count:
                upserted_count += 1

        total_in_db = await db.locations.count_documents({})
        print(f"[OK] Successfully seeded locations into MongoDB Atlas!")
        print(f"[OK] Locations count in MongoDB: {total_in_db}")

        # Test sample text search
        sample_query = "Vizag"
        sample_result = await LocationRepository.search_locations(sample_query, limit=3)
        print(f"\n[Verification Search] Query '{sample_query}' returned:")
        for r in sample_result:
            print(f"  -> {r.name}, {r.state} (lat: {r.lat}, lon: {r.lon}) | aliases: {r.aliases}")

    else:
        print("Notice: MongoDB Atlas not reachable on local port or URI not configured.")
        print("Seeding in-memory LocationRepository store for local development/testing...")
        await LocationRepository.insert_many(INDIAN_LOCATIONS)
        count = await LocationRepository.count()
        print(f"[OK] Successfully loaded {count} locations into in-memory repository store.")
        
        sample_query = "Kurnool"
        sample_result = await LocationRepository.search_locations(sample_query, limit=3)
        print(f"\n[Verification Search] Query '{sample_query}' returned:")
        for r in sample_result:
            print(f"  -> {r.name}, {r.state} (lat: {r.lat}, lon: {r.lon})")

    await db_manager.close_database_connection()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed_locations())
