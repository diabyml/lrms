import { useEffect, useRef, useState } from "react";

interface EditableTextProps {
  content: string;
  className?: string;
  inputClassName?: string;
  onContentChange?: (content: string) => void;
}

export const EditableText: React.FC<EditableTextProps> = ({
  content: initialContent,
  className,
  inputClassName,
  onContentChange,
}) => {
  const [content, setContent] = useState<string>(initialContent);
  const [inEditMode, setInEditMode] = useState<boolean>(false);
  const ref = useRef<HTMLInputElement>(null);

  const handleContentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);
  };

  const handleEditModeToggle = () => {
    setInEditMode((prev) => !prev);
  };

  //   focus input when in edit mode
  useEffect(() => {
    if (inEditMode) {
      if (ref.current) {
        ref.current.focus();
      }
    }
  }, [inEditMode]);

  useEffect(() => {
    if (onContentChange && content) {
      onContentChange(content);
    }
  }, [onContentChange, content]);

  return (
    <>
      {inEditMode ? (
        <input
          ref={ref}
          className={`px-2 ${inputClassName}`}
          onBlur={handleEditModeToggle}
          value={content}
          onChange={handleContentChange}
        />
      ) : (
        <span
          className={`inline-block cursor-pointer ${className}`}
          onClick={handleEditModeToggle}
        >
          {content}
        </span>
      )}
    </>
  );
};
