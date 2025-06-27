type NoticeListRequestType = {
  page: number;
  size: number;
};
type NoticeListType = {
  noticeId: number;
  authorName: string;
  title: string;
  createdAt: Date;
};

type NoticeListResponseType = ListResponseType<NoticeListType>;

type NoticeType = {
  noticeId: number;
  authorName: string;
  title: string;
  content: string;
  createdAt: Date;
};
