# Electron Performance Optimizations for macOS
## Deep-Level Performance Improvements

Based on research and Electron best practices for macOS, here are critical optimizations:

---

## 🔴 Critical Electron Optimizations

### 1. Frame Rate Limiting
**Issue:** Electron can render at very high frame rates (240+ fps) which wastes CPU/GPU on macOS
**Fix:** Limit frame rate to display refresh rate

```typescript
// In main.ts, after window creation:
mainWindow.webContents.setFrameRate(60); // Match display refresh rate
// Or detect display refresh rate dynamically
const display = screen.getPrimaryDisplay();
const refreshRate = display.refreshRate || 60;
mainWindow.webContents.setFrameRate(refreshRate);
```

### 2. WebPreferences Deep Optimization
**Current:** Basic optimizations exist, but missing critical macOS-specific settings

**Add these to `getOptimizedWebPreferences`:**
```typescript
{
  // Existing...
  backgroundThrottling: false,
  
  // NEW: macOS-specific optimizations
  enableBlinkFeatures: '', // Disable experimental features that can cause issues
  disableBlinkFeatures: 'Auxclick', // Disable unnecessary features
  v8CacheOptions: 'code', // Cache V8 compiled code
  spellcheck: false, // Disable if not needed (saves resources)
  
  // Performance flags
  sandbox: false, // Already set via contextIsolation
  webSecurity: true, // Keep enabled for security
  
  // NEW: Reduce memory usage
  images: true, // Keep image loading
  plugins: false, // Disable plugins if not needed
  
  // NEW: Optimize for macOS
  ...(process.platform === 'darwin' && {
    // macOS-specific optimizations
    // Use native window controls
    titleBarStyle: 'hiddenInset', // Better macOS integration
  }),
}
```

### 3. Native macOS Visual Effects
**Issue:** Electron windows don't use native macOS visual effects efficiently
**Fix:** Use native macOS APIs for better performance

```typescript
// After window creation on macOS:
if (process.platform === 'darwin' && mainWindow) {
  // Use native macOS visual effects
  mainWindow.setVibrancy('under-window'); // or 'sidebar', 'header', etc.
  
  // Optimize window rendering
  mainWindow.setBackgroundColor('#00000000'); // Transparent for vibrancy
}
```

### 4. Renderer Process Optimization
**Issue:** Multiple renderer processes consume excessive memory
**Fix:** Limit and optimize renderer processes

```typescript
// In main.ts, before app.whenReady():
app.commandLine.appendSwitch('--disable-renderer-backgrounding');
app.commandLine.appendSwitch('--disable-background-timer-throttling');
app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('--disable-ipc-flooding-protection');

// Limit renderer processes
app.commandLine.appendSwitch('--renderer-process-limit', '1'); // Single process for better memory usage
```

### 5. GPU Process Optimization
**Issue:** GPU process can consume excessive resources
**Fix:** Optimize GPU process settings

```typescript
// Add to command line switches:
app.commandLine.appendSwitch('--disable-gpu-vsync'); // Disable VSync if causing issues
app.commandLine.appendSwitch('--enable-gpu-rasterization'); // Enable GPU rasterization
app.commandLine.appendSwitch('--enable-zero-copy'); // Zero-copy rendering when possible
```

### 6. Memory Management
**Issue:** Electron apps can leak memory on macOS
**Fix:** Implement aggressive memory management

```typescript
// Add to window creation:
mainWindow.webContents.on('did-finish-load', () => {
  // Force garbage collection periodically (development only)
  if (isDev) {
    setInterval(() => {
      if (global.gc) {
        global.gc();
      }
    }, 30000); // Every 30 seconds in dev
  }
  
  // Optimize memory
  mainWindow.webContents.setZoomFactor(1.0); // Ensure no zoom overhead
});
```

### 7. CSS/Animation Optimization
**Issue:** Heavy CSS animations can cause performance issues
**Fix:** Use will-change and transform optimizations

