export const sessionStorageAdapter = {
  getAccessToken: () => null,
  getRefreshToken: () => null,
  save: (_tokens: { accessToken?: string; refreshToken?: string }) => {},
  clear: () => {
    sessionStorage.removeItem('hidrosmart_access_token');
    sessionStorage.removeItem('hidrosmart_refresh_token');
  },
};
