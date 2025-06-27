'use client';
import { forwardRef, useRef, useImperativeHandle } from 'react';

interface IDateTimeInput extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  type?: 'date' | 'datetime-local';
}

const Datetime = forwardRef<DateTimeInputRef, IDateTimeInput>(
  ({ label, type = 'date', className, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      clear: () => {
        if (inputRef.current) {
          inputRef.current.value = '';
        }
      },
    }));

    return (
      <div className={`relative w-full ${className || ''}`}>
        {/* Floating Label */}
        <label className="absolute left-3 transition-all text-gray-500 text-sm top-2">
          {label}
        </label>

        {/* Input Field */}
        <input
          ref={inputRef}
          type={type}
          className="w-full h-12 border border-gray-300 rounded-md px-3 pt-6 focus:outline-none focus:border-green-500"
          {...props}
        />
      </div>
    );
  },
);

Datetime.displayName = 'Datetime';

export default Datetime;
