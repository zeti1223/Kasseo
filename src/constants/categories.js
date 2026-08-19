import i18next from "@/i18n";

export const CATEGORY_ICONS = {
  "Food & Groceries": "fas fa-utensils",
  "Rent & Utilities": "fas fa-house",
  "Transport": "fas fa-car",
  "Entertainment": "fas fa-gamepad",
  "Shopping": "fas fa-bag-shopping",
  "Health": "fas fa-heart-pulse",
  "Travel": "fas fa-plane",
  "Other": "fas fa-tag",
};

export const CATEGORY_I18N_KEYS = {
  "Food & Groceries": "categories.foodAndGroceries",
  "Rent & Utilities": "categories.rentAndUtilities",
  "Transport": "categories.transport",
  "Entertainment": "categories.entertainment",
  "Shopping": "categories.shopping",
  "Health": "categories.health",
  "Travel": "categories.travel",
  "Other": "categories.other",
};

export const CATEGORIES = Object.keys(CATEGORY_ICONS);

export const PRESET_ICONS = [
  { icon: "fas fa-utensils", label: "Food & Dining", i18nKey: "categories.foodAndDining" },
  { icon: "fas fa-cart-shopping", label: "Groceries", i18nKey: "categories.groceries" },
  { icon: "fas fa-house", label: "Housing / Rent", i18nKey: "categories.housingRent" },
  { icon: "fas fa-bolt", label: "Utilities", i18nKey: "categories.utilities" },
  { icon: "fas fa-car", label: "Transport", i18nKey: "categories.transport" },
  { icon: "fas fa-bus", label: "Public Transport", i18nKey: "categories.publicTransport" },
  { icon: "fas fa-gas-pump", label: "Fuel", i18nKey: "categories.fuel" },
  { icon: "fas fa-gamepad", label: "Gaming", i18nKey: "categories.gaming" },
  { icon: "fas fa-film", label: "Movies & Cinema", i18nKey: "categories.moviesAndCinema" },
  { icon: "fas fa-music", label: "Music", i18nKey: "categories.music" },
  { icon: "fas fa-bag-shopping", label: "Shopping", i18nKey: "categories.shopping" },
  { icon: "fas fa-shirt", label: "Clothing", i18nKey: "categories.clothing" },
  { icon: "fas fa-heart-pulse", label: "Health & Medical", i18nKey: "categories.healthAndMedical" },
  { icon: "fas fa-pills", label: "Pharmacy", i18nKey: "categories.pharmacy" },
  { icon: "fas fa-plane", label: "Travel & Flights", i18nKey: "categories.travelAndFlights" },
  { icon: "fas fa-hotel", label: "Accommodation", i18nKey: "categories.accommodation" },
  { icon: "fas fa-mug-hot", label: "Coffee & Cafe", i18nKey: "categories.coffeeAndCafe" },
  { icon: "fas fa-beer-mug-empty", label: "Drinks & Bar", i18nKey: "categories.drinksAndBar" },
  { icon: "fas fa-circle-play", label: "Subscriptions", i18nKey: "categories.subscriptions" },
  { icon: "fas fa-paw", label: "Pets", i18nKey: "categories.pets" },
  { icon: "fas fa-dumbbell", label: "Fitness & Gym", i18nKey: "categories.fitnessAndGym" },
  { icon: "fas fa-graduation-cap", label: "Education", i18nKey: "categories.education" },
  { icon: "fas fa-book", label: "Books", i18nKey: "categories.books" },
  { icon: "fas fa-laptop", label: "Electronics", i18nKey: "categories.electronics" },
  { icon: "fas fa-mobile-screen", label: "Phone & Gadgets", i18nKey: "categories.phoneAndGadgets" },
  { icon: "fas fa-gift", label: "Gifts", i18nKey: "categories.gifts" },
  { icon: "fas fa-wallet", label: "Finance & Bills", i18nKey: "categories.financeAndBills" },
  { icon: "fas fa-wrench", label: "Services & Repairs", i18nKey: "categories.servicesAndRepairs" },
  { icon: "fas fa-child", label: "Family & Kids", i18nKey: "categories.familyAndKids" },
  { icon: "fas fa-scissors", label: "Beauty & Personal Care", i18nKey: "categories.beautyAndPersonalCare" },
  { icon: "fas fa-tag", label: "General Tag", i18nKey: "categories.generalTag" },
];

export function getCategoryIcon(categoryName, customIcon = null) {
  if (customIcon) return customIcon;
  if (!categoryName) return "fas fa-tag";

  if (CATEGORY_ICONS[categoryName]) {
    return CATEGORY_ICONS[categoryName];
  }

  return "fas fa-tag";
}

export function getCategoryLabel(categoryName, t) {
  if (!categoryName) return "";
  const key = CATEGORY_I18N_KEYS[categoryName];
  if (key) {
    return t ? t(key) : i18next.t(key);
  }
  return categoryName;
}
