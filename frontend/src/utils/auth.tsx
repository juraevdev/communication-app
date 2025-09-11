import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";


export const fetchWithAuth = async <T = any>(
  url: string,
  options: AxiosRequestConfig = {}
): Promise<AxiosResponse<T>> => {
  let token = localStorage.getItem("access_token");

  try {
    const response = await axios.request<T>({
      url,
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

    return response;
  } catch (error: any) {
    if (error.response?.status === 401) {
      const refresh = localStorage.getItem("refresh_token");
      if (!refresh) throw error;

      try {
        const refreshResponse = await axios.post<{ access: string }>(
          "http://172.16.8.92:8000/api/token/refresh/",
          { refresh }
        );

        const newAccess = refreshResponse.data.access;
        localStorage.setItem("access_token", newAccess);

        const retryResponse = await axios.request<T>({
          url,
          ...options,
          headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${newAccess}`,
          },
        });

        return retryResponse;
      } catch (refreshError) {
        localStorage.clear();
        window.location.href = "/login";
        throw refreshError;
      }
    }

    throw error;
  }
};
