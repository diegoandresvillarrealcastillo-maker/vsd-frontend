import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';

import { useFotoDePerfil, retirarLaFoto, subirLaFoto } from '../../foto/fotoDePerfil.ts';
import { prepararLaFoto } from '../../foto/prepararLaFoto.ts';
import type { Cuenta } from '../../infraestructura/api/cuenta.ts';
import { Icono } from '../panel/Icono.tsx';
import { explicarLaFoto } from './mensajesDeLaFoto.ts';
import { Apartado, MensajeDeAviso, type Aviso } from './piezas.tsx';

/**
 * La foto de perfil (SCRUM-120).
 *
 * Se elige de la galeria, un `.jpg` o un `.png`. **Se recorta en cuadrado y se
 * comprime aqui, en el dispositivo**, antes de mandarla: el archivo original no
 * sale de la persona, solo sale lo que queda, de unos 256 px y menos de 50 KB.
 *
 * La entrada de archivo va **antes** de su etiqueta, a proposito: es el patron
 * accesible para un boton de «elegir archivo». La entrada se queda a la vista de
 * quien navega con teclado o con lector de pantalla —recibe el foco y abre el
 * selector con Enter o con Espacio— y la etiqueta es lo que ve y toca todo el
 * mundo. Un boton aparte que llamara a `click()` sobre una entrada escondida
 * dejaria sin foco a quien no usa el raton.
 */
export function TuFoto({ actualizarCuenta }: { actualizarCuenta: (cuenta: Cuenta) => void }) {
  const foto = useFotoDePerfil();
  const [ocupado, setOcupado] = useState<'guardando' | 'quitando' | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const enfocarAlTerminar = useRef(false);
  const idDeLaEntrada = useId();

  // El boton de quitar desaparece con la foto, y con el se iria el foco de quien
  // navega con teclado. Se lleva al de elegir, pero solo cuando ya no esta
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
      actualizarCuenta(await subirLaFoto(await prepararLaFoto(elegido)));
      setAviso({ tipo: 'bien', texto: 'Listo, esta es tu foto.' });
    } catch (error) {
      setAviso({ tipo: 'fallo', texto: explicarLaFoto(error, 'guardar') });
    } finally {
      setOcupado(null);
    }
  }

  async function alQuitar() {
    setOcupado('quitando');
    setAviso(null);

    try {
      actualizarCuenta(await retirarLaFoto());
      setAviso({ tipo: 'bien', texto: 'Quitaste tu foto.' });
      enfocarAlTerminar.current = true;
    } catch (error) {
      setAviso({ tipo: 'fallo', texto: explicarLaFoto(error, 'quitar') });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Apartado
      titulo="Tu foto"
      ayuda="Es opcional y solo la ves tú. La recortamos en cuadrado y la reducimos aquí, en tu dispositivo, antes de guardarla: tu foto original no sale de él."
    >
      <div className="perfil__foto">
        <div className="perfil__foto-marco">
          {foto === null ? (
            <span className="perfil__foto-vacia" aria-hidden="true">
              <Icono nombre="user" tamano={40} />
            </span>
          ) : (
            <img className="perfil__foto-imagen" src={foto} alt="Tu foto de perfil" />
          )}
        </div>

        <div className="perfil__foto-acciones">
          <input
            ref={entrada}
            id={idDeLaEntrada}
            className="solo-lectores perfil__foto-entrada"
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            disabled={ocupado !== null}
            onChange={(evento) => void alElegir(evento)}
          />
          <label
            htmlFor={idDeLaEntrada}
            className={`app__boton perfil__foto-elegir${ocupado !== null ? ' perfil__foto-elegir--ocupado' : ''}`}
          >
            {foto === null ? 'Elegir una foto' : 'Cambiar la foto'}
          </label>

          {foto !== null && (
            <button
              type="button"
              className="perfil__secundario"
              disabled={ocupado !== null}
              onClick={() => void alQuitar()}
            >
              {ocupado === 'quitando' ? 'Quitando…' : 'Quitar la foto'}
            </button>
          )}
        </div>
      </div>

      {ocupado === 'guardando' && (
        <p className="app__nota" role="status">
          Preparando y guardando tu foto…
        </p>
      )}

      <MensajeDeAviso aviso={aviso} />
    </Apartado>
  );
}
