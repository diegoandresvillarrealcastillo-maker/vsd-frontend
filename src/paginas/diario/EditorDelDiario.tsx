import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { lazy, Suspense, useCallback, useId, useMemo, useState } from 'react';

import type { Adjunto, Anotacion, NodoDelDocumento } from '../../infraestructura/api/diario.ts';
import { horaDe } from './calendarioDelDiario.ts';
import { DiagramasContexto, idsDeDiagramas } from './diagramas.ts';
import { Diagrama } from './extensionDiagrama.ts';
import { COLORES, LETRAS, TAMANOS } from './formato.ts';
import { recortarDocumento } from './recortar.ts';

/**
 * El editor del diario: solo se descarga al abrir un diagrama. Ver
 * `EditorDeDiagrama.tsx`.
 */
const EditorDeDiagrama = lazy(() => import('./EditorDeDiagrama.tsx'));

/** Lo que sale del lienzo al guardar. */
export interface LoQueSeEscribio {
  readonly dia: string;
  readonly titulo: string;
  readonly contenido: NodoDelDocumento;
  readonly adjuntos: readonly Adjunto[];
}

/**
 * El lienzo de escritura del diario (SCRUM-96).
 *
 * Un lienzo amplio y no un cuadro de texto: lo primero que se ve al entrar es
 * espacio para escribir. Encima, una barra con el formato justo: negrita,
 * cursiva, subrayado, titulos, listas, dos letras, tres tamanos y cinco
 * colores que se leen bien en claro y en oscuro.
 *
 * Lo que se guarda es el documento del editor en JSON, nunca HTML.
 *
 * Sirve para escribir una anotacion nueva y para corregir una dentro de su
 * hora. Quien lo usa lo vuelve a montar con otra `key` para empezar de cero.
 */
export function EditorDelDiario({
  editando,
  diaInicial,
  hoy,
  guardando,
  alGuardar,
  alCancelar,
}: {
  /** La anotacion que se corrige. Sin ella, se escribe una nueva. */
  editando: Anotacion | undefined;
  diaInicial: string;
  hoy: string;
  guardando: boolean;
  alGuardar: (escrito: LoQueSeEscribio) => void;
  alCancelar: (() => void) | undefined;
}) {
  const idDelDia = useId();
  const idDelTitulo = useId();
  const [dia, setDia] = useState(editando?.dia ?? diaInicial);
  const [titulo, setTitulo] = useState(editando?.titulo ?? '');
  const [escenas, setEscenas] = useState<
    Readonly<Record<string, Readonly<Record<string, unknown>>>>
  >(() => Object.fromEntries((editando?.adjuntos ?? []).map(({ id, datos }) => [id, datos])));
  const [diagramaAbierto, setDiagramaAbierto] = useState<{
    readonly id: string;
    readonly nuevo: boolean;
  } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Sin enlaces ni codigo: un enlace es una puerta a una direccion ajena
        // dentro del diario, y el codigo no es para esto.
        link: false,
        code: false,
        codeBlock: false,
        heading: { levels: [2, 3] },
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Diagrama,
      Placeholder.configure({ placeholder: 'Escribe lo que quieras. Nadie más lo lee.' }),
    ],
    // El documento llega de la API como solo lectura; TipTap lo copia.
    content: (editando?.contenido as unknown as JSONContent | undefined) ?? '',
    // La barra pinta que esta activo con cada movimiento del cursor.
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: 'lienzo__texto',
        'aria-label': 'Lo que quieres escribir',
        'aria-multiline': 'true',
        role: 'textbox',
      },
    },
  });

  const abrir = useCallback((id: string) => setDiagramaAbierto({ id, nuevo: false }), []);
  const diagramas = useMemo(() => ({ abrir }), [abrir]);

  const terminarDiagrama = useCallback(
    (datos: Record<string, unknown> | null) => {
      const abierto = diagramaAbierto;

      setDiagramaAbierto(null);

      if (abierto === null || datos === null) {
        return;
      }

      setEscenas((antes) => ({ ...antes, [abierto.id]: datos }));

      if (abierto.nuevo) {
        editor
          ?.chain()
          .focus()
          .insertContent({ type: 'diagrama', attrs: { id: abierto.id } })
          .run();
      }
    },
    [diagramaAbierto, editor],
  );

  if (editor === null) {
    return null;
  }

  const contenido = editor.getJSON() as NodoDelDocumento;
  const usados = idsDeDiagramas(contenido);
  const vacio = editor.isEmpty && usados.length === 0;

  function guardar() {
    if (editor === null || vacio) {
      return;
    }

    const documento = recortarDocumento(editor.getJSON() as NodoDelDocumento);

    alGuardar({
      dia,
      titulo: titulo.trim(),
      contenido: documento,
      // Solo los diagramas que siguen en el texto: quitar la tarjeta quita el
      // diagrama.
      adjuntos: idsDeDiagramas(documento).flatMap((id) => {
        const datos = escenas[id];

        return datos === undefined ? [] : [{ id, tipo: 'diagrama' as const, datos }];
      }),
    });
  }

  return (
    <DiagramasContexto.Provider value={diagramas}>
      <div className="lienzo">
        {editando !== undefined && (
          <p className="lienzo__modo" role="status">
            Corrigiendo la anotación de las {horaDe(editando.creadaEn)}
          </p>
        )}

        <div className="lienzo__datos">
          {editando === undefined && (
            <div className="lienzo__campo">
              <label htmlFor={idDelDia}>Día</label>
              <input
                id={idDelDia}
                type="date"
                value={dia}
                max={hoy}
                onChange={(evento) => {
                  if (evento.target.value !== '') {
                    setDia(evento.target.value);
                  }
                }}
              />
            </div>
          )}

          <div className="lienzo__campo lienzo__campo--titulo">
            <label htmlFor={idDelTitulo}>Título (opcional)</label>
            <input
              id={idDelTitulo}
              type="text"
              maxLength={120}
              value={titulo}
              onChange={(evento) => setTitulo(evento.target.value)}
            />
          </div>
        </div>

        <BarraDeFormato
          editor={editor}
          alInsertarDiagrama={() =>
            setDiagramaAbierto({ id: globalThis.crypto.randomUUID(), nuevo: true })
          }
        />

        <EditorContent editor={editor} className="lienzo__hoja" />

        <div className="lienzo__acciones">
          {alCancelar !== undefined && (
            <button type="button" className="pildora pildora--fantasma" onClick={alCancelar}>
              Cancelar
            </button>
          )}
          <button
            type="button"
            className="pildora pildora--fuerte"
            disabled={vacio || guardando}
            onClick={guardar}
          >
            {guardando
              ? 'Guardando…'
              : editando === undefined
                ? 'Guardar anotación'
                : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {diagramaAbierto !== null && (
        <Suspense
          fallback={
            <p className="diagrama__cargando" role="status">
              Abriendo el editor de diagramas…
            </p>
          }
        >
          <EditorDeDiagrama
            inicial={escenas[diagramaAbierto.id]}
            soloLectura={false}
            alTerminar={terminarDiagrama}
          />
        </Suspense>
      )}
    </DiagramasContexto.Provider>
  );
}

