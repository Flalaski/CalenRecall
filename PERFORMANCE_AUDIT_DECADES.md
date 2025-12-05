# Performance Audit: Decades View

## Executive Summary
The decades view spans **110 years** (currentDecade - 50 to currentDecade + 60), creating significant performance bottlenecks when rendering the timeline minimap.

## Critical Performance Issues

### 1. **Massive Entry Load** ⚠️ CRITICAL
- **Range**: 110 years (e.g., 1970-2080)
- **Impact**: Potentially hundreds or thousands of entries across all time ranges
- **Location**: `entryPositions` useMemo processes ALL entries in this range
- **Current Behavior**: 
  - Filters entries by year range (good)
  - But still processes all matching entries for position calculation
  - Each entry gets position, color, polygon calculations

**Recommendation**: 
- Add early exit if entry count exceeds threshold
- Implement spatial indexing for faster lookups
- Consider pagination or lazy loading for entries outside viewport

### 2. **Year Scale Calculation** ⚠️ HIGH
- **Location**: `allScaleMarkings` useMemo, lines 1306-1315
- **Problem**: Loops through ALL 110 years, creating 110+ year markings
- **Impact**: 
  - 110 Date objects created
  - 110 position calculations
  - 110 label strings generated
- **Current**: No limit on year scale for decades view

**Recommendation**:
- Limit year markings in decades view (e.g., every 5-10 years)
- Only calculate year scale when actually needed
- Cache year positions

### 3. **All Scale Markings Calculation** ⚠️ HIGH
- **Location**: `allScaleMarkings` useMemo, lines 1216-1430
- **Problem**: Calculates markings for ALL 5 time scales (decade, year, month, week, day) even when only decade view is active
- **Impact**: 
  - Unnecessary calculations for month/week/day scales
  - Month scale: up to 120 months calculated
  - Week scale: up to 100 weeks calculated
  - Day scale: up to 200 days calculated
- **Total**: Potentially 500+ scale markings calculated unnecessarily

**Recommendation**:
- Only calculate scale markings for the current viewMode
- Cache scale markings per viewMode
- Lazy load other scales when needed

### 4. **Connection Generation - Distance Calculations** ⚠️ CRITICAL
- **Location**: `memoryWebConnections` useMemo, lines 1734-1740
- **Problem**: For EACH visible entry:
  - Calculates distance to ALL webNodes (typically 20-30 nodes)
  - Sorts all distances
  - Filters by scale
- **Impact**: 
  - If 100 visible entries: 100 × 25 nodes = 2,500 distance calculations
  - 100 sort operations
  - O(n²) complexity in worst case

**Recommendation**:
- Use spatial indexing (quadtree or grid) for webNodes
- Pre-calculate nearest nodes per entry
- Limit webNodes considered (e.g., only within 500px)
- Cache node distances

### 5. **Fractal Path Generation** ⚠️ MEDIUM-HIGH
- **Location**: `buildConnectionPath` → `generateFractalLightningBranch`, lines 816-896
- **Problem**: Recursive path generation with branching
- **Impact**:
  - Each connection generates complex SVG paths
  - Recursion depth up to 4 levels
  - Multiple branches per level
  - String concatenation for path building
- **Current**: Up to 50-200 connections in decades view

**Recommendation**:
- Further reduce recursion depth for decades view
- Use simpler path strategies for distant connections
- Cache generated paths
- Consider using canvas instead of SVG for many paths

### 6. **Entry-to-Entry Connections** ⚠️ HIGH
- **Location**: `memoryWebConnections` useMemo, lines 1904-1989
- **Problem**: Nested loops checking all nearby entries
- **Impact**:
  - For each visible entry (outer loop)
  - Check all other visible entries (inner loop)
  - Calculate distances
  - Sort and filter
- **Complexity**: O(n²) where n = visible entries
- **Current**: Up to 30 entry-to-entry connections in high LOD

**Recommendation**:
- Use spatial hash grid for O(1) neighbor lookup
- Limit entry-to-entry connections more aggressively in decades view
- Only connect entries within smaller radius (e.g., 100px instead of 200px)

