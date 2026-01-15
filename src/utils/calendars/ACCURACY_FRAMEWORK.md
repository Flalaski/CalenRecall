# Calendar Accuracy Framework

## Purpose

This framework ensures that all calendar implementations in CalenRecall are as accurate as possible based on current scholarly knowledge, and provides a structure for continuous improvement as new information becomes available.

## Principles

1. **Accuracy First**: All calendar conversions should be based on authoritative sources and verified algorithms
2. **Documentation**: All implementations must document their sources and any known limitations
3. **Verification**: Calculations should be verified against known reference dates
4. **Cultural Respect**: Calendar implementations should respect cultural practices and engage with cultural communities
5. **Continuous Improvement**: The system should evolve as new historical or astronomical information becomes available
6. **Transparency**: Users should be able to understand the accuracy level and limitations of each calendar

## Cultural Verification

**Important**: Technical accuracy (algorithms, calculations) is distinct from cultural verification (community needs, cultural appropriateness).

- **Technical Verification**: ✅ Completed - Algorithms verified against authoritative sources
- **Cultural Verification**: ⚠️ Not yet completed - Requires consultation with cultural experts and communities

See `CULTURAL_VERIFICATION_STATUS.md` for detailed status of cultural verification for each calendar system.

## Accuracy Levels

Each calendar implementation is assigned an accuracy level:

- **✅ Verified**: Implementation verified against authoritative sources and known reference dates
- **⚠️ Partial**: Implementation is generally accurate but has known limitations or edge cases
- **🔍 Needs Verification**: Implementation appears correct but needs verification against authoritative sources
- **📝 Documented Limitation**: Implementation has known limitations that are documented

## Verification Sources

Primary sources for verification:
- Dershowitz, Nachum, and Edward M. Reingold. *Calendrical Calculations: The Millennium Edition*. Cambridge University Press, 2001.
- Meeus, Jean. *Astronomical Algorithms*. Willmann-Bell, 1998 (2nd edition).
- Bickerman, E.J. *Chronology of the Ancient World*. Cornell University Press, 1980.
- National standards and official calendar authorities
- Historical documents and scholarly research
- Cultural experts and communities

For complete bibliography and detailed sources for each calendar system, see `RESEARCH_SOURCES.md`.

## Verification Process

1. **Algorithm Verification**: Verify algorithms against authoritative sources
2. **Reference Date Testing**: Test against known historical dates
3. **Edge Case Testing**: Test boundary conditions and unusual dates
4. **Cross-Reference**: Compare with other reliable implementations
5. **Documentation**: Document all sources and verification steps

## Known Limitations Tracking

Known limitations are tracked in this document and in individual calendar files. Categories:

- **Historical Period Limitations**: Certain periods may have different rules
- **Regional Variations**: Some calendars have regional variations
- **Approximations**: Some calculations use approximations for practical reasons
- **Uncertainty**: Some historical dates have scholarly debate

## Continuous Improvement Process

1. **Research**: When new information becomes available, research its source and reliability
2. **Verification**: Verify new information against existing implementations
3. **Implementation**: If verified, implement improvements
4. **Testing**: Test improvements thoroughly
5. **Documentation**: Update documentation to reflect changes
6. **Version Tracking**: Note when improvements are made

## Calendar Status

See individual calendar files and `CALENDAR_ACCURACY_STATUS.md` for detailed status of each calendar system.

## Research Sources

Comprehensive academic and authoritative sources for all calendar implementations are documented in `RESEARCH_SOURCES.md`. This includes:
- Primary algorithm sources
- Calendar-specific academic sources
- Historical references
- Official documentation
- Online resources

All implementations prioritize accuracy from authoritative sources and are verified against multiple references.
