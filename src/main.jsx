import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import AutopilotDock from "./AutopilotDock.jsx";
import ContentImpactCenter from "./ContentImpactCenter.jsx";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import "./i18n.js";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageSwitcher />
      <App />
      <ContentImpactCenter />
      <AutopilotDock />
    </BrowserRouter>
  </React.StrictMode>,
);
