const SECTION_CARDS_STORAGE_KEY = "gyansai_section_cards";

export const loadSectionCards = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SECTION_CARDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to load section cards", error);
    return [];
  }
};

export const saveSectionCards = (cards) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SECTION_CARDS_STORAGE_KEY, JSON.stringify(cards));
    window.dispatchEvent(new CustomEvent("section-cards:updated", { detail: cards }));
  } catch (error) {
    console.error("Failed to save section cards", error);
  }
};
