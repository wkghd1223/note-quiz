type TableColumnType = LabelValueType & {
  style?: any;
};

interface InputRef {
  focus: () => void;
  clear: () => void;
}

interface TextareaRef {
  focus: () => void;
  clear: () => void;
}

interface DateTimeInputRef {
  clear: () => void;
}

interface DateTimeRangeRef {
  clear: () => void;
}

type LabelValueType = {
  label: string | React.ReactNode;
  value: any;
};

interface TableRef<T = any> {
  getCheckedList: () => (T | Record<string, any>)[]; // Returns selected items
}

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
