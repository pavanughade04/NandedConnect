"use strict";

// Centralized frontend data. These records are preserved from the original
// directory and are intentionally kept separate from UI logic.
const directoryBusinesses = [
  {
    name: "PS Electrical & Engineers",
    category: "Electrical",
    area: "Waman Nagar",
    address: "Taroda Kh., Dhanvantri Colony, Waman Nagar, Nanded, Maharashtra 431605",
    phone: "+919130007955",
    rating: 5.0,
    reviews: 116,
    description: "Electrical services and contracting. Contact the provider to confirm the exact service you need.",
    icon: "⚡",
    mapQuery: "PS Electrical & engineers Waman Nagar Nanded"
  },
  {
    name: "SP Electrical",
    category: "Electrical",
    area: "Bhagya Nagar",
    address: "Geeta Nagar, Bhagya Nagar, Anand Nagar, Nanded, Maharashtra 431605",
    phone: "+919175957795",
    rating: 4.9,
    reviews: 49,
    description: "Local electrician listing. Confirm availability, pricing and service coverage directly.",
    icon: "⚡",
    mapQuery: "SP Electrical Geeta Nagar Nanded"
  },
  {
    name: "Kesari Laptop Care",
    category: "Computer & Mobile",
    area: "Vazirabad",
    address: "Yashodeep Malpani Building, 3-1-33, Collector Office Road, Shivaji Putala, Vazirabad, Nanded 431601",
    phone: "+919028106171",
    rating: 4.9,
    reviews: 616,
    description: "Computer and laptop sales/service listing. Call to confirm repair options and current timings.",
    icon: "💻",
    mapQuery: "Kesari Laptop Care Vazirabad Nanded"
  },
  {
    name: "M TECH Computers",
    category: "Computer & Mobile",
    area: "Anand Nagar",
    address: "Sai Bhawan, Anand Nagar Road, Vasant Nagar, Hyder Bagh, Nanded, Maharashtra 431602",
    phone: "+919545434318",
    rating: 5.0,
    reviews: 80,
    description: "Computer sales and repair listing. Confirm parts, pricing and availability before visiting.",
    icon: "🖥️",
    mapQuery: "M TECH Computers Anand Nagar Nanded"
  },
  {
    name: "Arman Mobile & Computer Services",
    category: "Computer & Mobile",
    area: "Khoja Colony",
    address: "Khoja Colony, Sai Nagar, Mafco Khoja Colony Road, Itwara Bazar Road, Nanded 431604",
    phone: "+919405383786",
    rating: 5.0,
    reviews: 208,
    description: "Mobile and computer repair listing in the Itwara area. Contact the shop to confirm repair details.",
    icon: "📱",
    mapQuery: "Arman Mobile Computer Services Khoja Colony Nanded"
  },
  {
    name: "Orion Computers",
    category: "Computer & Mobile",
    area: "Shivaji Nagar",
    address: "Mahatma Phule Market, Shop 38, ITI Road, near Chandu Kaka Saraf Jewels, Shivaji Nagar, Nanded 431602",
    phone: "+919823125503",
    rating: 4.8,
    reviews: 471,
    description: "Computer shop and service listing. Check the map listing or call for current details.",
    icon: "💻",
    mapQuery: "Orion Computers ITI Road Nanded"
  },
  {
    name: "Balaji Computers",
    category: "Computer & Mobile",
    area: "Vishnu Nagar",
    address: "Shop A-13, ITI Corner, Vishnu Complex, Visavanagar Colony, Vishnu Nagar, Nanded 431602",
    phone: "+918484925321",
    rating: 5.0,
    reviews: 44,
    description: "Computer and printer service listing. Confirm services and opening hours before visiting.",
    icon: "🖨️",
    mapQuery: "Balaji Computers Vishnu Complex Nanded"
  },
  {
    name: "Shiva's Skyline Computers",
    category: "Computer & Mobile",
    area: "Anand Nagar",
    address: "Jijau Nagar Road, near Rama Furniture, Geeta Nagar, Anand Nagar, Nanded 431605",
    phone: "+919890798136",
    rating: 4.8,
    reviews: 96,
    description: "Computer sales, service and networking listing. Contact the provider for current offerings.",
    icon: "🖥️",
    mapQuery: "Shiva Skyline Computers Anand Nagar Nanded"
  },
  {
    name: "Nucleus Computers",
    category: "Computer & Mobile",
    area: "Vasant Nagar",
    address: "Opposite Post Office, Vasant Nagar, Hyder Bagh, Dashmesh Nagar, Nanded 431602",
    phone: "+919021094013",
    rating: 5.0,
    reviews: 937,
    description: "Computer retail listing. Confirm current stock, repairs and opening hours directly.",
    icon: "💻",
    mapQuery: "Nucleus Computers Vasant Nagar Nanded"
  },
  {
    name: "Guru Bramha Pure Veg Restaurant",
    category: "Restaurants",
    area: "Vazirabad",
    address: "Near Chhatrapati Shivaji Maharaj Statue, Railway Station Road, Shivaji Putala, Vazirabad, Nanded 431601",
    phone: "+918484886681",
    rating: 4.8,
    reviews: 5785,
    description: "Vegetarian restaurant listing near Railway Station Road. Confirm current menu and timings directly.",
    icon: "🍽️",
    mapQuery: "Guru Bramha Pure Veg Restaurant Nanded"
  },
  {
    name: "Aamantran Garden Restaurant",
    category: "Restaurants",
    area: "Dhanvantri Colony",
    address: "Chhatrapati Chowk to More Chowk Road, Gopal Krishna Nagar, Dhanvantri Colony, Nanded 431605",
    phone: "+919373456899",
    rating: 4.6,
    reviews: 1070,
    description: "Restaurant listing near Chhatrapati Chowk. Call to verify today's opening hours and menu.",
    icon: "🍴",
    mapQuery: "Aamantran Garden Restaurant Nanded"
  },
  {
    name: "Kailash Parbat",
    category: "Restaurants",
    area: "Kabra Nagar",
    address: "Near More Chowk, Kabra Nagar, Tirumala Nagar, Nanded 431605",
    phone: "",
    rating: 4.7,
    reviews: 966,
    description: "Vegetarian restaurant listing. Use the map link to confirm current contact details and hours.",
    icon: "🥗",
    mapQuery: "Kailash Parbat Kabra Nagar Nanded"
  },
  {
    name: "Dwarka Dine-In Restaurant",
    category: "Restaurants",
    area: "Waman Nagar",
    address: "Chhatrapati Chowk to Kabra Nagar Road, Gopal Krishna Nagar, Waman Nagar, Nanded 431605",
    phone: "+918626036636",
    rating: 4.6,
    reviews: 401,
    description: "Vegetarian dine-in restaurant listing. Contact the restaurant for current menu and timings.",
    icon: "🍲",
    mapQuery: "Dwarka Dine In Restaurant Nanded"
  },
  {
    name: "Hotel Qureshiya",
    category: "Restaurants",
    area: "Degloor Naka",
    address: "Maltekri Road, Degloor Naka, Nanded, Maharashtra 431604",
    phone: "+919890910037",
    rating: 4.1,
    reviews: 1390,
    description: "Restaurant listing around Degloor Naka. Verify service details and opening hours before visiting.",
    icon: "🍛",
    mapQuery: "Hotel Qureshiya Degloor Naka Nanded"
  }
];

