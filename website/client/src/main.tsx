import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "../../../design/tokens.css";
import "./stil.css";
import { Rahmen } from "./bausteine/Rahmen";
import { Start } from "./seiten/Start";
import { ModulSeite } from "./seiten/Module";
import { Installation } from "./seiten/Installation";
import { Dokumentation } from "./seiten/Dokumentation";
import { Rueckmeldung } from "./seiten/Rueckmeldung";
import { Hinweis, Impressum, Datenschutz } from "./seiten/Rechtliches";
import { NichtGefunden } from "./seiten/NichtGefunden";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Rahmen />}>
          <Route index element={<Start />} />
          <Route path="studio" element={<ModulSeite key="studio" kennung="studio" />} />
          <Route path="web" element={<ModulSeite key="web" kennung="web" />} />
          <Route path="mobile" element={<ModulSeite key="mobile" kennung="mobile" />} />
          <Route path="installation" element={<Installation />} />
          <Route path="dokumentation" element={<Dokumentation />} />
          <Route path="handbuch" element={<Navigate to="/dokumentation#handbuch" replace />} />
          <Route path="ios" element={<Navigate to="/mobile#ios" replace />} />
          <Route path="android" element={<Navigate to="/mobile#android" replace />} />
          <Route path="rueckmeldung" element={<Rueckmeldung />} />
          <Route path="hinweis" element={<Hinweis />} />
          <Route path="impressum" element={<Impressum />} />
          <Route path="datenschutz" element={<Datenschutz />} />
          <Route path="*" element={<NichtGefunden />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
