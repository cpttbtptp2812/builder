import React, { useEffect, useState, useImperativeHandle, forwardRef, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import {
  BoldOutlined,
  ItalicOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  CodeOutlined,
  UndoOutlined,
  RedoOutlined,
  EyeOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { Tooltip } from "antd";

export interface TipTapRichEditorRef {
  insertVariable: (varCode: string) => void;
  focus: () => void;
}

interface TipTapRichEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export const TipTapRichEditor = forwardRef<TipTapRichEditorRef, TipTapRichEditorProps>(
  (
    {
      value,
      onChange,
      placeholder = "在此编写提示词人设、审查规则与输出格式（支持加粗、标题、列表、代码块）...",
    },
    ref
  ) => {
    const [mode, setMode] = useState<"rich" | "raw">("rich");
    const rawTextareaRef = useRef<HTMLTextAreaElement>(null);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          codeBlock: true,
        }),
        Placeholder.configure({
          placeholder,
        }),
        Markdown.configure({
          html: true,
          tightLists: true,
          bulletListMarker: "-",
        }),
      ],
      content: value,
      onUpdate: ({ editor: ed }) => {
        const md = (ed.storage as any)?.markdown?.getMarkdown?.() || ed.getText();
        onChange(md);
      },
    });

    useImperativeHandle(ref, () => ({
      insertVariable: (varCode: string) => {
        if (mode === "rich" && editor) {
          editor.chain().focus().insertContent(` ${varCode} `).run();
        } else if (rawTextareaRef.current) {
          const el = rawTextareaRef.current;
          const start = el.selectionStart ?? value.length;
          const end = el.selectionEnd ?? value.length;
          const next = value.substring(0, start) + ` ${varCode} ` + value.substring(end);
          onChange(next);
          setTimeout(() => {
            el.focus();
            el.setSelectionRange(start + varCode.length + 2, start + varCode.length + 2);
          }, 30);
        } else {
          onChange(value + ` ${varCode} `);
        }
      },
      focus: () => {
        if (mode === "rich" && editor) {
          editor.commands.focus();
        } else if (rawTextareaRef.current) {
          rawTextareaRef.current.focus();
        }
      },
    }));

    useEffect(() => {
      if (!editor) return;
      const currentMd = (editor.storage as any)?.markdown?.getMarkdown?.() || editor.getText();
      if (value !== currentMd) {
        editor.commands.setContent(value, false);
      }
    }, [value, editor]);

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          height: "100%",
          width: "100%",
          background: "#ffffff",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* 排版工具栏 */}
        <div
          style={{
            background: "#f8fafc",
            borderBottom: "1.5px solid #e2e8f0",
            padding: "7px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {mode === "rich" && editor && (
              <>
                <Tooltip title="加粗 (Ctrl+B)">
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    style={{
                      background: editor.isActive("bold") ? "#e0e7ff" : "#ffffff",
                      color: editor.isActive("bold") ? "#4338ca" : "#334155",
                      border: `1px solid ${editor.isActive("bold") ? "#818cf8" : "#cbd5e1"}`,
                      borderRadius: 6,
                      padding: "3px 8px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <BoldOutlined /> 粗体
                  </button>
                </Tooltip>

                <Tooltip title="斜体 (Ctrl+I)">
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    style={{
                      background: editor.isActive("italic") ? "#e0e7ff" : "#ffffff",
                      color: editor.isActive("italic") ? "#4338ca" : "#334155",
                      border: `1px solid ${editor.isActive("italic") ? "#818cf8" : "#cbd5e1"}`,
                      borderRadius: 6,
                      padding: "3px 8px",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <ItalicOutlined /> 斜体
                  </button>
                </Tooltip>

                <div style={{ width: 1, height: 18, background: "#cbd5e1", margin: "0 3px" }} />

                <Tooltip title="大标题 (H1)">
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    style={{
                      background: editor.isActive("heading", { level: 1 }) ? "#e0e7ff" : "#ffffff",
                      color: editor.isActive("heading", { level: 1 }) ? "#4338ca" : "#334155",
                      border: `1px solid ${editor.isActive("heading", { level: 1 }) ? "#818cf8" : "#cbd5e1"}`,
                      borderRadius: 6,
                      padding: "3px 8px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    H1 标题
                  </button>
                </Tooltip>

                <Tooltip title="二级标题 (H2)">
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    style={{
                      background: editor.isActive("heading", { level: 2 }) ? "#e0e7ff" : "#ffffff",
                      color: editor.isActive("heading", { level: 2 }) ? "#4338ca" : "#334155",
                      border: `1px solid ${editor.isActive("heading", { level: 2 }) ? "#818cf8" : "#cbd5e1"}`,
                      borderRadius: 6,
                      padding: "3px 8px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    H2 标题
                  </button>
                </Tooltip>

                <div style={{ width: 1, height: 18, background: "#cbd5e1", margin: "0 3px" }} />

                <Tooltip title="项目圆点列表">
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    style={{
                      background: editor.isActive("bulletList") ? "#e0e7ff" : "#ffffff",
                      color: editor.isActive("bulletList") ? "#4338ca" : "#334155",
                      border: `1px solid ${editor.isActive("bulletList") ? "#818cf8" : "#cbd5e1"}`,
                      borderRadius: 6,
                      padding: "3px 8px",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <UnorderedListOutlined /> 项目列表
                  </button>
                </Tooltip>

                <Tooltip title="数字编号列表">
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    style={{
                      background: editor.isActive("orderedList") ? "#e0e7ff" : "#ffffff",
                      color: editor.isActive("orderedList") ? "#4338ca" : "#334155",
                      border: `1px solid ${editor.isActive("orderedList") ? "#818cf8" : "#cbd5e1"}`,
                      borderRadius: 6,
                      padding: "3px 8px",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <OrderedListOutlined /> 编号
                  </button>
                </Tooltip>

                <Tooltip title="重点引用规范框">
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    style={{
                      background: editor.isActive("blockquote") ? "#e0e7ff" : "#ffffff",
                      color: editor.isActive("blockquote") ? "#4338ca" : "#334155",
                      border: `1px solid ${editor.isActive("blockquote") ? "#818cf8" : "#cbd5e1"}`,
                      borderRadius: 6,
                      padding: "3px 8px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    ❝ 重点框
                  </button>
                </Tooltip>

                <Tooltip title="插入标准代码块">
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    style={{
                      background: editor.isActive("codeBlock") ? "#e0e7ff" : "#ffffff",
                      color: editor.isActive("codeBlock") ? "#4338ca" : "#334155",
                      border: `1px solid ${editor.isActive("codeBlock") ? "#818cf8" : "#cbd5e1"}`,
                      borderRadius: 6,
                      padding: "3px 8px",
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <CodeOutlined /> 代码块
                  </button>
                </Tooltip>

                <div style={{ width: 1, height: 18, background: "#cbd5e1", margin: "0 3px" }} />

                <Tooltip title="撤销 (Ctrl+Z)">
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    style={{
                      background: "#ffffff",
                      color: "#475569",
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      padding: "3px 6px",
                      fontSize: 12,
                      cursor: editor.can().undo() ? "pointer" : "not-allowed",
                      opacity: editor.can().undo() ? 1 : 0.4,
                    }}
                  >
                    <UndoOutlined />
                  </button>
                </Tooltip>
                <Tooltip title="重做 (Ctrl+Y)">
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    style={{
                      background: "#ffffff",
                      color: "#475569",
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      padding: "3px 6px",
                      fontSize: 12,
                      cursor: editor.can().redo() ? "pointer" : "not-allowed",
                      opacity: editor.can().redo() ? 1 : 0.4,
                    }}
                  >
                    <RedoOutlined />
                  </button>
                </Tooltip>
              </>
            )}

            {mode === "raw" && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#4f46e5" }}>
                📝 纯文本源码模式 (可直接贴入任意 XML / Markdown 提示词代码)
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                display: "flex",
                background: "#e2e8f0",
                padding: "2px",
                borderRadius: 6,
                gap: 2,
              }}
            >
              <button
                type="button"
                onClick={() => setMode("rich")}
                style={{
                  background: mode === "rich" ? "#ffffff" : "transparent",
                  color: mode === "rich" ? "#4f46e5" : "#64748b",
                  border: "none",
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontSize: 11.5,
                  fontWeight: mode === "rich" ? 700 : 500,
                  cursor: "pointer",
                  boxShadow: mode === "rich" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <EyeOutlined /> 所见即所得
              </button>
              <button
                type="button"
                onClick={() => setMode("raw")}
                style={{
                  background: mode === "raw" ? "#ffffff" : "transparent",
                  color: mode === "raw" ? "#4f46e5" : "#64748b",
                  border: "none",
                  borderRadius: 4,
                  padding: "2px 8px",
                  fontSize: 11.5,
                  fontWeight: mode === "raw" ? 700 : 500,
                  cursor: "pointer",
                  boxShadow: mode === "raw" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <EditOutlined /> 纯文本源码
              </button>
            </div>
          </div>
        </div>

        {/* 核心正文编辑视口 */}
        <div
          style={{
            flex: 1,
            height: "100%",
            overflowY: "auto",
            position: "relative",
            cursor: "default",
          }}
        >
          {mode === "rich" ? (
            <div
              className="tiptap-editor-wrap"
              style={{
                height: "100%",
                cursor: "default",
              }}
            >
              <EditorContent editor={editor} />
            </div>
          ) : (
            <textarea
              ref={rawTextareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
              style={{
                width: "100%",
                height: "100%",
                minHeight: "100%",
                padding: "16px 20px",
                fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
                fontSize: 13,
                lineHeight: 1.75,
                border: "none",
                outline: "none",
                resize: "none",
                color: "#0f172a",
                background: "#ffffff",
                cursor: "default",
                caretColor: "#4f46e5",
                boxSizing: "border-box",
              }}
            />
          )}
        </div>
      </div>
    );
  }
);

TipTapRichEditor.displayName = "TipTapRichEditor";

export default TipTapRichEditor;

