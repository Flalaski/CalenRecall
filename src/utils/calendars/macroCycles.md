# Multi-Year and Multi-Decade Cycles in Calendar Cultures

This document identifies culturally accurate, astronomically-based cycles that span multiple years or decades, suitable for display in year and decade views.

## Culturally Accurate Multi-Year Cycles

### 1. Chinese 60-Year Sexagenary Cycle (干支, gānzhī)
- **Duration**: 60 years
- **Cultural Context**: Traditional Chinese calendar system
- **Components**: 
  - 10 Heavenly Stems (天干, tiāngān): 甲, 乙, 丙, 丁, 戊, 己, 庚, 辛, 壬, 癸
  - 12 Earthly Branches (地支, dìzhī): 子, 丑, 寅, 卯, 辰, 巳, 午, 未, 申, 酉, 戌, 亥
- **Cultural Significance**: Each year in the cycle has a unique name combining one stem and one branch. This cycle is still actively used in Chinese culture for traditional festivals, fortune-telling, and cultural observances.
- **Astronomical Basis**: The cycle combines lunar and solar cycles, with 60 being the least common multiple of 10 and 12.
- **Implementation**: Already referenced in calendar descriptions. Can be calculated from any year number.

### 2. Mayan Long Count Cycles
- **Baktun**: 144,000 days ≈ 394.26 years
- **Katun**: 7,200 days ≈ 19.71 years
- **Cultural Context**: Mayan Long Count calendar
- **Cultural Significance**: Baktuns and katuns were significant periods in Mayan cosmology and were used to mark important historical and ceremonial events. The completion of a baktun was considered a major cycle completion.
- **Astronomical Basis**: Based on precise day counts using a vigesimal (base-20) system.
- **Implementation**: Already fully implemented in `mayanLongCount.ts`

### 3. Metonic Cycle (19-Year Cycle)
- **Duration**: 19 years
- **Cultural Context**: Hebrew calendar, ancient Greek astronomy
- **Cultural Significance**: Used in the Hebrew calendar to synchronize lunar months with solar years. In the Hebrew calendar, 7 out of every 19 years are leap years (with an extra month). Named after Meton of Athens (5th century BCE).
- **Astronomical Basis**: 19 solar years ≈ 235 lunar months (accurate to within 2 hours). This is the period after which the phases of the moon recur on the same days of the year.
- **Implementation**: Already used in Hebrew calendar implementation (`hebrew.ts`)

### 4. Saros Cycle (Eclipse Cycle)
- **Duration**: 18 years, 11 days, 8 hours (approximately 6,585.32 days)
- **Cultural Context**: Babylonian astronomy, later used by Greek and other cultures
- **Cultural Significance**: The period after which the Sun, Earth, and Moon return to approximately the same relative geometry, causing similar eclipses to occur. The Babylonians used this cycle to predict eclipses.
- **Astronomical Basis**: The time it takes for the Moon to complete 223 synodic months (new moon to new moon) and return to the same node (where eclipses can occur).
- **Note**: This is primarily astronomical but has historical cultural significance in ancient astronomy.

### 5. Mayan Calendar Round
- **Duration**: 52 years (18,980 days)
- **Cultural Context**: Mayan calendar system
- **Cultural Significance**: The combination of the 260-day Tzolk'in cycle and the 365-day Haab' cycle. After 52 Haab' years (18,980 days), both cycles realign. This was an important cycle in Mayan culture.
- **Astronomical Basis**: Least common multiple of 260 and 365.
- **Implementation**: Can be calculated from existing Mayan calendar implementations.

### 6. Hindu Yuga Cycles
- **Duration**: 
  - **Satya Yuga (Krita Yuga)**: 1,728,000 years
  - **Treta Yuga**: 1,296,000 years
  - **Dvapara Yuga**: 864,000 years
  - **Kali Yuga**: 432,000 years
  - **Mahayuga** (complete cycle): 4,320,000 years
  - **Kalpa**: 1,000 Mahayugas = 4.32 billion years
- **Cultural Context**: Hindu cosmology and traditional Indian calendar systems
- **Cultural Significance**: The Yuga Cycle is a fundamental concept in Hindu cosmology describing a repeating sequence of four distinct ages, each characterized by varying levels of moral and spiritual qualities (dharma). The current age is Kali Yuga, which began in 3102 BCE according to traditional calculations. These cycles represent the cyclical nature of time in Hindu thought, where each age transitions into the next, leading to eventual renewal and restoration of dharma.
- **Astronomical Basis**: While primarily cosmological/theological, these cycles are deeply embedded in traditional Hindu calendar systems and astronomical calculations. The traditional start date of Kali Yuga (3102 BCE) is calculated from astronomical observations.
- **Implementation Note**: These extremely long cycles are more relevant for very long-term views (centuries, millennia) but should be accurately calculated and displayed when relevant calendar systems are selected.
- **Cultural Sensitivity**: These cycles are of profound religious and cultural significance in Hinduism. They must be presented accurately and respectfully, with proper context and explanation.

### Economic "Seasons"
- **Reason**: These are modern economic concepts, not traditional calendar cycles tied to specific cultures.

### Japanese 72 Micro-Seasons
- **Reason**: These are annual cycles (each ~5 days), not multi-year cycles.

## Recommended Implementation

For year and decade views, the following cycles are culturally appropriate and astronomically accurate:

1. **Chinese 60-Year Cycle**: Display the current position in the sexagenary cycle for any year
2. **Mayan Katun**: Display katun transitions (every ~20 years) in decade view
3. **Mayan Baktun**: Display baktun transitions (every ~394 years) in decade view
4. **Metonic Cycle**: Display the 19-year cycle position for Hebrew calendar years
5. **Mayan Calendar Round**: Display 52-year cycle completions

These cycles should only be displayed when:
- The user has selected the relevant calendar system
- The cycle is culturally appropriate for that calendar
- The display accurately represents the cultural significance

