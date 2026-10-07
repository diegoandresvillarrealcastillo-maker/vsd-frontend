import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';

import { comprobarElSvg } from '../../foto/comprobarElSvg.ts';
import {
  retirarLaMascotaPropia,
  subirLaMascotaPropia,
  useMascotaPropia,
} from '../../foto/mascotaPropia.ts';
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
import { Apartado, MensajeDeAviso, type Aviso } from './piezas.tsx';

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
  guardar: (cambios: CambiosDePreferencias) => Promise<void>;
  actualizarCuenta: (cuenta: Cuenta) => void;
}) {
  const dibujo = useMascotaPropia();
  const tiene = cuenta.mascotaPropia != null;
  const [ocupado, setOcupado] = useState<'guardando' | 'quitando' | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const enfocarAlTerminar = useRef(false);
  const idDeLaEntrada = useId();

  // El boton de quitar desaparece con la mascota, y con el se iria el foco de
  // quien navega con teclado. Se lleva al de subir, pero solo cuando ya no esta
  // deshabilitado: una entrada deshabilitada no recibe el foco.
  useEffect(() => {
    if (ocupado === null && enfocarAlTerminar.current) {
      enfocarAlTerminar.current = false;
      entrada.current?.focus();
    }
  }, [ocupado]);

  async function alElegir(evento: ChangeEvent<HTMLInputElement>) {
    const elegido = evento.target.files?.[0];

    // Se vacia para que elegir el mismo archivo otra vez cuente como un cambio.
    evento.target.value = '';

    if (elegido === undefined) {
      return;
    }

    setOcupado('guardando');
    setAviso(null);

    try {
      comprobarElSvg(elegido);

      const conLaMascota = await subirLaMascotaPropia(elegido);

      if (tiene) {
        actualizarCuenta(conLaMascota);
        setAviso({ tipo: 'bien', texto: 'Listo, esta es tu mascota.' });
        return;
      }

      // La primera: queda como la elegida. Si esto falla, el dibujo ya esta
      // guardado y se dice, para que la persona la elija a mano.
      const { personaje, nombre } = mascotaParaMostrar(conLaMascota.mascota);

      try {
        await guardar({
          mascota: {
            forma: FORMA_DE_LA_MASCOTA_PROPIA,
            nombre: nombreAlElegir(nombre, personaje, FORMA_DE_LA_MASCOTA_PROPIA),
          },
        });
        setAviso({ tipo: 'bien', texto: 'Listo, tu mascota ya te acompaña.' });
      } catch {
        actualizarCuenta(conLaMascota);
        setAviso({
          tipo: 'fallo',
          texto:
            'Tu dibujo se guardó, pero no pudimos dejarlo como tu acompañante. Elígelo en «Tu mascota».',
        });
      }
    } catch (error) {
      setAviso({ tipo: 'fallo', texto: explicarLaMascotaPropia(error, 'guardar') });
    } finally {
      setOcupado(null);
    }
  }

  async function alQuitar() {
    setOcupado('quitando');
    setAviso(null);

    try {
      const eraLaElegida = mascotaParaMostrar(cuenta.mascota).propia;
      const quedo = await retirarLaMascotaPropia();

      actualizarCuenta(quedo);
      setAviso({
        tipo: 'bien',
        texto: eraLaElegida
          ? `Quitaste tu mascota propia. Tu acompañante vuelve a ser ${PERSONAJES[mascotaParaMostrar(quedo.mascota).personaje].nombre}.`
          : 'Quitaste tu mascota propia.',
      });
      enfocarAlTerminar.current = true;
    } catch (error) {
      setAviso({ tipo: 'fallo', texto: explicarLaMascotaPropia(error, 'quitar') });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Apartado
      titulo="Tu propia mascota"
      ayuda="Sube un dibujo tuyo en SVG y te acompañará como tu mascota. Solo lo ves tú. Antes de guardarlo lo revisamos y lo rehacemos solo con formas y colores."
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
