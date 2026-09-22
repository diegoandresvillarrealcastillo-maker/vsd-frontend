import { Aparece } from './LienzoDeAcceso.tsx';

/**
 * Lo que hay que saber justo despues de que sale un correo.
 *
 * Las dos pantallas que envian —registro y recuperacion— necesitan decir lo
 * mismo, asi que se dice en un solo sitio.
 *
 * El aviso del spam va primero y sin rodeos porque hoy es lo que mas pasa:
 * enviamos desde una direccion de Gmail a traves de un servicio externo, y
 * Gmail no puede comprobar que ese envio este autorizado, asi que lo aparta.
 * Se arregla con un dominio propio. Mientras tanto, callarselo deja a la
 * persona esperando un correo que va a pensar que nunca salio.
 */
export function PistasDelCorreo() {
  return (
    <>
      <Aparece>
        <p className="aviso aviso--bien">
          Si en dos o tres minutos no aparece en la bandeja de entrada,{' '}
          <strong>revisa la carpeta de spam o correo no deseado</strong>. Suele llegar ahí las
          primeras veces; no significa que algo esté mal.
        </p>
      </Aparece>

      <Aparece>
        <ul className="pistas">
          <li>El enlace dura una hora y sirve una sola vez.</li>
          <li>Ábrelo en este mismo navegador: va atado a él.</li>
          <li>Si se te pasó la hora, vuelve a esta pantalla y pide otro.</li>
        </ul>
      </Aparece>
    </>
  );
}
