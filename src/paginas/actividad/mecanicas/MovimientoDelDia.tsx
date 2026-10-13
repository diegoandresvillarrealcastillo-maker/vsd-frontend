import { useState, type FormEvent } from 'react';

import { BarraDeAccion, BotonPrincipal, BotonSecundario } from '../viva/BarraDeAccion.tsx';
import { BarraDeProgreso } from '../viva/BarraDeProgreso.tsx';
import { mensajeAlElegir, mensajeDelPaso } from '../viva/mensajes.ts';
import { OpcionGrande } from '../viva/OpcionGrande.tsx';
import { PasoAnimado } from '../viva/PasoAnimado.tsx';
import { useMascotaDeLaPersona } from '../viva/mascotaDeLaPersona.ts';
import { VozDeLaMascota } from '../viva/VozDeLaMascota.tsx';
import type { PropsDeMecanica } from './registro.tsx';

/**
 * "Movimiento del dia": si te moviste hoy, como y cuanto (SCRUM-93).
 *
 * Es una **bitacora sin puntaje**. Nunca manda `score`: la actividad es
 * `sin_puntaje` y la API responderia 400. Ponerle nota a si alguien salio a
 * caminar convertiria un registro en un examen.
 *
 * "Hoy no me movi" es una respuesta tan valida como cualquier otra, y se
 * registra igual: sin ella, la bitacora solo guardaria los dias buenos y no
 * contaria como van de verdad las semanas.
 *
 * El tiempo va por tramos y no en minutos exactos: nadie cronometra una
 * caminata, y pedir un numero preciso invita a inventarlo.
 */

const TIPOS = [
  { clave: 'caminar', texto: 'Caminar' },
  { clave: 'ejercicio', texto: 'Deporte o ejercicio' },
  { clave: 'bicicleta', texto: 'Bicicleta' },
  { clave: 'baile', texto: 'Baile' },
  { clave: 'estiramientos', texto: 'Estiramientos o yoga' },
  { clave: 'tareas', texto: 'Tareas que te hicieron moverte' },
  { clave: 'otro', texto: 'Otro' },
] as const;

const DURACIONES = [
  { clave: 'menos-de-15', texto: 'Menos de 15 minutos' },
  { clave: '15-a-30', texto: 'De 15 a 30 minutos' },
  { clave: '30-a-60', texto: 'De 30 minutos a una hora' },
  { clave: 'mas-de-60', texto: 'Más de una hora' },
] as const;

type Tipo = (typeof TIPOS)[number]['clave'];
type Duracion = (typeof DURACIONES)[number]['clave'];

const ADORNOS_DE_TIPO: Readonly<Record<Tipo, string>> = {
  caminar: '🚶',
  ejercicio: '🏃',
  bicicleta: '🚴',
  baile: '💃',
  estiramientos: '🧘',
  tareas: '🧹',
  otro: '✨',
};

