import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import type { Notificacion, UseNotificacionesResult } from "./types";
import {
  shouldPollNotificaciones,
  realtimeCanConnect,
  NOTIFICACIONES_POLL_MS,
  type ChannelStatus,
} from "./realtimeFallback";

const QUICK_VIEW_SIZE = 5;

const sortDesc = (list: Notificacion[]): Notificacion[] =>
  [...list].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

export function useNotificaciones(): UseNotificacionesResult {
  const { user } = useAuth();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingIds, setMarkingIds] = useState<ReadonlySet<string>>(new Set());
  const [recienLlegadas, setRecienLlegadas] = useState<ReadonlySet<string>>(
    new Set(),
  );

  const email = user?.email ?? "admin";

  // The pending count always comes from an authoritative server recount (never
  // an optimistic delta), and out-of-order responses are discarded so a stale
  // in-flight count can't clobber a newer one.
  const countReqRef = useRef(0);
  const reloadCount = useCallback(async () => {
    const reqId = ++countReqRef.current;
    const { count, error: countError } = await supabase
      .from("notificaciones")
      .select("id", { count: "exact", head: true })
      .eq("atendida", false);
    if (!countError && count !== null && reqId === countReqRef.current) {
      setPendingCount(count);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let hadFirstSubscribe = false;
    let channelStatus: ChannelStatus | null = null;

    const fetchInitial = async (isFirstLoad: boolean) => {
      if (isFirstLoad) setLoading(true);
      const [listRes] = await Promise.all([
        supabase
          .from("notificaciones")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(QUICK_VIEW_SIZE),
        reloadCount(),
      ]);
      if (disposed) return;
      if (listRes.error) {
        setError("No se pudieron cargar las notificaciones.");
      } else {
        setError(null);
        // Keep already-revealed older pending rows; refresh the recent window.
        setNotificaciones((prev) => {
          const fresh = listRes.data ?? [];
          const freshIds = new Set(fresh.map((n) => n.id));
          const kept = prev.filter((n) => !freshIds.has(n.id));
          return sortDesc([...fresh, ...kept]);
        });
      }
      if (isFirstLoad) setLoading(false);
    };

    fetchInitial(true);

    // Realtime never connects in production (see realtimeFallback.ts), so the
    // bell refetches on a timer whenever the socket is not carrying events.
    // A hidden tab stops polling and catches up once on the way back.
    let poller: ReturnType<typeof setInterval> | null = null;
    const syncPolling = () => {
      if (disposed) return;
      const hidden =
        typeof document !== "undefined" && document.visibilityState === "hidden";
      const wanted = shouldPollNotificaciones(channelStatus, hidden);
      if (wanted && poller === null) {
        poller = setInterval(() => void fetchInitial(false), NOTIFICACIONES_POLL_MS);
      } else if (!wanted && poller !== null) {
        clearInterval(poller);
        poller = null;
      }
    };

    const onVisibility = () => {
      if (disposed) return;
      if (document.visibilityState === "visible" && channelStatus !== "SUBSCRIBED") {
        void fetchInitial(false);
      }
      syncPolling();
    };
    document.addEventListener("visibilitychange", onVisibility);
    syncPolling();

    const channel = supabase
      .channel("notificaciones-admin")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificaciones" },
        (payload) => {
          if (disposed) return;
          const row = payload.new as Notificacion;
          setNotificaciones((prev) =>
            prev.some((n) => n.id === row.id) ? prev : sortDesc([row, ...prev]),
          );
          reloadCount();
          setRecienLlegadas((s) => new Set(s).add(row.id));
          setTimeout(() => {
            if (disposed) return;
            setRecienLlegadas((s) => {
              const next = new Set(s);
              next.delete(row.id);
              return next;
            });
          }, 3000);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notificaciones" },
        (payload) => {
          if (disposed) return;
          const row = payload.new as Notificacion;
          setNotificaciones((prev) =>
            prev.map((n) => (n.id === row.id ? row : n)),
          );
          reloadCount();
        },
      );

    // subscribe() is what dials the socket, so where it cannot reach Supabase
    // we simply never call it: the client would retry the handshake forever and
    // bury real errors in the console. Polling above already covers that case,
    // since the status then stays null.
    if (realtimeCanConnect(import.meta.env.VITE_SUPABASE_URL)) {
      channel.subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          // On reconnect, re-sync whatever was missed while offline.
          if (hadFirstSubscribe) fetchInitial(false);
          hadFirstSubscribe = true;
        }
        channelStatus = status as ChannelStatus;
        syncPolling();
      });
    }

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (poller !== null) clearInterval(poller);
      supabase.removeChannel(channel);
    };
  }, [reloadCount]);

  // Reveal every pending notification not already shown. The pending set stays
  // small (they get marked done), so we load them all rather than page a cursor
  // — this also closes gaps left by events missed while the socket was down.
  const showOlderPending = useCallback(async () => {
    setError(null);
    setLoadingMore(true);
    const { data, error: fetchError } = await supabase
      .from("notificaciones")
      .select("*")
      .eq("atendida", false)
      .order("created_at", { ascending: false });
    if (fetchError) {
      setError("No se pudieron cargar más notificaciones.");
    } else if (data) {
      setNotificaciones((prev) => {
        const knownIds = new Set(prev.map((n) => n.id));
        const nuevos = data.filter((n) => !knownIds.has(n.id));
        return sortDesc([...prev, ...nuevos]);
      });
    }
    setLoadingMore(false);
  }, []);

  const markAtendida = useCallback(
    async (id: string) => {
      const target = notificaciones.find((n) => n.id === id);
      if (!target || target.atendida || markingIds.has(id)) return;
      setError(null);
      setMarkingIds((s) => new Set(s).add(id));

      const atendida_at = new Date().toISOString();
      const optimistic: Notificacion = {
        ...target,
        atendida: true,
        atendida_por: email,
        atendida_at,
      };
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === id ? optimistic : n)),
      );
      setPendingCount((c) => Math.max(0, c - 1));

      // .eq("atendida", false): first admin wins. A concurrent marker matches 0
      // rows (no error, empty data) — reconcile to the canonical row so the
      // "Hecho por" attribution reflects whoever actually won, not this client.
      const { data, error: updateError } = await supabase
        .from("notificaciones")
        .update({ atendida: true, atendida_por: email, atendida_at })
        .eq("id", id)
        .eq("atendida", false)
        .select();

      if (updateError) {
        setNotificaciones((prev) =>
          prev.map((n) => (n.id === id ? target : n)),
        );
        setPendingCount((c) => c + 1);
        setError("No se pudo marcar como hecho. Intente de nuevo.");
      } else if (data && data.length > 0) {
        setNotificaciones((prev) =>
          prev.map((n) => (n.id === id ? data[0] : n)),
        );
        reloadCount();
      } else {
        // Already marked by someone else — pull the true row + count.
        const { data: fresh } = await supabase
          .from("notificaciones")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (fresh) {
          setNotificaciones((prev) =>
            prev.map((n) => (n.id === id ? fresh : n)),
          );
        }
        reloadCount();
      }
      setMarkingIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    },
    [notificaciones, markingIds, email, reloadCount],
  );

  const visiblePending = notificaciones.filter((n) => !n.atendida).length;
  const hasMoreOlderPending = pendingCount > visiblePending;

  return {
    notificaciones,
    pendingCount,
    loading,
    loadingMore,
    hasMoreOlderPending,
    error,
    markingIds,
    recienLlegadas,
    showOlderPending,
    markAtendida,
  };
}
