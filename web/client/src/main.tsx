import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/de';
import './fonts.css';
import { theme } from './theme';
import { App } from './app/App';
import { Meldungen } from './lib/meldungen';
import { PdfWahl } from './lib/pdf';

// App-Installation (PWA) anbieten, sobald der Browser es erlaubt
window.addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); (window as unknown as { __pwaAngebot: Event }).__pwaAngebot = ev; });

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline enableColorScheme />
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
        <App />
        <Meldungen />
        <PdfWahl />
      </LocalizationProvider>
    </ThemeProvider>
  </StrictMode>,
);
