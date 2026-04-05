import { router } from "expo-router";
import { useEffect } from "react";
import { unregisterDevicePushToken } from "@/lib/api";
import * as Session from "@/lib/session";

/** When hunt state cannot be loaded (after retries), clear session and return to join screen. */
export function useRedirectOnHuntLoadFailure(q: {
  isError: boolean;
  isPending: boolean;
  data: unknown;
}): void {
  useEffect(() => {
    if (q.isError && !q.isPending && q.data == null) {
      void (async () => {
        await unregisterDevicePushToken();
        await Session.clearSession();
        router.replace("/");
      })();
    }
  }, [q.isError, q.isPending, q.data]);
}