### 7. **Viewport Culling Margin** ⚠️ MEDIUM
- **Location**: `memoryWebConnections` useMemo, line 1683
- **Problem**: 20% margin on 110-year range = 22 years of entries
- **Impact**: Processing entries for 22 years even if only 1-2 decades visible
- **Current**: `viewportMargin = 20%`

**Recommendation**:
- Reduce margin for decades view (e.g., 10% = 11 years)
- Make margin adaptive based on viewMode
- Use absolute pixel margin instead of percentage

### 8. **LOD Thresholds** ⚠️ MEDIUM
- **Location**: `LOD_THRESHOLDS`, lines 1208-1213
- **Current Thresholds**:
  - high: 50 entries
  - medium: 150 entries
  - low: 300 entries
  - minimal: 500 entries
- **Problem**: Decades view can easily exceed 500 entries
- **Impact**: Falls into 'minimal' LOD, but still processes many connections

**Recommendation**:
- Add 'ultra-minimal' LOD for >500 entries
- More aggressive connection limits for decades view
- Disable entry-to-entry connections in minimal/ultra-minimal

### 9. **useMemo Dependencies** ⚠️ MEDIUM
- **Problem**: Several expensive useMemos recalculate too frequently
- **Examples**:
  - `allScaleMarkings`: Depends on `timelineData` (changes on viewMode)
  - `memoryWebConnections`: Depends on `currentIndicatorMetrics.position` (changes on scroll)
  - `entryPositions`: Depends on `entries` and `timelineData`

**Recommendation**:
- Review dependencies - some may be unnecessary
- Use refs for values that don't need to trigger recalculation
- Debounce position updates

### 10. **DOM Rendering** ⚠️ MEDIUM
- **Location**: SVG rendering, lines 3036-3160
- **Problem**: Rendering hundreds of connection paths, scale markings, entry indicators
- **Impact**: Browser layout/paint costs
- **Current**: All connections rendered as separate `<path>` elements

**Recommendation**:
- Batch SVG updates
- Use CSS transforms instead of recalculating paths
- Virtualize off-screen elements
- Consider canvas for connections layer

## Performance Metrics (Estimated)

### Decades View (110 years, ~500 entries):
- **Entry Processing**: ~500 entries × 5ms = 2.5s
- **Scale Markings**: ~500 markings × 0.5ms = 250ms
- **Connection Generation**: ~200 connections × 10ms = 2s
- **Path Generation**: ~200 paths × 5ms = 1s
- **DOM Rendering**: ~500 elements × 2ms = 1s
- **Total Estimated**: ~6.75 seconds initial render

### After Optimizations (Target):
- **Entry Processing**: ~100 visible entries × 2ms = 200ms
- **Scale Markings**: ~20 decade markings × 0.5ms = 10ms
- **Connection Generation**: ~50 connections × 5ms = 250ms
- **Path Generation**: ~50 paths × 2ms = 100ms
- **DOM Rendering**: ~100 elements × 1ms = 100ms
- **Total Estimated**: ~660ms initial render (10x improvement)

## Priority Fixes

### Immediate (Critical) - ✅ IMPLEMENTED:
1. ✅ Limit year scale markings in decades view (every 5 years instead of every year)
2. ✅ Only calculate scale markings for current viewMode + adjacent scales
3. ✅ Reduce viewport margin for decades view (10% instead of 20%)
4. ✅ Add ultra-minimal LOD for >500 entries (25 connections max)
5. ✅ Optimize distance calculations (limit node search radius to 500px for decades)
6. ✅ Disable entry-to-entry connections in decades view
7. ✅ More aggressive LOD for decades view (one level lower)

### Short-term (High) - ✅ IMPLEMENTED:
8. ✅ Simplify path generation for ultra-minimal LOD (depth 1, simplified paths)
9. ⚠️ Cache scale markings per viewMode (structure ready, caching not implemented)
10. ✅ Reduce recursion depth for decades view (ultra-minimal uses depth 1)

### Long-term (Medium):
11. ⚠️ Implement spatial hash grid for entry-to-entry
12. ⚠️ Virtualize off-screen elements
13. ⚠️ Consider canvas for connections layer
14. ⚠️ Debounce position updates

### Long-term (Medium):
10. ✅ Implement spatial hash grid for entry-to-entry
11. ✅ Virtualize off-screen elements
12. ✅ Consider canvas for connections layer
13. ✅ Debounce position updates

