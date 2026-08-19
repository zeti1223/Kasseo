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

export const CATEGORIES = Object.keys(CATEGORY_ICONS);

export const PRESET_ICONS = [
  { icon: "fas fa-utensils", label: "Food & Dining" },
  { icon: "fas fa-cart-shopping", label: "Groceries" },
  { icon: "fas fa-house", label: "Housing / Rent" },
  { icon: "fas fa-bolt", label: "Utilities" },
  { icon: "fas fa-car", label: "Transport" },
  { icon: "fas fa-bus", label: "Public Transport" },
  { icon: "fas fa-gas-pump", label: "Fuel" },
  { icon: "fas fa-gamepad", label: "Gaming" },
  { icon: "fas fa-film", label: "Movies & Cinema" },
  { icon: "fas fa-music", label: "Music" },
  { icon: "fas fa-bag-shopping", label: "Shopping" },
  { icon: "fas fa-shirt", label: "Clothing" },
  { icon: "fas fa-heart-pulse", label: "Health & Medical" },
  { icon: "fas fa-pills", label: "Pharmacy" },
  { icon: "fas fa-plane", label: "Travel & Flights" },
  { icon: "fas fa-hotel", label: "Accommodation" },
  { icon: "fas fa-mug-hot", label: "Coffee & Cafe" },
  { icon: "fas fa-beer-mug-empty", label: "Drinks & Bar" },
  { icon: "fas fa-circle-play", label: "Subscriptions" },
  { icon: "fas fa-paw", label: "Pets" },
  { icon: "fas fa-dumbbell", label: "Fitness & Gym" },
  { icon: "fas fa-graduation-cap", label: "Education" },
  { icon: "fas fa-book", label: "Books" },
  { icon: "fas fa-laptop", label: "Electronics" },
  { icon: "fas fa-mobile-screen", label: "Phone & Gadgets" },
  { icon: "fas fa-gift", label: "Gifts" },
  { icon: "fas fa-wallet", label: "Finance & Bills" },
  { icon: "fas fa-wrench", label: "Services & Repairs" },
  { icon: "fas fa-child", label: "Family & Kids" },
  { icon: "fas fa-scissors", label: "Beauty & Personal Care" },
  { icon: "fas fa-tag", label: "General Tag" },
];

export function getCategoryIcon(categoryName, customIcon = null) {
  if (customIcon) return customIcon;
  if (!categoryName) return "fas fa-tag";

  if (CATEGORY_ICONS[categoryName]) {
    return CATEGORY_ICONS[categoryName];
  }

  return "fas fa-tag";
}

