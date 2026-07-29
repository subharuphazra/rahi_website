import React, { useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { api } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Quote,
  Undo2,
  Redo2,
  Image as ImageIcon,
  Link as LinkIcon,
  Minus,
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function RichEditor({ value, onChange, placeholder }) {
  const fileRef = useRef(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image.configure({ HTMLAttributes: { class: "editor-inline-image" } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "editor-link" } }),
      Placeholder.configure({ placeholder: placeholder || "Write your story…" }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose max-w-none min-h-[300px] focus:outline-none p-4",
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value === "" ? "clear" : "hasContent"]);

  if (!editor) return null;

  const uploadImage = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/uploads", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = `${BACKEND_URL}/api/files/${data.path}`;
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (e) {
      toast.error("Image upload failed");
    }
  };

  const addLink = () => {
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("URL", prev || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const btn = (active, onClick, testId, children) => (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      data-testid={testId}
      className={`h-8 w-8 p-0 rounded-sm ${active ? "bg-rahi-ink text-white" : ""}`}
    >
      {children}
    </Button>
  );

  return (
    <div className="border border-border rounded-sm" data-testid="rich-editor">
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-2 bg-muted/30">
        {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "rt-h2", <Heading2 className="h-4 w-4" />)}
        {btn(editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "rt-h3", <Heading3 className="h-4 w-4" />)}
        <div className="mx-1 h-6 w-px bg-border" />
        {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "rt-bold", <Bold className="h-4 w-4" />)}
        {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "rt-italic", <Italic className="h-4 w-4" />)}
        <div className="mx-1 h-6 w-px bg-border" />
        {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "rt-ul", <List className="h-4 w-4" />)}
        {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "rt-ol", <ListOrdered className="h-4 w-4" />)}
        {btn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "rt-quote", <Quote className="h-4 w-4" />)}
        {btn(false, () => editor.chain().focus().setHorizontalRule().run(), "rt-hr", <Minus className="h-4 w-4" />)}
        <div className="mx-1 h-6 w-px bg-border" />
        {btn(editor.isActive("link"), addLink, "rt-link", <LinkIcon className="h-4 w-4" />)}
        {btn(false, () => fileRef.current?.click(), "rt-image", <ImageIcon className="h-4 w-4" />)}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => uploadImage(e.target.files?.[0])}
          data-testid="rt-image-input"
        />
        <div className="ml-auto flex gap-1">
          {btn(false, () => editor.chain().focus().undo().run(), "rt-undo", <Undo2 className="h-4 w-4" />)}
          {btn(false, () => editor.chain().focus().redo().run(), "rt-redo", <Redo2 className="h-4 w-4" />)}
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
