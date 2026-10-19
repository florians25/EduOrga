import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { FluentProvider, Toaster } from "@fluentui/react-components";
import "../../../design/tokens.css";
import "./stil.css";
import { thema } from "./thema";
import { Rahmen } from "./bausteine/Rahmen";
import { Start } from "./seiten/Start";
import { ModuleSeite } from "./seiten/Module";
import { Installation } from "./seiten/Installation";
import { Portal } from "./seiten/Portal";
import { Hinweis, Impressum, Datenschutz } from "./seiten/Rechtliches";
import { NichtGefunden } from "./seiten/NichtGefunden";
import { Verwaltung } from "./verwaltung/Verwaltung";
import { TOASTER } from "./bausteine/meldungen";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FluentProvider theme={thema} className="fluent-wurzel">
      <BrowserRouter>
        <Routes>
          <Route path="/verwaltung/*" element={<Verwaltung />} />
          <Route element={<Rahmen />}>
            <Route index element={<Start />} />
            <Route path="module" element={<ModuleSeite />} />
            <Route path="installation" element={<Installation />} />
            <Route path="portal" element={<Portal />} />
            <Route path="hinweis" element={<Hinweis />} />
            <Route path="impressum" element={<Impressum />} />
            <Route path="datenschutz" element={<Datenschutz />} />
            <Route path="*" element={<NichtGefunden />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster toasterId={TOASTER} position="bottom-end" />
    </FluentProvider>
  </StrictMode>,
);
