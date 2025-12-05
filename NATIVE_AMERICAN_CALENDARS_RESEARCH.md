# Native American Calendars Research

## Overview
Native American calendar systems are diverse and deeply connected to natural cycles, lunar phases, and seasonal events. Unlike standardized solar calendars, most traditional Native American calendars are lunar-based or lunisolar, with months named after natural phenomena and seasonal activities.

## Key Calendar Systems

### 1. Iroquois (Haudenosaunee) Calendar
- **Type**: Lunisolar
- **Structure**: 13 moons per year
- **Months**: Each moon corresponds to a full moon cycle and is associated with specific energies and purposes
- **Characteristics**:
  - Deeply connected to agricultural cycles
  - Each moon has ceremonial significance
  - Aligns with the 13 full moons in a solar year
- **Conversion**: Can be mapped to Gregorian calendar by tracking full moon cycles

### 2. Cherokee Calendar
- **Type**: Lunar (originally 13 moons, adapted to 12 months)
- **Structure**: 
  - Originally: 13 moon cycles of ~28 days each
  - Modern adaptation: 12 months aligned with Julian/Gregorian calendar
- **Month Names** (Traditional):
  - Cold Moon (ᏅᏓ ᎧᎾᏬᎦ, Nv-da Ka-na-wo-ga) - January
  - Bony Moon (ᏅᏓ ᎤᏍᏗ, Nv-da U-s-di) - February
  - Windy Moon (ᏅᏓ ᎤᏃᎴ, Nv-da U-no-le) - March
  - Flower Moon (ᏅᏓ ᎠᏥᎷᏤᎢ, Nv-da A-tsi-lu-tse-i) - April
  - Planting Moon (ᏅᏓ ᎦᏢᏍᎦ, Nv-da Ga-hlv-sga) - May
  - Green Corn Moon (ᏅᏓ ᎢᏤ ᏗᎾᏓᏛᏂ, Nv-da I-tse Di-na-da-tv-ni) - June
  - Ripe Corn Moon (ᏅᏓ ᎤᏪᏅ, Nv-da U-we-nv) - July
  - Fruit Moon (ᏅᏓ ᎤᏍᎪᎵ, Nv-da U-s-go-li) - August
  - Nut Moon (ᏅᏓ ᎤᏍᏗ, Nv-da U-s-di) - September
  - Harvest Moon (ᏅᏓ ᎤᏍᏗ, Nv-da U-s-di) - October
  - Trading Moon (ᏅᏓ ᎤᏍᏗ, Nv-da U-s-di) - November
  - Snow Moon (ᏅᏓ ᎤᏍᏗ, Nv-da U-s-di) - December
- **Conversion**: Maps to Gregorian months with traditional names

### 3. Lakota (Oglala Sioux) Calendar
- **Type**: Lunar with seasonal markers
- **Structure**: 12-13 moons per year, named after natural events
- **Month Names** (Traditional):
  - Strong Cold Moon / Frost in the Teepee Moon - January
  - Raccoon Moon / Moon of the Popping Trees - February
  - Moon When Eyes Are Sore from Bright Snow - March
  - Moon of the Red Grass Appearing - April
  - Moon When the Ponies Shed - May
  - Moon of Making Fat / Moon When Berries Are Good - June
  - Moon of Red Cherries / Moon When the Sun Shines on the Tipi - July
  - Moon When the Geese Shed Their Feathers - August
  - Moon When the Calves Grow Hair - September
  - Moon When the Wind Shakes Off Leaves - October
  - Moon When the Deer Rut - November
  - Moon of Popping Trees / Moon When the Wolves Run Together - December
- **Characteristics**: 
  - Deeply connected to buffalo hunting and seasonal activities
  - Names reflect environmental observations

### 4. Navajo (Diné) Calendar
- **Type**: Seasonal/Lunar
- **Structure**: Based on natural cycles and ceremonies
- **Characteristics**:
  - Tied to agricultural and ceremonial cycles
  - Months named after seasonal activities
  - Traditional timekeeping based on observation of natural phenomena

