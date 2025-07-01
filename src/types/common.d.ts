/* eslint-disable @typescript-eslint/no-explicit-any */

interface IModalRef {
  openModal: () => void;
  closeModal: () => void;
}

interface ITable<T = any> {
  columns: TableColumnType[];
  items: (T | Record<string, any>)[];
  name?: string;
  onClick?: (item: T | Record<string, any>) => void;
  checkable?: boolean;
}
