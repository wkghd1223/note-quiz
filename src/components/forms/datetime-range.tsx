'use client';
import { forwardRef, useRef, useImperativeHandle, ChangeEvent } from 'react';

interface IDateTimeRange {
  type?: 'date' | 'datetime-local';
  defaultValue?: { start?: string; end?: string };
  labelStart?: string;
  labelEnd?: string;
  readOnly?: boolean;
  onChange?: ({ start, end }: { start?: string; end?: string }) => void;
}

const DateTimeRange = forwardRef<DateTimeRangeRef, IDateTimeRange>(
  (
    {
      type = 'date',
      defaultValue = {},
      labelStart,
      labelEnd,
      onChange,
      readOnly,
    },
    ref,
  ) => {
    const startRef = useRef<HTMLInputElement>(null);
    const endRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      clear: () => {
        if (startRef.current) startRef.current.value = '';
        if (endRef.current) endRef.current.value = '';
      },
    }));

    const _onChange = (e: ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      if (startRef.current && endRef.current && onChange) {
        onChange({
          start: startRef.current?.value,
          end: endRef.current?.value,
        });
      }
    };

    return (
      <div className="flex items-center gap-4 w-full">
        {/* Start Date/Datetime Input */}
        <div className="relative flex-1">
          <label className="absolute left-3 text-sm text-gray-500 top-2">
            {labelStart}
          </label>
          <input
            ref={startRef}
            type={type}
            defaultValue={defaultValue?.start}
            onChange={_onChange}
            readOnly={readOnly}
            className="w-full h-12 border border-gray-300 rounded-md px-3 pt-6 focus:outline-none focus:border-green-500"
          />
        </div>

        <span className="text-gray-500">~</span>

        {/* End Date/Datetime Input */}
        <div className="relative flex-1">
          <label className="absolute left-3 text-sm text-gray-500 top-2">
            {labelEnd}
          </label>
          <input
            ref={endRef}
            type={type}
            defaultValue={defaultValue?.end}
            onChange={_onChange}
            readOnly={readOnly}
            className="w-full h-12 border border-gray-300 rounded-md px-3 pt-6 focus:outline-none focus:border-green-500"
          />
        </div>
      </div>
    );
  },
);

DateTimeRange.displayName = 'DateTimeRange';

export default DateTimeRange;
