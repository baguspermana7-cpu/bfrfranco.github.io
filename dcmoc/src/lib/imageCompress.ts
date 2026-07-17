/* ─── Client-side image compression → WebP ────────────────────────────────────
 * Uploaded hero images are compressed to WebP in the browser (canvas → toBlob)
 * so a multi-MB PNG never gets stored/shipped — keeps the dashboard fast + the
 * dataURL small enough for localStorage. Falls back to the original dataURL if
 * WebP encoding is unavailable.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CompressOpts { maxW?: number; maxH?: number; quality?: number; }

export function compressToWebp(file: File, opts: CompressOpts = {}): Promise<string> {
    const { maxW = 1280, maxH = 1280, quality = 0.82 } = opts;
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) { reject(new Error('not an image')); return; }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read failed'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('decode failed'));
            img.onload = () => {
                let { width, height } = img;
                const scale = Math.min(1, maxW / width, maxH / height);
                width = Math.round(width * scale);
                height = Math.round(height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(String(reader.result)); return; }
                ctx.drawImage(img, 0, 0, width, height);
                try {
                    const webp = canvas.toDataURL('image/webp', quality);
                    // toDataURL returns 'data:image/png' if webp unsupported — accept either.
                    resolve(webp && webp.length > 32 ? webp : String(reader.result));
                } catch {
                    resolve(String(reader.result));
                }
            };
            img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
    });
}

/** Approx byte size of a dataURL (base64) for a size guard/label. */
export function dataUrlBytes(url: string | null): number {
    if (!url) return 0;
    const i = url.indexOf(',');
    const b64 = i >= 0 ? url.slice(i + 1) : url;
    return Math.round(b64.length * 0.75);
}
