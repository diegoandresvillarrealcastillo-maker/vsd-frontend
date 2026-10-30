import type { ChangeEvent } from 'react';

import { comprobarElSvg } from '../../foto/comprobarElSvg.ts';
import {
  retirarLaMascotaPropia,
  subirLaMascotaPropia,
  useMascotaPropia,
} from '../../foto/mascotaPropia.ts';
import type { ContextoDePeticion } from '../../infraestructura/api/clienteHttp.ts';
import type { CambiosDePreferencias, Cuenta } from '../../infraestructura/api/cuenta.ts';
import {
  FORMA_DE_LA_MASCOTA_PROPIA,
  mascotaParaMostrar,
  nombreAlElegir,
  PERSONAJES,
} from '../../mascota/personajes.ts';
import { Icono } from '../panel/Icono.tsx';
import { GuiaDeLaMascotaPropia } from './GuiaDeLaMascotaPropia.tsx';
import { explicarLaMascotaPropia } from './mensajesDeLaMascotaPropia.ts';
import { Apartado, MensajeDeAviso } from './piezas.tsx';
import { useEntradaDeArchivo } from './useEntradaDeArchivo.ts';

/**
 * La mascota propia (SCRUM-122): un dibujo SVG que sube la persona.
 *
 * El archivo se manda tal cual, **sin que el navegador lo lea ni lo toque**: lo
 * que se admite lo decide el servidor, que lo reescribe desde una lista blanca y
 * rechaza lo demas con un motivo. Lo que se muestra aqui es esa version
 * reescrita, siempre como `<img>`.
 *
 * Si es la primera que sube, queda como su mascota elegida: la subio para verla y
 * pedirle ademas que vaya a «Tu mascota» a elegirla seria un paso que no
 * entiende. Si ya tenia una y solo la cambia, la eleccion se deja como estaba.
 *
 * La entrada de archivo va antes de su etiqueta, como en la foto (`TuFoto`): asi
 * recibe el foco quien navega con teclado.
 */
export function TuMascotaPropia({
  cuenta,
  guardar,
  actualizarCuenta,
}: {
  cuenta: Cuenta;
  guardar: (cambios: CambiosDePreferencias, contexto?: ContextoDePeticion) => Promise<void>;
  actualizarCuenta: (cuenta: Cuenta) => void;
}) {
  const dibujo = useMascotaPropia();
  const tiene = cuenta.mascotaPropia != null;
  const {
    iniciarLaOperacion,
    ocupado,
    setOcupado,
    aviso,
    setAviso,
    entrada,
    enfocarLaEntradaAlTerminar,
    idDeLaEntrada,
    tomarElArchivo,
  } = useEntradaDeArchivo();

  async function alElegir(evento: ChangeEvent<HTMLInputElement>) {
    const elegido = tomarElArchivo(evento);

    if (elegido === undefined) {
      return;
    }

    // Las dos peticiones (subir el dibujo y dejarlo como acompanante) son de quien lo eligio: si la
    // sesion cambia entre una y otra, la segunda no sale con la sesion de otra persona (SCRUM-317).
    const { senal, operacion } = iniciarLaOperacion();
    const siguenSiendoDeEstaSesion = () => operacion === null || operacion.vigente();

    try {
      comprobarElSvg(elegido);

      const conLaMascota = await subirLaMascotaPropia(elegido, senal, operacion?.peticion);

      if (tiene) {
        actualizarCuenta(conLaMascota);
        setAviso({ tipo: 'bien', texto: 'Listo, esta es tu mascota.' });
        return;
      }

      // La primera: queda como la elegida. Si esto falla, el dibujo ya esta
      // guardado y se dice, para que la persona la elija a mano.
      const { personaje, nombre } = mascotaParaMostrar(conLaMascota.mascota);

      try {
        await guardar(
          {
            mascota: {
              forma: FORMA_DE_LA_MASCOTA_PROPIA,
              nombre: nombreAlElegir(nombre, personaje, FORMA_DE_LA_MASCOTA_PROPIA),
            },
          },
          operacion?.peticion,
        );
        setAviso({ tipo: 'bien', texto: 'Listo, tu mascota ya te acompaña.' });
      } catch {
        if (siguenSiendoDeEstaSesion()) {
          actualizarCuenta(conLaMascota);
          setAviso({
            tipo: 'fallo',
            texto:
              'Tu dibujo se guardó, pero no pudimos dejarlo como tu acompañante. Elígelo en «Tu mascota».',
          });
        }
      }
    } catch (error) {
      if (siguenSiendoDeEstaSesion()) {
        setAviso({ tipo: 'fallo', texto: explicarLaMascotaPropia(error, 'guardar') });
      }
    } finally {
      setOcupado(null);
    }
  }

  async function alQuitar() {
    const { senal, operacion } = iniciarLaOperacion();

    setOcupado('quitando');
    setAviso(null);

    try {
      const eraLaElegida = mascotaParaMostrar(cuenta.mascota).propia;
      const quedo = await retirarLaMascotaPropia(senal, operacion?.peticion);

      actualizarCuenta(quedo);
      setAviso({
        tipo: 'bien',
        texto: eraLaElegida
          ? `Quitaste tu mascota propia. Tu acompañante vuelve a ser ${PERSONAJES[mascotaParaMostrar(quedo.mascota).personaje].nombre}.`
          : 'Quitaste tu mascota propia.',
      });
      enfocarLaEntradaAlTerminar();
    } catch (error) {
      if (operacion === null || operacion.vigente()) {
        setAviso({ tipo: 'fallo', texto: explicarLaMascotaPropia(error, 'quitar') });
      }
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Apartado
      titulo="Tu propia mascota"
      ayuda="Sube un dibujo tuyo en SVG y será tu mascota. Solo lo ves tú. Antes de guardarlo lo revisamos y lo rehacemos solo con formas y colores."
    >
      <div className="perfil__foto">
        <div className="perfil__mascota-marco">
          {dibujo.url === null ? (
            <span className="perfil__mascota-vacia" aria-hidden="true">
              <Icono nombre="sparkles" tamano={40} />
            </span>
          ) : (
            <img
              className="perfil__mascota-dibujo"
              src={dibujo.url}
              alt="Tu mascota propia"
              width={96}
              height={96}
            />
          )}
        </div>

        <div className="perfil__foto-acciones">
          <input
            ref={entrada}
            id={idDeLaEntrada}
            className="solo-lectores perfil__foto-entrada"
            type="file"
            accept="image/svg+xml,.svg"
            disabled={ocupado !== null}
            onChange={(evento) => void alElegir(evento)}
          />
          <label
            htmlFor={idDeLaEntrada}
            className={`app__boton perfil__foto-elegir${ocupado !== null ? ' perfil__foto-elegir--ocupado' : ''}`}
          >
            {tiene ? 'Cambiar mi dibujo' : 'Subir mi dibujo'}
          </label>

          {tiene && (
            <button
              type="button"
              className="perfil__secundario"
              disabled={ocupado !== null}
              onClick={() => void alQuitar()}
            >
              {ocupado === 'quitando' ? 'Quitando…' : 'Quitar mi mascota'}
            </button>
          )}
        </div>
      </div>

      {ocupado === 'guardando' && (
        <p className="app__nota" role="status">
          Revisando y guardando tu dibujo…
        </p>
      )}

      <MensajeDeAviso aviso={aviso} />

      <GuiaDeLaMascotaPropia />
    </Apartado>
  );
}
