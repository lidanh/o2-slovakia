"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";

function getMarkdown(editor: Editor): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (editor.storage as any).markdown.getMarkdown() as string;
}

interface MarkdownEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  height?: number;
  placeholder?: string;
}

export default function MarkdownEditor({
  value,
  onChange,
  height = 300,
  placeholder,
}: MarkdownEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Track whether the latest content came from an internal edit
  const internalUpdate = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    immediatelyRender: false,
    content: value ?? "",
    onUpdate({ editor }) {
      internalUpdate.current = true;
      const md = getMarkdown(editor);
      onChangeRef.current?.(md);
    },
  });

  // Sync external value changes (e.g. form reset) without clobbering typing
  useEffect(() => {
    if (!editor) return;
    if (internalUpdate.current) {
      internalUpdate.current = false;
      return;
    }
    const current = getMarkdown(editor);
    if (value !== current) {
      editor.commands.setContent(value ?? "");
    }
  }, [value, editor]);

  return (
    <div className="markdown-editor" style={{ minHeight: height }}>
      {editor && (
        <BubbleMenu editor={editor}>
          <div className="md-bubble-menu">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={editor.isActive("bold") ? "is-active" : ""}
            >
              B
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={editor.isActive("italic") ? "is-active" : ""}
            >
              I
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={editor.isActive("code") ? "is-active" : ""}
            >
              &lt;/&gt;
            </button>
            <span className="md-bubble-sep" />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editor.isActive("heading", { level: 2 }) ? "is-active" : ""}
            >
              H2
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={editor.isActive("heading", { level: 3 }) ? "is-active" : ""}
            >
              H3
            </button>
            <span className="md-bubble-sep" />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={editor.isActive("bulletList") ? "is-active" : ""}
            >
              &bull;
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={editor.isActive("orderedList") ? "is-active" : ""}
            >
              1.
            </button>
          </div>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />

      <style jsx global>{`
        .markdown-editor {
          border: 1px solid #d9d9d9;
          border-radius: 6px;
          transition: border-color 0.2s;
        }
        .markdown-editor:focus-within {
          border-color: #0112AA;
        }
        .markdown-editor .tiptap {
          padding: 8px 12px;
          min-height: ${height - 18}px;
          outline: none;
          font-size: 14px;
          line-height: 1.6;
        }
        .markdown-editor .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #bfbfbf;
          pointer-events: none;
          height: 0;
        }
        .markdown-editor .tiptap h1,
        .markdown-editor .tiptap h2,
        .markdown-editor .tiptap h3 {
          margin: 0.6em 0 0.3em;
          line-height: 1.3;
        }
        .markdown-editor .tiptap h1 { font-size: 1.4em; }
        .markdown-editor .tiptap h2 { font-size: 1.2em; }
        .markdown-editor .tiptap h3 { font-size: 1.05em; }
        .markdown-editor .tiptap ul,
        .markdown-editor .tiptap ol {
          padding-left: 1.4em;
          margin: 0.3em 0;
        }
        .markdown-editor .tiptap code {
          background: #f5f5f5;
          border-radius: 3px;
          padding: 0.15em 0.3em;
          font-size: 0.9em;
        }
        .markdown-editor .tiptap pre {
          background: #f5f5f5;
          border-radius: 4px;
          padding: 0.6em 0.8em;
          margin: 0.4em 0;
        }
        .markdown-editor .tiptap pre code {
          background: none;
          padding: 0;
        }
        .markdown-editor .tiptap blockquote {
          border-left: 3px solid #d9d9d9;
          padding-left: 0.8em;
          margin: 0.4em 0;
          color: #666;
        }
        .markdown-editor .tiptap hr {
          border: none;
          border-top: 1px solid #d9d9d9;
          margin: 0.8em 0;
        }

        /* Bubble menu */
        .md-bubble-menu {
          display: flex;
          align-items: center;
          gap: 2px;
          background: #fff;
          border: 1px solid #d9d9d9;
          border-radius: 6px;
          padding: 2px 4px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .md-bubble-menu button {
          border: none;
          background: none;
          cursor: pointer;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 600;
          color: #444;
          line-height: 1;
        }
        .md-bubble-menu button:hover {
          background: #f0f0f0;
        }
        .md-bubble-menu button.is-active {
          background: #0112AA;
          color: #fff;
        }
        .md-bubble-sep {
          width: 1px;
          height: 16px;
          background: #e0e0e0;
          margin: 0 2px;
        }
      `}</style>
    </div>
  );
}
