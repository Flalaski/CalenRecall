# Mayan Long Count Encoding Verification

**Date**: December 2024  
**Purpose**: Verify the encoding scheme for Mayan Long Count components

## Current Implementation

### Encoding Scheme

The implementation encodes all 5 Long Count components using the standard CalendarDate interface:

- **year** field = baktun
- **month** field = katun  
- **day** field = encoded (tun × 400 + uinal × 20 + kin)

### Components

1. **Baktun**: 144,000 days (20 katuns)
2. **Katun**: 7,200 days (20 tuns)
3. **Tun**: 360 days (18 uinals)
4. **Uinal**: 20 days
5. **Kin**: 1 day

### Encoding Formula

```typescript
encodedDay = tun * 400 + uinal * 20 + kin
```

**Decoding**:
```typescript
tun = floor(encodedDay / 400)
uinal = floor((encodedDay % 400) / 20)
kin = encodedDay % 20
```

## Verification Needed

### Test Cases

1. **Classic Period Dates**
   - 9.15.0.0.0 (Classic period Long Count)
   - Verify encoding/decoding works correctly

2. **Modern Dates**
   - 13.0.0.0.0 (December 21, 2012 - end of baktun)
   - 13.0.0.0.1 (December 22, 2012)

3. **All Components**
   - Dates with non-zero uinal and kin
   - Verify all 5 components round-trip correctly

4. **Edge Cases**
   - Maximum values (e.g., 19.19.17.19.19)
   - Minimum values (0.0.0.0.0)
   - Negative dates (before epoch)

5. **Formatting**
   - Standard format: baktun.katun.tun.uinal.kin
   - Verify parsing works correctly

## Known Reference Dates

### Epoch
- **Long Count**: 0.0.0.0.0
- **Gregorian**: August 11, 3114 BCE
- **JDN**: 584283

### End of Baktun 13
- **Long Count**: 13.0.0.0.0
- **Gregorian**: December 21, 2012
- **JDN**: 2456283 (approximately)

### Verification Method

Test encoding/decoding:
1. Start with Long Count: baktun.katun.tun.uinal.kin
2. Encode to CalendarDate format
3. Convert to JDN
4. Convert JDN back to Long Count
5. Verify all 5 components match

## Questions to Answer

1. **Is the encoding scheme correct?**
   - Does encoding tun/uinal/kin in day field work correctly?
   - Are there any edge cases where this breaks?

2. **Is the formatting standard?**
   - Should we use baktun.katun.tun.uinal.kin format?
   - Are there alternative formats we should support?

3. **Are negative dates handled correctly?**
   - How should pre-epoch dates be represented?
   - Is our negative representation appropriate?

## Implementation Status

- ✅ Epoch correct (584283)
- ✅ Basic conversion works
- ⚠️ Encoding scheme needs verification with full component dates
- ⚠️ Formatting/parsing needs comprehensive testing

---

**Status**: Verification needed  
**Next Step**: Create test cases with all 5 components

