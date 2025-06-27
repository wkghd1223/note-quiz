import api from '@/lib/api';
import { stringify } from 'querystring';

export const getNotices = async (
  params: NoticeListRequestType,
): Promise<NoticeListResponseType> => {
  const data = await api.get<NoticeListResponseType>(
    `/v1/notices?${stringify(params)}`,
  );
  return data;
};

export const getNotice = async (
  noticeId: string | number,
): Promise<NoticeType | null> => {
  try {
    const data = await api.get<NoticeType>(`/v1/notices/${noticeId}`);
    return data;
  } catch (e) {
    return null;
  }
};
