import AsyncStorage from "@react-native-async-storage/async-storage";
import { uploadProofAndComplete } from "./upload";

const QUEUE_KEY = "scavenger_upload_queue";

export type QueuedUpload = {
  challengeId: string;
  localUri: string;
  contentType: string;
  ext: string;
};

async function readQueue(): Promise<QueuedUpload[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedUpload[];
  } catch {
    return [];
  }
}

async function writeQueue(q: QueuedUpload[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export async function enqueueUpload(item: QueuedUpload): Promise<void> {
  const q = await readQueue();
  q.push(item);
  await writeQueue(q);
}

export async function flushUploadQueue(): Promise<{ ok: number; failed: number }> {
  let q = await readQueue();
  let ok = 0;
  let failed = 0;
  const remaining: QueuedUpload[] = [];
  for (const item of q) {
    try {
      await uploadProofAndComplete(item);
      ok += 1;
    } catch {
      failed += 1;
      remaining.push(item);
    }
  }
  await writeQueue(remaining);
  return { ok, failed };
}
