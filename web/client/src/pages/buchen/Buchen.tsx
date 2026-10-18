// Buchen: Raum buchen, Ressource buchen, Neue Aktivität, Zusätzliche Stunden (Assistent), Meine Buchungen, Raum- und Ressourcenübersicht,
// Neuer Unterricht und – für die Administration – Ressourcen und Raumdaten verwalten. Adressen wie bisher: #/buchen/<bereich>/…
import type { SeitenProps } from '../register';
import { Assistent } from './Assistent';
import { MeineBuchungen } from './MeineBuchungen';
import { Raumuebersicht } from './Raumuebersicht';
import { Ressourcenuebersicht } from './Ressourcenuebersicht';
import { NeuerUnterricht, Raumdaten, Ressourcenverwaltung } from './Verwaltung';

export default function Buchen({ teile }: SeitenProps) {
  const [bereich, ...rest] = teile;
  switch (bereich) {
    case 'ressource': return <Assistent art="ressource" rest={rest} />;
    case 'aktivitaet': return <Assistent art="aktivitaet" rest={rest} />;
    case 'stunden': return <Assistent art="unterricht" rest={rest} />;
    case 'meine': return <MeineBuchungen rest={rest} />;
    case 'raeume': return <Raumuebersicht rest={rest} />;
    case 'ressourcen': return <Ressourcenuebersicht rest={rest} />;
    case 'unterricht': return <NeuerUnterricht />;
    case 'verwaltung': return <Ressourcenverwaltung />;
    case 'raumdaten': return <Raumdaten />;
    default: return <Assistent art="raum" rest={rest} />;
  }
}
