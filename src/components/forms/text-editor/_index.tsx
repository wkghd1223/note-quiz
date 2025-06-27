"use client";
import { useEffect, useMemo, useRef } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { getFileUrl } from "@/lib/file";
import "./index.css";
import { uploadFiles } from "@/services/fileService";

const formats = [
  "font",
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "blockquote",
  "list",
  "indent",
  "link",
  "align",
  "color",
  "background",
  "size",
  "image",
  "video",
];

const CustomToolbar = () => (
  <div id="toolbar">
    <label>
      <span style={{ display: "none" }}>ql-size</span>
      <select className="ql-size" aria-label="Font Size">
        <option value="small">Small</option>
        <option value="normal">Normal</option>
        <option value="large">Large</option>
        <option value="huge">Huge</option>
      </select>
    </label>

    <label>
      <span style={{ display: "none" }}>ql-align</span>
      <select className="ql-align" aria-label="Text Alignment">
        <option value=""></option>
        <option value="center">Center</option>
        <option value="right">Right</option>
        <option value="justify">Justify</option>
      </select>
    </label>

    <button className="ql-bold" aria-label="Bold"></button>
    <button className="ql-italic" aria-label="Italic"></button>
    <button className="ql-underline" aria-label="Underline"></button>
    <button className="ql-strike" aria-label="Strikethrough"></button>

    <label>
      <span style={{ display: "none" }}>ql-color</span>
      <select
        id="ql-color-select"
        className="ql-color"
        aria-label="Text Color"
      ></select>
    </label>
    <label>
      <span style={{ display: "none" }}>ql-background</span>
      <select
        id="ql-background-select"
        className="ql-background"
        aria-label="Background Color"
      ></select>
    </label>

    <button className="ql-image" aria-label="Insert Image"></button>
    <button className="ql-video" aria-label="Insert Video"></button>
  </div>
);

/**
 * Quill Editor
 *
 * 에디터 내 값 변경시(onChange) onChange 함수 trigger
 * useRef() 로 값 받아서 사용하는 것 권장
 *
 * @author pumpkin
 * @param onChange onChange
 * @returns
 */
const _TextEditor = ({
  onChange = () => {},
  defaultValue,
  ...rest
}: TextEditorProps) => {
  const ref = useRef<ReactQuill>(null);
  useEffect(() => {
    if (ref.current) {
      const editor = (ref.current as any).getEditor();
      if (editor) {
        // input 태그에 label 추가
        const inputElement = editor.container.querySelector(
          "input[data-formula]"
        );
        if (inputElement) {
          const uniqueId = "formula-input-id";
          inputElement.setAttribute("id", uniqueId); // id 속성 추가
          const label = document.createElement("label");
          label.setAttribute("for", inputElement.getAttribute("id"));
          label.setAttribute("style", "display: none;");
          label.innerText = "videoUrl";
          inputElement.parentNode.insertBefore(label, inputElement);
        }
        // a 태그에 label 추가
        const previewElement = editor.container.querySelector("a.ql-preview");
        if (previewElement) previewElement.textContent = "ql-preview";

        if (defaultValue) {
          editor.clipboard.dangerouslyPasteHTML(defaultValue);
        }
      }
    }
  }, [defaultValue]);
  const fileId = useRef<string>("");

  const imageHandler = () => {
    const input: HTMLInputElement = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.addEventListener("change", async () => {
      if (ref.current && input.files && input.files.length > 0) {
        const file = input.files?.[0];

        try {
          const res = await uploadFiles([file]);

          fileId.current = res.fileId;
          const imgUrl = getFileUrl(res.files[0]);
          const altText = file.name || "첨부 이미지";

          const editor = ref.current.getEditor();
          const range: any = editor.getSelection();
          const idx = range.index;

          editor.clipboard.dangerouslyPasteHTML(
            idx,
            `<img src="${imgUrl}" alt="${altText}" />`
          );

          editor.setSelection(idx + 1);
        } catch (error) {
          console.log(error);
        }
      }
    });
  };

  const modules = useMemo(() => {
    return {
      toolbar: {
        container: "#toolbar",
        handlers: {
          image: imageHandler,
        },
      },
      clipboard: {
        matchVisual: false,
      },
    };
  }, []);

  return (
    <>
      <CustomToolbar />
      <ReactQuill
        ref={ref}
        theme="snow"
        modules={modules}
        formats={formats}
        onChange={onChange}
        defaultValue={defaultValue}
        {...rest}
      />
    </>
  );
};

export default _TextEditor;