```css
/* In your CSS files, add these optimizations: */
.animated-element {
  will-change: transform, opacity; /* Hint browser about changes */
  transform: translateZ(0); /* Force GPU acceleration */
  backface-visibility: hidden; /* Optimize 3D transforms */
  perspective: 1000px; /* Enable 3D context */
}
```

### 8. Event Throttling
**Issue:** Too many events can cause performance degradation
**Fix:** Throttle expensive operations

```typescript
// Use requestIdleCallback for non-critical updates
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    // Non-critical updates here
  }, { timeout: 100 });
}
```

---

## 🟡 High Priority Optimizations

### 9. Web Workers for Heavy Computation
**Issue:** Heavy calculations block main thread
**Fix:** Move to Web Workers

```typescript
// Create worker for crystal calculations
const worker = new Worker(new URL('./crystalWorker.ts', import.meta.url));
worker.postMessage({ entries });
worker.onmessage = (e) => {
  // Handle results
};
```

### 10. Lazy Loading & Code Splitting
**Issue:** Loading everything upfront causes slow startup
**Fix:** Already implemented, but can be improved

### 11. Native Module Optimization
**Issue:** Native modules can cause performance issues
**Fix:** Ensure better-sqlite3 is properly optimized

```typescript
// In database.ts, ensure proper connection pooling
const db = new Database(path, {
  readonly: false,
  // Add these optimizations:
  // verbose: isDev ? console.log : undefined,
});
```

---

## 🟢 Medium Priority Optimizations

### 12. Window State Management
**Issue:** Window state changes can cause reflows
**Fix:** Batch window operations

### 13. IPC Optimization
**Issue:** Too many IPC calls can slow down app
**Fix:** Batch IPC calls when possible

### 14. Font Loading
**Issue:** Multiple fonts loading can cause delays
**Fix:** Use font-display: swap and preload critical fonts

---

## 📊 Performance Monitoring

### Add Performance Metrics:
```typescript
// In main.ts
mainWindow.webContents.on('did-finish-load', () => {
  mainWindow.webContents.executeJavaScript(`
    // Monitor frame rate
    let lastTime = performance.now();
    let frameCount = 0;
    function measureFPS() {
      frameCount++;
      const currentTime = performance.now();
      if (currentTime >= lastTime + 1000) {
        console.log('FPS:', frameCount);
        frameCount = 0;
        lastTime = currentTime;
      }
      requestAnimationFrame(measureFPS);
    }
    measureFPS();
  `);
});
```

---

## 🎯 macOS-Specific Recommendations

1. **Use Native Window Controls:** Better performance than custom controls
2. **Leverage NSVisualEffectView:** Native blur effects are faster
3. **Respect App Nap:** Let macOS manage app state when backgrounded
4. **Use Metal API:** For advanced graphics (if needed)
5. **Optimize for Retina:** Ensure proper @2x asset handling

---

## ⚠️ Known macOS Issues

1. **macOS 26 Tahoe Bug:** Electron had GPU performance issues (fixed in Electron 36.9.2+)
2. **AMD GPU Issues:** Some users report flickering (already handled with disableHardwareAcceleration option)
3. **Memory Pressure:** macOS aggressively manages memory - optimize accordingly

---

## 🔧 Implementation Priority

1. **Immediate:** Frame rate limiting, WebPreferences optimization
2. **Short-term:** Native macOS visual effects, renderer process limits
3. **Medium-term:** Web Workers, advanced memory management
4. **Long-term:** Native module optimization, Metal API integration

---

## 📝 Testing Checklist

- [ ] Frame rate stays at 60fps (or display refresh rate)
- [ ] Memory usage stays under 200MB for 10k entries
- [ ] No lag during navigation
- [ ] Smooth animations
- [ ] No GPU spikes
- [ ] App responds quickly to user input
- [ ] No memory leaks over extended use
