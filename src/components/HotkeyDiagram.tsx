import './HotkeyDiagram.css';

export default function HotkeyDiagram() {
  return (
    <div className="hotkey-diagram-container">
      <div className="hotkey-diagram-hologram">
        <div className="hotkey-diagram-header">
          <h2>Keyboard Shortcuts</h2>
        </div>
        
        <div className="hotkey-keyboard-layout">
          {/* Top Row - Zoom Keys & T */}
          <div className="hotkey-keyboard-row">
            <div className="hotkey-key-item">
              <kbd className="hotkey-key">↑</kbd>
              <span className="hotkey-key-label">Zoom In</span>
            </div>
            <div className="hotkey-key-item">
              <kbd className="hotkey-key">W</kbd>
              <span className="hotkey-key-label">Zoom In</span>
            </div>
            <div className="hotkey-key-spacer"></div>
            <div className="hotkey-key-item">
              <kbd className="hotkey-key">T</kbd>
              <span className="hotkey-key-label">Today</span>
            </div>
            <div className="hotkey-key-spacer"></div>
            <div className="hotkey-key-item">
              <kbd className="hotkey-key">S</kbd>
              <span className="hotkey-key-label">Zoom Out</span>
            </div>
            <div className="hotkey-key-item">
              <kbd className="hotkey-key">↓</kbd>
              <span className="hotkey-key-label">Zoom Out</span>
            </div>
          </div>

          {/* Middle Row - WASD Navigation */}
          <div className="hotkey-keyboard-row">
            <div className="hotkey-key-item">
              <kbd className="hotkey-key">←</kbd>
              <span className="hotkey-key-label">Prev</span>
            </div>
            <div className="hotkey-key-item">
              <kbd className="hotkey-key">A</kbd>
              <span className="hotkey-key-label">Prev</span>
            </div>
            <div className="hotkey-key-spacer"></div>
            <div className="hotkey-key-item">
              <kbd className="hotkey-key">D</kbd>
              <span className="hotkey-key-label">Next</span>
            </div>
            <div className="hotkey-key-item">
              <kbd className="hotkey-key">→</kbd>
              <span className="hotkey-key-label">Next</span>
            </div>
          </div>

          {/* Bottom Row - Entry & App Keys */}
          <div className="hotkey-keyboard-row">
            <div className="hotkey-key-item hotkey-key-wide">
              <kbd className="hotkey-key">Shift</kbd>
              <span className="hotkey-plus">+</span>
              <kbd className="hotkey-key">Space</kbd>
              <span className="hotkey-key-label">New Entry</span>
            </div>
            <div className="hotkey-key-item hotkey-key-wide">
              <kbd className="hotkey-key">Ctrl</kbd>
              <span className="hotkey-plus">+</span>
              <kbd className="hotkey-key">Enter</kbd>
              <span className="hotkey-key-label">Save</span>
            </div>
            <div className="hotkey-key-item">
              <kbd className="hotkey-key">Esc</kbd>
              <span className="hotkey-key-label">Cancel</span>
            </div>
            <div className="hotkey-key-item hotkey-key-wide">
              <kbd className="hotkey-key">Ctrl</kbd>
              <span className="hotkey-plus">+</span>
              <kbd className="hotkey-key">,</kbd>
              <span className="hotkey-key-label">Prefs</span>
            </div>
            <div className="hotkey-key-item hotkey-key-wide">
              <kbd className="hotkey-key">Ctrl</kbd>
              <span className="hotkey-plus">+</span>
              <kbd className="hotkey-key">Q</kbd>
              <span className="hotkey-key-label">Quit</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

