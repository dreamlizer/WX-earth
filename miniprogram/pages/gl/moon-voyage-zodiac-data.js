// Zodiac Data (Enhanced with more stars)
// Coordinates are normalized (0-1) for the specific constellation view box

export const SCORPIO_DATA = {
  name: 'Scorpio',
  points: [
    { name: 'Antares', x: 0.5, y: 0.6, size: 1.8, color: 0xFF4400, opacity: 1.0 }, 
    { name: 'Graffias', x: 0.55, y: 0.75, size: 0.9, color: 0xFFFFFF, opacity: 0.8 },
    { name: 'Dschubba', x: 0.45, y: 0.72, size: 0.9, color: 0xFFFFFF, opacity: 0.8 },
    { name: 'Pi Scorpii', x: 0.35, y: 0.65, size: 0.8, color: 0xAAAAFF, opacity: 0.7 },
    { name: 'Alniyat', x: 0.55, y: 0.55, size: 0.7, color: 0xAAAAFF, opacity: 0.7 },
    { name: 'Larawag', x: 0.52, y: 0.45, size: 0.8, color: 0xFFFFFF, opacity: 0.8 },
    { name: 'Mu Scorpii', x: 0.55, y: 0.35, size: 0.8, color: 0xAAAAFF, opacity: 0.7 },
    { name: 'Zeta Scorpii', x: 0.60, y: 0.25, size: 0.8, color: 0xFFFFFF, opacity: 0.7 },
    { name: 'Theta Scorpii', x: 0.70, y: 0.15, size: 0.9, color: 0xFFFFFF, opacity: 0.8 },
    { name: 'Kappa Scorpii', x: 0.80, y: 0.20, size: 0.9, color: 0xFFFFFF, opacity: 0.8 },
    { name: 'Shaula', x: 0.85, y: 0.35, size: 1.5, color: 0xAACCFF, opacity: 1.0 }, 
    { name: 'Lesath', x: 0.82, y: 0.38, size: 0.6, color: 0xFFFFFF, opacity: 0.6 },
    { name: 'Girtab', x: 0.75, y: 0.12, size: 0.8, color: 0xFFFFFF, opacity: 0.7 }, // Added
    { name: 'Iota', x: 0.72, y: 0.10, size: 0.8, color: 0xFFFFFF, opacity: 0.7 }, // Added
    { name: 'Rho', x: 0.38, y: 0.68, size: 0.7, color: 0xFFFFFF, opacity: 0.6 }   // Added
  ],
  lines: [
    [3, 14], [14, 2], [2, 1], [1, 0], // Head area
    [4, 0], // Antares connection
    [0, 5], [5, 6], [6, 7], [7, 8], [8, 13], [13, 12], [12, 9], [9, 10], [10, 11] // Body to Tail
  ]
};

