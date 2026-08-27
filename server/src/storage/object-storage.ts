export type ObjectHead = { contentLength?: number; contentType?: string; checksum?: string };
export interface ObjectStorage { createUploadUrl(key: string, contentType: string, expiresIn: number): Promise<string>; headObject(key: string): Promise<ObjectHead | null>; createDownloadUrl(key: string, expiresIn: number): Promise<string>; }
