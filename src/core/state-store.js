export function createStore({ defaultOutfit, initialActiveCategory = "tops" }) {
  let outfit = { ...defaultOutfit };
  let activeCategory = initialActiveCategory;
  let wardrobeOpen = false;
  let outfitSelectionRequest = 0;
  let previewReady = false;

  return {
    getOutfit() {
      return outfit;
    },
    setOutfit(nextOutfit) {
      outfit = { ...nextOutfit };
    },
    setOutfitItem(category, itemId) {
      outfit[category] = itemId;
    },
    clearOutfitItems(categories) {
      for (const category of categories) {
        outfit[category] = null;
      }
    },
    getActiveCategory() {
      return activeCategory;
    },
    setActiveCategory(category) {
      activeCategory = category;
    },
    isWardrobeOpen() {
      return wardrobeOpen;
    },
    setWardrobeOpen(open) {
      wardrobeOpen = open;
    },
    nextOutfitSelectionRequest() {
      outfitSelectionRequest += 1;
      return outfitSelectionRequest;
    },
    getOutfitSelectionRequest() {
      return outfitSelectionRequest;
    },
    isCurrentOutfitSelectionRequest(request) {
      return request === outfitSelectionRequest;
    },
    isPreviewReady() {
      return previewReady;
    },
    setPreviewReady(ready) {
      previewReady = ready;
    },
  };
}
