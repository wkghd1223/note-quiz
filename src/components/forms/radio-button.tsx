'use client';
import { forwardRef, useId, useState } from 'react';
import { motion } from 'framer-motion';

interface IRadioButton {
  options: LabelValueType[];
  name?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

const RadioButton = forwardRef<HTMLInputElement, IRadioButton>(
  ({ options, name, defaultValue, onChange }, ref) => {
    const id = useId();
    const [selected, setSelected] = useState(defaultValue || '');

    const handleChange = (value: string) => {
      setSelected(value);
      if (onChange) onChange(value);
    };

    return (
      <div className="flex space-x-4">
        {options.map((option) => (
          <label
            key={option.value}
            className="relative flex items-center cursor-pointer"
          >
            {/* Hidden Radio Input */}
            <input
              ref={ref}
              type="radio"
              name={name || id}
              value={option.value}
              checked={selected === option.value}
              onChange={() => handleChange(option.value)}
              className="sr-only"
            />

            {/* Custom Radio Button */}
            <motion.div
              className={`w-6 h-6 border-2 rounded-full flex items-center justify-center transition-all ${
                selected === option.value
                  ? 'border-green-500'
                  : 'border-gray-400'
              }`}
              whileHover={{ scale: 1.1 }}
            >
              {selected === option.value && (
                <motion.div
                  className="w-3 h-3 bg-green-500 rounded-full"
                  layout
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                />
              )}
            </motion.div>

            {/* Label Text */}
            <span className="ml-2 text-gray-700 text-sm">{option.label}</span>
          </label>
        ))}
      </div>
    );
  },
);

RadioButton.displayName = 'RadioButton';
export default RadioButton;
