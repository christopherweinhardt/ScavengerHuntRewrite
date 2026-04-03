import {
  copyAsync,
  documentDirectory,
  makeDirectoryAsync,
} from "expo-file-system/legacy";

export async function copyToBackup(params: {
  huntId: string;
  challengeId: string;
  fromUri: string;
  ext: string;
}): Promise<string> {
  const root = documentDirectory;
  if (!root) throw new Error("No document directory");
  const base = `${root}backups/${params.huntId}/`;
  await makeDirectoryAsync(base, { intermediates: true });
  const dest = `${base}${params.challengeId}-${Date.now()}.${params.ext}`;
  await copyAsync({ from: params.fromUri, to: dest });
  return dest;
}