### 5. Aztec Calendar (Mesoamerican)
- **Type**: Dual calendar system
- **Components**:
  - **Xiuhpohualli**: 365-day solar year (18 months × 20 days + 5 "nameless" days)
  - **Tonalpohualli**: 260-day ritual calendar (20 periods × 13 days)
- **Epoch**: Based on creation date (August 11, 3114 BCE in Gregorian)
- **Conversion**: Well-documented algorithms exist for conversion to/from Julian Day Number
- **Note**: While technically Mesoamerican, the Aztec calendar is significant and has detailed conversion methods

### 6. Kiowa Calendar
- **Type**: Pictographic "Winter Count"
- **Structure**: Annual records of significant events
- **Characteristics**:
  - Not a traditional calendar in the standard sense
  - Records events year by year
  - Historical documentation method rather than timekeeping system

## Implementation Considerations

### Technical Challenges
1. **Lunar vs. Solar**: Most Native American calendars are lunar-based, requiring moon phase calculations
2. **Variable Month Lengths**: Lunar months vary (29-30 days), making fixed conversions difficult
3. **Seasonal Alignment**: Many calendars align with natural events that vary by location
4. **Cultural Variations**: Each tribe has unique practices; no single "Native American calendar"

### Conversion Strategies
1. **Lunisolar Mapping**: Map lunar months to approximate Gregorian months based on full moon cycles
2. **Seasonal Alignment**: Use solstices and equinoxes as anchor points
3. **Traditional Month Names**: Preserve traditional names while mapping to Gregorian structure
4. **Flexible Structure**: Allow for 12 or 13 month variations

### Recommended Approach
1. **Start with Well-Documented Systems**: 
   - Iroquois 13-moon calendar (has clear structure)
   - Cherokee calendar (has documented month names)
   - Aztec calendar (has established conversion algorithms)

2. **Use Approximate Mappings**: 
   - Map traditional months to Gregorian months
   - Preserve traditional names and meanings
   - Note that these are approximations for practical use

3. **Cultural Sensitivity**:
   - Work with cultural experts when possible
   - Provide context and explanations
   - Acknowledge that these are simplified representations

## Priority Implementation List

### High Priority (Well-Documented)
1. **Iroquois (Haudenosaunee) 13-Moon Calendar**
   - Clear structure
   - Well-documented
   - Significant cultural importance

2. **Cherokee Calendar**
   - Documented month names
   - Modern 12-month adaptation available
   - Clear mapping to Gregorian

3. **Aztec Calendar** (if including Mesoamerican)
   - Established conversion algorithms
   - Well-documented structure
   - Significant historical importance

### Medium Priority (Requires More Research)
4. **Lakota Calendar**
   - Documented month names
   - Needs conversion algorithm development

5. **Navajo Calendar**
   - Requires more specific research
   - Ceremonial significance important

### Lower Priority (Less Standardized)
6. **Other Tribal Calendars**
   - Many tribes have unique systems
   - Would require individual research and consultation

## Implementation Notes

### For Iroquois Calendar:
- 13 moons per year
- Each moon ~28 days (lunar cycle)
- Can be approximated as: 13 months of ~28 days = 364 days
- Requires adjustment for solar year alignment

### For Cherokee Calendar:
- Modern adaptation uses 12 months
- Direct mapping to Gregorian months
- Preserve traditional Cherokee names

### For Aztec Calendar:
- Xiuhpohualli: 365-day year
- 18 months of 20 days + 5 "nameless" days (Nemontemi)
- Well-established conversion formulas available
- Epoch: August 11, 3114 BCE

## Cultural Considerations

1. **Respect and Accuracy**: These calendars are deeply meaningful to their communities
2. **Consultation**: Ideally consult with cultural experts or tribal representatives
3. **Education**: Provide context about the significance and structure of each calendar
4. **Flexibility**: Acknowledge that these are approximations and may not capture all nuances
5. **Attribution**: Credit sources and acknowledge the cultural origins

## Next Steps

1. Implement Iroquois 13-moon calendar (highest priority)
2. Implement Cherokee calendar (well-documented)
3. Consider Aztec calendar (if expanding to Mesoamerican)
4. Research Lakota calendar conversion methods
5. Develop flexible framework for adding more calendars

