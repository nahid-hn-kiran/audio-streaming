import { apiFetch } from "@/lib/api";
export type UploadInput = { filename: string; contentType: string; byteSize: number; checksum?: string };
export type UploadSession = { uploadId: string; uploadUrl: string; expiresAt: string; requiredHeaders: Record<string, string> };
export const initiateUpload = (trackId: string, body: UploadInput) => apiFetch<{ data: UploadSession }>(`/api/v1/admin/tracks/${trackId}/audio/upload`, { method: "POST", body: JSON.stringify(body) });
export const completeUpload = (uploadId: string) => apiFetch<{ data: { uploadId: string; mediaAssetId: string; status: string } }>(`/api/v1/admin/uploads/${uploadId}/complete`, { method: "POST" });
export const retryUpload = (uploadId: string, body: UploadInput) => apiFetch<{ data: UploadSession }>(`/api/v1/admin/uploads/${uploadId}/retry`, { method: "POST", body: JSON.stringify(body) });

export async function putObject(url: string, file: File, headers: Record<string, string>, onProgress: (value: number) => void) {
  const response = await fetch(url, { method: "PUT", headers, body: file });
  onProgress(100);
  if (!response.ok) throw new Error("Storage upload failed");
}
