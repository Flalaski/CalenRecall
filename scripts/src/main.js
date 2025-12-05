"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const client_1 = __importDefault(require("react-dom/client"));
const App_1 = __importDefault(require("./App"));
const CalendarContext_1 = require("./contexts/CalendarContext");
require("./index.css");
client_1.default.createRoot(document.getElementById('root')).render(<react_1.default.StrictMode>
    <CalendarContext_1.CalendarProvider>
      <App_1.default />
    </CalendarContext_1.CalendarProvider>
  </react_1.default.StrictMode>);