/** La barra de formato. Botones de verdad: funcionan con teclado y dicen si estan activos. */
function BarraDeFormato({
  editor,
  alInsertarDiagrama,
}: {
  editor: Editor;
  alInsertarDiagrama: () => void;
}) {
  const estilo = editor.getAttributes('textStyle') as {
    color?: string;
    fontFamily?: string;
    fontSize?: string;
  };

  const botones = [
    {
      nombre: 'Negrita',
      texto: 'B',
      clase: 'lienzo__boton--negrita',
      activo: editor.isActive('bold'),
      hacer: () => editor.chain().focus().toggleBold().run(),
    },
    {
      nombre: 'Cursiva',
      texto: 'I',
      clase: 'lienzo__boton--cursiva',
      activo: editor.isActive('italic'),
      hacer: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      nombre: 'Subrayado',
      texto: 'U',
      clase: 'lienzo__boton--subrayado',
      activo: editor.isActive('underline'),
      hacer: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      nombre: 'Título',
      clase: '',
      texto: 'T',
      activo: editor.isActive('heading', { level: 2 }),
      hacer: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      nombre: 'Subtítulo',
      clase: '',
      texto: 't',
      activo: editor.isActive('heading', { level: 3 }),
      hacer: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      nombre: 'Lista',
      clase: '',
      texto: '•',
      activo: editor.isActive('bulletList'),
      hacer: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      nombre: 'Lista numerada',
      clase: '',
      texto: '1.',
      activo: editor.isActive('orderedList'),
      hacer: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ];

  return (
    <div
      className="lienzo__barra"
      role="toolbar"
      aria-label="Formato del texto"
      // Pulsar un boton con el raton no le quita el foco al texto: si se lo
      // quitara, la seleccion se perderia antes de aplicarle el formato. Los
      // selectores si lo necesitan para abrirse. Con teclado no cambia nada.
      onMouseDown={(evento) => {
        if ((evento.target as HTMLElement).closest('button') !== null) {
          evento.preventDefault();
        }
      }}
    >
      <div className="lienzo__grupo">
        {botones.map(({ nombre, texto, clase, activo, hacer }) => (
          <button
            key={nombre}
            type="button"
            className={`lienzo__boton ${clase}`}
            aria-label={nombre}
            title={nombre}
            aria-pressed={activo}
            onClick={hacer}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="lienzo__grupo">
        <select
          className="lienzo__selector"
          aria-label="Tipo de letra"
          value={estilo.fontFamily ?? ''}
          onChange={(evento) => {
            const valor = evento.target.value;
            const cadena = editor.chain().focus();
            (valor === '' ? cadena.unsetFontFamily() : cadena.setFontFamily(valor)).run();
          }}
        >
          <option value="">Letra normal</option>
          {LETRAS.map(({ nombre, valor }) => (
            <option key={valor} value={valor}>
              {nombre}
            </option>
          ))}
        </select>

        <select
          className="lienzo__selector"
          aria-label="Tamaño de letra"
          value={estilo.fontSize ?? ''}
          onChange={(evento) => {
            const valor = evento.target.value;
            const cadena = editor.chain().focus();
            (valor === '' ? cadena.unsetFontSize() : cadena.setFontSize(valor)).run();
          }}
        >
          <option value="">Tamaño normal</option>
          {TAMANOS.map(({ nombre, valor }) => (
            <option key={valor} value={valor}>
              {nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="lienzo__grupo" role="group" aria-label="Color del texto">
        <button
          type="button"
          className="lienzo__color lienzo__color--ninguno"
          aria-label="Sin color"
          title="Sin color"
          aria-pressed={estilo.color === undefined}
          onClick={() => editor.chain().focus().unsetColor().run()}
        />
        {COLORES.map(({ nombre, valor }) => (
          <button
            key={valor}
            type="button"
            className="lienzo__color"
            style={{ background: valor }}
            aria-label={`Color ${nombre.toLowerCase()}`}
            title={nombre}
            aria-pressed={estilo.color === valor}
            onClick={() => editor.chain().focus().setColor(valor).run()}
          />
        ))}
      </div>

      <div className="lienzo__grupo">
        <button type="button" className="pildora pildora--fantasma" onClick={alInsertarDiagrama}>
          Diagrama
        </button>
      </div>
    </div>
  );
}
