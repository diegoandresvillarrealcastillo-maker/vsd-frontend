import type { Session } from '@supabase/supabase-js';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorDeLaApi } from '../../infraestructura/api/clienteHttp.ts';
import { RUTAS } from '../../rutas/rutas.ts';
import { SesionContexto, type EstadoDeSesion } from '../../sesion/SesionContexto.ts';
import { olvidarElRegistro } from '../../sesion/useRegistroCompleto.ts';
import { fijarLaZonaDeLaCuenta, olvidarLaZonaDeLaCuenta } from '../../tiempo/zonaHoraria.ts';
import { CompletarRegistro } from './CompletarRegistro.tsx';
import { lineasParaMenores } from './lineasParaMenores.ts';
import { Registro } from './Registro.tsx';
import { SoloMayores } from './SoloMayores.tsx';

/**
 * El registro con edad y consentimiento explicito, visto desde las pantallas
 * (T-03 de la auditoria 360): el formulario de registro, «Completa tu registro»
 * y la pantalla que ve quien resulta menor de 18 anos.
 *
 * Lo que mas importa: que a un menor no se le llame a nadie ni se le guarde nada,
 * que sin las dos casillas no se avance, y que la pantalla de rechazo no le
 * explique como saltarsela.
 */
const { consultarElEstadoDelRegistro, completarElRegistro, consultarLosTextosVigentes } =
  vi.hoisted(() => ({
    consultarElEstadoDelRegistro: vi.fn(),
    completarElRegistro: vi.fn(),
    consultarLosTextosVigentes: vi.fn(),
  }));

vi.mock('../../infraestructura/api/registro.ts', async (importarLoReal) => ({
  ...(await importarLoReal<typeof import('../../infraestructura/api/registro.ts')>()),
  consultarElEstadoDelRegistro,
  completarElRegistro,
}));
vi.mock('../../infraestructura/api/aviso.ts', () => ({ consultarLosTextosVigentes }));

const SESION = { user: { id: 'persona-1', email: 'ana@ejemplo.test' } } as Session;

function estado(parcial: Partial<EstadoDeSesion> = {}): EstadoDeSesion {
  const vacio = vi.fn().mockResolvedValue({ ok: true });

  return {
    sesion: SESION,
    cargando: false,
    correo: 'ana@ejemplo.test',
    registrarse: vacio,
    entrar: vacio,
    entrarConGoogle: vacio,
    pedirRecuperacion: vacio,
    cambiarContrasena: vacio,
    pedirCodigoDeVerificacion: vacio,
    cambiarContrasenaConCodigo: vacio,
    salir: vi.fn().mockResolvedValue(undefined),
    ...parcial,
  };
}

let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  olvidarElRegistro();
  consultarElEstadoDelRegistro.mockResolvedValue({ estado: 'sin-cuenta' });
  completarElRegistro.mockResolvedValue({});
  consultarLosTextosVigentes.mockResolvedValue({ aviso: '2026-09-1', terminos: '2026-10-1' });
});

afterEach(() => {
  vi.clearAllMocks();
  olvidarLaZonaDeLaCuenta();
});

/** Un menor y un adulto, sea cual sea el dia en que se corra la prueba. */
const MENOR = '2015-05-05';
const ADULTO = '1998-03-14';

function ponerLaFecha(fecha: string) {
  fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: fecha } });
}

async function aceptarTodo() {
  await usuario.click(screen.getByLabelText(/Acepto el aviso de privacidad/));
  await usuario.click(screen.getByLabelText(/Acepto los términos/));
}

// ---------------------------------------------------------------------------
// Registro con correo
// ---------------------------------------------------------------------------

