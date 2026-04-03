import "dotenv/config";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? "3000"),
  databaseUrl: req("DATABASE_URL"),
  teamJwtSecret: req("TEAM_JWT_SECRET"),
  adminApiKey: req("ADMIN_API_KEY"),
  awsRegion: req("AWS_REGION"),
  s3Bucket: req("S3_BUCKET"),
  /** Optional; uses default provider chain (env, instance role) */
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
