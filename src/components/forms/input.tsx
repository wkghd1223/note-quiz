'use client';
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
} from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  margin?: string;
}

const Input = forwardRef<InputRef, InputProps>(
  ({ label, margin, className, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (props.value) {
        setIsFocused(true);
      }
    }, [props.value]);

    const handleBlur = () => {
      if (inputRef.current && !inputRef.current.value) {
        setIsFocused(false);
      }
    };

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => {
        if (inputRef.current) {
          inputRef.current.value = '';
          setIsFocused(false);
        }
      },
    }));

    const active = isFocused || !!props.value;

    return (
      <div className={`relative flex ${margin || 'my-2'} w-full`}>
        {/* Floating Label */}
        <label
          className={`absolute left-3 transition-all text-gray-500 ${
            active ? 'top-2 text-xs' : 'top-1/2 -translate-y-1/2 text-sm'
          }`}
        >
          {label}
        </label>

        {/* Input Field */}
        <input
          ref={inputRef}
          className={`w-full px-3 pt-5 pb-2 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all h-12 ${className}`}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          {...props}
        />
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
