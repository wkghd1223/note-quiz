'use client';
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
} from 'react';

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  margin?: string;
  padding?: string;
}

const Textarea = forwardRef<TextareaRef, TextareaProps>(
  ({ label, margin, padding, className, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(true);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      if (props.value) {
        setIsFocused(true);
      }
    }, [props.value]);

    const handleBlur = () => {
      if (textareaRef.current && !textareaRef.current.value) {
        setIsFocused(false);
      }
    };

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      clear: () => {
        if (textareaRef.current) {
          textareaRef.current.value = '';
          setIsFocused(false);
        }
      },
    }));

    const active = isFocused || !!props.value;

    return (
      <div
        className={`relative w-full ${margin ? margin : 'mt-2'} ${
          className || ''
        }`}
      >
        {/* Floating Label */}
        <label
          className={`absolute left-3 transition-all ${
            active
              ? 'top-2 text-xs text-gray-600'
              : 'top-1/2 transform -translate-y-1/2 text-sm text-gray-400'
          }`}
        >
          {label}
        </label>

        {/* Styled Textarea */}
        <textarea
          ref={textareaRef}
          className={`w-full min-h-[100px] rounded-lg border border-gray-300 bg-white p-3 text-gray-800 resize-y transition-all focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 ${
            padding ? padding : ''
          }`}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          {...props}
        />
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';

export default Textarea;
