// context/UploadContext.tsx
import React, { createContext, useContext, useState } from "react";
import { uploadFileWithProgress } from "../utils"; // Import the new function
import { FilePublic } from "../client";

interface UploadContextValue {
  uploadFile: (
    file: File, 
    onProgress: (progress: number) => void, 
    onComplete: ((file: FilePublic) => void) | undefined,
    controller: AbortController,
  ) => Promise<void>;
  isUploading: boolean;
  progress: number;
}

const UploadContext = createContext<UploadContextValue | undefined>(undefined);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = async (file: File, onProgress: (progress: number) => void, onComplete: ((file: FilePublic) => void) | undefined, controller: AbortController) => {
    setIsUploading(true);
    setProgress(0);

    try {
      const response = await uploadFileWithProgress(file, controller, (event) => {
        let total = event.total;
        if (total === undefined) {
            total = file.size;
        }
        const percentage = Math.round((event.loaded * 100) / total);
        setProgress(percentage);
        onProgress(percentage);
      });
      if (response.data?.id && onComplete) {
        onComplete(response.data);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <UploadContext.Provider value={{ uploadFile, isUploading, progress }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUpload must be used within an UploadProvider");
  }
  return context;
};
