import { stringify } from 'querystring';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const getFileUrl = ({ fileId, fileSn = 1 }: FileType) =>
  `${API_URL}/v1/files/${fileId}?${stringify({ fileSn })}`;
