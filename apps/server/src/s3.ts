import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";

const s3 = new S3Client({
  region: config.awsRegion,
  ...(config.awsAccessKeyId && config.awsSecretAccessKey
    ? {
        credentials: {
          accessKeyId: config.awsAccessKeyId,
          secretAccessKey: config.awsSecretAccessKey,
        },
      }
    : {}),
});

const DEFAULT_PART_SIZE = 8 * 1024 * 1024; // 8 MiB

export function buildObjectKey(params: {
  huntId: string;
  teamId: string;
  challengeId: string;
  ext: string;
}): string {
  const safeExt = params.ext.replace(/^\./, "");
  return `hunts/${params.huntId}/teams/${params.teamId}/challenges/${params.challengeId}/${randomUUID()}.${safeExt}`;
}

export async function presignPutObject(params: {
  key: string;
  contentType: string;
}): Promise<{ url: string; key: string }> {
  const cmd = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: params.key,
    ContentType: params.contentType,
  });
  const url = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
  return { url, key: params.key };
}

export type MultipartSession = {
  key: string;
  uploadId: string;
  partSize: number;
  huntId: string;
  teamId: string;
  createdAt: number;
};

const sessions = new Map<string, MultipartSession>();

export async function initMultipart(params: {
  key: string;
  contentType: string;
  huntId: string;
  teamId: string;
  partSize?: number;
}): Promise<{ uploadId: string; key: string; partSize: number }> {
  const partSize = params.partSize ?? DEFAULT_PART_SIZE;
  const out = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: config.s3Bucket,
      Key: params.key,
      ContentType: params.contentType,
    })
  );
  const uploadId = out.UploadId;
  if (!uploadId) throw new Error("No uploadId from S3");
  sessions.set(uploadId, {
    key: params.key,
    uploadId,
    partSize,
    huntId: params.huntId,
    teamId: params.teamId,
    createdAt: Date.now(),
  });
  return { uploadId, key: params.key, partSize };
}

export function getSession(uploadId: string): MultipartSession | undefined {
  return sessions.get(uploadId);
}

export async function presignUploadPart(params: {
  uploadId: string;
  partNumber: number;
}): Promise<string> {
  const session = sessions.get(params.uploadId);
  if (!session) throw new Error("Unknown upload session");

  const cmd = new UploadPartCommand({
    Bucket: config.s3Bucket,
    Key: session.key,
    UploadId: params.uploadId,
    PartNumber: params.partNumber,
  });
  return getSignedUrl(s3, cmd, { expiresIn: 3600 });
}

export async function completeMultipart(params: {
  uploadId: string;
  parts: { ETag: string; PartNumber: number }[];
}): Promise<{ key: string }> {
  const session = sessions.get(params.uploadId);
  if (!session) throw new Error("Unknown upload session");

  const sorted = [...params.parts].sort(
    (a, b) => a.PartNumber - b.PartNumber
  );
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: config.s3Bucket,
      Key: session.key,
      UploadId: params.uploadId,
      MultipartUpload: {
        Parts: sorted.map((p) => ({ ETag: p.ETag, PartNumber: p.PartNumber })),
      },
    })
  );
  sessions.delete(params.uploadId);
  return { key: session.key };
}

/** Prune stale sessions (e.g. abandoned uploads) */
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id, s] of sessions) {
    if (s.createdAt < cutoff) sessions.delete(id);
  }
}, 60 * 60 * 1000).unref?.();