export function MovimientoDelDia({ alTerminar, enviando }: PropsDeMecanica) {
  const mascota = useMascotaDeLaPersona();
  const [seMovio, setSeMovio] = useState<boolean | null>(null);
  const [tipos, setTipos] = useState<readonly Tipo[]>([]);
  const [duracion, setDuracion] = useState<Duracion | null>(null);
  const [paso, setPaso] = useState(0);
  const [direccion, setDireccion] = useState<1 | -1>(1);
  // Sube con cada eleccion: es lo que hace saltar a la mascota.
  const [latido, setLatido] = useState(0);

  // Si hoy no hubo movimiento, no hay mas que preguntar: la actividad es de un solo paso.
  const total = seMovio === false ? 1 : 3;
  const esElUltimo = paso === total - 1;
  const hechos =
    (seMovio === null ? 0 : 1) + (tipos.length > 0 ? 1 : 0) + (duracion === null ? 0 : 1);
  const puedeSeguir =
    paso === 0 ? seMovio !== null : paso === 1 ? tipos.length > 0 : duracion !== null;

  function elegir<T>(poner: (valor: T) => void, valor: T) {
    poner(valor);
    setLatido((antes) => antes + 1);
  }

  function alternarTipo(tipo: Tipo) {
    setLatido((antes) => antes + 1);
    setTipos((antes) =>
      antes.includes(tipo) ? antes.filter((uno) => uno !== tipo) : [...antes, tipo],
    );
  }

  function volver() {
    setLatido((antes) => antes + 1);
    setDireccion(-1);
    setPaso((antes) => Math.max(0, antes - 1));
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();

    if (!puedeSeguir) {
      return;
    }

    if (!esElUltimo) {
      setLatido((antes) => antes + 1);
      setDireccion(1);
      setPaso((antes) => antes + 1);
      return;
    }

    if (seMovio === false) {
      alTerminar({ metadata: { seMovio: false } });
      return;
    }

    if (duracion === null) {
      return;
    }

    // En el orden de la lista y no en el que se marcaron: asi dos registros
    // iguales quedan iguales.
    alTerminar({
      metadata: {
        seMovio: true,
        tipos: TIPOS.map(({ clave }) => clave).filter((clave) => tipos.includes(clave)),
        duracion,
      },
    });
  }

  const mensaje =
    paso === 0 && seMovio === false
      ? 'También cuenta. Registrarlo ayuda a ver cómo van tus semanas, sin metas que cumplir.'
      : puedeSeguir
        ? mensajeAlElegir(paso)
        : mensajeDelPaso(paso, total);

  return (
    <form className="viva" onSubmit={enviar} noValidate>
      <BarraDeProgreso paso={paso + 1} total={total} hechos={hechos} etiqueta="Paso" />

      <VozDeLaMascota
        mascota={mascota}
        mensaje={mensaje}
        expresion={paso === 0 && seMovio === null ? 'feliz' : 'normal'}
        latido={latido}
      />

      {paso === 0 && (
        <PasoAnimado clave="se-movio" direccion={direccion} titulo="¿Te moviste hoy?">
          <div className="viva-opciones" role="radiogroup" aria-labelledby="viva-titulo-se-movio">
            {[
              { valor: true, texto: 'Sí', adorno: '🚶' },
              { valor: false, texto: 'Hoy no', adorno: '🛋️' },
            ].map(({ valor, texto, adorno }) => (
              <OpcionGrande
                key={texto}
                tipo="radio"
                nombre="seMovio"
                valor={texto}
                marcada={seMovio === valor}
                alCambiar={() => elegir(setSeMovio, valor)}
                texto={texto}
                adorno={adorno}
              />
            ))}
          </div>
        </PasoAnimado>
      )}

      {paso === 1 && (
        <PasoAnimado
          clave="tipos"
          direccion={direccion}
          titulo="¿Qué tipo de movimiento?"
          ayuda="Puedes marcar varios."
        >
          <div className="viva-opciones viva-opciones--en-dos">
            {TIPOS.map(({ clave, texto }) => (
              <OpcionGrande
                key={clave}
                tipo="checkbox"
                nombre="tipos"
                valor={clave}
                marcada={tipos.includes(clave)}
                alCambiar={() => alternarTipo(clave)}
                texto={texto}
                adorno={ADORNOS_DE_TIPO[clave]}
              />
            ))}
          </div>
        </PasoAnimado>
      )}

      {paso === 2 && (
        <PasoAnimado clave="duracion" direccion={direccion} titulo="¿Cuánto tiempo, más o menos?">
          <div className="viva-opciones" role="radiogroup" aria-labelledby="viva-titulo-duracion">
            {DURACIONES.map(({ clave, texto }) => (
              <OpcionGrande
                key={clave}
                tipo="radio"
                nombre="duracion"
                valor={clave}
                marcada={duracion === clave}
                alCambiar={() => elegir(setDuracion, clave)}
                texto={texto}
              />
            ))}
          </div>
        </PasoAnimado>
      )}

      {!puedeSeguir && (
        <p className="viva-falta">
          {paso === 0
            ? 'Cuéntanos si te moviste hoy.'
            : paso === 1
              ? 'Elige al menos un tipo de movimiento.'
              : 'Elige más o menos cuánto tiempo.'}
        </p>
      )}

      <BarraDeAccion>
        {paso > 0 && <BotonSecundario alPulsar={volver}>Atrás</BotonSecundario>}

        <BotonPrincipal
          tipo="submit"
          conFlecha={!esElUltimo}
          deshabilitado={!puedeSeguir || enviando}
        >
          {enviando ? 'Guardando…' : esElUltimo ? 'Terminar' : 'Continuar'}
        </BotonPrincipal>
      </BarraDeAccion>
    </form>
  );
}
