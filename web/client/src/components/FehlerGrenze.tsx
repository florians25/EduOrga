// Fängt Darstellungsfehler einer Seite ab (die Navigation bleibt bedienbar).
import { Component, type ReactNode } from 'react';
import { Alert, Button } from '@mui/material';

export class FehlerGrenze extends Component<{ children: ReactNode; schluessel?: string }, { fehler: Error | null; schluessel?: string }> {
  override state: { fehler: Error | null; schluessel?: string } = { fehler: null, schluessel: this.props.schluessel };
  static getDerivedStateFromError(fehler: Error) { return { fehler }; }
  static getDerivedStateFromProps(p: { schluessel?: string }, s: { fehler: Error | null; schluessel?: string }) {
    return p.schluessel !== s.schluessel ? { fehler: null, schluessel: p.schluessel } : null;
  }
  override componentDidCatch(err: Error) { console.error(err); }
  override render() {
    if (this.state.fehler) {
      return <Alert severity="error" action={<Button color="inherit" onClick={() => location.reload()}>Neu laden</Button>}>Die Seite konnte nicht angezeigt werden: {this.state.fehler.message}</Alert>;
    }
    return this.props.children;
  }
}
