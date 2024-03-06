export const UploadSuccessfulResponseDto = (uploadedFileName: string) => {
  return {
    fileName: uploadedFileName,
  };
};
