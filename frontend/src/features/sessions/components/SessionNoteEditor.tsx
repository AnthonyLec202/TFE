import { useEffect } from 'react';
import { useEditor, useEditorState, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { Bold as BoldIcon, Highlighter } from 'lucide-react';

export interface SessionNoteEditorProps {
  /** Note content as an HTML string (TipTap document serialized via editor.getHTML()). */
  content: string;
  /** Emits the updated HTML string on every edit, so the container can persist it to Dexie. */
  onChange: (html: string) => void;
}

// A single toolbar toggle. `isActive` highlights the button when the mark is applied at the caret.
function ToolbarButton({
  onClick, isActive, label, children,
}: {
  onClick: () => void;
  isActive: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
        isActive
          ? 'bg-petrol-600 text-white'
          : 'text-taupe-500 hover:bg-sand-100 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

// Rich-text session-note editor (TipTap). Bold comes from StarterKit (Italic is disabled — the
// clinician only uses Bold and Highlight); Highlight emits standard <mark> tags for the "fluo" effect.
// The clinician uses these to flag critical content, which the AI report generator then prioritizes.
// Captures the document as an HTML string via editor.getHTML().
export function SessionNoteEditor({ content, onChange }: SessionNoteEditorProps) {
  const editor = useEditor({
    extensions: [
      // Disable Italic entirely (removes both the mark and its Ctrl+I keyboard shortcut).
      StarterKit.configure({ italic: false }),
      // Default rendering serializes to <mark>; keep it so the backend prompt can detect highlights.
      Highlight,
    ],
    content,
    onUpdate: ({ editor }: { editor: Editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'bg-white px-7 py-6 text-base text-ink focus:outline-none',
      },
    },
  });

  // Reconcile external content changes (switching sessions, appended handwriting recognition) into the
  // editor without firing onUpdate — guard on equality so our own edits never round-trip into a loop.
  useEffect(() => {
    if (!editor) return;
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  // Subscribe to the marks active at the current selection so the toolbar buttons reflect them live
  // (Word-style "pressed" state). TipTap v3's useEditor does not re-render on selection changes on its
  // own, so reading editor.isActive() directly in render would go stale when the caret moves.
  const activeMarks = useEditorState({
    editor,
    selector: ({ editor }) => ({
      isBold: editor?.isActive('bold') ?? false,
      isHighlight: editor?.isActive('highlight') ?? false,
    }),
  });

  if (!editor) return null;

  return (
    <div className="session-note-editor flex flex-col">
      <div className="flex items-center gap-1 border-b border-sand-200 px-3 py-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={activeMarks?.isBold ?? false}
          label="Gras"
        >
          <BoldIcon className="h-4 w-4" strokeWidth={2.25} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          isActive={activeMarks?.isHighlight ?? false}
          label="Surligner (fluo)"
        >
          <Highlighter className="h-4 w-4" strokeWidth={2.25} />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
