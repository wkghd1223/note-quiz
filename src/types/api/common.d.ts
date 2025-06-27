interface APIResponse<T> {
  status: number;
  message: string;
  data: T;
}

type ListResponseType<T> = {
  items: T[];
  totalCount: number;
};
