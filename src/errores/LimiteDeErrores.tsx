import { Component, type ErrorInfo, type ReactNode } from 'react';

import { PantallaDeError } from './PantallaDeError.tsx';
import { reportarError, type OrigenDelError } from './reportarError.ts';

interface Propiedades {
  readonly children: ReactNode;
  /** Quien lo puso: la raiz de la aplicacion o una ruta. Solo sirve al informe. */
  readonly origen: Extract<OrigenDelError, 'raiz' | 'ruta'>;
  /**
   * Cuando esto cambia, el limite se limpia solo. Pasarle la ruta hace que
   * navegar a otra pantalla quite la de error: es lo que la persona espera.
   */
  readonly restablecerCon?: string;
}

interface Estado {
  readonly fallo: boolean;
  readonly intentos: number;
}

/**
 * Atrapa lo que se rompe al pintar y muestra `PantallaDeError` en su lugar
 * (SCRUM-156).
 *
 * Tiene que ser una clase: React solo deja atrapar errores de pintado desde
 * `getDerivedStateFromError` y `componentDidCatch`, que no existen como hooks.
 *
 * Lo que **no** atrapa, por como funciona React: los errores de los manejadores
 * de eventos, de las promesas y de lo asincrono. Esos van por `main.tsx`
 * (`error` y `unhandledrejection` de la ventana), que los reporta, y cada
 * pantalla decide que le dice a la persona.
 */
export class LimiteDeErrores extends Component<Propiedades, Estado> {
  override state: Estado = { fallo: false, intentos: 0 };

  static getDerivedStateFromError(): Partial<Estado> {
    return { fallo: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    reportarError(error, this.props.origen, info.componentStack);
  }

  override componentDidUpdate(anteriores: Propiedades): void {
    // Otra pantalla, otra oportunidad: el error era de la anterior.
    if (this.state.fallo && anteriores.restablecerCon !== this.props.restablecerCon) {
      this.setState({ fallo: false, intentos: 0 });
    }
  }

  private readonly reintentar = (): void => {
    this.setState((estado) => ({ fallo: false, intentos: estado.intentos + 1 }));
  };

  override render(): ReactNode {
    if (this.state.fallo) {
      return <PantallaDeError alReintentar={this.reintentar} intentos={this.state.intentos} />;
    }

    return this.props.children;
  }
}
