import { Alert } from '@mui/material';
import { Seite } from '../components/Seite';
import type { SeitenProps } from './register';

export default function Platzhalter({ nav }: SeitenProps) {
  return <Seite titel="In Arbeit"><Alert severity="info">Diese Seite ({nav}) wird gerade auf die neue Oberfläche umgestellt.</Alert></Seite>;
}
