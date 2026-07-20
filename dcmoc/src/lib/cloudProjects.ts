/* ─── CLOUD PROJECTS (Arc-4, opsional) ───────────────────────────────────────
 * Thin, honest wrapper over the sitewide Supabase helpers (window.rzSupa,
 * js/rz-supabase.js — loaded lazily via store/auth.ts getRzSupa()).
 *
 * PRINSIP: localStorage tetap penyimpanan UTAMA. Cloud = cadangan opsional
 * per-project + share link lihat-saja. Tidak ada sinkron otomatis.
 *
 * Semua fungsi async, null-safe, dan mengembalikan CloudResult dengan pesan
 * error string ramah (Bahasa Indonesia) — tidak pernah throw ke pemanggil.
 * ──────────────────────────────────────────────────────────────────────── */

import { getRzSupa } from '@/store/auth';
import type { ProjectBundle } from '@/store/projects';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type CloudResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface CloudProjectMeta {
    id: string;
    name: string;
    version: number;
    share_token: string | null;
    created_at: string;
    updated_at: string;
}

export interface SharedProjectPayload {
    name: string;
    bundle: ProjectBundle;
    version: number;
    shared_at: string | null;
}

/** Pesan jujur saat SQL Module 9 belum dijalankan owner (tabel belum ada). */
export const CLOUD_TABLE_MISSING =
    'Tabel cloud belum tersedia — lihat Owner Action Board di setup-supabase';

const MAX_BUNDLE_BYTES = 240 * 1024; // client pre-guard; DB caps at 256 KB

/* ── rzSupa surface used here (helpers already shipped in js/rz-supabase.js) ── */
interface SupaRes<T> { data?: T | null; error?: string | null }
interface DcmocSupa {
    ready?: Promise<unknown>;
    saveDcmocProject: (id: string | null, name: string, bundle: unknown) => Promise<SupaRes<{ id: string; updated_at: string }>>;
    listDcmocProjects: () => Promise<SupaRes<CloudProjectMeta[]>>;
    getDcmocProject: (id: string) => Promise<SupaRes<{ id: string; name: string; bundle: unknown; version: number; share_token: string | null; created_at: string; updated_at: string }>>;
    deleteDcmocProject: (id: string) => Promise<SupaRes<unknown>>;
    shareDcmocProject: (id: string) => Promise<SupaRes<{ id: string; share_token: string }>>;
    unshareDcmocProject: (id: string) => Promise<SupaRes<unknown>>;
    getSharedProject: (token: string) => Promise<SupaRes<unknown>>;
}

/** Map raw helper errors to honest, friendly messages. */
function mapError(raw: unknown): string {
    const msg = typeof raw === 'string' ? raw : raw instanceof Error ? raw.message : String(raw ?? 'unknown error');
    if (/relation .* does not exist|could not find the table|schema cache|database not set up/i.test(msg)) {
        return CLOUD_TABLE_MISSING;
    }
    if (/not signed in|silakan login/i.test(msg)) return 'Silakan login dulu untuk memakai fitur cloud.';
    if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'Tidak bisa terhubung ke cloud — periksa koneksi lalu coba lagi.';
    return msg;
}

/** Lazy-load + sanity-check the shared client. Never throws. */
async function getCloudApi(): Promise<CloudResult<DcmocSupa>> {
    try {
        const supa = await getRzSupa();
        if (!supa) return { ok: false, error: 'Modul Supabase gagal dimuat — periksa koneksi lalu muat ulang halaman.' };
        const api = supa as unknown as Partial<DcmocSupa>;
        if (typeof api.saveDcmocProject !== 'function' || typeof api.getSharedProject !== 'function') {
            return { ok: false, error: 'Modul cloud belum tersedia di versi rz-supabase.js yang termuat — muat ulang halaman (hard refresh).' };
        }
        if (api.ready) await api.ready; // wait for session restore
        return { ok: true, data: api as DcmocSupa };
    } catch (err) {
        return { ok: false, error: mapError(err) };
    }
}

/* ── shape validation (before any restore touches the stores) ── */
const SNAPSHOT_KEYS: (keyof ProjectBundle['snapshot'])[] = [
    'simInputs', 'capexInputs', 'requirements', 'sites', 'architecture',
    'constructionTracking', 'cxTracking', 'financialTracking', 'opsLog', 'sustainability',
];

/** version===1 + snapshot shape check. Returns the typed bundle or null. */
export function validateBundle(raw: unknown): ProjectBundle | null {
    if (!raw || typeof raw !== 'object') return null;
    const b = raw as Partial<ProjectBundle>;
    if (b.version !== 1) return null;
    if (!b.snapshot || typeof b.snapshot !== 'object') return null;
    const snap = b.snapshot as Record<string, unknown>;
    for (const k of SNAPSHOT_KEYS) {
        if (!(k in snap)) return null;
    }
    return b as ProjectBundle;
}

/** Ukuran bundle dalam bytes (JSON) — dipakai guard + label UI. */
export function bundleSizeBytes(project: ProjectBundle): number {
    try { return new Blob([JSON.stringify(project)]).size; } catch { return Number.MAX_SAFE_INTEGER; }
}

/* ─────────────────────────── public API ─────────────────────────── */

/** Upload satu ProjectBundle ke cloud. `cloudId` (opsional) = update row lama.
 *  Size-guard JUJUR: >240 KB ditolak dengan pesan — TANPA auto-trim. */
