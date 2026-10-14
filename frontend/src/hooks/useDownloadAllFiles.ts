import { useState } from "react";
import type { FilePublic } from "../client";
import useCustomToast from "./useCustomToast";

export function buildZipFileName(rawName?: string | null): string {
  if (!rawName) {
    return "files.zip";
  }

  const sanitized = rawName.replace(/[^A-Za-z0-9._ -]+/g, "_").trim();
  if (!sanitized) {
    return "files.zip";
  }

  return sanitized.toLowerCase().endsWith(".zip")
    ? sanitized
    : `${sanitized}.zip`;
}

/** Expands groups into their children, returning the ids of the real files. */
export function getDownloadableFileIds(files: FilePublic[]): string[] {
  return files.flatMap((file) =>
    file.children && file.children.length > 0
      ? file.children.map((child) => child.id)
      : [file.id],
  );
}

export function useDownloadAllFiles() {
  const [isDownloading, setIsDownloading] = useState(false);
  const showToast = useCustomToast();

  const downloadAll = async (
    files: FilePublic[],
    zipFileName?: string | null,
  ) => {
    const fileIds = getDownloadableFileIds(files);
    const requestedZipFileName = buildZipFileName(zipFileName);
    const accessToken = localStorage.getItem("access_token");

    if (fileIds.length === 0) {
      showToast(
        "No files to download",
        "There are no downloadable files.",
        "warning",
      );
      return;
    }

    if (!accessToken) {
      showToast(
        "Authentication required",
        "Please sign in and try again.",
        "error",
      );
      return;
    }

    setIsDownloading(true);
    try {
      const params = new URLSearchParams();
      for (const fileId of fileIds) {
        params.append("ids", fileId);
      }
      params.append("filename", requestedZipFileName);

      const tokenResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/files/downloads/all/token?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!tokenResponse.ok) {
        let description = "Failed to prepare bulk download.";
        try {
          const payload = (await tokenResponse.json()) as { detail?: string };
          if (payload?.detail) {
            description = payload.detail;
          }
        } catch {
          // ignore parse errors and keep fallback message
        }
        showToast("Download failed", description, "error");
        return;
      }

      const downloadToken = (await tokenResponse.json()) as string;

      const link = document.createElement("a");
      link.href = `${import.meta.env.VITE_API_URL}/api/v1/files/downloads/all/${encodeURIComponent(downloadToken)}`;
      link.download = requestedZipFileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      showToast("Download failed", "An unexpected error occurred.", "error");
    } finally {
      setIsDownloading(false);
    }
  };

  return { downloadAll, isDownloading };
}