export const ZODIAC_ALL_DATA = [
  // 1. Aries (白羊) - 5 stars
  {
    name: 'Aries',
    points: [
      { x: 0.3, y: 0.4, size: 1.5, color: 0xFFAA00 }, // Hamal (Alpha)
      { x: 0.45, y: 0.48, size: 1.2 }, // Sheratan (Beta)
      { x: 0.52, y: 0.45, size: 1.0 }, // Mesarthim (Gamma)
      { x: 0.65, y: 0.35, size: 0.9 }, // 41 Ari
      { x: 0.75, y: 0.25, size: 0.8 }  // Delta Arietis
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]]
  },
  
  // 2. Taurus (金牛) - 13 stars
  {
    name: 'Taurus',
    points: [
      { x: 0.5, y: 0.45, size: 1.8, color: 0xFFAA00 }, // Aldebaran (Alpha)
      { x: 0.42, y: 0.52, size: 1.0 }, // Epsilon (Ain)
      { x: 0.46, y: 0.48, size: 0.9 }, // Gamma (Hyades)
      { x: 0.48, y: 0.50, size: 0.8 }, // Delta (Hyades)
      { x: 0.44, y: 0.46, size: 0.8 }, // Theta (Hyades)
      { x: 0.3, y: 0.75, size: 1.3 }, // Elnath (Beta)
      { x: 0.7, y: 0.65, size: 1.2 }, // Zeta (Tianguan)
      { x: 0.35, y: 0.3, size: 1.5, color: 0xAACCFF }, // Pleiades (M45)
      { x: 0.55, y: 0.38, size: 1.0 }, // Lambda
      { x: 0.60, y: 0.35, size: 0.9 }, // Nu
      { x: 0.65, y: 0.32, size: 0.9 }, // Xi
      { x: 0.70, y: 0.30, size: 0.9 }, // Omicron
      { x: 0.25, y: 0.35, size: 0.8 }  // 10 Tau (Connection to Pleiades)
    ],
    lines: [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 0], // Hyades V-shape
      [1, 5], // Horn 1 (Elnath)
      [0, 6], // Horn 2 (Zeta)
      [0, 8], [8, 9], [9, 10], [10, 11], // Body line
      [4, 12], [12, 7] // Reach to Pleiades
    ]
  },

  // 3. Gemini (双子) - 15 stars
  {
    name: 'Gemini',
    points: [
      { x: 0.35, y: 0.85, size: 1.5, color: 0xFFFFFF }, // Castor (Alpha)
      { x: 0.65, y: 0.82, size: 1.6, color: 0xFFEEAA }, // Pollux (Beta)
      { x: 0.38, y: 0.55, size: 1.0 }, // Mebsuta (Epsilon)
      { x: 0.62, y: 0.55, size: 1.0 }, // Wasat (Delta)
      { x: 0.32, y: 0.45, size: 1.0 }, // Tejat (Mu)
      { x: 0.68, y: 0.45, size: 1.0 }, // Mekbuda (Zeta)
      { x: 0.30, y: 0.25, size: 1.1 }, // Propus (Eta) - Foot
      { x: 0.70, y: 0.22, size: 1.1 }, // Alhena (Gamma) - Foot
      { x: 0.25, y: 0.65, size: 0.9 }, // Iota
      { x: 0.75, y: 0.62, size: 0.9 }, // Kappa
      { x: 0.40, y: 0.65, size: 0.9 }, // Tau
      { x: 0.60, y: 0.65, size: 0.9 }, // Upsilon
      { x: 0.28, y: 0.15, size: 0.8 }, // Xi (Foot tip)
      { x: 0.72, y: 0.12, size: 0.8 }, // Nu (Foot tip)
      { x: 0.5, y: 0.5, size: 0.5, opacity: 0.0 } // Center anchor (invisible)
    ],
    lines: [
      [0, 2], [2, 4], [4, 6], [6, 12], // Castor Body
      [1, 3], [3, 5], [5, 7], [7, 13], // Pollux Body
      [0, 1], // Head connection
      [2, 8], // Arm 1
      [3, 9], // Arm 2
      [2, 10], // Shoulder detail
      [3, 11]  // Shoulder detail
    ]
  },

  // 4. Cancer (巨蟹) - 8 stars
  {
    name: 'Cancer',
    points: [
      { x: 0.5, y: 0.5, size: 1.1 }, // Delta (Asellus Australis)
      { x: 0.45, y: 0.35, size: 1.2 }, // Alpha (Acubens)
      { x: 0.3, y: 0.65, size: 1.0 }, // Iota (Decapoda)
      { x: 0.65, y: 0.58, size: 1.0 }, // Gamma (Asellus Borealis)
      { x: 0.5, y: 0.55, size: 1.3, color: 0xAACCFF }, // Praesepe (Cluster)
      { x: 0.25, y: 0.75, size: 0.9 }, // Chi
      { x: 0.75, y: 0.45, size: 0.9 }, // Beta (Tarf) - Leg
      { x: 0.48, y: 0.42, size: 0.8 }  // Theta
    ],
    lines: [
      [0, 1], [0, 2], [0, 3], // Y-shape center
      [2, 5], // Extend leg
      [1, 6], // Extend leg
      [0, 7]  // Inner detail
    ]
  },

  // 5. Leo (狮子) - 12 stars
  {
    name: 'Leo',
    points: [
      { x: 0.75, y: 0.3, size: 1.8, color: 0xAAAAFF }, // Regulus (Alpha)
      { x: 0.65, y: 0.45, size: 1.1 }, // Eta
      { x: 0.55, y: 0.55, size: 1.3 }, // Algieba (Gamma)
      { x: 0.45, y: 0.65, size: 1.1 }, // Adhafera (Zeta)
      { x: 0.35, y: 0.60, size: 1.0 }, // Rasalas (Mu)
      { x: 0.38, y: 0.50, size: 0.9 }, // Epsilon (Sickle end)
      { x: 0.20, y: 0.35, size: 1.2 }, // Denebola (Beta)
      { x: 0.35, y: 0.40, size: 1.1 }, // Zosma (Delta)
      { x: 0.50, y: 0.35, size: 1.0 }, // Chertan (Theta)
      { x: 0.65, y: 0.25, size: 0.9 }, // Subra (Omicron)
      { x: 0.25, y: 0.45, size: 0.9 }, // Coxa (Theta 2 / 93 Leo?) -> Actually Chertan is Theta. Let's add Iota.
      { x: 0.45, y: 0.30, size: 0.8 }  // Rho? Just a body star.
    ],
    lines: [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], // Sickle
      [2, 7], [7, 6], // Back
      [6, 8], [8, 0], // Belly
      [2, 5], // Sickle connect
      [0, 9], // Front leg
      [8, 11] // Back leg detail
    ]
  },

  // 6. Virgo (处女) - 14 stars
  {
    name: 'Virgo',
    points: [
      { x: 0.5, y: 0.2, size: 1.8, color: 0xAACCFF }, // Spica (Alpha)
      { x: 0.5, y: 0.45, size: 1.2 }, // Porrima (Gamma)
      { x: 0.6, y: 0.65, size: 1.1 }, // Vindemiatrix (Epsilon)
      { x: 0.4, y: 0.55, size: 1.0 }, // Auva (Delta)
      { x: 0.3, y: 0.35, size: 1.0 }, // Zavijava (Beta)
      { x: 0.7, y: 0.4, size: 1.0 }, // Heze (Zeta)
      { x: 0.8, y: 0.3, size: 0.9 }, // Syrma (Iota)
      { x: 0.2, y: 0.45, size: 0.9 }, // Zaniah (Eta)
      { x: 0.75, y: 0.55, size: 0.9 }, // Tau
      { x: 0.85, y: 0.2, size: 0.9 }, // Kappa
      { x: 0.65, y: 0.15, size: 0.8 }, // Lambda
      { x: 0.55, y: 0.10, size: 0.8 }, // Mu
      { x: 0.45, y: 0.75, size: 0.8 }, // Rho
      { x: 0.35, y: 0.25, size: 0.8 }  // Chi
    ],
    lines: [
      [0, 1], [1, 2], [1, 3], [3, 4], // Main body
      [4, 7], // Head/Arm
      [1, 5], [5, 6], [6, 9], // Skirt right
      [0, 6], // Skirt connect
      [5, 8], // Arm right
      [0, 10], [10, 11], // Feet
      [3, 12], // Top detail
      [0, 13] // Inner detail
    ]
  },

  // 7. Libra (天秤) - 8 stars
  {
    name: 'Libra',
    points: [
      { x: 0.5, y: 0.75, size: 1.3 }, // Zubeneschamali (Beta)
      { x: 0.3, y: 0.45, size: 1.3 }, // Zubenelgenubi (Alpha)
      { x: 0.7, y: 0.35, size: 1.1 }, // Brachium (Sigma)
      { x: 0.5, y: 0.25, size: 1.0 }, // Upsilon
      { x: 0.8, y: 0.55, size: 1.0 }, // Gamma (Zubenelakrab)
      { x: 0.6, y: 0.15, size: 0.9 }, // Tau
      { x: 0.4, y: 0.15, size: 0.8 }, // Theta
      { x: 0.2, y: 0.35, size: 0.8 }  // Mu? Nearby star
    ],
    lines: [
      [0, 1], [0, 4], // Top V
      [1, 3], [3, 2], [2, 4], // Bottom Diamond
      [3, 5], [3, 6], // Legs
      [1, 7] // Balance pan extension
    ]
  },

  // 8. Scorpio (天蝎) - (Using SCORPIO_DATA defined above)
  SCORPIO_DATA,

  // 9. Sagittarius (射手) - 16 stars
  {
    name: 'Sagittarius',
    points: [
      { x: 0.25, y: 0.3, size: 1.4 }, // Kaus Australis (Epsilon)
      { x: 0.45, y: 0.3, size: 1.3 }, // Kaus Media (Delta)
      { x: 0.35, y: 0.5, size: 1.2 }, // Kaus Borealis (Lambda)
      { x: 0.65, y: 0.35, size: 1.3 }, // Nunki (Sigma)
      { x: 0.55, y: 0.55, size: 1.1 }, // Phi
      { x: 0.75, y: 0.45, size: 1.0 }, // Tau
      { x: 0.15, y: 0.4, size: 1.0 }, // Alnasl (Gamma)
      { x: 0.50, y: 0.75, size: 0.9 }, // Mu (Polis)
      { x: 0.85, y: 0.25, size: 0.9 }, // Ascella (Zeta)
      { x: 0.05, y: 0.35, size: 0.8 }, // Eta
      { x: 0.40, y: 0.85, size: 0.8 }, // Xi2 (Head)
      { x: 0.60, y: 0.80, size: 0.8 }, // Omicron
      { x: 0.70, y: 0.70, size: 0.8 }, // Pi
      { x: 0.80, y: 0.60, size: 0.8 }, // Rho1
      { x: 0.90, y: 0.50, size: 0.8 }, // Upsilon
      { x: 0.50, y: 0.20, size: 0.8 }  // Theta? Bottom detail
    ],
    lines: [
      [0, 1], [1, 3], [3, 4], [4, 2], [2, 0], // Teapot Body
      [4, 1], // Teapot Lid
      [2, 7], // Spoon handle
      [3, 8], [8, 5], [5, 3], // Handle detail
      [0, 6], [6, 9], // Spout / Bow
      [4, 12], [12, 11], [11, 10], // Head/Neck
      [5, 13], [13, 14] // Flowing cape
    ]
  },

  // 10. Capricorn (摩羯) - 12 stars
  {
    name: 'Capricorn',
    points: [
      { x: 0.15, y: 0.7, size: 1.3 }, // Algedi (Alpha)
      { x: 0.15, y: 0.6, size: 1.2 }, // Dabih (Beta)
      { x: 0.5, y: 0.2, size: 1.1 }, // Omega
      { x: 0.85, y: 0.7, size: 1.4 }, // Deneb Algedi (Delta)
      { x: 0.75, y: 0.65, size: 1.1 }, // Nashira (Gamma)
      { x: 0.35, y: 0.5, size: 1.0 }, // Theta
      { x: 0.65, y: 0.35, size: 1.0 }, // Psi
      { x: 0.55, y: 0.25, size: 1.0 }, // Zeta
      { x: 0.45, y: 0.4, size: 0.9 }, // Iota
      { x: 0.25, y: 0.3, size: 0.9 }, // Nu
      { x: 0.20, y: 0.5, size: 0.9 }, // Rho
      { x: 0.60, y: 0.15, size: 0.8 }  // 24 Cap
    ],
    lines: [
      [0, 1], [1, 10], [10, 5], // Head
      [5, 8], [8, 9], [9, 2], // Body Top
      [5, 6], [6, 4], [4, 3], // Back
      [2, 7], [7, 6], // Belly
      [2, 11] // Leg
    ]
  },

  // 11. Aquarius (水瓶) - 14 stars
  {
    name: 'Aquarius',
    points: [
      { x: 0.35, y: 0.85, size: 1.3 }, // Sadalmelik (Alpha)
      { x: 0.55, y: 0.85, size: 1.3 }, // Sadalsuud (Beta)
      { x: 0.45, y: 0.65, size: 1.1 }, // Seat (Pi)
      { x: 0.35, y: 0.55, size: 1.0 }, // Eta
      { x: 0.55, y: 0.55, size: 1.0 }, // Zeta
      { x: 0.65, y: 0.45, size: 1.0 }, // Gamma (Sadachbia)
      { x: 0.50, y: 0.35, size: 1.2 }, // Skat (Delta)
      { x: 0.40, y: 0.45, size: 0.9 }, // Ancha (Theta)
      { x: 0.60, y: 0.25, size: 0.9 }, // Lambda (Hydor)
      { x: 0.65, y: 0.15, size: 0.9 }, // Phi
      { x: 0.70, y: 0.10, size: 0.9 }, // Chi
      { x: 0.75, y: 0.05, size: 0.9 }, // Psi
      { x: 0.25, y: 0.75, size: 0.8 }, // Omicron? (Head detail)
      { x: 0.15, y: 0.65, size: 0.8 }  // Mu? (Arm)
    ],
    lines: [
      [0, 1], // Shoulders
      [1, 4], [4, 2], [2, 3], [3, 0], // Jar Body
      [4, 5], [5, 2], // Jar Handle
      [5, 6], [6, 8], [8, 9], [9, 10], [10, 11], // Water Stream
      [3, 7], [7, 6], // Body/Legs
      [0, 12], [12, 13] // Arm
    ]
  },

  // 12. Pisces (双鱼) - 17 stars
  {
    name: 'Pisces',
    points: [
      { x: 0.10, y: 0.70, size: 1.1 }, // Beta (Fum al Samakah)
      { x: 0.20, y: 0.60, size: 1.0 }, // Gamma
      { x: 0.25, y: 0.50, size: 1.0 }, // Theta
      { x: 0.22, y: 0.40, size: 1.0 }, // Iota
      { x: 0.15, y: 0.35, size: 1.0 }, // Omega
      { x: 0.30, y: 0.25, size: 1.0 }, // Delta
      { x: 0.50, y: 0.15, size: 1.3 }, // Alrescha (Alpha) - Knot
      { x: 0.60, y: 0.25, size: 0.9 }, // Nu
      { x: 0.68, y: 0.35, size: 0.9 }, // Mu
      { x: 0.75, y: 0.45, size: 0.9 }, // Omicron
      { x: 0.82, y: 0.55, size: 0.9 }, // Eta
      { x: 0.85, y: 0.75, size: 0.8 }, // Rho (Fish 2 Tail)
      { x: 0.78, y: 0.85, size: 0.8 }, // Phi (Fish 2 Body)
      { x: 0.70, y: 0.80, size: 0.8 }, // Upsilon
      { x: 0.65, y: 0.70, size: 0.8 }, // Tau
      { x: 0.05, y: 0.65, size: 0.8 }, // Lambda (Circlet)
      { x: 0.08, y: 0.55, size: 0.8 }  // Kappa (Circlet)
    ],
    lines: [
      // West Fish (Circlet)
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 16], [16, 15], [15, 0],
      // Cord to Knot
      [2, 5], [5, 6],
      // Cord to North Fish
      [6, 7], [7, 8], [8, 9], [9, 10],
      // North Fish
      [10, 11], [11, 12], [12, 13], [13, 14], [14, 10]
    ]
  }
];
