'use client';
import {
  forwardRef,
  useEffect,
  useState,
  useImperativeHandle,
  useCallback,
} from 'react';
import NoData from './no-data';

/**
 * Table component for displaying structured data.
 *
 * @template T - Type of data items in the table.
 *
 * @param {ITable<T>} props - Component props.
 * @param {TableRef<T>} ref - Ref to expose table methods.
 *
 * @returns {JSX.Element} A styled table with optional row selection.
 *
 * @example
 * ```tsx
 * import { useRef } from "react";
 * import Table, { TableRef } from "./Table";
 *
 * const columns = [
 *   { label: "Name", value: "name" },
 *   { label: "Age", value: "age" },
 * ];
 *
 * const data = [
 *   { name: "Alice", age: 25 },
 *   { name: "Bob", age: 30 },
 * ];
 *
 * const MyComponent = () => {
 *   const tableRef = useRef<TableRef>(null);
 *
 *   const handleGetChecked = () => {
 *     const checkedItems = tableRef.current?.getCheckedList();
 *     console.log(checkedItems);
 *   };
 *
 *   return (
 *     <>
 *       <Table ref={tableRef} columns={columns} items={data} checkable />
 *       <button onClick={handleGetChecked}>Get Checked Rows</button>
 *     </>
 *   );
 * };
 * ```
 */
const Table = forwardRef<TableRef, ITable>(
  ({ columns = [], items, name = '', onClick, checkable = false }, ref) => {
    const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

    // Select all when all rows are checked
    const selectAll = checkedItems.size === items.length && items.length > 0;

    // Reset checkboxes when items change
    useEffect(() => {
      setCheckedItems(new Set());
    }, [items]);

    // Handle single row selection
    const handleCheck = useCallback((index: number) => {
      setCheckedItems((prev) => {
        const newChecked = new Set(prev);
        newChecked.has(index)
          ? newChecked.delete(index)
          : newChecked.add(index);
        return newChecked;
      });
    }, []);

    // Handle "Select All" toggle
    const handleSelectAll = useCallback(() => {
      setCheckedItems(selectAll ? new Set() : new Set(items.map((_, i) => i)));
    }, [selectAll, items]);

    // Expose checked items list via ref
    useImperativeHandle(ref, () => ({
      getCheckedList: () => [...checkedItems].map((index) => items[index]),
    }));

    return (
      <div className="overflow-x-auto rounded-lg shadow-md h-full bg-white">
        <table className="min-w-full border-collapse bg-white shadow-sm">
          <thead>
            <tr className="bg-green-600 text-white uppercase text-sm leading-normal">
              {checkable && (
                <th className="py-3 px-4 text-center border-b">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="cursor-pointer"
                  />
                </th>
              )}
              {columns.map((column, columnKey) => (
                <th
                  key={`${name}_COLUMNS_HEADER_${columnKey}`}
                  className="py-3 px-4 text-center border-b"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm">
            {items.length > 0 ? (
              items.map((item, itemKey) => (
                <tr
                  key={`${name}_BODY_${itemKey}`}
                  onClick={() => onClick?.(item)}
                  className={`border-b transition-all ${
                    onClick ? 'cursor-pointer hover:bg-green-100' : ''
                  }`}
                >
                  {checkable && (
                    <td className="py-2 px-4 border-b text-center">
                      <input
                        type="checkbox"
                        checked={checkedItems.has(itemKey)}
                        onChange={() => handleCheck(itemKey)}
                        className="cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((column, columnKey) => (
                    <td
                      key={`${name}_BODY_${itemKey}_${columnKey}`}
                      style={column.style}
                      className="py-2 px-4 border-b"
                    >
                      {item[column.value]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + (checkable ? 1 : 0)}>
                  <NoData />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  },
);

Table.displayName = 'Table';
export default Table;
