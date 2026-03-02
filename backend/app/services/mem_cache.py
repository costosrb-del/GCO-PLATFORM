"""
mem_cache.py — Caché en memoria RAM con TTL.
100% gratis: vive en el proceso FastAPI, sin GCS, sin disco.
Reduce lecturas Firestore ~90% para datos que no cambian cada segundo.
"""
import time
import threading
from typing import Any, Optional, Callable

class MemCache:
    """
    TTL cache thread-safe en RAM.
    Política: stale-while-revalidate (retorna dato viejo mientras refresca en background).
    """
    def __init__(self):
        self._store: dict[str, tuple[Any, float]] = {}  # key → (value, expire_at)
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expire_at = entry
            if time.time() > expire_at:
                # Expirado: eliminar y devolver None
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl: int):
        """ttl en segundos."""
        with self._lock:
            self._store[key] = (value, time.time() + ttl)

    def delete(self, key: str):
        with self._lock:
            self._store.pop(key, None)

    def delete_prefix(self, prefix: str):
        """Invalida todas las claves que empiecen con prefix."""
        with self._lock:
            keys = [k for k in self._store if k.startswith(prefix)]
            for k in keys:
                del self._store[k]

    def get_or_set(self, key: str, loader: Callable, ttl: int) -> Any:
        """
        Patrón cache-aside:
        1. Si hay valor fresco → devolverlo.
        2. Si no → llamar loader(), cachear y devolver.
        """
        cached = self.get(key)
        if cached is not None:
            return cached
        value = loader()
        if value is not None:
            self.set(key, value, ttl)
        return value

    def stats(self) -> dict:
        with self._lock:
            now = time.time()
            total = len(self._store)
            valid = sum(1 for _, (_, exp) in self._store.items() if now <= exp)
            return {"total_keys": total, "valid_keys": valid, "expired_keys": total - valid}


# Singleton global
mem_cache = MemCache()

# ── TTLs por tipo de dato ──────────────────────────────────────────────────────
TTL_STATIC    = 600   # 10 min — insumos, terceros, productos (cambian poco)
TTL_ORDENES   = 30    # 30 s  — órdenes (cambian con cada acción)
TTL_SNAPSHOT  = 15    # 15 s  — snapshot MRP (tiempo real)
TTL_KPI       = 60    # 1 min — KPIs del dashboard
TTL_BORRADORES = 120  # 2 min — borradores MRP
