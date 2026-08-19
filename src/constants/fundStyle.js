// Presets for the per-fund personalization feature:
// - color: personal, each member picks their own for a given fund
// - icon: "central", shared by everyone in the fund, settable by the owner only

export const DEFAULT_FUND_COLOR = "#C8A5FC"; // matches the app's primary purple
export const DEFAULT_FUND_ICON = "fas fa-wallet";

export const FUND_COLORS = [
  { value: "#C8A5FC", label: "Purple" },
  { value: "#A5E3FC", label: "Blue" },
  { value: "#A7F49D", label: "Green" },
  { value: "#D89B3C", label: "Yellow" },
  { value: "#C1503A", label: "Red" },
  { value: "#F5A5C8", label: "Pink" },
  { value: "#A5FCE0", label: "Teal" },
  { value: "#FCC08A", label: "Orange" },
  { value: "#B5A5FC", label: "Indigo" },
  { value: "#8B6FB0", label: "Plum" },
  { value: "#9ca3af", label: "Gray" },
  { value: "#5C7A99", label: "Slate" },
];

export const FUND_ICONS = [
  { icon: "fas fa-wallet", label: "Wallet" },
  { icon: "fas fa-piggy-bank", label: "Piggy bank" },
  { icon: "fas fa-sack-dollar", label: "Savings" },
  { icon: "fas fa-house", label: "Home" },
  { icon: "fas fa-plane", label: "Travel" },
  { icon: "fas fa-umbrella-beach", label: "Vacation" },
  { icon: "fas fa-cart-shopping", label: "Shopping" },
  { icon: "fas fa-utensils", label: "Food" },
  { icon: "fas fa-mug-hot", label: "Coffee" },
  { icon: "fas fa-gamepad", label: "Gaming" },
  { icon: "fas fa-gift", label: "Gifts" },
  { icon: "fas fa-heart", label: "Shared" },
  { icon: "fas fa-users", label: "Group" },
  { icon: "fas fa-star", label: "Favorite" },
  { icon: "fas fa-rocket", label: "Project" },
  { icon: "fas fa-graduation-cap", label: "Education" },
  { icon: "fas fa-briefcase", label: "Work" },
  { icon: "fas fa-paw", label: "Pets" },
  { icon: "fas fa-cake-candles", label: "Party" },
  { icon: "fas fa-trophy", label: "Goal" },
];

// The color is personal: read from the current user's own member entry.
export function getMyFundColor(group, uid) {
  return group?.members?.[uid]?.color || DEFAULT_FUND_COLOR;
}

// The icon is central: same for everyone in the fund, set by the owner.
export function getFundIcon(group) {
  return group?.icon || DEFAULT_FUND_ICON;
}