function pintarElRegistro(valor: EstadoDeSesion) {
  return render(
    <SesionContexto.Provider value={valor}>
      <MemoryRouter initialEntries={[RUTAS.REGISTRO]}>
        <Routes>
          <Route path={RUTAS.REGISTRO} element={<Registro />} />
          <Route path={RUTAS.SOLO_MAYORES} element={<SoloMayores />} />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

async function rellenarElRegistro(fecha: string) {
  await usuario.type(screen.getByLabelText('Correo'), 'ana@ejemplo.test');
  await usuario.click(screen.getByLabelText('Contraseña'));
  await usuario.paste('UnaContrasena#2026');
  await usuario.click(screen.getByLabelText('Repite la contraseña'));
  await usuario.paste('UnaContrasena#2026');
  ponerLaFecha(fecha);
}

describe('Registro con correo: la edad', () => {
  it('pide la fecha de nacimiento y dice que es solo para mayores de 18 años', () => {
    pintarElRegistro(estado({ sesion: null }));

    expect(screen.getByLabelText('Fecha de nacimiento')).toHaveAttribute('type', 'date');
    expect(screen.getByText(/solo para personas mayores de 18 años/i)).toBeInTheDocument();
  });

  it('las dos casillas no vienen marcadas, y cada una lleva a su documento en otra pestaña', () => {
    pintarElRegistro(estado({ sesion: null }));

    expect(screen.getByLabelText(/Acepto el aviso de privacidad/)).not.toBeChecked();
    expect(screen.getByLabelText(/Acepto los términos/)).not.toBeChecked();

    const aviso = screen.getByRole('link', { name: /Leer el aviso de privacidad/ });
    const terminos = screen.getByRole('link', { name: /Leer los términos/ });

    expect(aviso).toHaveAttribute('href', RUTAS.PRIVACIDAD);
    expect(terminos).toHaveAttribute('href', RUTAS.TERMINOS);

    // En otra pestaña, para no perder lo que ya se escribio.
    for (const enlace of [aviso, terminos]) {
      expect(enlace).toHaveAttribute('target', '_blank');
      expect(enlace).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
  });

  it('con una sola casilla no se registra a nadie', async () => {
    const registrarse = vi.fn().mockResolvedValue({ ok: true });
    pintarElRegistro(estado({ sesion: null, registrarse }));

    await rellenarElRegistro(ADULTO);
    await usuario.click(screen.getByLabelText(/Acepto el aviso de privacidad/));
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(registrarse).not.toHaveBeenCalled();
    expect(
      screen.getByText(/hace falta aceptar el aviso de privacidad y los términos/i),
    ).toBeInTheDocument();
  });

  it('sin fecha no se registra a nadie, y se dice por que', async () => {
    const registrarse = vi.fn().mockResolvedValue({ ok: true });
    pintarElRegistro(estado({ sesion: null, registrarse }));

    await rellenarElRegistro('');
    await aceptarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(registrarse).not.toHaveBeenCalled();
    expect(await screen.findByText('Escribe tu fecha de nacimiento.')).toBeInTheDocument();
  });

  it('con una fecha del futuro no se registra a nadie', async () => {
    const registrarse = vi.fn().mockResolvedValue({ ok: true });
    pintarElRegistro(estado({ sesion: null, registrarse }));

    await rellenarElRegistro('2999-01-01');
    await aceptarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(registrarse).not.toHaveBeenCalled();
    expect(await screen.findByText(/Revisa tu fecha de nacimiento/)).toBeInTheDocument();
  });

  it('un menor ve la pantalla de rechazo al instante y no se llama a nadie', async () => {
    const registrarse = vi.fn().mockResolvedValue({ ok: true });
    pintarElRegistro(estado({ sesion: null, registrarse }));

    await rellenarElRegistro(MENOR);
    await aceptarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    // Ni la identidad se crea: lo escrito no sale del dispositivo.
    expect(registrarse).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('heading', { level: 1, name: /para mayores de 18 años/ }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Fecha de nacimiento')).not.toBeInTheDocument();
  });

  it('un adulto se registra con las dos casillas, y la fecha no sale hacia Supabase', async () => {
    const registrarse = vi.fn().mockResolvedValue({ ok: true });
    pintarElRegistro(estado({ sesion: null, registrarse }));

    await rellenarElRegistro(ADULTO);
    await aceptarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => {
      expect(registrarse).toHaveBeenCalledTimes(1);
    });
    expect(registrarse).toHaveBeenCalledWith({
      correo: 'ana@ejemplo.test',
      contrasena: 'UnaContrasena#2026',
      aceptaElAviso: true,
      aceptaLosTerminos: true,
    });
    expect(JSON.stringify(registrarse.mock.calls)).not.toContain(ADULTO);
  });

  it('al terminar avisa de que la fecha se volvera a pedir al entrar', async () => {
    pintarElRegistro(estado({ sesion: null }));

    await rellenarElRegistro(ADULTO);
    await aceptarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByText(/te pediremos confirmar tu fecha de nacimiento/),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Completa tu registro
// ---------------------------------------------------------------------------

function pintarCompletar(valor: EstadoDeSesion, volverA?: string) {
  return render(
    <SesionContexto.Provider value={valor}>
      <MemoryRouter
        initialEntries={[
          { pathname: RUTAS.COMPLETAR_REGISTRO, ...(volverA ? { state: { volverA } } : {}) },
        ]}
      >
        <Routes>
          <Route path={RUTAS.COMPLETAR_REGISTRO} element={<CompletarRegistro />} />
          <Route path={RUTAS.PANEL} element={<p>Panel de prueba</p>} />
          <Route path={RUTAS.PERFIL} element={<p>Perfil de prueba</p>} />
          <Route path={RUTAS.SOLO_MAYORES} element={<SoloMayores />} />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

async function formularioListo() {
  await screen.findByRole('heading', { level: 1, name: 'Completa tu registro' });
}

describe('Completa tu registro', () => {
  it('muestra el formulario a quien tiene sesion y todavia no tiene cuenta', async () => {
    pintarCompletar(estado());

    await formularioListo();

    expect(screen.getByLabelText('Fecha de nacimiento')).toBeInTheDocument();
    expect(screen.getByLabelText(/Acepto el aviso de privacidad/)).not.toBeChecked();
    expect(screen.getByLabelText(/Acepto los términos/)).not.toBeChecked();
  });

  it('tambien a quien tiene una cuenta de antes, con el registro incompleto', async () => {
    consultarElEstadoDelRegistro.mockResolvedValue({ estado: 'incompleto', cuenta: {} });

    pintarCompletar(estado());

    await formularioListo();
  });

  it('no ensena el formulario mientras comprueba, y no lo ensena a quien ya esta completo', async () => {
    consultarElEstadoDelRegistro.mockResolvedValue({ estado: 'completo', cuenta: {} });

    pintarCompletar(estado());

    expect(screen.getByText('Comprobando tu registro')).toBeInTheDocument();
    expect(await screen.findByText('Panel de prueba')).toBeInTheDocument();
    expect(screen.queryByLabelText('Fecha de nacimiento')).not.toBeInTheDocument();
  });

  it('quien ya esta completo vuelve a donde iba', async () => {
    consultarElEstadoDelRegistro.mockResolvedValue({ estado: 'completo', cuenta: {} });

    pintarCompletar(estado(), RUTAS.PERFIL);

    expect(await screen.findByText('Perfil de prueba')).toBeInTheDocument();
  });

  it('si no se puede comprobar, la pantalla sirve igual: la API manda', async () => {
    consultarElEstadoDelRegistro.mockRejectedValue(new TypeError('Failed to fetch'));

    pintarCompletar(estado());

    await formularioListo();
  });

  it('con la fecha y las dos casillas crea la cuenta con las versiones de la API y sigue', async () => {
    pintarCompletar(estado());
    await formularioListo();

    ponerLaFecha(ADULTO);
    await aceptarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => {
      expect(completarElRegistro).toHaveBeenCalledTimes(1);
    });
    expect(completarElRegistro).toHaveBeenCalledWith({
      fechaNacimiento: ADULTO,
      textos: { aviso: '2026-09-1', terminos: '2026-10-1' },
    });
    expect(await screen.findByText('Panel de prueba')).toBeInTheDocument();
  });

  it('despues de completar vuelve a donde iba', async () => {
    pintarCompletar(estado(), RUTAS.PERFIL);
    await formularioListo();

    ponerLaFecha(ADULTO);
    await aceptarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('Perfil de prueba')).toBeInTheDocument();
  });

  it('sin las casillas no se manda nada', async () => {
    pintarCompletar(estado());
    await formularioListo();

    ponerLaFecha(ADULTO);
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(completarElRegistro).not.toHaveBeenCalled();
    expect(
      screen.getByText(/hace falta aceptar el aviso de privacidad y los términos/i),
    ).toBeInTheDocument();
  });

  it('sin fecha no se manda nada, y se dice por que', async () => {
    pintarCompletar(estado());
    await formularioListo();

    await aceptarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(completarElRegistro).not.toHaveBeenCalled();
    expect(await screen.findByText('Escribe tu fecha de nacimiento.')).toBeInTheDocument();
  });

  it('un menor ve el rechazo al instante: no se llama a la API y se cierra la sesion', async () => {
    const salir = vi.fn().mockResolvedValue(undefined);
    pintarCompletar(estado({ salir }));
    await formularioListo();

    ponerLaFecha(MENOR);
    await aceptarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(completarElRegistro).not.toHaveBeenCalled();
    expect(consultarLosTextosVigentes).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('heading', { level: 1, name: /para mayores de 18 años/ }),
    ).toBeInTheDocument();
    expect(salir).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Fecha de nacimiento')).not.toBeInTheDocument();
  });

  it('si la API rechaza por la edad, es lo mismo: rechazo y sesion cerrada, sin un mensaje de error', async () => {
    completarElRegistro.mockRejectedValue(
      new ErrorDeLaApi(403, 'VSD Health es solo para mayores', undefined, 'MENOR_DE_EDAD'),
    );
    const salir = vi.fn().mockResolvedValue(undefined);
    pintarCompletar(estado({ salir }));
    await formularioListo();

    // El dispositivo cree que es mayor (por ejemplo, el reloj esta mal): manda
    // la API, que es la que cuenta la edad de verdad.
    ponerLaFecha(ADULTO);
    await aceptarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: /para mayores de 18 años/ }),
    ).toBeInTheDocument();
    expect(salir).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('si los textos cambiaron mientras tanto, lo dice y deja volver a intentarlo', async () => {
    completarElRegistro.mockRejectedValueOnce(
      new ErrorDeLaApi(409, 'x', undefined, 'VERSION_DE_LOS_TERMINOS_NO_VIGENTE'),
    );
    pintarCompletar(estado());
    await formularioListo();

    ponerLaFecha(ADULTO);
    await aceptarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/acaban de actualizarse/);

    // Reintentar vuelve a pedir las versiones vigentes.
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('Panel de prueba')).toBeInTheDocument();
    expect(consultarLosTextosVigentes).toHaveBeenCalledTimes(2);
  });

  it('si no se pueden saber las versiones vigentes, no se registra a nadie', async () => {
    consultarLosTextosVigentes.mockRejectedValue(new TypeError('Failed to fetch'));
    pintarCompletar(estado());
    await formularioListo();

    ponerLaFecha(ADULTO);
    await aceptarTodo();
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo conectar/);
    expect(completarElRegistro).not.toHaveBeenCalled();
  });

  it('quien no quiere continuar puede cerrar la sesion', async () => {
    const salir = vi.fn().mockResolvedValue(undefined);
    pintarCompletar(estado({ salir }));
    await formularioListo();

    await usuario.click(screen.getByRole('button', { name: /Prefiero no continuar/ }));

    expect(salir).toHaveBeenCalledTimes(1);
    expect(completarElRegistro).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// La pantalla de rechazo
// ---------------------------------------------------------------------------

function pintarElRechazo() {
  return render(
    <SesionContexto.Provider value={estado({ sesion: null })}>
      <MemoryRouter initialEntries={[RUTAS.SOLO_MAYORES]}>
        <Routes>
          <Route path={RUTAS.SOLO_MAYORES} element={<SoloMayores />} />
          <Route path={RUTAS.INICIO} element={<p>Portada de prueba</p>} />
        </Routes>
      </MemoryRouter>
    </SesionContexto.Provider>,
  );
}

/** La lista de lineas. La pantalla tiene otra lista, la de los documentos legales del pie. */
function lasLineas(): HTMLElement {
  return within(screen.getByRole('region', { name: 'Si quieres hablar con alguien' })).getByRole(
    'list',
  );
}

describe('La pantalla de rechazo', () => {
  it('explica que no es por la persona, por que es, y que no se guardo nada', () => {
    pintarElRechazo();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Por ahora VSD Health es para mayores de 18 años',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No es por ti/)).toBeInTheDocument();
    expect(screen.getByText(/No guardamos nada de lo que escribiste/)).toBeInTheDocument();
    expect(screen.getByText(/Cuando cumplas 18 años te daremos la bienvenida/)).toBeInTheDocument();
  });

  it('no pide ni muestra nada: sin campos, sin fecha, sin formulario', () => {
    pintarElRechazo();

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Fecha de nacimiento')).not.toBeInTheDocument();
    expect(document.querySelector('form')).toBeNull();
  });

  it('no ofrece intentar de nuevo ni da pistas: lo unico para seguir es volver a la portada', () => {
    pintarElRechazo();

    expect(
      screen.queryByRole('button', { name: /intentar|reintentar|de nuevo|corregir/i }),
    ).toBeNull();
    expect(
      screen.queryByRole('link', { name: /intentar|reintentar|de nuevo|corregir/i }),
    ).toBeNull();
    expect(screen.queryByText(/si te equivocaste|otra fecha|fecha correcta/i)).toBeNull();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute(
      'href',
      RUTAS.INICIO,
    );
  });

  it('en Colombia deja a quien acudir: la 141 del ICBF y la 106, y las de siempre', () => {
    fijarLaZonaDeLaCuenta('America/Bogota');
    pintarElRechazo();

    const lista = lasLineas();

    expect(lista).toHaveTextContent('Línea 141 del ICBF');
    expect(lista).toHaveTextContent('Línea 106');
    expect(lista).toHaveTextContent('Línea 192, opción 4');
    expect(lista).toHaveTextContent('Línea 123');
    expect(screen.queryByText(/Directorio internacional/)).not.toBeInTheDocument();
  });

  it('dice donde sirve cada una: la 106 solo atiende desde Bogota', () => {
    fijarLaZonaDeLaCuenta('America/Bogota');
    pintarElRechazo();

    const linea106 = screen.getByText('Línea 106').closest('li');

    expect(linea106).toHaveTextContent('Desde Bogotá');
    expect(screen.getByText('Línea 141 del ICBF').closest('li')).toHaveTextContent('Todo el país');
  });

  it('los enlaces llevan a las paginas oficiales, en otra pestaña', () => {
    fijarLaZonaDeLaCuenta('America/Bogota');
    pintarElRechazo();

    const icbf = screen.getByRole('link', { name: /Más información sobre Línea 141 del ICBF/ });

    expect(icbf).toHaveAttribute('href', 'https://www.icbf.gov.co/linea-141');
    expect(icbf).toHaveAttribute('target', '_blank');
    expect(icbf).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('fuera de Colombia no hay ningun telefono: se manda al directorio internacional', () => {
    fijarLaZonaDeLaCuenta('Europe/Madrid');
    pintarElRechazo();

    expect(lasLineas()).toHaveTextContent('Directorio internacional de líneas de ayuda');
    // Un numero de otro pais, ensenado como si fuera de quien lo lee, es el peor
    // error posible.
    expect(screen.queryByText(/Línea 141|Línea 106|Línea 192|Línea 123/)).not.toBeInTheDocument();
  });
});

describe('lineasParaMenores', () => {
  it('en Colombia: las dos para menores primero, y despues las de siempre', () => {
    expect(lineasParaMenores('America/Bogota').map((linea) => linea.titulo)).toEqual([
      'Línea 141 del ICBF',
      'Línea 106',
      'Línea 192, opción 4',
      'Línea 123',
    ]);
  });

  it('fuera de Colombia: solo el directorio', () => {
    expect(lineasParaMenores('Europe/Madrid').map((linea) => linea.cobertura)).toEqual([
      'internacional',
    ]);
    expect(lineasParaMenores('Marte/Olympus')).toHaveLength(1);
  });
});
