// This is the "Master List" for your store.
// Edit this file to change prices, names, or options across the whole site.

export const PRODUCTS = [
  { id: 'hoodie_aqua', name: 'Unisex Hoodie (Aqua)', basePrice: 60, type: 'top' },
  { id: 'hoodie_grey', name: 'Unisex Hoodie (Grey)', basePrice: 60, type: 'top' },
  { id: 'crew_red', name: 'Crew Sweat (Red)', basePrice: 55, type: 'top' },
  { id: 'tee_royal', name: 'Tie Dye T-Shirt (Royal)', basePrice: 35, type: 'top' },
  { id: 'tee_dusk', name: 'Short Sleeve T-Shirt (Dusk)', basePrice: 30, type: 'top' },
  { id: 'jogger_grey', name: 'Unisex Jogger Pant', basePrice: 40, type: 'bottom' },
];

export const LOGO_OPTIONS = [
  'Butterfly', 
  'Backstroke', 
  'Breaststroke', 
  'Freestyle', 
  'IM', 
  'GO State', 
  'WI State', 
  'Flag'
];

export const POSITIONS = {
  top: [
    { id: '1', label: 'Pos 1: Full Front' },
    { id: '2', label: 'Pos 2: Left Crest' },
    { id: '3', label: 'Pos 3: Full Back' },
    { id: '4', label: 'Pos 4: Upper Back' },
    { id: '5', label: 'Pos 5: Lower Back' },
    { id: '6', label: 'Pos 6: Vertical Back' },
    { id: '7', label: 'Pos 7: Sleeve' },
  ],
  bottom: [
    { id: '8', label: 'Pos 8: Left Hip' },
    { id: '9', label: 'Pos 9: Right Hip' },
    { id: '10', label: 'Pos 10: Leg Vertical' },
  ]
};