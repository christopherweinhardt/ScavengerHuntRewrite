import {
  createUploadTask,
  FileSystemUploadType,
} from "expo-file-system/legacy";
import { apiCompleteChallenge, apiPresignPut } from "./api";

export async function uploadProofAndComplete(params: {
  challengeId: string;
  localUri: string;
  contentType: string;
  ext: string;
  onProgress?: (p: number) => void;
}): Promise<void> {
  const { url, key } = await apiPresignPut({
    challengeId: params.challengeId,
    contentType: params.contentType,
    ext: params.ext,
  });

  const upload = createUploadTask(
    url,
    params.localUri,
    {
      httpMethod: "PUT",
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: { "Content-Type": params.contentType },
    },
    (data) => {
      const total = data.totalBytesExpectedToSend ?? 0;
      if (total > 0 && params.onProgress) {
        params.onProgress((data.totalBytesSent ?? 0) / total);
      }
    }
  );

  const res = await upload.uploadAsync();
  if (!res || res.status !== 200) {
    throw new Error(`S3 upload failed: ${res?.status ?? "unknown"}`);
  }

  await apiCompleteChallenge(params.challengeId, key);
}
