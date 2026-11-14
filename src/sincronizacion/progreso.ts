import { cicloActual, suscribirALaCola, suscribirAlCiclo } from './ciclo.ts';

/**
 * Lo que una pantalla necesita saber para ir al ritmo de la cola (SCRUM-139).
 */
export interface Progreso {
  /** El motor esta enviando ahora. */
  readonly sincronizando: boolean;
}

/**
 * Avisa a `oyente` cada vez que algo de la cola pudo cambiar para quien la mira: se
 * agrego o se descarto algo (aqui o en otra pestana), el motor empezo o termino una
 * tanda, envio una operacion, o se abrio o cerro el almacen.
 *
 * Es lo que necesita una pantalla que muestra datos y tambien lo que esta pendiente de
 * enviar —el diario—: cuando cambia algo, vuelve a leer. Quien solo quiere esperar a una
 * operacion usa `seguirUnaOperacion`.
 *
 * Se llama una vez al empezar, para que quien se suscribe parta de lo que hay. Devuelve
 * la funcion para dejar de escuchar.
 */
export function suscribirAlProgreso(oyente: (progreso: Progreso) => void): () => void {
  let sincronizando = false;
  let dejarDeEscucharAlMotor: (() => void) | null = null;

  function avisar(): void {
    oyente({ sincronizando });
  }

  function escucharAlMotorDeAhora(): void {
    dejarDeEscucharAlMotor?.();
    sincronizando = false;
    dejarDeEscucharAlMotor =
      cicloActual()?.motor.suscribir((evento) => {
        if (evento.tipo === 'inicio') {
          sincronizando = true;
        } else if (evento.tipo === 'fin') {
          sincronizando = false;
        }

        avisar();
      }) ?? null;
  }

  escucharAlMotorDeAhora();

  const dejarDeEscucharLaCola = suscribirALaCola(avisar);
  const dejarDeEscucharElCiclo = suscribirAlCiclo(() => {
    escucharAlMotorDeAhora();
    avisar();
  });

  avisar();

  return () => {
    dejarDeEscucharAlMotor?.();
    dejarDeEscucharLaCola();
    dejarDeEscucharElCiclo();
  };
}
