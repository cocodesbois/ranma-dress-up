// Each PNG retains its position on this shared source canvas, so all layers use one transform.
const sharedSpritePlacement = {
  x: 960.9,
  y: 540.2,
  scale: 0.18,
  regX: 3230,
  regY: 3405
};

window.RanmaDressUpCatalog = {
  width: 1920,
  height: 1080,
  background: {
    source: "images/sprites/background.png"
  },
  base: {
    id: "body",
    label: "Ranma",
    source: "images/sprites/body.png",
    placement: sharedSpritePlacement
  },
  categories: [
    { id: "bodysuits", label: "Bodysuits" },
    { id: "underwear", label: "Underwear" },
    { id: "slips", label: "Slips" },
    { id: "tights", label: "Tights" },
    { id: "tops", label: "Tops" },
    { id: "dresses", label: "Dresses" },
    { id: "pants", label: "Pants" },
    { id: "hair", label: "Hair" },
    { id: "hats", label: "Hats" },
    { id: "shoes", label: "Shoes" },
    { id: "necklace", label: "Necklace" },
    { id: "bracelets", label: "Bracelets" },
    { id: "accessories", label: "Accessories" }
  ],
  items: [
    {
      id: "top001",
      category: "tops",
      label: "Top 01",
      source: "images/sprites/top001.png",
      thumbnail: { x: 2709, y: 1881, width: 986, height: 1505 },
      placement: sharedSpritePlacement
    },
    {
      id: "top002",
      category: "tops",
      label: "Top 02",
      source: "images/sprites/top002.png",
      thumbnail: { x: 2549, y: 1879, width: 1338, height: 1343 },
      placement: sharedSpritePlacement
    },
    {
      id: "top003",
      category: "tops",
      label: "Top 03",
      source: "images/sprites/top003.png",
      thumbnail: { x: 2750, y: 1883, width: 912, height: 1218 },
      placement: sharedSpritePlacement
    },
    {
      id: "top004",
      category: "tops",
      label: "Top 04",
      source: "images/sprites/top004.png",
      thumbnail: { x: 2909, y: 1980, width: 689, height: 921 },
      placement: sharedSpritePlacement
    },
    {
      id: "top005",
      category: "tops",
      label: "Top 05",
      source: "images/sprites/top005.png",
      thumbnail: { x: 2908, y: 1909, width: 730, height: 886 },
      placement: sharedSpritePlacement
    },
    {
      id: "top006",
      category: "tops",
      label: "Top 06",
      source: "images/sprites/top006.png",
      thumbnail: { x: 2805, y: 1969, width: 800, height: 1064 },
      placement: sharedSpritePlacement
    },
    {
      id: "top008",
      category: "tops",
      label: "Top 08",
      source: "images/sprites/top008.png",
      thumbnail: { x: 2898, y: 2187, width: 686, height: 665 },
      placement: sharedSpritePlacement
    },
    {
      id: "dress006",
      category: "dresses",
      label: "Dress 06",
      source: "images/sprites/dress006.png",
      thumbnail: { x: 2793, y: 1951, width: 1320, height: 2979 },
      placement: sharedSpritePlacement
    },
    {
      id: "dress007",
      category: "dresses",
      label: "Dress 07",
      source: "images/sprites/dress007.png",
      thumbnail: { x: 2467, y: 1872, width: 1547, height: 3039 },
      placement: sharedSpritePlacement
    },
    {
      id: "slip006",
      category: "slips",
      label: "Slip 06",
      source: "images/sprites/slip006.png",
      thumbnail: { x: 2861, y: 2980, width: 664, height: 338 },
      placement: sharedSpritePlacement
    },
    {
      id: "slip008",
      category: "slips",
      label: "Slip 08",
      source: "images/sprites/slip008.png",
      thumbnail: { x: 2902, y: 2946, width: 624, height: 373 },
      placement: sharedSpritePlacement
    },
    {
      id: "tights008",
      category: "tights",
      label: "Tights 08",
      source: "images/sprites/tights008.png",
      thumbnail: { x: 2817, y: 2854, width: 1507, height: 2889 },
      placement: sharedSpritePlacement
    },
    {
      id: "pants001",
      category: "pants",
      label: "Pants 01",
      source: "images/sprites/pants001.png",
      thumbnail: { x: 2788, y: 2810, width: 1493, height: 2687 },
      placement: sharedSpritePlacement
    },
    {
      id: "pant002",
      category: "pants",
      label: "Pants 03",
      source: "images/sprites/pant002.png",
      thumbnail: { x: 2800, y: 2882, width: 1162, height: 1726 },
      placement: sharedSpritePlacement
    },
    {
      id: "pants004",
      category: "pants",
      label: "Pants 04",
      source: "images/sprites/pants004.png",
      thumbnail: { x: 2760, y: 2842, width: 811, height: 554 },
      placement: sharedSpritePlacement
    },
    {
      id: "hair001",
      category: "hair",
      label: "Hair 01",
      source: "images/sprites/hair001.png",
      thumbnail: { x: 2142, y: 1489, width: 929, height: 915 },
      placement: sharedSpritePlacement
    },
    {
      id: "shoes001",
      category: "shoes",
      label: "Shoes 01",
      source: "images/sprites/shoes001.png",
      thumbnail: { x: 3130, y: 5078, width: 1210, height: 674 },
      placement: sharedSpritePlacement
    },
    {
      id: "shoes006",
      category: "shoes",
      label: "Shoes 06",
      source: "images/sprites/shoes006.png",
      thumbnail: { x: 3132, y: 5198, width: 1193, height: 559 },
      placement: sharedSpritePlacement
    },
    {
      id: "shoes007",
      category: "shoes",
      label: "Shoes 07",
      source: "images/sprites/shoes007.png",
      thumbnail: { x: 3125, y: 4944, width: 1202, height: 804 },
      placement: sharedSpritePlacement
    },
    {
      id: "bracelets001",
      category: "bracelets",
      label: "Bracelets 01",
      source: "images/sprites/bracelets001.png",
      thumbnail: { x: 2391, y: 2634, width: 1678, height: 546 },
      placement: sharedSpritePlacement
    },
    {
      id: "bracelets003",
      category: "bracelets",
      label: "Bracelets 02",
      source: "images/sprites/bracelets003.png",
      thumbnail: { x: 2408, y: 2771, width: 1671, height: 390 },
      placement: sharedSpritePlacement
    },
    {
      id: "bracelets008",
      category: "bracelets",
      label: "Bracelets 08",
      source: "images/sprites/bracelets008.png",
      thumbnail: { x: 2407, y: 2724, width: 1626, height: 434 },
      placement: sharedSpritePlacement
    },
    {
      id: "bodysuit009",
      category: "bodysuits",
      label: "Bodysuit 09",
      source: "images/sprites/bodysuit009.png",
      thumbnail: { x: 2918, y: 1964, width: 671, height: 1362 },
      placement: sharedSpritePlacement
    },
    {
      id: "hat009",
      category: "hats",
      label: "Hat 09",
      source: "images/sprites/hat009.png",
      thumbnail: { x: 2928, y: 379, width: 832, height: 1181 },
      placement: sharedSpritePlacement
    },
    {
      id: "shoes009",
      category: "shoes",
      label: "Shoes 09",
      source: "images/sprites/shoes009.png",
      thumbnail: { x: 3135, y: 5086, width: 1214, height: 707 },
      placement: sharedSpritePlacement
    },
    {
      id: "tights009",
      category: "tights",
      label: "Tights 09",
      source: "images/sprites/tights009.png",
      thumbnail: { x: 2809, y: 2838, width: 1518, height: 2910 },
      placement: sharedSpritePlacement
    },
    {
      id: "accessories009",
      category: "accessories",
      label: "Accessories 09",
      source: "images/sprites/accessories009.png",
      thumbnail: { x: 1789, y: 1347, width: 2729, height: 1530 },
      placement: sharedSpritePlacement
    }
  ],
  outfits: [
    {
      id: "001",
      label: "Outfit 01",
      items: {
        tops: "top001",
        pants: "pants001",
        hair: "hair001",
        shoes: "shoes001",
        bracelets: "bracelets001"
      }
    },
    {
      id: "002",
      label: "Outfit 02",
      items: {
        tops: "top002",
        pants: "pant002",
        hair: "hair001"
      }
    },
    {
      id: "003",
      label: "Outfit 03",
      items: {
        tops: "top003",
        pants: "pants001",
        hair: "hair001",
        shoes: "shoes001",
        bracelets: "bracelets003"
      }
    },
    {
      id: "004",
      label: "Outfit 04",
      items: {
        tops: "top004",
        pants: "pants004",
        hair: "hair001"
      }
    },
    {
      id: "005",
      label: "Outfit 05",
      items: {
        tops: "top005",
        pants: "pants004",
        hair: "hair001"
      }
    },
    {
      id: "006",
      label: "Outfit 06",
      items: {
        tops: "top006",
        dresses: "dress006",
        slips: "slip006",
        hair: "hair001",
        shoes: "shoes006"
      }
    },
    {
      id: "007",
      label: "Outfit 07",
      items: {
        dresses: "dress007",
        hair: "hair001",
        shoes: "shoes007"
      }
    },
    {
      id: "008",
      label: "Outfit 08",
      items: {
        tops: "top008",
        slips: "slip008",
        tights: "tights008",
        hair: "hair001",
        bracelets: "bracelets008"
      }
    },
    {
      id: "009",
      label: "Outfit 09",
      items: {
        bodysuits: "bodysuit009",
        tights: "tights009",
        hair: "hair001",
        hats: "hat009",
        shoes: "shoes009",
        accessories: "accessories009"
      }
    }
  ]
};