const directoryCategories = [
  { name: "Computer & Mobile", description: "Repair, accessories", icon: "💻" },
  { name: "Electrical", description: "Electrical services", icon: "⚡" },
  { name: "Restaurants", description: "Food & dining", icon: "🍽️" },
  { name: "Hotels", description: "Stay in Nanded", icon: "🛏️" },
  { name: "Home Services", description: "Everyday home help", icon: "🏠" },
  { name: "Education", description: "Learning & tutoring", icon: "📚" },
  { name: "Repairs", description: "Fixes & maintenance", icon: "🛠️" },
  { name: "Other", description: "More local services", icon: "✳️" }
];

const directoryTouristPlaces = [
  { type: "SPIRITUAL HERITAGE", name: "Takht Sri Hazur Sahib", mapQuery: "Takht Sri Hazur Sahib Nanded" },
  { type: "HISTORY", name: "Nanded Fort", mapQuery: "Nanded Fort" },
  { type: "NATURE & HERITAGE", name: "Godavari River", mapQuery: "Godavari River Nanded" },
  { type: "DISTRICT LANDMARK", name: "Kaleshwar Temple", mapQuery: "Kaleshwar Temple Vishnupuri Nanded" },
  { type: "DISTRICT PILGRIMAGE", name: "Mahur Gadh", mapQuery: "Mahur Gadh Renuka Devi Temple" },
  { type: "NATURE", name: "Sahastrakund Waterfall", mapQuery: "Sahastrakund Waterfall Nanded" }
];

window.NandedConnect = window.NandedConnect || {};
window.NandedConnect.data = Object.freeze({
  businesses: directoryBusinesses,
  categories: directoryCategories,
  touristPlaces: directoryTouristPlaces
});