export async function uploadProject(
    project: ProjectBundle,
    cloudId?: string | null
): Promise<CloudResult<{ id: string; updated_at: string }>> {
    if (!project || project.version !== 1 || !project.snapshot) {
        return { ok: false, error: 'Bundle project tidak valid — buka/simpan ulang project lalu coba lagi.' };
    }
    const size = bundleSizeBytes(project);
    if (size > MAX_BUNDLE_BYTES) {
        const kb = Math.ceil(size / 1024);
        return {
            ok: false,
            error: `Project ${kb} KB / 240 KB — kurangi log tracking (Ops/Construction/Financial) lalu coba lagi`,
        };
    }
    const api = await getCloudApi();
    if (!api.ok) return api;
    try {
        const res = await api.data.saveDcmocProject(cloudId ?? null, project.name, project);
        if (res.error) return { ok: false, error: mapError(res.error) };
        if (!res.data?.id) return { ok: false, error: 'Cloud tidak mengembalikan ID — coba lagi.' };
        return { ok: true, data: { id: res.data.id, updated_at: res.data.updated_at } };
    } catch (err) {
        return { ok: false, error: mapError(err) };
    }
}

/** Daftar project cloud milik user (RINGAN — tanpa kolom bundle). */
export async function listCloud(): Promise<CloudResult<CloudProjectMeta[]>> {
    const api = await getCloudApi();
    if (!api.ok) return api;
    try {
        const res = await api.data.listDcmocProjects();
        if (res.error) return { ok: false, error: mapError(res.error) };
        return { ok: true, data: Array.isArray(res.data) ? res.data : [] };
    } catch (err) {
        return { ok: false, error: mapError(err) };
    }
}

/** Ambil satu project cloud (dengan bundle) + validasi version/shape SEBELUM return. */
export async function loadCloud(id: string): Promise<CloudResult<ProjectBundle>> {
    if (!id) return { ok: false, error: 'ID project cloud kosong.' };
    const api = await getCloudApi();
    if (!api.ok) return api;
    try {
        const res = await api.data.getDcmocProject(id);
        if (res.error) return { ok: false, error: mapError(res.error) };
        const bundle = validateBundle(res.data?.bundle);
        if (!bundle) {
            return { ok: false, error: 'Bundle cloud rusak / versi tidak dikenal (butuh version 1) — data lokal TIDAK diubah.' };
        }
        return { ok: true, data: bundle };
    } catch (err) {
        return { ok: false, error: mapError(err) };
    }
}

/** Hapus project cloud (data lokal tidak tersentuh). */
export async function removeCloud(id: string): Promise<CloudResult<null>> {
    if (!id) return { ok: false, error: 'ID project cloud kosong.' };
    const api = await getCloudApi();
    if (!api.ok) return api;
    try {
        const res = await api.data.deleteDcmocProject(id);
        if (res.error) return { ok: false, error: mapError(res.error) };
        return { ok: true, data: null };
    } catch (err) {
        return { ok: false, error: mapError(err) };
    }
}

/** Buat share token (link lihat-saja) untuk satu project cloud. */
export async function share(id: string): Promise<CloudResult<{ share_token: string }>> {
    if (!id) return { ok: false, error: 'ID project cloud kosong.' };
    const api = await getCloudApi();
    if (!api.ok) return api;
    try {
        const res = await api.data.shareDcmocProject(id);
        if (res.error) return { ok: false, error: mapError(res.error) };
        if (!res.data?.share_token) return { ok: false, error: 'Cloud tidak mengembalikan token share — coba lagi.' };
        return { ok: true, data: { share_token: res.data.share_token } };
    } catch (err) {
        return { ok: false, error: mapError(err) };
    }
}

/** Cabut share token — link lama langsung mati. */
export async function unshare(id: string): Promise<CloudResult<null>> {
    if (!id) return { ok: false, error: 'ID project cloud kosong.' };
    const api = await getCloudApi();
    if (!api.ok) return api;
    try {
        const res = await api.data.unshareDcmocProject(id);
        if (res.error) return { ok: false, error: mapError(res.error) };
        return { ok: true, data: null };
    } catch (err) {
        return { ok: false, error: mapError(err) };
    }
}

/** Ambil project dibagikan via token (RPC anon — TANPA login). Bundle divalidasi. */
export async function fetchShared(token: string): Promise<CloudResult<SharedProjectPayload>> {
    if (!token) return { ok: false, error: 'Token share kosong.' };
    const api = await getCloudApi();
    if (!api.ok) return api;
    try {
        const res = await api.data.getSharedProject(token);
        if (res.error) return { ok: false, error: mapError(res.error) };
        // RPC bisa mengembalikan objek tunggal ATAU array 1 baris — normalisasi.
        const row = (Array.isArray(res.data) ? res.data[0] : res.data) as
            | { name?: string; bundle?: unknown; version?: number; shared_at?: string | null }
            | null | undefined;
        if (!row || row.bundle == null) {
            return { ok: false, error: 'Link share tidak ditemukan / sudah dicabut oleh pemiliknya.' };
        }
        const bundle = validateBundle(row.bundle);
        if (!bundle) {
            return { ok: false, error: 'Bundle yang dibagikan rusak / versi tidak dikenal (butuh version 1).' };
        }
        return {
            ok: true,
            data: {
                name: String(row.name ?? bundle.name ?? 'Shared project'),
                bundle,
                version: Number(row.version ?? bundle.version),
                shared_at: row.shared_at ?? null,
            },
        };
    } catch (err) {
        return { ok: false, error: mapError(err) };
    }
}
