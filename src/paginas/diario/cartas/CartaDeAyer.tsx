import { useEffect, useId, useRef } from 'react';

import '../../../estilos/cartas.css';
import { useEnLinea } from '../../../conexion/useEnLinea.ts';
import type { Anotacion } from '../../../infraestructura/api/diario.ts';
import { diasAntes } from '../../../tiempo/dias.ts';
import { ahoraMismo, diaDe, nombreDelDia } from '../calendarioDelDiario.ts';
import { DocumentoLeido } from '../DocumentoLeido.tsx';
import { BorrarSinLeer } from './BorrarSinLeer.tsx';
import { useCartaDeAyer } from './useCartaDeAyer.ts';

/** «Ayer te dejaste esto»; si la carta es de antes de ayer, dice de cuando. */
function tituloDe(dia: string): string {
  const hoy = diaDe(ahoraMismo());

  return dia === diasAntes(hoy, 1)
    ? 'Ayer te dejaste esto'
    : `Te dejaste esto el ${nombreDelDia(dia, hoy).toLowerCase()}`;
}

/**
 * La carta que la persona se escribio para despues (SCRUM-230, EMO-05).
 *
 * Aparece en el panel solo si hay una esperando, y se ofrece **sin presion**: «Leerla» y «Borrar sin
 * leerla» pesan lo mismo, y las dos estan bien. No hay contador, ni «te quedan N dias», ni nada que se
 * pueda perder: si la persona no hace nada, la carta sigue ahi.
 *
 * Es una region con nombre y no un aviso: no interrumpe a nadie. Lo que pasa despues de pulsar si se
 * anuncia (`role="status"`).
 */
export function CartaDeAyer() {
  const { estado, leer, borrar, cerrar } = useCartaDeAyer();
  const idDelTitulo = useId();

  if (estado.tipo === 'oculta') {
    return null;
  }

  if (estado.tipo === 'borrada') {
    return <CartaBorrada alCerrar={cerrar} />;
  }

  if (estado.tipo === 'leida') {
    return (
      <CartaLeida
        titulo={tituloDe(estado.carta.dia)}
        anotacion={estado.anotacion}
        alCerrar={cerrar}
      />
    );
  }

  return (
    <section className="carta" aria-labelledby={idDelTitulo}>
      <h2 id={idDelTitulo} className="carta__titulo">
        {tituloDe(estado.carta.dia)}
      </h2>
      <p className="carta__texto">
        Una carta que escribiste para ti. Puedes leerla ahora o borrarla sin leerla: las dos están
        bien.
      </p>

      {estado.aviso !== null && (
        <p className="carta__aviso" role="status">
          {estado.aviso}
        </p>
      )}

      <div className="carta__acciones">
        <button
          type="button"
          className="pildora pildora--fantasma"
          disabled={estado.leyendo}
          onClick={leer}
        >
          {estado.leyendo ? 'Abriéndola…' : 'Leerla'}
        </button>
        <BorrarSinLeer alBorrar={() => void borrar()} deshabilitado={estado.leyendo} />
      </div>
    </section>
  );
}

/**
 * El texto de la carta. Quien pulso «Leerla» ya no tiene ese boton: el foco pasa al titulo, para que un
 * lector de pantalla empiece a leer por aqui y quien teclea no se quede en el aire.
 */
function CartaLeida({
  titulo,
  anotacion,
  alCerrar,
}: {
  titulo: string;
  anotacion: Anotacion;
  alCerrar: () => void;
}) {
  const idDelTitulo = useId();
  const encabezado = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    encabezado.current?.focus();
  }, []);

  return (
    <section className="carta" aria-labelledby={idDelTitulo}>
      <h2 ref={encabezado} id={idDelTitulo} tabIndex={-1} className="carta__titulo">
        {titulo}
      </h2>
      <div className="carta__cuerpo">
        <DocumentoLeido documento={anotacion.contenido} />
      </div>
      <p className="carta__aviso">Se queda en tu diario, por si quieres volver a leerla.</p>
      <div className="carta__acciones">
        <button type="button" className="pildora pildora--fantasma" onClick={alCerrar}>
          Cerrar
        </button>
      </div>
    </section>
  );
}

/** Lo que se dice al borrar sin leer. El foco pasa al unico boton: el que se pulso ya no esta. */
function CartaBorrada({ alCerrar }: { alCerrar: () => void }) {
  const boton = useRef<HTMLButtonElement>(null);
  const enLinea = useEnLinea();

  useEffect(() => {
    boton.current?.focus();
  }, []);

  return (
    <section className="carta" aria-label="Carta a mí de mañana">
      <p className="carta__texto" role="status">
        Listo: la borraste sin leerla.
        {!enLinea && ' Se borra del todo en cuanto vuelva la conexión.'}
      </p>
      <div className="carta__acciones">
        <button ref={boton} type="button" className="pildora pildora--fantasma" onClick={alCerrar}>
          Entendido
        </button>
      </div>
    </section>
  );
}
