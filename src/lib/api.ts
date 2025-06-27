import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const FRONT_URL = process.env.NEXT_PUBLIC_FRONT_URL || '';

/**
 * 클라이언트용
 */
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터 추가
api.interceptors.request.use(
  (config) => {
    // localStorage에 token이 있으면 헤더에 넣어서 요청보냄
    const token = localStorage.getItem('token');
    if (token) {
      return {
        ...config,
        headers: {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        },
      } as InternalAxiosRequestConfig;
    }
    return config;
  },
  (error) => {
    // 요청 에러가 발생했을 때 수행할 로직
    console.error(error); // 디버깅
    return Promise.reject(error);
  },
);

// 응답 인터셉터 추가
api.interceptors.response.use(
  async (response) => {
    // 응답에 대한 로직 작성
    const res = response.data;
    // 4011: 엑세스토큰 만료시
    if (res.status === 4011) {
      try {
        // localStorage 의 토큰 삭제
        localStorage.removeItem('token');
        // 프론트서버 /api/auth/refresh 호출
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        const { token } = await res.json();

        const accessToken = token?.accessToken;
        // accessToken를 정상적으로 받아왔으면 헤더에 담아서 다시 요청보낸다.
        if (accessToken) {
          // localStorage에 토큰 다시 저장
          localStorage.setItem('token', accessToken);
          response.config.headers.Authorization = `Bearer ${accessToken}`;
          return api(response.config);
        }
      } catch (err) {
        localStorage.removeItem('token');
        console.error('Token refresh failed', err);
      }
    }
    return res;
  },
  (error) => {
    // 응답에 에러가 발생했을 때 수행할 로직
    console.error(error); // 디버깅
    return Promise.reject(error);
  },
);

/**
 * 사바용
 */
const serverApi: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});
// 요청 인터셉터
serverApi.interceptors.request.use(
  async (config) => {
    // 서버사이드에서 쿠키를 가져온다.
    // import 로 가져오면 client단에서는 server용 코드 못넣는다고 오류를 뱉어내서
    // require로 승부
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    if (!config.headers.Authorization) {
      const { cookies } = require('next/headers');
      const cookieStore = await cookies();
      const accessToken = cookieStore.get('access-token')?.value;
      // accessToken이 쿠키에 있으면 axios 쏘기 전에 헤더에 담아서 보낸다.
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }
    return config;
  },
  (error) => {
    // 요청 에러가 발생했을 때 수행할 로직
    console.error(error); // 디버깅
    return Promise.reject(error);
  },
);
// 응답 인터셉터 추가
serverApi.interceptors.response.use(
  async (response) => {
    // 응답에 대한 로직 작성
    const res = response.data;
    // 4011: 엑세스토큰 만료시
    if (res.status === 4011) {
      try {
        // 프론트서버 /api/auth/refresh 호출
        // 서버코드(노드환경)에서 FRONT_URL 안넣어주면 에러 먹뱉
        const { cookies } = require('next/headers');
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('access-token')?.value;
        const refreshToken = cookieStore.get('refresh-token')?.value;
        const res = await fetch(`${FRONT_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            Cookie: `access-token=${accessToken};refresh-token=${refreshToken}`,
          },
        });
        const { token } = (await res.json()) as unknown as TokenResponseType;
        // accessToken를 정상적으로 받아왔으면 헤더에 담아서 다시 요청보낸다.
        if (token) {
          const accessToken = token?.accessToken;
          if (accessToken) {
            response.config.headers.Authorization = `Bearer ${accessToken}`;
            return serverApi(response.config); // 🔄 Retry request with new token
          }
        }
      } catch (err) {
        console.error('Token refresh failed', err);
      }
    }
    return res;
  },
  (error) => {
    // 응답에 에러가 발생했을 때 수행할 로직
    console.error(error); // 디버깅
    return Promise.reject(error);
  },
);

/**
 * GET 메서드
 * @param url /api 이후로 작성
 * @param config 추가 설정
 * @returns
 */
const get = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  try {
    // 서버환경인 경우 serverApi 호출
    // 클라이언트 환경인 경우 api 호출
    const response: AxiosResponse = await (
      typeof window !== 'undefined' ? api : serverApi
    ).get<APIResponse<T>>(url, config);
    return response.data;
  } catch (error: any) {
    throw new Error(error);
  }
};

/**
 * POST 메서드
 * @param url /api 이후로 작성
 * @param config 추가 설정
 * @returns
 */
const post = async <T>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<T> => {
  try {
    // 서버환경인 경우 serverApi 호출
    // 클라이언트 환경인 경우 api 호출
    const response: AxiosResponse = await (
      typeof window !== 'undefined' ? api : serverApi
    ).post<APIResponse<T>>(url, data, config);
    return response.data;
  } catch (error: any) {
    throw new Error(error);
  }
};

/**
 * PUT 메서드
 * @param url /api 이후로 작성
 * @param config 추가 설정
 * @returns
 */
const put = async <T>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<T> => {
  try {
    // 서버환경인 경우 serverApi 호출
    // 클라이언트 환경인 경우 api 호출
    const response: AxiosResponse = await (
      typeof window !== 'undefined' ? api : serverApi
    ).put<APIResponse<T>>(url, data, config);
    return response.data;
  } catch (error: any) {
    throw new Error(error);
  }
};

/**
 * DELTE 메서드
 * @param url /api 이후로 작성
 * @param config 추가 설정
 * @returns
 */
const _delete = async <T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> => {
  try {
    // 서버환경인 경우 serverApi 호출
    // 클라이언트 환경인 경우 api 호출
    const response: AxiosResponse = await (
      typeof window !== 'undefined' ? api : serverApi
    ).delete<APIResponse<T>>(url, config);
    return response.data;
  } catch (error: any) {
    throw new Error(error);
  }
};

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  get,
  post,
  put,
  delete: _delete,
};
