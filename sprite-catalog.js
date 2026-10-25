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
    { id: "tops", label: "Tops" },
    { id: "dresses", label: "Dresses" },
    { id: "pants", label: "Pants" },
    { id: "hair", label: "Hair" },
    { id: "hats", label: "Hats" },
    { id: "shoes", label: "Shoes" },
    { id: "necklace", label: "Necklace" },
    { id: "bracelets", label: "Bracelets" }
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
    }
  ]
};
